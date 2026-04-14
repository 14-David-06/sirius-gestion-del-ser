/**
 * GET /api/lifecycle/onboard-options — Datos para el formulario de vinculación
 *
 * Retorna:
 * - Lista de tipos de turno disponibles (desde schedules/shift-types)
 * - Lista de tipos de contrato (enum)
 * - Lista de áreas disponibles
 *
 * Acceso: Solo Admin Depto+
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";
import {
  TIPOS_CONTRATO,
  PERIODICIDADES_PAGO,
} from "@/lib/lifecycle/tipos";

export const dynamic = "force-dynamic";

const BASE_NC = env.airtable.baseNominaCore;
const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_AREAS = env.airtable.tableAreas;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;
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

    // ─── Obtener tipos de turno (horarios) ────────────────────────────────────
    const horariosUrl = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_HORARIOS)}`
    );
    horariosUrl.searchParams.set("sort[0][field]", "Nombre_Horario");
    horariosUrl.searchParams.set("sort[0][direction]", "asc");

    const horariosRes = await fetch(horariosUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 300 }, // Cache 5 min
    });

    let tiposTurno: Array<{ id: string; nombre: string; diasLaborales: string[]; tipoJornada: string }> = [];
    if (horariosRes.ok) {
      const horariosData = await horariosRes.json();
      tiposTurno = (horariosData.records || []).map((r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        nombre: (r.fields["Nombre_Horario"] as string) || "Sin nombre",
        diasLaborales: (r.fields["Dias_Laborales"] as string[]) || [],
        tipoJornada: (r.fields["Tipo_Jornada"] as string) || "",
      }));
    }

    // ─── Obtener áreas ────────────────────────────────────────────────────────
    const areasUrl = new URL(
      `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_AREAS)}`
    );
    areasUrl.searchParams.set("sort[0][field]", "Nombre del Area");
    areasUrl.searchParams.set("sort[0][direction]", "asc");

    const areasRes = await fetch(areasUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 300 },
    });

    let areas: Array<{ id: string; nombre: string }> = [];
    if (areasRes.ok) {
      const areasData = await areasRes.json();
      areas = (areasData.records || []).map((r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        nombre: (r.fields["Nombre del Area"] as string) || "Sin nombre",
      }));
    }

    return NextResponse.json({
      tiposContrato: TIPOS_CONTRATO,
      periodicidadesPago: PERIODICIDADES_PAGO,
      tiposTurno,
      areas,
    });
  } catch (err) {
    console.error("[OnboardOptions] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
