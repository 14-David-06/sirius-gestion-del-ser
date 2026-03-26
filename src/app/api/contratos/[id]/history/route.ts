/**
 * GET /api/contratos/:id/history
 * Historial de cambios de un contrato. Solo Admin Depto+.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_HISTORY = env.airtable.tableContractsHistory;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para ver historial" }, { status: 403 });
    }

    const { id } = await params;

    // Obtener el ID_Contrato (texto) del record
    const contratoRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
    );

    if (!contratoRes.ok) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const contrato = await contratoRes.json();
    const idContrato = contrato.fields["ID_Contrato"] as string;

    if (!idContrato) {
      return NextResponse.json({ historial: [] });
    }

    // Buscar historial por ID_Contrato
    const safeId = escapeAirtableValue(idContrato);
    const histUrl = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_HISTORY)}`
    );
    histUrl.searchParams.set("filterByFormula", `{ID_Contrato}='${safeId}'`);
    histUrl.searchParams.set("sort[0][field]", "Timestamp");
    histUrl.searchParams.set("sort[0][direction]", "desc");

    const histRes = await fetch(histUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!histRes.ok) {
      return NextResponse.json({ error: "Error al consultar historial" }, { status: 500 });
    }

    const histData = await histRes.json();
    const historial = (histData.records || []).map(
      (r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        idHistorial: r.fields["ID_Historial"] || "",
        idContrato: r.fields["ID_Contrato"] || "",
        accion: r.fields["Accion"] || "",
        campoModificado: r.fields["Campo_Modificado"] || null,
        valorAnterior: r.fields["Valor_Anterior"] || null,
        valorNuevo: r.fields["Valor_Nuevo"] || null,
        modificadoPor: r.fields["Modificado_Por"] || "",
        timestamp: r.fields["Timestamp"] || "",
      })
    );

    return NextResponse.json({ historial });
  } catch (err) {
    console.error("[Contratos/history GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
