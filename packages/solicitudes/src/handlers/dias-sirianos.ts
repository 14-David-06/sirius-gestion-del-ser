/**
 * Saldo de días sirianos del colaborador de la sesión.
 *
 * `PermisoForm` lo consulta al elegir ese tipo de permiso, para mostrar cuántos
 * quedan y apagar el botón de enviar si no hay ninguno. Está en el paquete —y no
 * en cada app— porque la forma de la respuesta es parte del contrato del
 * formulario: si una app la nombrara distinto, el saldo saldría siempre en cero
 * sin ningún error.
 */
import { NextResponse } from "next/server";
import { escapeAirtableValue } from "../lib/security";
import { FIELDS, PERIODO_ACTUAL } from "../lib/schema";
import { resolverAirtable } from "../infra";
import type { OpcionesHandlers } from "../types";

const C = FIELDS.DIAS_SIRIANOS;

export function createDiasSirianosHandlers(opciones: OpcionesHandlers) {
  const { resolvePayload, airtable } = opciones;

  async function GET() {
    const payload = await resolvePayload();
    if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { baseId, apiKey, tablas } = resolverAirtable(airtable);

    const formula = encodeURIComponent(
      `AND({${C.ID_COLABORADOR}}='${escapeAirtableValue(payload.idCore)}', ` +
        `{${C.PERIODO}}='${escapeAirtableValue(PERIODO_ACTUAL)}')`
    );

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tablas.diasSirianos)}?filterByFormula=${formula}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );

    if (!res.ok) {
      console.error("[dias-sirianos/saldo GET]", await res.text());
      return NextResponse.json({ error: "Error al consultar Airtable" }, { status: 500 });
    }

    const data = await res.json();
    const record = (data.records ?? [])[0];

    // Sin fila para el periodo, el saldo es cero y no un error: el beneficio se
    // carga por periodo y puede que a este colaborador aún no se le haya cargado.
    if (!record) {
      return NextResponse.json({
        saldo_disponible: 0,
        saldo_usado: 0,
        periodo: PERIODO_ACTUAL,
        fecha_ultimo_uso: null,
      });
    }

    return NextResponse.json({
      saldo_disponible: record.fields[C.SALDO_DISPONIBLE] ?? 0,
      saldo_usado: record.fields[C.SALDO_USADO] ?? 0,
      periodo: record.fields[C.PERIODO] ?? PERIODO_ACTUAL,
      fecha_ultimo_uso: record.fields[C.FECHA_ULTIMO_USO] ?? null,
    });
  }

  return { GET };
}
