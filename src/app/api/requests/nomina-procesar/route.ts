/**
 * API Solicitudes — Nómina Procesar
 *
 * PATCH /api/requests/nomina-procesar → Marca solicitudes como procesadas por nómina
 *
 * Body: { ids: ["id1", "id2", ...] }
 *
 * Uso: El módulo de Nómina (futuro) llamará este endpoint después de procesar
 * las novedades en el cálculo de nómina.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";

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

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    // Solo admin puede marcar como procesadas
    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para procesar solicitudes de nómina" }, { status: 403 });
    }

    const body = await req.json() as { ids?: string[] };
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids es requerido y debe ser un array no vacío" }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({ error: "Máximo 50 solicitudes por lote" }, { status: 400 });
    }

    const ahora = new Date().toISOString();
    const results: { id: string; ok: boolean; error?: string }[] = [];

    // Procesar cada solicitud (verificar que esté aprobada antes de marcar)
    await Promise.all(
      ids.map(async (id) => {
        try {
          // Verificar estado actual
          const getRes = await fetch(recordUrl(id), {
            headers: { Authorization: `Bearer ${API_KEY}` },
            cache: "no-store",
          });

          if (!getRes.ok) {
            results.push({ id, ok: false, error: "No encontrada" });
            return;
          }

          const record = await getRes.json();
          const estado = record.fields?.Estado as string;

          if (estado !== "aprobado") {
            results.push({ id, ok: false, error: `Estado inválido: ${estado}` });
            return;
          }

          // Marcar como procesada
          const updateRes = await fetch(recordUrl(id), {
            method: "PATCH",
            headers: airtableHeaders(),
            body: JSON.stringify({
              fields: {
                Procesado_Nomina: true,
                Fecha_Procesado_Nomina: ahora,
                Updated_At: ahora,
              },
            }),
          });

          if (!updateRes.ok) {
            results.push({ id, ok: false, error: "Error al actualizar" });
            return;
          }

          results.push({ id, ok: true });
        } catch (_e) {
          results.push({ id, ok: false, error: "Error de procesamiento" });
        }
      })
    );

    const exitosos = results.filter((r) => r.ok).length;
    const fallidos = results.filter((r) => !r.ok);

    return NextResponse.json({
      ok: fallidos.length === 0,
      procesados: exitosos,
      total: ids.length,
      ...(fallidos.length > 0 ? { errores: fallidos } : {}),
    });
  } catch (err) {
    console.error("[Requests nomina-procesar] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
