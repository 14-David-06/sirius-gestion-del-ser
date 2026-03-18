/**
 * GET /api/asistencia/summary?empleado_id=X&periodo=YYYY-MM
 *
 * Retorna el resumen de horas del empleado para el periodo indicado:
 * ordinarias, extras, nocturnas, dominicales, festivos y faltantes.
 *
 * Autorización:
 *  - El propio empleado puede consultar su resumen (payload.sub === empleado_id)
 *  - Admin Depto o superior puede consultar cualquier empleado
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

    // Query params
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get("empleado_id");
    const periodo    = searchParams.get("periodo"); // YYYY-MM

    if (!empleadoId || !periodo) {
      return NextResponse.json(
        { error: "Parámetros requeridos: empleado_id, periodo (YYYY-MM)" },
        { status: 400 }
      );
    }

    // Validar formato periodo
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      return NextResponse.json(
        { error: "Formato de periodo inválido. Usa YYYY-MM" },
        { status: 400 }
      );
    }

    // RBAC: empleado solo ve el suyo; Admin Depto+ puede ver cualquiera
    const role = getRoleFromPayload(payload);
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
    const safeAnio         = escapeAirtableValue(String(anio));

    // Fetch paralelo: registros de asistencia + asignación + festivos
    const [registrosRaw, asignacionRaw, festivosRaw] = await Promise.all([
      // Registros de asistencia del empleado en el periodo
      fetchFiltered(
        BASE_ID,
        "Registro_Asistencia",
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Fecha}>='${safeInicio}',{Fecha}<='${safeFin}')`
      ),
      // Asignación de horario activa
      fetchFiltered(
        BASE_ID,
        env.airtable.tableAsignacionHorario,
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Estado}='Activo')`,
        1
      ),
      // Festivos del año (tabla de festivos Colombia)
      fetchFiltered(
        BASE_ID,
        env.airtable.tableFestivosColombia,
        `FIND('${safeAnio}',{Fecha})`
      ),
    ]);

    // Obtener nombre del empleado
    let nombreEmpleado = "";
    const empRecord = await fetchById(BASE_NC, env.airtable.tablePersonal, empleadoId);
    if (empRecord) {
      nombreEmpleado =
        (empRecord.fields["Nombre completo"] as string) || "";
    }

    // Obtener configuración del horario desde la asignación
    let horarioConfig: HorarioConfig = {
      horaEntradaSeg: 8 * 3600,
      horaSalidaSeg:  17 * 3600,
      diasLaborales:  ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
      totalHorasDia:  8,
    };

    if (asignacionRaw.length > 0) {
      const asignacion = asignacionRaw[0];
      const horarioIds = (asignacion.fields["Horario"] as string[]) || [];

      if (horarioIds.length > 0) {
        const horarioRecord = await fetchById(
          BASE_ID,
          env.airtable.tableConfiguracionHorarios,
          horarioIds[0]
        );
        if (horarioRecord) {
          const f = horarioRecord.fields;
          horarioConfig = {
            horaEntradaSeg: (f["Hora_Entrada"] as number) ?? 8 * 3600,
            horaSalidaSeg:  (f["Hora_Salida"]  as number) ?? 17 * 3600,
            diasLaborales:  (f["Dias_Laborales"] as string[]) ?? [
              "Lunes", "Martes", "Miércoles", "Jueves", "Viernes",
            ],
            totalHorasDia:  (f["Horas_Dia"] as number) ?? 8,
          };
        }
      }
    }

    // Mapear registros de asistencia al formato de calcularHoras
    const registros: RegistroAsistencia[] = registrosRaw
      .filter(
        (r) =>
          r.fields["Tipo"] === "Entrada" || r.fields["Tipo"] === "Salida"
      )
      .map((r) => ({
        tipo:  r.fields["Tipo"]  as "Entrada" | "Salida",
        fecha: r.fields["Fecha"] as string,
        hora:  r.fields["Hora"]  as string,
      }));

    // Obtener array de fechas de festivos YYYY-MM-DD
    const festivos: string[] = festivosRaw
      .map((r) => r.fields["Fecha"] as string)
      .filter(Boolean);

    // Calcular horas
    const resultado = calcularHoras(registros, horarioConfig, festivos, inicio, fin);

    return NextResponse.json({
      empleado_id:   empleadoId,
      nombre:        nombreEmpleado,
      periodo,
      inicio,
      fin,
      ...resultado,
    });
  } catch (err) {
    console.error("[Asistencia Summary GET]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
