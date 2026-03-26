/**
 * API Solicitudes — Catálogo de tipos
 *
 * GET /api/requests/tipos → Lista de subtipos de solicitud activos
 *   ?tipo_padre=permiso|novedad_nomina  (filtro opcional)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";
import { mapearTipoCatalogo } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_TIPOS = env.airtable.tableRequestsTipos;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const tipoPadre = req.nextUrl.searchParams.get("tipo_padre");

    // Siempre filtrar por Activo=1; opcionalmente también por Tipo_Padre
    const conditions = ["{Activo}=1"];
    if (tipoPadre) {
      const safe = escapeAirtableValue(tipoPadre);
      conditions.push(`{Tipo_Padre}='${safe}'`);
    }

    const formula = conditions.length === 1 ? conditions[0] : `AND(${conditions.join(",")})`;

    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_TIPOS)}`
    );
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("sort[0][field]", "Nombre");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      // ISR: el catálogo cambia raramente — revalidar cada hora
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("[Requests tipos GET] Airtable error:", res.status, await res.text());
      return NextResponse.json({ error: "Error al consultar el catálogo de tipos" }, { status: 500 });
    }

    const data = await res.json();
    const tipos = (data.records ?? []).map(mapearTipoCatalogo);

    return NextResponse.json({ tipos });
  } catch (err) {
    console.error("[Requests tipos GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
