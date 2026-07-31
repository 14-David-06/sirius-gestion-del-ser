import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { validarPermisoAutorizacion, type TipoSolicitud } from "@/lib/permisos";
import {
  uploadFirmaTrabajador,
  uploadPdfAutorizacion,
  descargarObjetoS3,
} from "@/lib/s3";
import { generarPdfAutorizacion, formatearFechaLarga } from "@/lib/pdf";
import { subirAdjuntoAirtable } from "@/lib/airtable-attachments";
import { obtenerEmpleadoPorRecordId } from "@/lib/empleados";
import {
  TABLES,
  FIELDS,
  FIELDS_AUTORIZACION,
  FK_ID_CORE,
} from "@/lib/airtable-schema";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

/**
 * Solo permisos y vacaciones pasan por autorizacion. Las novedades de nomina son
 * un registro informativo del colaborador: no se aprueban ni se rechazan, asi
 * que este endpoint las rechaza explicitamente.
 */
type Tabla = "permiso" | "vacaciones";

/**
 * Fecha actual en zona horaria de Colombia, formato YYYY-MM-DD.
 * `new Date().toISOString()` devuelve UTC: después de las 19:00 en Bogotá
 * daría el día siguiente.
 */
function fechaHoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface DiaCompensacion {
  fecha: string;
  horas: number;
  descripcion: string;
}

interface AutorizarBody {
  tabla: Tabla;
  recordId: string;
  accion: "aprobar" | "rechazar";
  comentario?: string;
  firmaBase64?: string;
  // Campos específicos para permisos
  remunerado?: boolean;
  compensado?: boolean;
  diasCompensacion?: DiaCompensacion[];
}

const texto = (valor: unknown): string =>
  valor === null || valor === undefined || valor === "" ? "—" : String(valor).trim();

const fecha = (valor: unknown): string =>
  typeof valor === "string" && valor ? formatearFechaLarga(valor.slice(0, 10)) : "—";

/** Detalle del PDF según el tipo de solicitud. */
function detallesSolicitud(
  tabla: Tabla,
  f: Record<string, unknown>,
): { etiqueta: string; valor: string }[] {
  if (tabla === "permiso") {
    return [
      { etiqueta: "Tipo de permiso", valor: texto(f[FIELDS.PERMISO.TIPO]) },
      { etiqueta: "Horas solicitadas", valor: texto(f[FIELDS.PERMISO.HORAS]) },
      { etiqueta: "Desde", valor: fecha(f[FIELDS.PERMISO.FECHA_INICIO]) },
      { etiqueta: "Hasta", valor: fecha(f[FIELDS.PERMISO.FECHA_FIN] ?? f[FIELDS.PERMISO.FECHA_INICIO]) },
      { etiqueta: "Fecha de solicitud", valor: fecha(f[FIELDS.PERMISO.FECHA_SOLICITUD]) },
    ];
  }

  return [
    { etiqueta: "Fecha de inicio", valor: fecha(f[FIELDS.VACACIONES.FECHA_INICIO]) },
    { etiqueta: "Fecha de fin", valor: fecha(f[FIELDS.VACACIONES.FECHA_FIN]) },
    { etiqueta: "Fecha de reintegro", valor: fecha(f[FIELDS.VACACIONES.FECHA_REINTEGRO]) },
    { etiqueta: "Días de vacaciones", valor: texto(f[FIELDS.VACACIONES.DIAS]) },
    { etiqueta: "Fecha de presentación", valor: fecha(f[FIELDS.VACACIONES.FECHA_PRESENTACION]) },
  ];
}

/** S3 key de la firma del trabajador, si la solicitud la tiene. */
function firmaTrabajadorKey(tabla: Tabla, f: Record<string, unknown>): string | null {
  const campo =
    tabla === "permiso" ? FIELDS.PERMISO.FIRMA_S3_KEY : FIELDS.VACACIONES.FIRMA_S3_KEY;
  const valor = f[campo];
  return typeof valor === "string" && valor ? valor : null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticación
    const token = (await cookies()).get("sirius-auth")?.value;
    const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;

    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Parsear body
    const body: AutorizarBody = await req.json();
    const { tabla, recordId, accion, comentario, firmaBase64, remunerado, compensado, diasCompensacion } = body;

    if (!tabla || !recordId || !accion) {
      return NextResponse.json(
        { error: "Campos requeridos: tabla, recordId, accion" },
        { status: 400 }
      );
    }

    if (tabla !== "permiso" && tabla !== "vacaciones") {
      return NextResponse.json(
        {
          error:
            "Solo los permisos y las vacaciones se autorizan. Las novedades de nómina son un registro informativo.",
        },
        { status: 400 }
      );
    }

    if (!firmaBase64) {
      return NextResponse.json(
        { error: "La firma digital es obligatoria para autorizar" },
        { status: 400 }
      );
    }

    if (accion === "rechazar" && !comentario?.trim()) {
      return NextResponse.json(
        { error: "El comentario es obligatorio al rechazar una solicitud" },
        { status: 400 }
      );
    }

    // 3. Obtener registro de la solicitud
    const tablaMap: Record<Tabla, string> = {
      permiso: TABLES.PERMISO,
      vacaciones: TABLES.VACACIONES
    };

    const nombreTabla = tablaMap[tabla];
    const urlRecord = `https://api.airtable.com/v0/${BASE_ID_NOVEDADES}/${encodeURIComponent(nombreTabla)}/${recordId}`;

    const resRecord = await fetch(urlRecord, {
      headers: { Authorization: `Bearer ${API_KEY_NOVEDADES}` }
    });

    if (!resRecord.ok) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const dataRecord = await resRecord.json();
    const campos: Record<string, unknown> = dataRecord.fields ?? {};

    // 4. Determinar tipo de solicitud para validación
    const tipoSolicitud: TipoSolicitud = tabla === "permiso" ? "Permiso" : "Vacaciones";

    // 5. Validar permisos de autorización
    const solicitudIdCore = campos[FK_ID_CORE] as string;

    const validacion = await validarPermisoAutorizacion({
      autorizadorId: payload.sub,
      tipoSolicitud,
      solicitudIdCore
    });

    if (!validacion.puede) {
      return NextResponse.json(
        { error: validacion.razon || "No tiene permisos para autorizar esta solicitud" },
        { status: 403 }
      );
    }

    // 6. Upload firma del autorizador a S3
    const firmaAutorizador = await uploadFirmaTrabajador({
      base64: firmaBase64,
      cedula: payload.cedula,
      idCore: payload.idCore,
      tipo: `autorizacion-${tabla}`,
      metadata: {
        recordId,
        tabla,
        accion,
        autorizador: payload.nombre,
        fecha: new Date().toISOString()
      }
    });

    // 7. Determinar nuevo estado según acción y tabla
    const campoEstado =
      tabla === "permiso" ? FIELDS.PERMISO.ESTADO : FIELDS.VACACIONES.ESTADO;
    const nuevoEstado =
      accion === "rechazar" ? "Rechazado" : tabla === "permiso" ? "Concedido" : "Aprobado";

    // 8. Preparar campos de actualización
    const fechaAutorizacion = fechaHoyBogota();
    const diasValidos = (diasCompensacion ?? []).filter((d) => d.fecha && d.horas > 0);

    const fieldsUpdate: Record<string, unknown> = {
      [campoEstado]: nuevoEstado,
      [FIELDS_AUTORIZACION.AUTORIZADO_POR_ID]: payload.sub,
      [FIELDS_AUTORIZACION.AUTORIZADO_POR_NOM]: payload.nombre,
      [FIELDS_AUTORIZACION.FECHA]: fechaAutorizacion,
      [FIELDS_AUTORIZACION.FIRMA_S3_KEY]: firmaAutorizador.s3Key,
      // Fecha_Firma_Autorizador es tipo `date` en Airtable (sin hora):
      // rechaza un ISO con hora como el de firmaAutorizador.uploadedAt.
      [FIELDS_AUTORIZACION.FECHA_FIRMA]: fechaAutorizacion
    };

    if (comentario?.trim()) {
      fieldsUpdate[FIELDS_AUTORIZACION.COMENTARIO] = comentario.trim();
    }

    // Campos específicos de permisos
    if (tabla === "permiso" && accion === "aprobar") {
      if (remunerado !== undefined) {
        fieldsUpdate[FIELDS.PERMISO.REMUNERADO] = remunerado;
      }
      if (compensado !== undefined) {
        fieldsUpdate[FIELDS.PERMISO.COMPENSADO] = compensado;
      }
      if (compensado && diasValidos.length > 0) {
        // Serializar días de compensación como JSON
        fieldsUpdate[FIELDS.PERMISO.DIAS_COMPENSACION] = JSON.stringify(diasValidos);
        // El campo nativo de Airtable solo admite una fecha: se usa la primera
        fieldsUpdate[FIELDS.PERMISO.FECHA_COMP] = diasValidos
          .map((d) => d.fecha)
          .sort()[0];
      }
    }

    // 9. Generar el documento oficial y archivarlo en S3.
    //    Si algo falla aquí la decisión igual se registra: el documento se puede
    //    regenerar, pero perder la autorización obligaría a repetir el trámite.
    let documento: { url: string; s3Key: string; filename: string; sha256: string } | null = null;
    let avisoDocumento: string | null = null;
    let pdfBytes: Uint8Array | null = null;

    try {
      const autorizador = await obtenerEmpleadoPorRecordId(payload.sub);
      const firmaKey = firmaTrabajadorKey(tabla, campos);

      pdfBytes = await generarPdfAutorizacion({
        tipo: tabla,
        solicitudId: recordId,
        decision: accion,
        estado: nuevoEstado,
        solicitante: {
          nombre: (campos[FIELDS.PERMISO.NOMBRE] as string) ?? "",
          cedula: (campos[FIELDS.PERMISO.CEDULA] as string) ?? "",
          cargo: (campos[FIELDS.PERMISO.CARGO] as string) ?? "",
          idCore: solicitudIdCore ?? "",
        },
        detalles: detallesSolicitud(tabla, campos),
        motivo:
          (campos[
            tabla === "permiso" ? FIELDS.PERMISO.MOTIVO : FIELDS.VACACIONES.MOTIVO
          ] as string) ?? "",
        comentario: comentario?.trim(),
        remunerado,
        compensado,
        diasCompensacion: diasValidos,
        autorizador: {
          nombre: payload.nombre,
          cedula: payload.cedula,
          cargo: autorizador?.cargo ?? "",
        },
        fechaAutorizacion,
        firmaTrabajador: firmaKey ? await descargarObjetoS3(firmaKey) : null,
        firmaAutorizador: Buffer.from(firmaBase64, "base64"),
      });

      documento = await uploadPdfAutorizacion({
        pdf: pdfBytes,
        tipo: tabla,
        idCore: payload.idCore,
        recordId,
        fechaAutorizacion,
        metadata: { estado: nuevoEstado, autorizador: payload.nombre },
      });

      // Enlace estable al documento: resuelve una URL firmada fresca en cada
      // visita, porque el objeto de S3 es privado y las URLs firmadas expiran.
      const enlace = `${req.nextUrl.origin}/api/documentos/${tabla}/${recordId}`;

      // Los campos del documento van en PDF_Autorizacion_*, nunca en
      // Archivo_Generado / Nombre_Archivo: esos guardan los documentos HTML del
      // sistema anterior y sobreescribirlos perdería ese historial.
      if (tabla === "permiso") {
        fieldsUpdate[FIELDS.PERMISO.PDF_AUTORIZACION_URL] = enlace;
        fieldsUpdate[FIELDS.PERMISO.PDF_AUTORIZACION_S3_KEY] = documento.s3Key;
        fieldsUpdate[FIELDS.PERMISO.HASH_DOCUMENTO] = documento.sha256;
        fieldsUpdate[FIELDS.PERMISO.REVISADO] = true;
        fieldsUpdate[FIELDS.PERMISO.FIRMANTE_APROB_NOMBRE] = payload.nombre;
        fieldsUpdate[FIELDS.PERMISO.FIRMANTE_APROB_CEDULA] = payload.cedula;
        fieldsUpdate[FIELDS.PERMISO.FIRMANTE_APROB_CARGO] = autorizador?.cargo ?? "";
        // Fecha_Firma_Aprobador sí es dateTime: acepta el ISO completo
        fieldsUpdate[FIELDS.PERMISO.FECHA_FIRMA_APROBADOR] = firmaAutorizador.uploadedAt;
      } else {
        fieldsUpdate[FIELDS.VACACIONES.PDF_AUTORIZACION_URL] = enlace;
        fieldsUpdate[FIELDS.VACACIONES.PDF_AUTORIZACION_S3_KEY] = documento.s3Key;
        fieldsUpdate[FIELDS.VACACIONES.HASH_DOCUMENTO] = documento.sha256;
      }
    } catch (error) {
      console.error("[autorizar] No se pudo generar el documento oficial:", error);
      avisoDocumento =
        "La autorización quedó registrada, pero el documento oficial no se pudo generar.";
    }

    // 10. Actualizar registro en Airtable
    const resUpdate = await fetch(urlRecord, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${API_KEY_NOVEDADES}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: fieldsUpdate })
    });

    if (!resUpdate.ok) {
      const error = await resUpdate.text();
      return NextResponse.json(
        { error: `Error al actualizar solicitud: ${error}` },
        { status: 500 }
      );
    }

    const dataUpdate = await resUpdate.json();

    // 11. Adjuntar el PDF y la firma en Airtable (comodidad de consulta —
    //     la referencia canónica sigue siendo S3, así que no bloquea).
    if (pdfBytes && documento) {
      const adjuntos: Promise<boolean>[] = [];

      if (tabla === "permiso") {
        adjuntos.push(
          subirAdjuntoAirtable({
            baseId: BASE_ID_NOVEDADES,
            apiKey: API_KEY_NOVEDADES,
            recordId,
            campo: FIELDS.PERMISO.PDF_FIRMADO,
            contenido: Buffer.from(pdfBytes),
            filename: documento.filename,
            contentType: "application/pdf",
          }),
          subirAdjuntoAirtable({
            baseId: BASE_ID_NOVEDADES,
            apiKey: API_KEY_NOVEDADES,
            recordId,
            campo: FIELDS.PERMISO.FIRMA_APROBADOR,
            contenido: Buffer.from(firmaBase64, "base64"),
            filename: `firma_autorizador_${payload.idCore}.png`,
            contentType: "image/png",
          }),
        );
      } else {
        adjuntos.push(
          subirAdjuntoAirtable({
            baseId: BASE_ID_NOVEDADES,
            apiKey: API_KEY_NOVEDADES,
            recordId,
            campo: FIELDS.VACACIONES.FIRMA_GESTION,
            contenido: Buffer.from(firmaBase64, "base64"),
            filename: `firma_autorizador_${payload.idCore}.png`,
            contentType: "image/png",
          }),
        );
      }

      await Promise.allSettled(adjuntos);
    }

    // 12. Retornar resultado
    return NextResponse.json({
      ok: true,
      estado: nuevoEstado,
      autorizadoPor: payload.nombre,
      fecha: fechaAutorizacion,
      firmaS3Key: firmaAutorizador.s3Key,
      documento: documento
        ? { url: documento.url, nombre: documento.filename, hash: documento.sha256 }
        : null,
      aviso: avisoDocumento,
      record: dataUpdate
    });

  } catch (error: unknown) {
    console.error("Error en /api/solicitudes/autorizar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
