/**
 * API de Horarios — Asignación de horarios a empleados
 *
 * GET    → Lista empleados, horarios disponibles y asignaciones actuales
 * POST   → Crear nueva asignación (soporta múltiples horarios por empleado)
 * PUT    → Actualizar una asignación existente
 * DELETE → Desactivar una asignación (soft-delete: cambia Estado a Inactivo)
 *
 * Cada asignación puede vincular MÚLTIPLES horarios (ej: L-J + Viernes).
 * El campo Horario es Link to Record (array) → Configuracion_Horarios.
 * ID Core Usuario Asignado almacena el record ID de Personal (cross-base FK).
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const BASE_NOMINA = env.airtable.baseNominaCore;
const TABLE_ASIGNACION = env.airtable.tableAsignacionHorario;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;
const TABLE_PERSONAL = env.airtable.tablePersonal;
const TABLE_AREAS = env.airtable.tableAreas;
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

// ─── GET: Todo lo necesario para la página de asignación ─────────────────────

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  try {
    const [personal, horarios, asignaciones, areas] = await Promise.all([
      fetchPaginated(BASE_NOMINA, TABLE_PERSONAL),
      fetchPaginated(BASE_GESTION, TABLE_HORARIOS),
      fetchPaginated(BASE_GESTION, TABLE_ASIGNACION),
      fetchPaginated(BASE_NOMINA, TABLE_AREAS),
    ]);

    // Build area lookup: recordId → name
    const areaMap = new Map<string, string>();
    for (const a of areas) {
      areaMap.set(a.id, (a.fields["Nombre del Area"] as string) || "");
    }
    console.log("[DEBUG areas] count:", areas.length, "keys:", [...areaMap.keys()].slice(0, 3));
    const angi = personal.find((p) => (p.fields["ID Empleado"] as string)?.includes("0007"));
    if (angi) console.log("[DEBUG angi] Areas field:", angi.fields["Areas"]);

    // Map horarios by record ID for quick lookup
    const horariosMap = new Map<string, Record<string, unknown>>();
    for (const h of horarios) {
      horariosMap.set(h.id, h.fields);
    }

    // Enrich asignaciones: resolve ALL linked Horario records
    const asignacionesMapped = asignaciones.map((a) => {
      const horarioIds = (a.fields["Horario"] as string[]) || [];

      const horariosResueltos = horarioIds.map((hId) => {
        const f = horariosMap.get(hId);
        return {
          id: hId,
          nombre: f ? (f["Nombre_Horario"] as string) || "" : "",
          dias: f ? (f["Dias_Laborales"] as string[]) || [] : [],
          totalHoras: f ? (f["Total_Horas_Dia"] as number) || 0 : 0,
        };
      });

      return {
        id: a.id,
        idAsignacion: a.fields["ID Asignacion Horario"] || "",
        idCoreUsuario: (a.fields["ID Core Usuario Asignado"] as string) || "",
        cedula: (a.fields["Cedula_Empleado"] as string) || "",
        nombre: (a.fields["Nombre_Empleado"] as string) || "",
        horarioIds,
        horarios: horariosResueltos,
        horarioNombres: horariosResueltos.map((h) => h.nombre).join(" + "),
        fechaInicio: (a.fields["Fecha_Inicio"] as string) || "",
        fechaFin: (a.fields["Fecha_Fin"] as string) || "",
        estado: (a.fields["Estado"] as string) || "",
        notas: (a.fields["Notas"] as string) || "",
      };
    });

    // Build empleados list
    const empleados = personal
      .filter((p) => p.fields["Estado de actividad"] === "Activo")
      .map((p) => ({
        id: p.id,
        idEmpleado: (p.fields["ID Empleado"] as string) || "",
        nombre: (p.fields["Nombre completo"] as string) || "",
        cedula: (p.fields["Numero Documento"] as string) || "",
        cargo: (p.fields["Cargo"] as string) || "",
        tipoPersonal: (p.fields["Tipo Personal"] as string) || "",
        area: (() => {
          const ids = (p.fields["Areas"] as string[]) || [];
          return ids.length > 0 ? (areaMap.get(ids[0]) || "Sin área") : "Sin área";
        })(),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Format horarios for frontend
    const horariosDisponibles = horarios
      .filter((h) => h.fields["Estado"] === "Activo")
      .map((h) => ({
        id: h.id,
        nombre: (h.fields["Nombre_Horario"] as string) || "",
        dias: (h.fields["Dias_Laborales"] as string[]) || [],
        horaEntrada: h.fields["Hora_Entrada"],
        horaSalida: h.fields["Hora_Salida"],
        totalHoras: h.fields["Total_Horas_Dia"],
        tipoJornada: h.fields["Tipo_Jornada"] || "",
      }));

    return NextResponse.json({
      empleados,
      horarios: horariosDisponibles,
      asignaciones: asignacionesMapped,
    });
  } catch (err) {
    console.error("[Horarios GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Crear nueva asignación (múltiples horarios) ───────────────────────

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para asignar horarios" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // horarioIds: array of record IDs (multiple schedules per assignment)
    const horarioIds: string[] = body.horarioIds || (body.horarioId ? [body.horarioId] : []);

    if (!body.cedula || !body.nombre || horarioIds.length === 0) {
      return NextResponse.json(
        { error: "Cédula, nombre y al menos un horario son obligatorios" },
        { status: 400 }
      );
    }

    // Deactivate any existing active assignment for this employee
    const existing = await fetchPaginated(
      BASE_GESTION,
      TABLE_ASIGNACION,
      `AND({Cedula_Empleado}='${escapeAirtableValue(body.cedula)}',{Estado}='Activo')`
    );

    for (const rec of existing) {
      await fetch(
        `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}/${rec.id}`,
        {
          method: "PATCH",
          headers: airtableHeaders(),
          body: JSON.stringify({
            fields: {
              Estado: "Inactivo",
              Fecha_Fin: new Date().toISOString().split("T")[0],
            },
          }),
        }
      );
    }

    // Create new assignment with multiple horarios
    const createUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}`;

    const fields: Record<string, unknown> = {
      "ID Core Usuario Asignado": body.idEmpleado || body.empleadoRecordId || "",
      Cedula_Empleado: body.cedula,
      Nombre_Empleado: body.nombre,
      Horario: horarioIds,
      Fecha_Inicio: body.fechaInicio || new Date().toISOString().split("T")[0],
      Estado: "Activo",
    };

    if (body.fechaFin) fields.Fecha_Fin = body.fechaFin;
    if (body.notas) fields.Notas = body.notas;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Horarios POST] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al crear asignación" }, { status: 500 });
    }

    const created = await res.json();
    return NextResponse.json({ ok: true, record: { id: created.id, fields: created.fields } });
  } catch (err) {
    console.error("[Horarios POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT: Actualizar asignación ──────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para modificar asignaciones" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID de la asignación es obligatorio" }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};

    if (body.horarioIds) fields.Horario = body.horarioIds;
    if (body.estado) fields.Estado = body.estado;
    if (body.fechaFin) fields.Fecha_Fin = body.fechaFin;
    if (body.notas !== undefined) fields.Notas = body.notas;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updateUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}/${body.id}`;

    const res = await fetch(updateUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Horarios PUT] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al actualizar asignación" }, { status: 500 });
    }

    const updated = await res.json();
    return NextResponse.json({ ok: true, record: { id: updated.id, fields: updated.fields } });
  } catch (err) {
    console.error("[Horarios PUT] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE: Desactivar asignación ───────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para eliminar asignaciones" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID de la asignación es obligatorio" }, { status: 400 });
    }

    const updateUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}/${body.id}`;

    const res = await fetch(updateUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Estado: "Inactivo",
          Fecha_Fin: new Date().toISOString().split("T")[0],
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Horarios DELETE] Airtable error:", res.status, errorText);
      return NextResponse.json({ error: "Error al desactivar asignación" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Horarios DELETE] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
