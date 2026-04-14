/**
 * GET /api/lifecycle/events?empleado_id=X → Historial de eventos del empleado
 *
 * Parámetros opcionales:
 * - empleado_id: filtrar por empleado específico
 * - tipo: filtrar por tipo_evento (vinculacion, desvinculacion, etc.)
 *
 * Acceso: Admin Depto+ puede ver todos, empleados solo los propios
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { mapearEvento } from "@/lib/lifecycle/tipos";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_LIFECYCLE = env.airtable.tableLifecycleEvents;
const API_KEY = env.airtable.apiKey;

export async function GET(req: NextRequest) {
  try {
    // ─── Autenticación ────────────────────────────────────────────────────────
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    const { searchParams } = new URL(req.url);
    const empleadoIdParam = searchParams.get("empleado_id");
    const tipoParam = searchParams.get("tipo");

    // RBAC: empleados solo pueden ver sus propios eventos
    const empleadoId = isAdmin
      ? (empleadoIdParam || null)
      : (payload.idCore || null);

    if (!isAdmin && empleadoIdParam && empleadoIdParam !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a eventos de otro empleado" }, { status: 403 });
    }

    // ─── Construir fórmula de filtro ──────────────────────────────────────────
    const conditions: string[] = [];

    if (empleadoId) {
      const safe = escapeAirtableValue(empleadoId);
      conditions.push(`{Empleado_ID}='${safe}'`);
    }

    if (tipoParam) {
      const safeTipo = escapeAirtableValue(tipoParam);
      conditions.push(`{Tipo_Evento}='${safeTipo}'`);
    }

    const formula = conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : `AND(${conditions.join(",")})`
      : "";

    // ─── Consultar eventos ────────────────────────────────────────────────────
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}`
    );
    if (formula) url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("sort[0][field]", "Fecha_Efectiva");
    url.searchParams.set("sort[0][direction]", "desc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Events GET] Airtable error:", res.status);
      return NextResponse.json({ error: "Error al consultar eventos" }, { status: 500 });
    }

    const data = await res.json();
    const eventos = (data.records || []).map(mapearEvento);

    return NextResponse.json({ eventos });
  } catch (err) {
    console.error("[Events GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
