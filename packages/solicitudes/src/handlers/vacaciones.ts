import { NextRequest, NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import { FIELDS, FK_ID_CORE } from "../lib/schema";
import { resolverAirtable } from "../infra";
import type { OpcionesHandlers } from "../types";

export function createVacacionesHandlers(opciones: OpcionesHandlers) {
  const { resolvePayload, infra, airtable } = opciones;

  async function GET() {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const formula = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(payload.idCore)}'`);
    const sort    = encodeURIComponent(FIELDS.VACACIONES.FECHA_PRESENTACION);
    const params  = `filterByFormula=${formula}&sort[0][field]=${sort}&sort[0][direction]=desc&maxRecords=20`;
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.vacaciones)}?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );

    // ⚠️ No basta con leer `records`: la respuesta de error de Airtable no lo trae,
    // y devolverla como lista vacía le dice al colaborador «no tienes solicitudes»
    // cuando lo que pasa es que la credencial no alcanza o la tabla no es esa. Así
    // se escondió una API key sin acceso a la base durante toda una integración.
    if (!res.ok) {
      console.error("[solicitudes/vacaciones GET]", await res.text());
      return NextResponse.json({ error: "Error al consultar Airtable" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data.records ?? []);
  }

  async function POST(req: NextRequest) {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const body  = await req.json();
    const today = new Date().toISOString().split("T")[0];

    const fields: Record<string, unknown> = {
      [FIELDS.VACACIONES.NOMBRE]:             payload.nombre,
      [FIELDS.VACACIONES.CEDULA]:             payload.cedula,
      [FIELDS.VACACIONES.CARGO]:              body.cargo ?? "",
      [FK_ID_CORE]:                           payload.idCore,
      [FIELDS.VACACIONES.FECHA_PRESENTACION]: today,
      [FIELDS.VACACIONES.FECHA_INICIO]:       body.fechaInicio,
      [FIELDS.VACACIONES.FECHA_FIN]:          body.fechaFin,
      [FIELDS.VACACIONES.DIAS]:               body.dias ?? 0,
      [FIELDS.VACACIONES.MOTIVO]:             body.motivo ?? "",
    };

    if (body.fechaReintegro) fields[FIELDS.VACACIONES.FECHA_REINTEGRO] = body.fechaReintegro;

    // Firma del trabajador — la archiva la app (ver ../infra). Sin adaptador no
    // se guarda a medias: el PNG no puede terminar en un campo de Airtable.
    if (body.firmaBase64) {
      if (!infra?.guardarFirma) {
        console.error("[vacaciones POST] falta infra.guardarFirma");
        return NextResponse.json(
          { error: "Error al guardar firma digital" },
          { status: 500 }
        );
      }

      try {
        const firma = await infra.guardarFirma({
          base64: body.firmaBase64,
          cedula: payload.cedula,
          idCore: payload.idCore,
          tipo: "vacaciones",
          metadata: {
            fechaInicio: body.fechaInicio,
            fechaFin: body.fechaFin,
            dias: String(body.dias ?? ""),
            fechaSolicitud: today,
          },
        });

        // Solo la referencia, nunca el base64.
        fields[FIELDS.VACACIONES.FIRMA_S3_KEY] = firma.key;
        fields[FIELDS.VACACIONES.FECHA_FIRMA_TRAB] = firma.archivadaEn;
      } catch (error) {
        console.error("[vacaciones POST - archivar firma]", error);
        return NextResponse.json(
          { error: "Error al guardar firma digital" },
          { status: 500 }
        );
      }
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.vacaciones)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("[solicitudes/vacaciones POST]", err);
      return NextResponse.json({ error: "Error al guardar en Airtable." }, { status: 500 });
    }

    const record = await res.json();
    return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
  }

  return { GET, POST };
}
