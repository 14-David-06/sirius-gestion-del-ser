/**
 * GET /api/lifecycle/events/:id → Detalle de un evento específico
 *
 * Acceso: Admin Depto+ puede ver todos, empleados solo los propios
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";
import { mapearEvento } from "@/lib/lifecycle/tipos";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_LIFECYCLE = env.airtable.tableLifecycleEvents;
const API_KEY = env.airtable.apiKey;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ─── Autenticación ────────────────────────────────────────────────────────
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { id } = await params;

    // ─── Obtener evento ───────────────────────────────────────────────────────
    const url = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}/${id}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al consultar evento" }, { status: 500 });
    }

    const record = await res.json();
    const evento = mapearEvento(record);

    // RBAC: empleados solo pueden ver sus propios eventos
    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    if (!isAdmin && evento.empleadoId !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a este evento" }, { status: 403 });
    }

    return NextResponse.json({ evento });
  } catch (err) {
    console.error("[Events/:id GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
