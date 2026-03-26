/**
 * GET /api/contratos/expiring?days=30
 * Contratos activos próximos a vencer. Solo Admin Depto+.
 * Default: 30 días.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearContrato } from "@/lib/contratos/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: "days debe estar entre 1 y 365" }, { status: 400 });
    }

    // Calcular fecha límite (hoy + days días)
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + days);
    const hoyStr = hoy.toISOString().split("T")[0];
    const limiteStr = limite.toISOString().split("T")[0];

    // Contratos activos con fecha_fin entre hoy y la fecha límite
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}`
    );
    url.searchParams.set(
      "filterByFormula",
      `AND({Estado}='activo',{Fecha_Fin}>='${hoyStr}',{Fecha_Fin}<='${limiteStr}')`
    );
    url.searchParams.set("sort[0][field]", "Fecha_Fin");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error al consultar contratos" }, { status: 500 });
    }

    const data = await res.json();
    const contratos = (data.records || []).map(mapearContrato);

    return NextResponse.json({ contratos, days, hoy: hoyStr, limite: limiteStr });
  } catch (err) {
    console.error("[Contratos/expiring GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
