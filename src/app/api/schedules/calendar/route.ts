/**
 * GET /api/schedules/calendar?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
 *
 * Requiere Admin Depto+.
 * Retorna el calendario de turnos de todos los empleados con asignación activa
 * en el rango de fechas indicado (máximo 31 días).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_ASIGNACION = env.airtable.tableAsignacionHorario;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;
const API_KEY = env.airtable.apiKey;

const DIA_A_INDICE: Record<string, number> = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  "Miércoles": 3,
  Miercoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Sabado: 6,
};

function secondsToHHMM(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(Number(seconds))) return "00:00";
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function esDiaLaboral(fecha: string, diasLaborales: string[]): boolean {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const indice = date.getUTCDay();
  return diasLaborales.some((dia) => DIA_A_INDICE[dia] === indice);
}

/**
 * Genera todas las fechas ISO entre fechaInicio y fechaFin (inclusive).
 */
function generarRangoFechas(fechaInicio: string, fechaFin: string): string[] {
  const fechas: string[] = [];
  const [sy, sm, sd] = fechaInicio.split("-").map(Number);
  const [ey, em, ed] = fechaFin.split("-").map(Number);
  const current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (current <= end) {
    fechas.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return fechas;
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

export async function GET(req: NextRequest) {
  // Autenticación
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // Solo Admin Depto+
  const role = getRoleFromPayload(payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para ver el calendario de turnos" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fechaInicio = searchParams.get("fecha_inicio");
  const fechaFin = searchParams.get("fecha_fin");

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

  // Limitar rango a 31 días
  const dias = generarRangoFechas(fechaInicio, fechaFin);
  if (dias.length > 31) {
    return NextResponse.json({ error: "El rango máximo permitido es de 31 días" }, { status: 400 });
  }

  try {
    const safeFechaInicio = escapeAirtableValue(fechaInicio);
    const safeFechaFin = escapeAirtableValue(fechaFin);

    // Obtener asignaciones activas que se solapan con el rango
    const formula = `AND(
      {Estado}='Activo',
      {Fecha_Inicio}<='${safeFechaFin}',
      OR(
        {Fecha_Fin}>='${safeFechaInicio}',
        {Fecha_Fin}=''
      )
    )`;

    const asignaciones = await fetchPaginated(BASE_GESTION, TABLE_ASIGNACION, formula);

    if (asignaciones.length === 0) {
      return NextResponse.json({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        empleados: [],
        total_empleados: 0,
      });
    }

    // Recopilar todos los IDs de horarios únicos para obtenerlos en batch
    const horarioIdsSet = new Set<string>();
    for (const asig of asignaciones) {
      const ids = (asig.fields["Horario"] as string[]) || [];
      ids.forEach((id) => horarioIdsSet.add(id));
    }

    // Obtener todos los horarios en paralelo (máximo ~10 simultáneos para no saturar la API)
    const horarioIds = [...horarioIdsSet];
    const horariosMap = new Map<string, Record<string, unknown>>();

    const BATCH_SIZE = 10;
    for (let i = 0; i < horarioIds.length; i += BATCH_SIZE) {
      const batch = horarioIds.slice(i, i + BATCH_SIZE);
      const horarioFetches = batch.map((hId) =>
        fetch(
          `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_HORARIOS)}/${hId}`,
          { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : null))
      );
      const resultados = await Promise.all(horarioFetches);
      for (const r of resultados) {
        if (r) horariosMap.set(r.id, r.fields);
      }
    }

    // Construir el calendario por empleado
    const empleadosMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        turno_por_dia: Record<
          string,
          { trabaja: boolean; horario_nombre: string | null; hora_inicio: string | null; hora_fin: string | null }
        >;
      }
    >();

    for (const asig of asignaciones) {
      const empleadoId = (asig.fields["ID Core Usuario Asignado"] as string) || asig.id;
      const empleadoNombre = (asig.fields["Nombre_Empleado"] as string) || "";
      const asigFechaInicio = (asig.fields["Fecha_Inicio"] as string) || "0000-00-00";
      const asigFechaFin = (asig.fields["Fecha_Fin"] as string) || "9999-12-31";

      if (!empleadosMap.has(empleadoId)) {
        empleadosMap.set(empleadoId, {
          id: empleadoId,
          nombre: empleadoNombre,
          turno_por_dia: {},
        });
      }

      const empleadoData = empleadosMap.get(empleadoId)!;
      const horarioIdsAsig = (asig.fields["Horario"] as string[]) || [];
      const horarioId = horarioIdsAsig[0];
      const hf = horarioId ? horariosMap.get(horarioId) : undefined;

      for (const fecha of dias) {
        // Solo aplica si la fecha está dentro del rango de la asignación
        if (fecha < asigFechaInicio || fecha > asigFechaFin) continue;
        // No sobrescribir si ya hay un turno asignado para ese día
        if (empleadoData.turno_por_dia[fecha]) continue;

        if (hf) {
          const diasLaborales = (hf["Dias_Laborales"] as string[]) || [];
          const trabaja = esDiaLaboral(fecha, diasLaborales);
          empleadoData.turno_por_dia[fecha] = {
            trabaja,
            horario_nombre: trabaja ? ((hf["Nombre_Horario"] as string) || null) : null,
            hora_inicio: trabaja ? secondsToHHMM(hf["Hora_Entrada"] as number) : null,
            hora_fin: trabaja ? secondsToHHMM(hf["Hora_Salida"] as number) : null,
          };
        } else {
          empleadoData.turno_por_dia[fecha] = {
            trabaja: false,
            horario_nombre: null,
            hora_inicio: null,
            hora_fin: null,
          };
        }
      }
    }

    // Completar días faltantes como no laborales
    for (const emp of empleadosMap.values()) {
      for (const fecha of dias) {
        if (!emp.turno_por_dia[fecha]) {
          emp.turno_por_dia[fecha] = {
            trabaja: false,
            horario_nombre: null,
            hora_inicio: null,
            hora_fin: null,
          };
        }
      }
    }

    const empleados = [...empleadosMap.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    );

    return NextResponse.json({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      empleados,
      total_empleados: empleados.length,
    });
  } catch (err) {
    console.error("[Calendar GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
