/**
 * API Solicitudes — Recurso individual
 *
 * GET /api/requests/:id → Detalle de una solicitud
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearSolicitud } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_REQUESTS = env.airtable.tableRequestsRequests;

function recordUrl(recordId: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_REQUESTS)}/${recordId}`;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { id } = await params;

    const res = await fetch(recordUrl(id), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al consultar la solicitud" }, { status: 500 });
    }

    const record = await res.json();
    const solicitud = mapearSolicitud(record);

    // Empleados regulares solo pueden ver sus propias solicitudes
    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    if (!isAdmin && solicitud.empleadoId !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a esta solicitud" }, { status: 403 });
    }

    return NextResponse.json({ solicitud });
  } catch (err) {
    console.error("[Requests/:id GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
