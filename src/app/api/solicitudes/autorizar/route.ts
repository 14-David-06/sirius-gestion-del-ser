import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { validarPermisoAutorizacion, type TipoSolicitud } from "@/lib/permisos";
import { uploadFirmaTrabajador } from "@/lib/s3";
import {
  TABLES,
  FIELDS,
  FIELDS_AUTORIZACION,
  FK_ID_CORE,
} from "@/lib/airtable-schema";
import { TIPO_HORAS_EXTRA } from "@/lib/constants";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

interface AutorizarBody {
  tabla: "permiso" | "vacaciones" | "novedades";
  recordId: string;
  accion: "aprobar" | "rechazar";
  comentario?: string;
  firmaBase64?: string;
  // Campos específicos para permisos
  remunerado?: boolean;
  compensado?: boolean;
  diasCompensacion?: Array<{
    fecha: string;
    horas: number;
    descripcion: string;
  }>;
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

    if (!firmaBase64) {
      return NextResponse.json(
        { error: "La firma digital es obligatoria para autorizar" },
        { status: 400 }
      );
    }

    // 3. Obtener registro de la solicitud
    const tablaMap: Record<string, string> = {
      permiso: TABLES.PERMISO,
      vacaciones: TABLES.VACACIONES,
      novedades: TABLES.NOVEDADES
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

    // 4. Determinar tipo de solicitud para validación
    let tipoSolicitud: TipoSolicitud;

    if (tabla === "permiso") {
      tipoSolicitud = "Permiso";
    } else if (tabla === "vacaciones") {
      tipoSolicitud = "Vacaciones";
    } else {
      // Para novedades, obtener el tipo específico.
      // El campo es texto libre y llega con espacios/plurales ("Horas Extra ", "Horas Extras").
      const tipoNovedad = String(dataRecord.fields[FIELDS.NOVEDADES.TIPO] ?? "").trim().toLowerCase();
      tipoSolicitud = tipoNovedad.startsWith(TIPO_HORAS_EXTRA.toLowerCase())
        ? TIPO_HORAS_EXTRA
        : "Novedad Nómina";
    }

    // 5. Validar permisos de autorización
    const solicitudIdCore = dataRecord.fields[FK_ID_CORE];

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
    const uploadResult = await uploadFirmaTrabajador({
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
    let campoEstado: string;
    let nuevoEstado: string;

    if (tabla === "permiso") {
      campoEstado = FIELDS.PERMISO.ESTADO;
      nuevoEstado = accion === "aprobar" ? "Concedido" : "Rechazado";
    } else if (tabla === "vacaciones") {
      campoEstado = FIELDS.VACACIONES.ESTADO;
      nuevoEstado = accion === "aprobar" ? "Aprobado" : "Rechazado";
    } else {
      campoEstado = FIELDS.NOVEDADES.ESTADO;
      nuevoEstado = accion === "aprobar" ? "Autorizado" : "No autorizado";
    }

    // 8. Preparar campos de actualización
    const fechaAutorizacion = new Date().toISOString().split('T')[0];
    const fieldsUpdate: Record<string, unknown> = {
      [campoEstado]: nuevoEstado,
      [FIELDS_AUTORIZACION.AUTORIZADO_POR_ID]: payload.sub,
      [FIELDS_AUTORIZACION.AUTORIZADO_POR_NOM]: payload.nombre,
      [FIELDS_AUTORIZACION.FECHA]: fechaAutorizacion,
      [FIELDS_AUTORIZACION.FIRMA_S3_KEY]: uploadResult.s3Key,
      [FIELDS_AUTORIZACION.FECHA_FIRMA]: uploadResult.uploadedAt
    };

    if (comentario) {
      fieldsUpdate[FIELDS_AUTORIZACION.COMENTARIO] = comentario;
    }

    // Campos específicos de permisos
    if (tabla === "permiso" && accion === "aprobar") {
      if (remunerado !== undefined) {
        fieldsUpdate[FIELDS.PERMISO.REMUNERADO] = remunerado;
      }
      if (compensado !== undefined) {
        fieldsUpdate[FIELDS.PERMISO.COMPENSADO] = compensado;
      }
      if (compensado && diasCompensacion && diasCompensacion.length > 0) {
        // Serializar días de compensación como JSON
        fieldsUpdate["Dias_Compensacion_Detalle"] = JSON.stringify(diasCompensacion);
      }
    }

    // 9. Actualizar registro en Airtable
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

    // 10. Retornar resultado
    return NextResponse.json({
      ok: true,
      estado: nuevoEstado,
      autorizadoPor: payload.nombre,
      fecha: fechaAutorizacion,
      firmaS3Key: uploadResult.s3Key,
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
