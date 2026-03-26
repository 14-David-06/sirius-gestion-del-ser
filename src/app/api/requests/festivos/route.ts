/**
 * API Solicitudes — Festivos Colombia
 *
 * GET /api/requests/festivos?anio=2026 → Lista de festivos nacionales para el año dado
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { FestivoColombia } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_FESTIVOS = env.airtable.tableRequestsFestivos;

function mapearFestivo(record: { id: string; fields: Record<string, unknown> }): FestivoColombia {
  const f = record.fields;
  return {
    fecha: (f["Fecha"] as string) || "",
    nombre: (f["Nombre"] as string) || "",
    anio: (f["Anio"] as number) ?? 0,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const anioParam = req.nextUrl.searchParams.get("anio");
    if (!anioParam) {
      return NextResponse.json({ error: "El parámetro anio es requerido" }, { status: 400 });
    }

    const anio = parseInt(anioParam, 10);
    if (isNaN(anio) || anio < 2020 || anio > 2100) {
      return NextResponse.json({ error: "El parámetro anio debe ser un año válido" }, { status: 400 });
    }

    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_FESTIVOS)}`
    );
    url.searchParams.set("filterByFormula", `{Anio}=${anio}`);
    url.searchParams.set("sort[0][field]", "Fecha");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      // ISR: los festivos son estáticos — revalidar una vez al día
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.error("[Requests festivos GET] Airtable error:", res.status, await res.text());
      return NextResponse.json({ error: "Error al consultar los festivos" }, { status: 500 });
    }

    const data = await res.json();
    const festivos = (data.records ?? []).map(mapearFestivo);

    return NextResponse.json({ festivos });
  } catch (err) {
    console.error("[Requests festivos GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
