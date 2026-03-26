/**
 * GET  /api/schedules/assignments?empleado_id=SIRIUS-PER-XXXX → Asignación vigente del empleado
 * POST /api/schedules/assignments → Crear asignación (Admin Depto+), también escribe historial
 *
 * Wrapper semántico sobre Asignacion_Horarios con trazabilidad en schedules_historial.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_ASIGNACION = env.airtable.tableAsignacionHorario;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;
const TABLE_HISTORIAL = env.airtable.tableSchedulesHistorial;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function tableUrl(table: string) {
  return `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(table)}`;
}

async function fetchPaginated(
  table: string,
  formula: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const records: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;
  do {
    const url = new URL(tableUrl(table));
    if (offset) url.searchParams.set("offset", offset);
    url.searchParams.set("filterByFormula", formula);
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

// ─── GET: asignación vigente del empleado ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const empleadoId = searchParams.get("empleado_id") || payload.idCore;

    if (!empleadoId) {
      return NextResponse.json({ error: "empleado_id es obligatorio" }, { status: 400 });
    }

    // RBAC: empleados solo pueden ver su propia asignación
    const esAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    if (!esAdmin && empleadoId !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a esta asignación" }, { status: 403 });
    }

    const safeId = escapeAirtableValue(empleadoId);
    const asignaciones = await fetchPaginated(
      TABLE_ASIGNACION,
      `AND({ID Core Usuario Asignado}='${safeId}',{Estado}='Activo')`
    );

    if (asignaciones.length === 0) {
      return NextResponse.json({ asignacion: null });
    }

    // Tomar la asignación activa más reciente por Fecha_Inicio
    const asignacion = asignaciones.sort((a, b) => {
      const fa = String(a.fields["Fecha_Inicio"] || "");
      const fb = String(b.fields["Fecha_Inicio"] || "");
      return fb.localeCompare(fa);
    })[0];

    const horarioIds = (asignacion.fields["Horario"] as string[]) || [];

    // Resolver horarios vinculados (con cache de 5 min)
    const horarios = await Promise.all(
      horarioIds.map(async (hId) => {
        const res = await fetch(`${tableUrl(TABLE_HORARIOS)}/${hId}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
          next: { revalidate: 300 },
        });
        if (!res.ok) return null;
        const rec = await res.json();
        const f = rec.fields as Record<string, unknown>;
        return {
          id: rec.id,
          nombre: (f["Nombre_Horario"] as string) || "",
          diasLaborales: (f["Dias_Laborales"] as string[]) || [],
          horaEntradaSeg: (f["Hora_Entrada"] as number) ?? 0,
          horaSalidaSeg: (f["Hora_Salida"] as number) ?? 0,
          totalHorasDia: (f["Total_Horas_Dia"] as number) || 0,
          tipoJornada: (f["Tipo_Jornada"] as string) || "",
        };
      })
    );

    return NextResponse.json({
      asignacion: {
        id: asignacion.id,
        idCoreUsuario: (asignacion.fields["ID Core Usuario Asignado"] as string) || "",
        nombre: (asignacion.fields["Nombre_Empleado"] as string) || "",
        fechaInicio: (asignacion.fields["Fecha_Inicio"] as string) || "",
        fechaFin: (asignacion.fields["Fecha_Fin"] as string) || "",
        estado: (asignacion.fields["Estado"] as string) || "",
        notas: (asignacion.fields["Notas"] as string) || "",
        horarios: horarios.filter((h): h is NonNullable<typeof h> => h !== null),
      },
    });
  } catch (err) {
    console.error("[Assignments GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: crear asignación ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para crear asignaciones" }, { status: 403 });
    }

    const body = await req.json();
    const { idEmpleado, cedula, nombre, horarioIds, fechaInicio, fechaFin, notas } = body;

    if (!idEmpleado || !cedula || !nombre) {
      return NextResponse.json(
        { error: "idEmpleado, cedula y nombre son obligatorios" },
        { status: 400 }
      );
    }
    if (!Array.isArray(horarioIds) || horarioIds.length === 0) {
      return NextResponse.json({ error: "Al menos un horarioId es obligatorio" }, { status: 400 });
    }

    // Desactivar asignaciones activas previas
    const existing = await fetchPaginated(
      TABLE_ASIGNACION,
      `AND({ID Core Usuario Asignado}='${escapeAirtableValue(idEmpleado)}',{Estado}='Activo')`
    );
    for (const rec of existing) {
      await fetch(`${tableUrl(TABLE_ASIGNACION)}/${rec.id}`, {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: { Estado: "Inactivo", Fecha_Fin: new Date().toISOString().split("T")[0] },
        }),
      });
    }

    // Crear nueva asignación
    const fields: Record<string, unknown> = {
      "ID Core Usuario Asignado": idEmpleado,
      Cedula_Empleado: cedula,
      Nombre_Empleado: nombre,
      Horario: horarioIds,
      Fecha_Inicio: fechaInicio || new Date().toISOString().split("T")[0],
      Estado: "Activo",
    };
    if (fechaFin) fields.Fecha_Fin = fechaFin;
    if (notas) fields.Notas = notas;

    const createRes = await fetch(tableUrl(TABLE_ASIGNACION), {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!createRes.ok) {
      console.error("[Assignments POST] Airtable error:", await createRes.text());
      return NextResponse.json({ error: "Error al crear asignación" }, { status: 500 });
    }

    const created = await createRes.json();

    // Registrar en historial (no bloqueante)
    if (TABLE_HISTORIAL) {
      fetch(tableUrl(TABLE_HISTORIAL), {
        method: "POST",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            Entidad_Tipo: "asignacion",
            Entidad_ID: created.id,
            Accion: "crear",
            Datos_Nuevos: JSON.stringify(fields),
            Usuario_ID: payload.idCore || payload.sub,
            Usuario_Nombre: payload.nombre || "",
            Timestamp: new Date().toISOString(),
          },
        }),
      }).catch((e) => console.error("[Assignments POST] Error escribiendo historial:", e));
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[Assignments POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
