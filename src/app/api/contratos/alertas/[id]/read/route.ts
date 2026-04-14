/**
 * PATCH /api/contratos/alertas/:id/read → Marcar alerta como leída (Admin Depto+)
 *
 * Actualiza el campo Leida = true en contracts_alertas.
 * Usado por el panel admin para tracking de alertas vistas.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_ALERTAS = env.airtable.tableContractsAlertas;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

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
      return NextResponse.json({ error: "Solo administradores pueden marcar alertas como leídas" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que la alerta existe
    const checkUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_ALERTAS)}/${id}`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!checkRes.ok) {
      if (checkRes.status === 404) {
        return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al verificar alerta" }, { status: 500 });
    }

    // Marcar como leída
    const updateRes = await fetch(checkUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Leida: true,
        },
      }),
    });

    if (!updateRes.ok) {
      console.error("[alertas/:id/read PATCH] Error:", await updateRes.text());
      return NextResponse.json({ error: "Error al marcar alerta como leída" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mensaje: "Alerta marcada como leída" });
  } catch (err) {
    console.error("[alertas/:id/read PATCH] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
