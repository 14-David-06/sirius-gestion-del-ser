/**
 * PATCH /api/contratos/:id/terminate
 * Terminar o suspender un contrato laboral.
 * Requiere motivo y fecha de terminación.
 * Solo Admin Depto+.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearContrato, generarIdHistorial, EstadoContrato } from "@/lib/contratos/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_HISTORY = env.airtable.tableContractsHistory;

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
      return NextResponse.json({ error: "Sin permisos para terminar contratos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { motivo, fecha_terminacion, estado } = body;

    // Validaciones
    if (!motivo?.trim()) {
      return NextResponse.json({ error: "El motivo de terminación es obligatorio" }, { status: 400 });
    }
    if (!fecha_terminacion) {
      return NextResponse.json({ error: "La fecha de terminación es obligatoria" }, { status: 400 });
    }

    const estadosPermitidos: EstadoContrato[] = ["terminado", "suspendido"];
    if (!estadosPermitidos.includes(estado as EstadoContrato)) {
      return NextResponse.json(
        { error: `Estado inválido. Debe ser: ${estadosPermitidos.join(", ")}` },
        { status: 400 }
      );
    }

    // Obtener contrato actual
    const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${id}`;
    const currentRes = await fetch(recordUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!currentRes.ok) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const currentRecord = await currentRes.json();
    const contratoActual = mapearContrato(currentRecord);

    if (contratoActual.estado === "terminado") {
      return NextResponse.json({ error: "El contrato ya está terminado" }, { status: 400 });
    }

    const ahora = new Date().toISOString();

    // Actualizar contrato
    const updateRes = await fetch(recordUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Estado: estado,
          Motivo_Terminacion: motivo.trim(),
          Fecha_Terminacion: fecha_terminacion,
          Fecha_Actualizacion: ahora,
        },
      }),
    });

    if (!updateRes.ok) {
      console.error("[Contratos/terminate] Airtable error:", updateRes.status, await updateRes.text());
      return NextResponse.json({ error: "Error al actualizar contrato" }, { status: 500 });
    }

    const updated = await updateRes.json();

    // Registrar en historial (no bloqueante)
    const histId = generarIdHistorial(id, estado);
    const accion = estado === "suspendido" ? "suspender" : "terminar";
    fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_HISTORY)}`,
      {
        method: "POST",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            ID_Historial: histId,
            ID_Contrato: contratoActual.idContrato,
            Accion: accion,
            Campo_Modificado: "estado",
            Valor_Anterior: contratoActual.estado,
            Valor_Nuevo: estado,
            Modificado_Por: payload.nombre || "Admin",
            ID_Usuario_Modificador: payload.idCore || payload.sub,
            Timestamp: ahora,
          },
        }),
      }
    ).catch((e) => console.error("[Contratos/terminate] historial:", e));

    return NextResponse.json({ ok: true, contrato: mapearContrato(updated) });
  } catch (err) {
    console.error("[Contratos/terminate] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
