import { NextRequest, NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import { FIELDS, FK_ID_CORE, ESTADO_PENDIENTE } from "../lib/schema";
import { TIPO_HORAS_EXTRA, TIPO_NOVEDAD_OTRA } from "../lib/constants";
import { resolverAirtable } from "../infra";
import type { OpcionesHandlers } from "../types";

export function createNovedadesHandlers(opciones: OpcionesHandlers) {
  const { resolvePayload, airtable } = opciones;

  async function GET() {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const formula = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(payload.idCore)}'`);
    const sort    = encodeURIComponent(FIELDS.NOVEDADES.FECHA_CREACION);
    const params  = `filterByFormula=${formula}&sort[0][field]=${sort}&sort[0][direction]=desc&maxRecords=20`;
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.novedades)}?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );

    // ⚠️ No basta con leer `records`: la respuesta de error de Airtable no lo trae,
    // y devolverla como lista vacía le dice al colaborador «no tienes solicitudes»
    // cuando lo que pasa es que la credencial no alcanza o la tabla no es esa. Así
    // se escondió una API key sin acceso a la base durante toda una integración.
    if (!res.ok) {
      console.error("[solicitudes/novedades GET]", await res.text());
      return NextResponse.json({ error: "Error al consultar Airtable" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data.records ?? []);
  }

  async function POST(req: NextRequest) {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);
    const body = await req.json();

    // La tabla no tiene un campo para el tipo escrito a mano: cuando el
    // colaborador elige «Otra», su texto va dentro de `Tipo de Novedad`. Sin esto
    // el detalle se perdería y el registro solo diría «Otra».
    const tipo =
      body.tipo === TIPO_NOVEDAD_OTRA && body.otraTipo
        ? `${TIPO_NOVEDAD_OTRA}: ${body.otraTipo}`
        : body.tipo;

    const fields: Record<string, unknown> = {
      [FK_ID_CORE]:                   payload.idCore,
      [FIELDS.NOVEDADES.EMPLEADO]:    payload.nombre,
      [FIELDS.NOVEDADES.TIPO]:        tipo,
      [FIELDS.NOVEDADES.DESCRIPCION]: body.descripcion,
      [FIELDS.NOVEDADES.ESTADO]:      ESTADO_PENDIENTE,
    };

    if (body.tipo === TIPO_HORAS_EXTRA && body.horasExtra) {
      fields[FIELDS.NOVEDADES.HORAS_EXTRA] = Number(body.horasExtra);
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.novedades)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("[solicitudes/novedades POST]", err);
      return NextResponse.json({ error: "Error al guardar en Airtable." }, { status: 500 });
    }

    const record = await res.json();
    return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
  }

  return { GET, POST };
}
