/**
 * GET /api/schedules/shift-types/:id → Obtener tipo de turno por Airtable record ID
 * PUT /api/schedules/shift-types/:id → Editar tipo de turno (Admin Depto+)
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

function recordUrl(id: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${id}`;
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

// ─── GET ──────────────────────────────────────────────────────────────────────

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

    if (res.status === 404) {
      return NextResponse.json({ error: "Tipo de turno no encontrado" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Error al obtener tipo de turno" }, { status: 500 });
    }

    const record = await res.json();
    return NextResponse.json({ tipo: mapShiftType(record) });
  } catch (err) {
    console.error("[ShiftTypes/:id GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para editar tipos de turno" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const fields: Record<string, unknown> = {};

    if (body.nombre !== undefined) fields.Nombre_Horario = String(body.nombre).trim();
    if (body.diasLaborales !== undefined) fields.Dias_Laborales = body.diasLaborales;
    if (body.horaEntradaSeg !== undefined) fields.Hora_Entrada = Number(body.horaEntradaSeg);
    if (body.horaSalidaSeg !== undefined) fields.Hora_Salida = Number(body.horaSalidaSeg);
    if (body.toleranciaMin !== undefined) fields.Tolerancia_Min = Number(body.toleranciaMin);
    if (body.tipoJornada !== undefined) fields.Tipo_Jornada = body.tipoJornada;
    if (body.estado !== undefined) fields.Estado = body.estado;

    // Recalcular total horas si se actualizaron ambas horas
    if (fields.Hora_Entrada !== undefined && fields.Hora_Salida !== undefined) {
      const diff = (fields.Hora_Salida as number) - (fields.Hora_Entrada as number);
      fields.Total_Horas_Dia = diff > 0 ? Math.round((diff / 3600) * 10) / 10 : 0;
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const res = await fetch(recordUrl(id), {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (res.status === 404) {
      return NextResponse.json({ error: "Tipo de turno no encontrado" }, { status: 404 });
    }
    if (!res.ok) {
      console.error("[ShiftTypes/:id PUT] Airtable error:", await res.text());
      return NextResponse.json({ error: "Error al actualizar tipo de turno" }, { status: 500 });
    }

    const updated = await res.json();
    return NextResponse.json({ ok: true, tipo: mapShiftType(updated) });
  } catch (err) {
    console.error("[ShiftTypes/:id PUT] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
