/**
 * API de Cambios de Horario — Excepciones y modificaciones puntuales de turno
 *
 * GET  ?empleado_id=X&fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
 *   → Lista cambios de horario en el período indicado.
 *     Admin Depto+ puede ver cualquier empleado; empleado solo ve los suyos.
 *
 * POST → Registrar un cambio puntual (requiere Admin Depto+).
 *   Body: { empleado_id, fecha, tipo_cambio, nuevo_horario_id?, hora_inicio_override?,
 *           hora_fin_override?, motivo }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_CAMBIOS = env.airtable.tableCambiosHorario;
const API_KEY = env.airtable.apiKey;

const TIPOS_CAMBIO_VALIDOS = ["swap_turno", "dia_libre", "turno_extra", "ajuste_hora"] as const;
type TipoCambio = (typeof TIPOS_CAMBIO_VALIDOS)[number];

function airtableHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchPaginated(
  baseId: string,
  table: string,
  formula?: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
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

// ─── GET: Listar cambios de horario en un período ─────────────────────────────

export async function GET(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get("fecha_inicio");
  const fechaFin = searchParams.get("fecha_fin");
  const role = getRoleFromPayload(payload);
  const esAdmin = hasMinRole(role, "Admin Depto");

  // El empleado siempre ve sus propios cambios; admin puede especificar otro
  const empleadoId = esAdmin
    ? (searchParams.get("empleado_id") || payload.sub)
    : payload.sub;

  if (!fechaInicio || !fechaFin) {
    return NextResponse.json(
      { error: "Los parámetros fecha_inicio y fecha_fin son obligatorios (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    return NextResponse.json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" }, { status: 400 });
  }

  if (fechaFin < fechaInicio) {
    return NextResponse.json({ error: "fecha_fin debe ser igual o posterior a fecha_inicio" }, { status: 400 });
  }

  // Si la tabla no está configurada, retornar lista vacía
  if (!TABLE_CAMBIOS) {
    return NextResponse.json({ cambios: [], total: 0 });
  }

  try {
    const safeEmpleadoId = escapeAirtableValue(empleadoId);
    const safeFechaInicio = escapeAirtableValue(fechaInicio);
    const safeFechaFin = escapeAirtableValue(fechaFin);

    const formula = `AND(
      {Empleado_RecordID}='${safeEmpleadoId}',
      {Fecha}>='${safeFechaInicio}',
      {Fecha}<='${safeFechaFin}'
    )`;

    const records = await fetchPaginated(BASE_GESTION, TABLE_CAMBIOS, formula);

    const cambios = records.map((r) => ({
      id: r.id,
      empleado_id: (r.fields["Empleado_RecordID"] as string) || "",
      fecha: (r.fields["Fecha"] as string) || "",
      tipo_cambio: (r.fields["Tipo_Cambio"] as string) || "",
      nuevo_horario_id: (r.fields["Nuevo_Horario_ID"] as string) || null,
      hora_inicio_override: (r.fields["Hora_Inicio_Override"] as string) || null,
      hora_fin_override: (r.fields["Hora_Fin_Override"] as string) || null,
      motivo: (r.fields["Motivo"] as string) || "",
      aprobado_por: (r.fields["Aprobado_Por"] as string) || "",
      estado: (r.fields["Estado"] as string) || "",
      fecha_creacion: (r.fields["Fecha_Creacion"] as string) || "",
    }));

    return NextResponse.json({ cambios, total: cambios.length });
  } catch (err) {
    console.error("[Changes GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Registrar cambio puntual de horario ────────────────────────────────

export async function POST(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const role = getRoleFromPayload(payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json(
      { error: "No tienes permisos para registrar cambios de horario" },
      { status: 403 }
    );
  }

  // Verificar que la tabla esté configurada
  if (!TABLE_CAMBIOS) {
    return NextResponse.json(
      { error: "La tabla de cambios de horario no está configurada" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();

    // Validaciones obligatorias
    if (!body.empleado_id) {
      return NextResponse.json({ error: "El campo empleado_id es obligatorio" }, { status: 400 });
    }
    if (!body.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)) {
      return NextResponse.json({ error: "El campo fecha es obligatorio y debe tener formato YYYY-MM-DD" }, { status: 400 });
    }
    if (!body.tipo_cambio || !TIPOS_CAMBIO_VALIDOS.includes(body.tipo_cambio as TipoCambio)) {
      return NextResponse.json(
        {
          error: `El campo tipo_cambio es obligatorio. Valores permitidos: ${TIPOS_CAMBIO_VALIDOS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!body.motivo || String(body.motivo).trim().length === 0) {
      return NextResponse.json({ error: "El campo motivo es obligatorio" }, { status: 400 });
    }

    // Validaciones condicionales por tipo
    const tipoCambio = body.tipo_cambio as TipoCambio;
    if ((tipoCambio === "swap_turno" || tipoCambio === "turno_extra") && !body.nuevo_horario_id) {
      return NextResponse.json(
        { error: `Para tipo_cambio '${tipoCambio}' el campo nuevo_horario_id es obligatorio` },
        { status: 400 }
      );
    }
    if (tipoCambio === "ajuste_hora" && (!body.hora_inicio_override || !body.hora_fin_override)) {
      return NextResponse.json(
        { error: "Para tipo_cambio 'ajuste_hora' los campos hora_inicio_override y hora_fin_override son obligatorios" },
        { status: 400 }
      );
    }

    const fields: Record<string, unknown> = {
      Empleado_RecordID: body.empleado_id,
      Fecha: body.fecha,
      Tipo_Cambio: tipoCambio,
      Motivo: String(body.motivo).trim(),
      Aprobado_Por: payload.nombre,
      Estado: "Pendiente",
      Fecha_Creacion: new Date().toISOString().split("T")[0],
    };

    if (body.nuevo_horario_id) fields["Nuevo_Horario_ID"] = body.nuevo_horario_id;
    if (body.hora_inicio_override) fields["Hora_Inicio_Override"] = body.hora_inicio_override;
    if (body.hora_fin_override) fields["Hora_Fin_Override"] = body.hora_fin_override;

    const createUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_CAMBIOS)}`;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Changes POST] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al registrar el cambio de horario" }, { status: 500 });
    }

    const created = await res.json();
    return NextResponse.json(
      {
        ok: true,
        cambio: {
          id: created.id,
          empleado_id: created.fields["Empleado_RecordID"],
          fecha: created.fields["Fecha"],
          tipo_cambio: created.fields["Tipo_Cambio"],
          estado: created.fields["Estado"],
          aprobado_por: created.fields["Aprobado_Por"],
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Changes POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
