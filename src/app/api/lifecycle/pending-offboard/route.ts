/**
 * GET /api/lifecycle/pending-offboard → Empleados con contrato vencido sin desvinculación formal
 *
 * Lógica:
 * 1. Consultar contratos vencidos via GET /api/contratos/expiring?days=0
 * 2. Cruzar con lifecycle_events para ver cuáles no tienen evento de desvinculación
 * 3. Retornar lista de empleados que necesitan ser desvinculados formalmente
 *
 * Acceso: Solo Admin Depto+
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_LIFECYCLE = env.airtable.tableLifecycleEvents;
const API_KEY = env.airtable.apiKey;

export async function GET(req: NextRequest) {
  try {
    // ─── Autenticación y autorización ─────────────────────────────────────────
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Solo administradores pueden acceder" }, { status: 403 });
    }

    // ─── Obtener contratos ya vencidos ────────────────────────────────────────
    // Contratos activos o vencidos con fecha_fin <= hoy
    const hoy = new Date().toISOString().split("T")[0];
    const contratosUrl = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_CONTRATOS)}`
    );
    contratosUrl.searchParams.set(
      "filterByFormula",
      `AND(
        OR({Estado}='activo',{Estado}='vencido'),
        {Fecha_Fin}!='',
        {Fecha_Fin}<='${hoy}'
      )`.replace(/\s+/g, " ")
    );
    contratosUrl.searchParams.set("sort[0][field]", "Fecha_Fin");
    contratosUrl.searchParams.set("sort[0][direction]", "asc");

    const contratosRes = await fetch(contratosUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!contratosRes.ok) {
      console.error("[PendingOffboard] Error en contratos:", contratosRes.status);
      return NextResponse.json({ error: "Error al consultar contratos" }, { status: 500 });
    }

    const contratosData = await contratosRes.json();
    const contratosVencidos = contratosData.records || [];

    if (contratosVencidos.length === 0) {
      return NextResponse.json({ pendientes: [], total: 0 });
    }

    // ─── Obtener eventos de desvinculación existentes ─────────────────────────
    const lifecycleUrl = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}`
    );
    lifecycleUrl.searchParams.set("filterByFormula", "{Tipo_Evento}='desvinculacion'");

    const lifecycleRes = await fetch(lifecycleUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    const empleadosDesvinculados = new Set<string>();
    if (lifecycleRes.ok) {
      const lifecycleData = await lifecycleRes.json();
      for (const record of lifecycleData.records || []) {
        const empleadoId = record.fields["Empleado_ID"] as string;
        if (empleadoId) empleadosDesvinculados.add(empleadoId);
      }
    }

    // ─── Filtrar contratos de empleados sin evento de desvinculación ──────────
    const pendientes: Array<{
      idContrato: string;
      idEmpleado: string;
      nombreEmpleado: string;
      tipoContrato: string;
      fechaFin: string;
      diasVencido: number;
    }> = [];

    for (const contrato of contratosVencidos) {
      const f = contrato.fields;
      const empleadoId = (f["ID_Empleado"] as string) || "";

      if (empleadoId && !empleadosDesvinculados.has(empleadoId)) {
        const fechaFin = (f["Fecha_Fin"] as string) || "";
        const diasVencido = Math.floor(
          (new Date().getTime() - new Date(fechaFin).getTime()) / (1000 * 60 * 60 * 24)
        );

        pendientes.push({
          idContrato: (f["ID_Contrato"] as string) || contrato.id,
          idEmpleado: empleadoId,
          nombreEmpleado: (f["Nombre_Empleado"] as string) || "",
          tipoContrato: (f["Tipo_Contrato"] as string) || "",
          fechaFin,
          diasVencido,
        });
      }
    }

    // Ordenar por días vencido (más urgentes primero)
    pendientes.sort((a, b) => b.diasVencido - a.diasVencido);

    return NextResponse.json({
      pendientes,
      total: pendientes.length,
    });
  } catch (err) {
    console.error("[PendingOffboard] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
