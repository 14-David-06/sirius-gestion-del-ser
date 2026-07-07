import { NextRequest, NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import { TABLES, FIELDS, FK_ID_CORE, ESTADO_PENDIENTE, PERIODO_ACTUAL } from "../lib/schema";
import { TIPO_DIA_PACTO } from "../lib/constants";
import type { ResolvePayload } from "../types";
import { uploadFirmaTrabajador } from "@/lib/s3";

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

    let pactoRecordId: string | null = null;
    let pactoRecord: { id: string; fields: Record<string, unknown> } | null = null;

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
    }

    // Crear permiso en Solicitud_Permiso
    const fields: Record<string, unknown> = {
      [FIELDS.PERMISO.NOMBRE]:          payload.nombre,
      [FIELDS.PERMISO.CEDULA]:          payload.cedula,
      [FIELDS.PERMISO.CARGO]:           body.cargo ?? "",
      [FK_ID_CORE]:                     payload.idCore,
      [FIELDS.PERMISO.FECHA_SOLICITUD]: today,
      [FIELDS.PERMISO.FECHA_INICIO]:    body.fechaInicio,
      [FIELDS.PERMISO.TIPO]:            body.tipo,
      [FIELDS.PERMISO.MOTIVO]:          body.motivo,
      [FIELDS.PERMISO.HORAS]:           body.horas ? String(body.horas) : "",
      [FIELDS.PERMISO.REMUNERADO]:      body.remunerado ?? false,
      [FIELDS.PERMISO.COMPENSADO]:      body.compensado ?? false,
      [FIELDS.PERMISO.ESTADO]:          ESTADO_PENDIENTE,
    };

    if (body.fechaFin)          fields[FIELDS.PERMISO.FECHA_FIN]  = body.fechaFin;
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

        // Guardar referencia S3 en Airtable (NO el base64)
        fields[FIELDS.PERMISO.FIRMA_S3_KEY] = uploadResult.s3Key;
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

    // Si es día de pacto, actualizar saldo en Dias_Pacto
    if (esDiaPacto && pactoRecord) {
      const saldoDisponible = (pactoRecord.fields[CAMPOS_DIAS_PACTO.SALDO_DISPONIBLE] ?? 0) as number;
      const saldoUsado = (pactoRecord.fields[CAMPOS_DIAS_PACTO.SALDO_USADO] ?? 0) as number;
      const observacionesActuales = (pactoRecord.fields[CAMPOS_DIAS_PACTO.OBSERVACIONES] ?? "") as string;

      const nuevoSaldoDisponible = saldoDisponible - 1;
      const nuevoSaldoUsado = saldoUsado + 1;
      const nuevoEstado = nuevoSaldoDisponible === 0 ? "Agotado" : "Activo";

      const nuevaObservacion = `${body.fechaInicio}: Permiso ${permisoCreado.id} - ${body.motivo || "Día de pacto"}`;
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
            [CAMPOS_DIAS_PACTO.FECHA_ULTIMO_USO]: body.fechaInicio,
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

    return NextResponse.json({ ok: true, id: permisoCreado.id }, { status: 201 });
  }

  return { GET, POST };
}
