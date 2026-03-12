import { NextRequest, NextResponse } from "next/server";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";
import { verifyJWT } from "@/lib/auth";
import { env } from "@/lib/env";

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
      body: JSON.stringify({ fields }),
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
