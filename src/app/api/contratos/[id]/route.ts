/**
 * API Contratos — Recurso individual
 *
 * GET   /api/contratos/:id → Detalle de un contrato
 * PATCH /api/contratos/:id → Actualizar campos (genera auditoría automática)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearContrato, generarIdHistorial } from "@/lib/contratos/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_HISTORY = env.airtable.tableContractsHistory;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function recordUrl(recordId: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${recordId}`;
}

// ─── GET ────────────────────────────────────────────────────────────────────

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
      if (res.status === 404) return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
      return NextResponse.json({ error: "Error al consultar contrato" }, { status: 500 });
    }

    const record = await res.json();
    const contrato = mapearContrato(record);

    // Empleados regulares solo pueden ver sus propios contratos
    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto") && contrato.idEmpleado !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a este contrato" }, { status: 403 });
    }

    return NextResponse.json({ contrato });
  } catch (err) {
    console.error("[Contratos/:id GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

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
      return NextResponse.json({ error: "Sin permisos para editar contratos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Obtener contrato actual para comparar y generar historial
    const currentRes = await fetch(recordUrl(id), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (!currentRes.ok) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }
    const currentRecord = await currentRes.json();
    const contratoActual = mapearContrato(currentRecord);

    if (contratoActual.estado === "terminado") {
      return NextResponse.json({ error: "No se puede editar un contrato terminado" }, { status: 400 });
    }

    // Campos editables y su mapeo a nombre de campo en Airtable
    const camposEditables: Record<string, string> = {
      tipo_contrato: "Tipo_Contrato",
      fecha_inicio: "Fecha_Inicio",
      fecha_fin: "Fecha_Fin",
      salario_base: "Salario_Base",
      periodicidad_pago: "Periodicidad_Pago",
      jornada_id: "Jornada_ID",
      observaciones: "Observaciones",
    };

    const camposAirtable: Record<string, unknown> = {};
    const cambios: Array<{ campo: string; anterior: string; nuevo: string }> = [];

    for (const [bodyKey, airtableKey] of Object.entries(camposEditables)) {
      if (bodyKey in body) {
        const valorNuevo = body[bodyKey];
        const valorActual = currentRecord.fields[airtableKey];
        if (String(valorActual ?? "") !== String(valorNuevo ?? "")) {
          camposAirtable[airtableKey] = valorNuevo;
          cambios.push({
            campo: bodyKey,
            anterior: String(valorActual ?? ""),
            nuevo: String(valorNuevo ?? ""),
          });
        }
      }
    }

    if (cambios.length === 0) {
      return NextResponse.json({ ok: true, mensaje: "Sin cambios" });
    }

    const ahora = new Date().toISOString();
    camposAirtable["Version"] = (contratoActual.version || 1) + 1;
    camposAirtable["Fecha_Actualizacion"] = ahora;

    // Actualizar contrato
    const updateRes = await fetch(recordUrl(id), {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields: camposAirtable }),
    });

    if (!updateRes.ok) {
      console.error("[Contratos/:id PATCH] Airtable error:", updateRes.status, await updateRes.text());
      return NextResponse.json({ error: "Error al actualizar contrato" }, { status: 500 });
    }

    const updated = await updateRes.json();

    // Registrar en historial un registro por cada campo cambiado (no bloqueante)
    for (const cambio of cambios) {
      const histId = generarIdHistorial(id, cambio.campo);
      fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_HISTORY)}`,
        {
          method: "POST",
          headers: airtableHeaders(),
          body: JSON.stringify({
            fields: {
              ID_Historial: histId,
              ID_Contrato: contratoActual.idContrato,
              Accion: "modificar",
              Campo_Modificado: cambio.campo,
              Valor_Anterior: cambio.anterior,
              Valor_Nuevo: cambio.nuevo,
              Modificado_Por: payload.nombre || "Admin",
              ID_Usuario_Modificador: payload.idCore || payload.sub,
              Timestamp: ahora,
            },
          }),
        }
      ).catch((e) => console.error("[Contratos/:id PATCH] historial:", e));
    }

    return NextResponse.json({ ok: true, contrato: mapearContrato(updated) });
  } catch (err) {
    console.error("[Contratos/:id PATCH] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
