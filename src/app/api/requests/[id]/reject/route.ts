/**
 * API Solicitudes — Rechazar
 *
 * PATCH /api/requests/:id/reject → Rechazar solicitud pendiente (Admin Depto+)
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

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function recordUrl(recordId: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_REQUESTS)}/${recordId}`;
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para rechazar solicitudes" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json() as { comentario?: string };

    if (!body.comentario?.trim()) {
      return NextResponse.json(
        { error: "El comentario es requerido para rechazar una solicitud" },
        { status: 400 }
      );
    }

    // Obtener solicitud actual
    const currentRes = await fetch(recordUrl(id), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!currentRes.ok) {
      if (currentRes.status === 404) {
        return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al consultar la solicitud" }, { status: 500 });
    }

    const solicitud = mapearSolicitud(await currentRes.json());

    if (solicitud.estado !== "pendiente") {
      return NextResponse.json(
        { error: `No se puede rechazar una solicitud en estado '${solicitud.estado}'` },
        { status: 400 }
      );
    }

    const ahora = new Date().toISOString();

    const updateRes = await fetch(recordUrl(id), {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Estado: "rechazado",
          Comentario_Admin: body.comentario,
          Revisado_Por: payload.nombre || "Admin",
          Updated_At: ahora,
        },
      }),
    });

    if (!updateRes.ok) {
      console.error("[Requests reject] Airtable error:", updateRes.status, await updateRes.text());
      return NextResponse.json({ error: "Error al rechazar la solicitud" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Requests reject] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
