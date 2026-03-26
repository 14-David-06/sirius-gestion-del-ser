/**
 * GET  /api/schedules/shift-types → Listar tipos de turno (Configuracion_Horarios)
 * POST /api/schedules/shift-types → Crear tipo de turno (Admin Depto+)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const TABLE = env.airtable.tableConfiguracionHorarios;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function tableUrl() {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;
}

function secondsToHHMM(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(Number(seconds))) return "00:00";
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapShiftType(r: { id: string; fields: Record<string, unknown> }) {
  return {
    id: r.id,
    nombre: (r.fields["Nombre_Horario"] as string) || "",
    diasLaborales: (r.fields["Dias_Laborales"] as string[]) || [],
    horaEntrada: secondsToHHMM(r.fields["Hora_Entrada"] as number),
    horaSalida: secondsToHHMM(r.fields["Hora_Salida"] as number),
    horaEntradaSeg: (r.fields["Hora_Entrada"] as number) ?? 0,
    horaSalidaSeg: (r.fields["Hora_Salida"] as number) ?? 0,
    totalHorasDia: (r.fields["Total_Horas_Dia"] as number) || 0,
    toleranciaMin: (r.fields["Tolerancia_Min"] as number) || 0,
    tipoJornada: (r.fields["Tipo_Jornada"] as string) || "",
    estado: (r.fields["Estado"] as string) || "Activo",
  };
}

// ─── GET: listar tipos de turno ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const soloActivos = searchParams.get("activos") !== "false";

    const url = new URL(tableUrl());
    if (soloActivos) {
      url.searchParams.set("filterByFormula", "{Estado}='Activo'");
    }
    url.searchParams.set("sort[0][field]", "Nombre_Horario");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error al consultar tipos de turno" }, { status: 500 });
    }

    const data = await res.json();
    const tipos = (data.records || []).map(mapShiftType);

    return NextResponse.json({ tipos });
  } catch (err) {
    console.error("[ShiftTypes GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: crear tipo de turno ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para crear tipos de turno" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, diasLaborales, horaEntradaSeg, horaSalidaSeg, toleranciaMin, tipoJornada } = body;

    if (!nombre || !Array.isArray(diasLaborales) || diasLaborales.length === 0) {
      return NextResponse.json(
        { error: "nombre y diasLaborales son obligatorios" },
        { status: 400 }
      );
    }
    if (horaEntradaSeg == null || horaSalidaSeg == null) {
      return NextResponse.json(
        { error: "horaEntradaSeg y horaSalidaSeg son obligatorios (segundos desde medianoche)" },
        { status: 400 }
      );
    }

    const diff = Number(horaSalidaSeg) - Number(horaEntradaSeg);
    const totalHorasDia = diff > 0 ? Math.round((diff / 3600) * 10) / 10 : 0;

    const fields: Record<string, unknown> = {
      Nombre_Horario: String(nombre).trim(),
      Dias_Laborales: diasLaborales,
      Hora_Entrada: Number(horaEntradaSeg),
      Hora_Salida: Number(horaSalidaSeg),
      Total_Horas_Dia: totalHorasDia,
      Tolerancia_Min: Number(toleranciaMin) || 0,
      Estado: "Activo",
    };
    if (tipoJornada) fields.Tipo_Jornada = tipoJornada;

    const res = await fetch(tableUrl(), {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      console.error("[ShiftTypes POST] Airtable error:", await res.text());
      return NextResponse.json({ error: "Error al crear tipo de turno" }, { status: 500 });
    }

    const created = await res.json();
    return NextResponse.json({ ok: true, tipo: mapShiftType(created) }, { status: 201 });
  } catch (err) {
    console.error("[ShiftTypes POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
