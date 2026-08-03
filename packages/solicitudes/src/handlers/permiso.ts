import { NextRequest, NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import {
  TABLES,
  FIELDS,
  FK_ID_CORE,
  ESTADO_PENDIENTE,
  ESTADO_CONCEDIDO,
  PERIODO_ACTUAL,
} from "../lib/schema";
import { TIPO_DIA_PACTO } from "../lib/constants";
import type { ResolvePayload } from "../types";
import { uploadFirmaTrabajador, uploadPdfPermisoPacto } from "@/lib/s3";
import { generarPdfPermisoPacto } from "@/lib/pdf";
import { subirAdjuntoAirtable } from "@/lib/airtable-attachments";

/** Texto que queda como autorizador en los permisos de día de pacto. */
const AUTORIZACION_AUTOMATICA = "Autorización automática — Día de Pacto";

const base = () => process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const key  = () => process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

// Tabla Dias_Pacto
const TABLA_DIAS_PACTO = process.env.AIRTABLE_TABLE_DIAS_PACTO ?? "Dias_Pacto";
const CAMPOS_DIAS_PACTO = {
  ID_COLABORADOR:   "id_colaborador_core",
  SALDO_DISPONIBLE: "saldo_disponible",
  SALDO_USADO:      "saldo_usado",
  PERIODO:          "periodo",
  FECHA_ULTIMO_USO: "fecha_ultimo_uso",
  OBSERVACIONES:    "observaciones",
  ESTADO:           "estado",
};

export function createPermisoHandlers(resolvePayload: ResolvePayload) {
  async function GET() {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const formula = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(payload.idCore)}'`);
    const sort    = encodeURIComponent(FIELDS.PERMISO.FECHA_SOLICITUD);
    const params  = `filterByFormula=${formula}&sort[0][field]=${sort}&sort[0][direction]=desc&maxRecords=20`;
    const res = await fetch(
      `https://api.airtable.com/v0/${base()}/${encodeURIComponent(TABLES.PERMISO)}?${params}`,
      { headers: { Authorization: `Bearer ${key()}` }, cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data.records ?? []);
  }

  async function POST(req: NextRequest) {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body  = await req.json();
    const today = new Date().toISOString().split("T")[0];
    const esDiaPacto = body.tipo === TIPO_DIA_PACTO;

    // Regla de negocio: un día de pacto por solicitud.
    const fechasPacto: string[] = Array.isArray(body.fechasPacto)
      ? (body.fechasPacto as string[]).filter((f) => typeof f === "string" && f)
      : [];

    if (esDiaPacto && fechasPacto.length > 1) {
      return NextResponse.json(
        { error: "Solo puedes solicitar un día de pacto por solicitud" },
        { status: 400 }
      );
    }

    const fechaPacto = fechasPacto[0] ?? (body.fechaInicio as string);

    let pactoRecordId: string | null = null;
    let pactoRecord: { id: string; fields: Record<string, unknown> } | null = null;
    let saldoPactoDisponible = 0;

    // Si es día de pacto, validar saldo y obtener recordId
    if (esDiaPacto) {
      const idCore = escapeAirtableValue(payload.idCore);
      const periodo = escapeAirtableValue(PERIODO_ACTUAL);
      const formulaPacto = encodeURIComponent(
        `AND({${CAMPOS_DIAS_PACTO.ID_COLABORADOR}}='${idCore}', {${CAMPOS_DIAS_PACTO.PERIODO}}='${periodo}')`
      );

      const urlPacto = `https://api.airtable.com/v0/${base()}/${encodeURIComponent(TABLA_DIAS_PACTO)}?filterByFormula=${formulaPacto}`;

      const resPacto = await fetch(urlPacto, {
        headers: { Authorization: `Bearer ${key()}` },
        cache: "no-store",
      });

      if (!resPacto.ok) {
        const error = await resPacto.text();
        console.error("[permiso POST - fetch pacto]", error);
        return NextResponse.json({ error: "Error al consultar días de pacto" }, { status: 500 });
      }

      const dataPacto = await resPacto.json();
      const recordsPacto = dataPacto.records ?? [];

      if (recordsPacto.length === 0) {
        return NextResponse.json(
          { error: "No se encontró registro de días de pacto para este periodo" },
          { status: 404 }
        );
      }

      const record = recordsPacto[0];
      const saldoDisponible = (record.fields[CAMPOS_DIAS_PACTO.SALDO_DISPONIBLE] ?? 0) as number;

      if (saldoDisponible <= 0) {
        return NextResponse.json(
          { error: "No tienes días de pacto disponibles para este periodo" },
          { status: 400 }
        );
      }

      pactoRecord = record;
      pactoRecordId = record.id;
      saldoPactoDisponible = saldoDisponible;
    }

    // Crear permiso en Solicitud_Permiso
    const fields: Record<string, unknown> = {
      [FIELDS.PERMISO.NOMBRE]:          payload.nombre,
      [FIELDS.PERMISO.CEDULA]:          payload.cedula,
      [FIELDS.PERMISO.CARGO]:           body.cargo ?? "",
      [FK_ID_CORE]:                     payload.idCore,
      [FIELDS.PERMISO.FECHA_SOLICITUD]: today,
      [FIELDS.PERMISO.FECHA_INICIO]:    esDiaPacto ? fechaPacto : body.fechaInicio,
      [FIELDS.PERMISO.TIPO]:            body.tipo,
      [FIELDS.PERMISO.MOTIVO]:          body.motivo,
      [FIELDS.PERMISO.HORAS]:           body.horas ? String(body.horas) : "",
      [FIELDS.PERMISO.REMUNERADO]:      body.remunerado ?? false,
      [FIELDS.PERMISO.COMPENSADO]:      body.compensado ?? false,
      // Los días de pacto son un beneficio ya concedido: quedan autorizados al radicarse.
      [FIELDS.PERMISO.ESTADO]:          esDiaPacto ? ESTADO_CONCEDIDO : ESTADO_PENDIENTE,
    };

    if (esDiaPacto) {
      fields[FIELDS.PERMISO.FECHA_AUTORIZACION] = today;
      fields[FIELDS.PERMISO.AUTORIZADO_POR_NOM] = AUTORIZACION_AUTOMATICA;
      fields[FIELDS.PERMISO.COMENTARIO_AUTORIZACION] =
        "Día de pacto: beneficio ya concedido, no requiere autorización de jefatura.";
    }

    // Un día de pacto por solicitud: nunca lleva rango inicio–fin.
    if (body.fechaFin && !esDiaPacto) fields[FIELDS.PERMISO.FECHA_FIN] = body.fechaFin;
    if (body.fechaCompensatorio) fields[FIELDS.PERMISO.FECHA_COMP] = body.fechaCompensatorio;
    if (esDiaPacto && pactoRecordId) {
      fields[FIELDS.PERMISO.DIAS_PACTO_LINK] = [pactoRecordId];  // Relación: array de record IDs
    }

    // Firma del trabajador - Upload a S3
    if (body.firmaBase64) {
      try {
        const uploadResult = await uploadFirmaTrabajador({
          base64: body.firmaBase64,
          cedula: payload.cedula,
          idCore: payload.idCore,
          tipo: "permiso",
          metadata: {
            tipoPermiso: body.tipo,
            fechaSolicitud: today,
          },
        });

        // Guardar referencia S3 en Airtable (NO el base64).
        // Firma_Trabajador es el gemelo en texto largo del mismo dato: guarda la
        // S3 key, no el PNG. El adjunto se sube aparte, ya con el recordId.
        fields[FIELDS.PERMISO.FIRMA_S3_KEY] = uploadResult.s3Key;
        fields[FIELDS.PERMISO.FIRMA_TRAB_TEXTO] = uploadResult.s3Key;
        fields[FIELDS.PERMISO.FECHA_FIRMA_TRAB] = uploadResult.uploadedAt;
      } catch (error) {
        console.error("[permiso POST - S3 upload]", error);
        return NextResponse.json(
          { error: "Error al guardar firma digital" },
          { status: 500 }
        );
      }
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${base()}/${encodeURIComponent(TABLES.PERMISO)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("[solicitudes/permiso POST]", err);
      return NextResponse.json({ error: "Error al guardar en Airtable." }, { status: 500 });
    }

    const permisoCreado = await res.json();

    // Gemelo adjunto de la firma: Firma_Trabajador_Base64 solo se puede llenar
    // con el recordId ya creado. Es comodidad de consulta dentro de Airtable —
    // la referencia canónica es la S3 key, así que un fallo no bloquea.
    if (body.firmaBase64) {
      await subirAdjuntoAirtable({
        baseId: base(),
        apiKey: key(),
        recordId: permisoCreado.id,
        campo: FIELDS.PERMISO.FIRMA_TRAB_ADJUNTO,
        contenido: Buffer.from(body.firmaBase64, "base64"),
        filename: `firma_trabajador_${payload.idCore}.png`,
        contentType: "image/png",
      });
    }

    // Si es día de pacto, actualizar saldo en Dias_Pacto
    if (esDiaPacto && pactoRecord) {
      const saldoDisponible = (pactoRecord.fields[CAMPOS_DIAS_PACTO.SALDO_DISPONIBLE] ?? 0) as number;
      const saldoUsado = (pactoRecord.fields[CAMPOS_DIAS_PACTO.SALDO_USADO] ?? 0) as number;
      const observacionesActuales = (pactoRecord.fields[CAMPOS_DIAS_PACTO.OBSERVACIONES] ?? "") as string;

      const nuevoSaldoDisponible = saldoDisponible - 1;
      const nuevoSaldoUsado = saldoUsado + 1;
      const nuevoEstado = nuevoSaldoDisponible <= 0 ? "Agotado" : "Activo";

      const nuevaObservacion = `${fechaPacto}: Permiso ${permisoCreado.id} - ${body.motivo || "Día de pacto"}`;
      const observacionesActualizadas = observacionesActuales
        ? `${observacionesActuales}\n${nuevaObservacion}`
        : nuevaObservacion;

      const urlPatchPacto = `https://api.airtable.com/v0/${base()}/${encodeURIComponent(TABLA_DIAS_PACTO)}/${pactoRecord.id}`;

      const resPatchPacto = await fetch(urlPatchPacto, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            [CAMPOS_DIAS_PACTO.SALDO_DISPONIBLE]: nuevoSaldoDisponible,
            [CAMPOS_DIAS_PACTO.SALDO_USADO]: nuevoSaldoUsado,
            [CAMPOS_DIAS_PACTO.FECHA_ULTIMO_USO]: fechaPacto,
            [CAMPOS_DIAS_PACTO.OBSERVACIONES]: observacionesActualizadas,
            [CAMPOS_DIAS_PACTO.ESTADO]: nuevoEstado,
          },
        }),
      });

      if (!resPatchPacto.ok) {
        const errorPacto = await resPatchPacto.text();
        console.error("[permiso POST - update pacto]", errorPacto);
        // No revertimos el permiso - mejor log del error y notificar a admin
        console.error(`IMPORTANTE: Permiso ${permisoCreado.id} creado pero no se pudo actualizar días de pacto ${pactoRecord.id}`);
      }
    }

    // Día de pacto: el permiso nace autorizado, así que se emite el PDF y se
    // archiva en S3. Un fallo aquí no invalida el permiso ya registrado.
    let pdfUrl: string | null = null;

    if (esDiaPacto) {
      try {
        const pdf = await generarPdfPermisoPacto({
          solicitudId: permisoCreado.id,
          nombre: payload.nombre,
          cedula: payload.cedula,
          cargo: body.cargo ?? "",
          idCore: payload.idCore,
          fechaPermiso: fechaPacto,
          fechaSolicitud: today,
          motivo: body.motivo ?? "",
          periodo: PERIODO_ACTUAL,
          saldoRestante: Math.max(0, saldoPactoDisponible - 1),
          firmaBase64: body.firmaBase64,
        });

        const subida = await uploadPdfPermisoPacto({
          pdf,
          cedula: payload.cedula,
          idCore: payload.idCore,
          fechaPermiso: fechaPacto,
          metadata: {
            solicitudId: permisoCreado.id,
            periodo: PERIODO_ACTUAL,
            nombre: payload.nombre,
          },
        });

        pdfUrl = subida.url;

        // Enlace estable al documento: /api/documentos resuelve una URL firmada
        // fresca en cada visita, porque el objeto de S3 es privado.
        const enlace = `${req.nextUrl.origin}/api/documentos/permiso/${permisoCreado.id}`;

        const resPdf = await fetch(
          `https://api.airtable.com/v0/${base()}/${encodeURIComponent(TABLES.PERMISO)}/${permisoCreado.id}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              fields: {
                [FIELDS.PERMISO.URL_PDF]: subida.url,
                [FIELDS.PERMISO.NOMBRE_ARCHIVO]: subida.filename,
                [FIELDS.PERMISO.HASH_DOCUMENTO]: subida.sha256,
                // Gemelos que llena /api/solicitudes/autorizar en los permisos
                // normales. PDF_Autorizacion_S3_Key es además el campo que lee
                // /api/documentos para firmar la URL.
                [FIELDS.PERMISO.PDF_AUTORIZACION_URL]: enlace,
                [FIELDS.PERMISO.PDF_AUTORIZACION_S3_KEY]: subida.s3Key,
                [FIELDS.PERMISO.REVISADO]: true,
              },
            }),
          }
        );

        if (!resPdf.ok) {
          console.error("[permiso POST - patch pdf]", await resPdf.text());
          console.error(
            `IMPORTANTE: PDF ${subida.s3Key} archivado pero no se pudo referenciar en el permiso ${permisoCreado.id}`
          );
        }

        // Gemelo adjunto del documento, igual que en el flujo de autorización.
        await subirAdjuntoAirtable({
          baseId: base(),
          apiKey: key(),
          recordId: permisoCreado.id,
          campo: FIELDS.PERMISO.PDF_FIRMADO,
          contenido: Buffer.from(pdf),
          filename: subida.filename,
          contentType: "application/pdf",
        });
      } catch (error) {
        console.error("[permiso POST - pdf dia de pacto]", error);
        console.error(
          `IMPORTANTE: Permiso ${permisoCreado.id} autorizado pero sin PDF archivado en S3`
        );
      }
    }

    return NextResponse.json(
      { ok: true, id: permisoCreado.id, autorizado: esDiaPacto, pdfUrl },
      { status: 201 }
    );
  }

  return { GET, POST };
}
