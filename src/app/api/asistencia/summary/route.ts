/**
 * GET /api/asistencia/summary
 *
 * Modos de uso:
 *  1. ?empleado_id=X&periodo=YYYY-MM    → Resumen individual
 *  2. ?equipo=true&periodo=YYYY-MM      → Resumen de todo el equipo (Admin Depto+)
 *
 * Retorna horas ordinarias, extras, nocturnas, dominicales, festivos y faltantes.
 * Incluye desglose diario cuando se consulta un empleado individual con ?detalle=true.
 *
 * Autorización:
 *  - El propio empleado puede consultar su resumen
 *  - Admin Depto o superior puede consultar cualquier empleado o el equipo completo
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, getRoleFromPayload, hasMinRole } from "@/lib/security";
import {
  calcularHoras,
  type RegistroAsistencia,
  type HorarioConfig,
} from "@/lib/asistencia/calcularHoras";
import { festivosColombia } from "@/lib/asistencia/festivosColombia";

export const dynamic = "force-dynamic";

const API_KEY  = env.airtable.apiKey;
const BASE_ID  = env.airtable.baseGestionDelSer;
const BASE_NC  = env.airtable.baseNominaCore;

function atHeaders() {
  return { Authorization: `Bearer ${API_KEY}` };
}

// ─── Helpers de fetch Airtable ────────────────────────────────────────────────

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchFiltered(
  baseId: string,
  table: string,
  formula: string,
  maxRecords?: number
): Promise<AirtableRecord[]> {
  const url = new URL(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`
  );
  url.searchParams.set("filterByFormula", formula);
  if (maxRecords) url.searchParams.set("maxRecords", String(maxRecords));

  const res = await fetch(url.toString(), {
    headers: atHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `[Airtable fetchFiltered] ${table} — ${res.status}: ${await res.text()}`
    );
  }
  const data = await res.json();
  return (data.records ?? []) as AirtableRecord[];
}

async function fetchById(
  baseId: string,
  table: string,
  recordId: string
): Promise<AirtableRecord | null> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${recordId}`;
  const res = await fetch(url, { headers: atHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

// ─── Helpers internos ──────────────────────────────────────────────────────

const HORARIO_DEFAULT: HorarioConfig = {
  horaEntradaSeg: 8 * 3600,
  horaSalidaSeg:  17 * 3600,
  diasLaborales:  ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  totalHorasDia:  8,
};

async function resolverHorario(asignacionRaw: AirtableRecord[]): Promise<HorarioConfig> {
  if (asignacionRaw.length === 0) return { ...HORARIO_DEFAULT };
  const horarioIds = (asignacionRaw[0].fields["Horario"] as string[]) || [];
  if (horarioIds.length === 0) return { ...HORARIO_DEFAULT };

  const horarioRecord = await fetchById(
    BASE_ID,
    env.airtable.tableConfiguracionHorarios,
    horarioIds[0]
  );
  if (!horarioRecord) return { ...HORARIO_DEFAULT };

  const f = horarioRecord.fields;
  return {
    horaEntradaSeg: (f["Hora_Entrada"] as number) ?? 8 * 3600,
    horaSalidaSeg:  (f["Hora_Salida"]  as number) ?? 17 * 3600,
    diasLaborales:  (f["Dias_Laborales"] as string[]) ?? HORARIO_DEFAULT.diasLaborales,
    totalHorasDia:  (f["Horas_Dia"] as number) ?? 8,
  };
}

function mapearRegistros(raw: AirtableRecord[]): RegistroAsistencia[] {
  return raw
    .filter((r) => r.fields["Tipo"] === "Entrada" || r.fields["Tipo"] === "Salida")
    .map((r) => ({
      tipo:  r.fields["Tipo"]  as "Entrada" | "Salida",
      fecha: r.fields["Fecha"] as string,
      hora:  r.fields["Hora"]  as string,
    }));
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth
    const token = request.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get("empleado_id");
    const periodo    = searchParams.get("periodo"); // YYYY-MM
    const equipo     = searchParams.get("equipo") === "true";

    if (!periodo) {
      return NextResponse.json(
        { error: "Parámetro requerido: periodo (YYYY-MM)" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return NextResponse.json(
        { error: "Formato de periodo inválido. Usa YYYY-MM" },
        { status: 400 }
      );
    }

    const role = getRoleFromPayload(payload);

    // ── Modo equipo: resumen de todos los empleados (Admin Depto+) ─────
    if (equipo) {
      if (!hasMinRole(role, "Admin Depto")) {
        return NextResponse.json({ error: "Se requiere Admin Depto o superior" }, { status: 403 });
      }

      const [anio, mes] = periodo.split("-").map(Number);
      const inicio = `${periodo}-01`;
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const fin = `${periodo}-${String(ultimoDia).padStart(2, "0")}`;
      const safeInicio = escapeAirtableValue(inicio);
      const safeFin    = escapeAirtableValue(fin);

      // Festivos calculados algorítmicamente (Ley Emiliani)
      const festivos = festivosColombia(anio);

      // Obtener todas las asignaciones activas y todos los registros del periodo
      const [asignaciones, todosRegistros] = await Promise.all([
        fetchFiltered(BASE_ID, env.airtable.tableAsignacionHorario, `{Estado}='Activo'`),
        fetchFiltered(BASE_ID, "Registro_Asistencia", `AND({Fecha}>='${safeInicio}',{Fecha}<='${safeFin}')`),
      ]);

      // Agrupar registros por cédula
      const registrosPorCedula = new Map<string, AirtableRecord[]>();
      for (const r of todosRegistros) {
        const cedula = (r.fields["Cedula"] as string) || "";
        if (!cedula) continue;
        if (!registrosPorCedula.has(cedula)) registrosPorCedula.set(cedula, []);
        registrosPorCedula.get(cedula)!.push(r);
      }

      // Procesar cada asignación (cada empleado con horario)
      const resultados = await Promise.all(
        asignaciones.map(async (asig) => {
          const cedula = (asig.fields["Cedula_Empleado"] as string) || "";
          const nombre = (asig.fields["Nombre_Empleado"] as string) || cedula;
          const horarioConfig = await resolverHorario([asig]);
          const regsEmpleado = registrosPorCedula.get(cedula) || [];
          const registros = mapearRegistros(regsEmpleado);
          const horas = calcularHoras(registros, horarioConfig, festivos, inicio, fin);

          return {
            cedula,
            nombre,
            horario: horarioConfig,
            ...horas,
          };
        })
      );

      // También incluir empleados sin asignación que tengan registros
      const cedulasConAsignacion = new Set(asignaciones.map((a) => a.fields["Cedula_Empleado"] as string));
      for (const [cedula, regs] of registrosPorCedula) {
        if (cedulasConAsignacion.has(cedula)) continue;
        const nombre = (regs[0]?.fields["Nombre_Empleado"] as string) || cedula;
        const registros = mapearRegistros(regs);
        const horas = calcularHoras(registros, HORARIO_DEFAULT, festivos, inicio, fin);
        resultados.push({ cedula, nombre, horario: HORARIO_DEFAULT, ...horas });
      }

      // Ordenar por nombre
      resultados.sort((a, b) => a.nombre.localeCompare(b.nombre));

      return NextResponse.json({
        modo: "equipo",
        periodo,
        inicio,
        fin,
        total_empleados: resultados.length,
        resultados,
      });
    }

    // ── Modo individual: resumen de un empleado ────────────────────────
    if (!empleadoId) {
      return NextResponse.json(
        { error: "Parámetro requerido: empleado_id o equipo=true" },
        { status: 400 }
      );
    }

    // RBAC: empleado solo ve el suyo; Admin Depto+ puede ver cualquiera
    if (payload.sub !== empleadoId && !hasMinRole(role, "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para consultar este empleado" }, { status: 403 });
    }

    // Calcular fechas inicio/fin del periodo
    const [anio, mes] = periodo.split("-").map(Number);
    const inicio = `${periodo}-01`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const fin = `${periodo}-${String(ultimoDia).padStart(2, "0")}`;

    const safeEmpleadoId   = escapeAirtableValue(empleadoId);
    const safeInicio       = escapeAirtableValue(inicio);
    const safeFin          = escapeAirtableValue(fin);

    // Festivos calculados algorítmicamente (Ley Emiliani)
    const festivos = festivosColombia(anio);

    // Fetch paralelo: registros de asistencia + asignación
    const [registrosRaw, asignacionRaw] = await Promise.all([
      fetchFiltered(
        BASE_ID,
        "Registro_Asistencia",
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Fecha}>='${safeInicio}',{Fecha}<='${safeFin}')`
      ),
      fetchFiltered(
        BASE_ID,
        env.airtable.tableAsignacionHorario,
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Estado}='Activo')`,
        1
      ),
    ]);

    // Obtener nombre del empleado
    let nombreEmpleado = "";
    const empRecord = await fetchById(BASE_NC, env.airtable.tablePersonal, empleadoId);
    if (empRecord) {
      nombreEmpleado =
        (empRecord.fields["Nombre completo"] as string) || "";
    }

    const horarioConfig = await resolverHorario(asignacionRaw);
    const registros = mapearRegistros(registrosRaw);

    // Calcular horas
    const resultado = calcularHoras(registros, horarioConfig, festivos, inicio, fin);

    // Desglose diario: registros individuales agrupados por fecha
    const detalleDiario: Record<string, { entradas: string[]; salidas: string[] }> = {};
    for (const r of registros) {
      if (!detalleDiario[r.fecha]) detalleDiario[r.fecha] = { entradas: [], salidas: [] };
      if (r.tipo === "Entrada") detalleDiario[r.fecha].entradas.push(r.hora);
      else detalleDiario[r.fecha].salidas.push(r.hora);
    }

    // Obtener novedades del empleado en el periodo
    const novedadesRaw = await fetchFiltered(
      BASE_ID,
      env.airtable.tableNovedadesAsistencia,
      `AND({Cedula_Empleado}='${escapeAirtableValue(empRecord?.fields["Numero Documento"] as string || "")}',OR({Fecha_Novedad}>='${safeInicio}',{Fecha_Inicio}>='${safeInicio}'))`
    ).catch(() => [] as AirtableRecord[]);

    const novedades = novedadesRaw.map((r) => ({
      tipo: r.fields["Tipo_Novedad"] as string || "",
      fecha: (r.fields["Fecha_Novedad"] as string) || (r.fields["Fecha_Inicio"] as string) || "",
      estado: r.fields["Estado"] as string || "",
      descripcion: r.fields["Descripcion"] as string || "",
    }));

    return NextResponse.json({
      modo: "individual",
      empleado_id: empleadoId,
      nombre: nombreEmpleado,
      periodo,
      inicio,
      fin,
      ...resultado,
      detalle_diario: detalleDiario,
      novedades,
    });
  } catch (err) {
    console.error("[Asistencia Summary GET]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
