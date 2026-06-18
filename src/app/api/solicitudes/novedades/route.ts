import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";
import { TABLES, FIELDS, FK_ID_CORE, ESTADO_PENDIENTE } from "@/lib/airtable-schema";
import { TIPO_HORAS_EXTRA } from "@/lib/constants";

const BASE = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const KEY = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

async function authPayload() {
  const token = (await cookies()).get("sirius-auth")?.value;
  return token ? verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
}

export async function GET() {
  const payload = await authPayload();
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formula = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(payload.idCore)}'`);
  const sort = encodeURIComponent(FIELDS.NOVEDADES.FECHA_CREACION);
  const params = `filterByFormula=${formula}&sort[0][field]=${sort}&sort[0][direction]=desc&maxRecords=20`;
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.NOVEDADES)}?${params}`,
    { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data.records ?? []);
}

export async function POST(req: NextRequest) {
  const payload = await authPayload();
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  const fields: Record<string, unknown> = {
    [FK_ID_CORE]:                   payload.idCore,
    [FIELDS.NOVEDADES.TIPO]:        body.tipo,
    [FIELDS.NOVEDADES.DESCRIPCION]: body.descripcion,
    [FIELDS.NOVEDADES.ESTADO]:      ESTADO_PENDIENTE,
  };

  if (body.tipo === TIPO_HORAS_EXTRA && body.horasExtra) {
    fields[FIELDS.NOVEDADES.HORAS_EXTRA] = Number(body.horasExtra);
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.NOVEDADES)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
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
