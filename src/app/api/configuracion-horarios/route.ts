import { NextRequest, NextResponse } from "next/server";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { verifyJWT } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

function authenticate(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return { error: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }
  return { payload };
}

// ─── Helpers de conversión de tiempo ─────────────────────────────────────────

/**
 * Convierte segundos desde medianoche a formato "HH:MM".
 * Airtable almacena los campos de duración como segundos.
 */
function secondsToHHMM(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(Number(seconds))) return "00:00";
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Convierte formato "HH:MM" a segundos desde medianoche.
 */
function hhmmToSeconds(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return (hh * 60 + mm) * 60;
}

async function fetchPaginated(baseId: string, table: string, formula?: string) {
  const records: Array<{ id: string; fields: Record<string, unknown>; createdTime: string }> = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    if (offset) url.searchParams.set("offset", offset);
    if (formula) url.searchParams.set("filterByFormula", formula);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Airtable ${table} error: ${res.status}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// ─── GET: Listar tipos de turno ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const todos = searchParams.get("todos") === "true";

    const formula = todos ? "" : `{Estado}='Activo'`;
    const records = await fetchPaginated(BASE_GESTION, TABLE_HORARIOS, formula || undefined);

    const horarios = records.map((r) => ({
      id: r.id,
      nombre: (r.fields["Nombre_Horario"] as string) || "",
      horaEntrada: secondsToHHMM(r.fields["Hora_Entrada"] as number),
      horaSalida: secondsToHHMM(r.fields["Hora_Salida"] as number),
      diasLaborales: (r.fields["Dias_Laborales"] as string[]) || [],
      totalHorasDia: (r.fields["Total_Horas_Dia"] as number) || 0,
      tipoJornada: (r.fields["Tipo_Jornada"] as string) || "",
      toleranciaMin: (r.fields["Tolerancia_Min"] as number) || 0,
      estado: (r.fields["Estado"] as string) || "",
    }));

    return NextResponse.json({ horarios });
  } catch (err) {
    console.error("[ConfigHorarios GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT: Editar tipo de turno existente ─────────────────────────────────────

export async function PUT(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para editar horarios" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "El ID del horario es obligatorio" }, { status: 400 });
    }

    // Validar que el ID sea un record ID de Airtable y no contenga caracteres peligrosos
    if (!body.id.startsWith("rec") || escapeAirtableValue(String(body.id)) !== String(body.id)) {
      return NextResponse.json({ error: "ID de horario inválido" }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};

    if (body.nombre !== undefined) fields["Nombre_Horario"] = body.nombre;
    if (body.diasLaborales !== undefined) fields["Dias_Laborales"] = body.diasLaborales;
    if (body.totalHorasDia !== undefined) fields["Total_Horas_Dia"] = body.totalHorasDia;
    if (body.tipoJornada !== undefined) fields["Tipo_Jornada"] = body.tipoJornada;
    if (body.toleranciaMin !== undefined) fields["Tolerancia_Min"] = body.toleranciaMin;
    if (body.estado !== undefined) fields["Estado"] = body.estado;

    // Convertir "HH:MM" → segundos antes de enviar a Airtable
    if (body.horaEntrada !== undefined) {
      fields["Hora_Entrada"] = hhmmToSeconds(body.horaEntrada);
    }
    if (body.horaSalida !== undefined) {
      fields["Hora_Salida"] = hhmmToSeconds(body.horaSalida);
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updateUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_HORARIOS)}/${body.id}`;

    const res = await fetch(updateUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ConfigHorarios PUT] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al actualizar el horario" }, { status: 500 });
    }

    const updated = await res.json();
    return NextResponse.json({
      ok: true,
      record: {
        id: updated.id,
        nombre: updated.fields["Nombre_Horario"],
        horaEntrada: secondsToHHMM(updated.fields["Hora_Entrada"] as number),
        horaSalida: secondsToHHMM(updated.fields["Hora_Salida"] as number),
      },
    });
  } catch (err) {
    console.error("[ConfigHorarios PUT] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Crear nuevo horario en Configuracion_Horarios ─────────────────────

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para crear horarios" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.nombre || body.horaEntrada == null || body.horaSalida == null || !body.diasLaborales?.length) {
      return NextResponse.json(
        { error: "Nombre, hora de entrada, hora de salida y días laborales son obligatorios" },
        { status: 400 }
      );
    }

    const fields: Record<string, unknown> = {
      Nombre_Horario: body.nombre,
      Hora_Entrada: body.horaEntrada,     // seconds (Airtable duration field)
      Hora_Salida: body.horaSalida,       // seconds
      Dias_Laborales: body.diasLaborales,
      Total_Horas_Dia: body.totalHoras ?? 0,
      Estado: body.estado || "Activo",
    };

    if (body.tipoJornada) fields.Tipo_Jornada = body.tipoJornada;
    if (body.horaInicioAlmuerzo) fields.Hora_Inicio_Almuerzo = body.horaInicioAlmuerzo;
    if (body.horaFinAlmuerzo) fields.Hora_Fin_Almuerzo = body.horaFinAlmuerzo;
    if (body.descripcion) fields.Descripcion = body.descripcion;

    const createUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_HORARIOS)}`;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ConfigHorarios POST] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al crear el horario" }, { status: 500 });
    }

    const created = await res.json();
    return NextResponse.json({ ok: true, record: { id: created.id, fields: created.fields } });
  } catch (err) {
    console.error("[ConfigHorarios POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
