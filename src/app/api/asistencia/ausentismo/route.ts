/**
 * POST /api/asistencia/ausentismo
 *
 * Cron/n8n endpoint — Detecta faltas injustificadas del día anterior.
 *
 * Para cada empleado activo con asignación de horario activa:
 *  1. Verifica si ayer fue día laboral según el horario asignado.
 *  2. Si fue día laboral y no existe ningún registro Entrada para ayer →
 *     crea novedad "Falta Injustificada" (Estado: "Pendiente").
 *  3. No duplica: si ya existe novedad de ese tipo y fecha, omite.
 *
 * Autorización:
 *  - Header: Authorization: Bearer <CRON_SECRET>
 *  - O JWT con rol Super Admin
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, getRoleFromPayload, hasMinRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const API_KEY = env.airtable.apiKey;
const BASE_ID = env.airtable.baseGestionDelSer;

// Nombres de día de la semana (índice 0 = Domingo)
const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function atHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Fecha de ayer en Colombia (UTC-5) como YYYY-MM-DD */
function ayerColombia(): string {
  const now = new Date();
  const bogota = new Date(
    now.getTime() - 5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000
  );
  bogota.setDate(bogota.getDate() - 1);
  return bogota.toISOString().split("T")[0];
}

/** Obtiene el nombre del día de la semana (Colombia) para una fecha YYYY-MM-DD */
function diaSemanaDesFecha(fecha: string): string {
  // Usar medianoche UTC para evitar desfase de zona horaria en el día
  const d = new Date(`${fecha}T12:00:00Z`);
  return DIAS_SEMANA[d.getUTCDay()];
}

async function fetchAll(
  table: string,
  formula?: string
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
    );
    if (formula) url.searchParams.set("filterByFormula", formula);
    if (offset)  url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `[Airtable fetchAll] ${table} — ${res.status}: ${await res.text()}`
      );
    }
    const data = await res.json();
    all.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);

  return all;
}

async function fetchFiltered(
  table: string,
  formula: string,
  maxRecords?: number
): Promise<AirtableRecord[]> {
  const url = new URL(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
  );
  url.searchParams.set("filterByFormula", formula);
  if (maxRecords) url.searchParams.set("maxRecords", String(maxRecords));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
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

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Autorización: CRON_SECRET o JWT Super Admin ──
    const authHeader = request.headers.get("Authorization") ?? "";
    const cronSecret = env.cron.cronSecret;

    let autorizado = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      autorizado = true;
    } else {
      const token = request.cookies.get("sirius-auth")?.value;
      if (token) {
        const payload = verifyJWT(token, env.auth.jwtSecret);
        if (payload) {
          const role = getRoleFromPayload(payload);
          autorizado = hasMinRole(role, "Super Admin");
        }
      }
    }

    if (!autorizado) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ayer        = ayerColombia();
    const diaSemana   = diaSemanaDesFecha(ayer);
    const safeAyer    = escapeAirtableValue(ayer);

    // Obtener todas las asignaciones de horario activas
    const asignaciones = await fetchAll(
      env.airtable.tableAsignacionHorario,
      `{Estado}='Activo'`
    );

    let procesados       = 0;
    let novedadesCreadas = 0;

    for (const asignacion of asignaciones) {
      procesados++;

      const empleadoId = asignacion.fields["Empleado_RecordID"] as string | undefined;
      const horarioIds = (asignacion.fields["Horario"] as string[]) || [];

      if (!empleadoId || !horarioIds.length) continue;

      // Obtener configuración del horario (días laborales)
      const horarioUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
        env.airtable.tableConfiguracionHorarios
      )}/${horarioIds[0]}`;
      const horarioRes = await fetch(horarioUrl, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      });
      if (!horarioRes.ok) continue;

      const horario = await horarioRes.json();
      const diasLaborales =
        (horario.fields["Dias_Laborales"] as string[]) ??
        ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

      // Verificar si ayer era día laboral según el horario
      if (!diasLaborales.includes(diaSemana)) continue;

      const safeEmpleadoId = escapeAirtableValue(empleadoId);

      // Verificar si existe algún registro de Entrada para ayer
      const entradas = await fetchFiltered(
        "Registro_Asistencia",
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Fecha}='${safeAyer}',{Tipo}='Entrada')`,
        1
      );

      if (entradas.length > 0) continue; // sí marcó entrada → no es falta

      // Verificar que no exista ya una novedad de Falta Injustificada para este día
      const safeAyer2 = escapeAirtableValue(ayer);
      const novedadExistente = await fetchFiltered(
        env.airtable.tableNovedadesAsistencia,
        `AND({Empleado_RecordID}='${safeEmpleadoId}',{Tipo_Novedad}='Falta Injustificada',{Fecha_Novedad}='${safeAyer2}')`,
        1
      );

      if (novedadExistente.length > 0) continue; // ya existe → no duplicar

      // Crear novedad Falta Injustificada
      const createUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
        env.airtable.tableNovedadesAsistencia
      )}`;

      const nombreEmpleado =
        (asignacion.fields["Nombre_Empleado"] as string) ||
        (asignacion.fields["Nombre"] as string) ||
        "";

      const cedulaEmpleado =
        (asignacion.fields["Cedula_Empleado"] as string) ||
        (asignacion.fields["Cedula"] as string) ||
        "";

      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: atHeaders(),
        body: JSON.stringify({
          fields: {
            Empleado_RecordID: empleadoId,
            Nombre_Empleado:   nombreEmpleado,
            Cedula_Empleado:   cedulaEmpleado,
            Tipo_Novedad:      "Falta Injustificada",
            Fecha_Novedad:     ayer,
            Fecha_Inicio:      ayer,
            Fecha_Fin:         ayer,
            Descripcion:       `Falta injustificada detectada automáticamente para el día ${ayer} (${diaSemana}).`,
            Estado:            "Pendiente",
            Usuario_Registro:  "Sistema (cron)",
          },
        }),
      });

      if (createRes.ok) {
        novedadesCreadas++;
      } else {
        console.error(
          `[Ausentismo POST] Error creando novedad para empleado ${empleadoId}:`,
          createRes.status,
          await createRes.text()
        );
      }
    }

    return NextResponse.json({ procesados, novedades_creadas: novedadesCreadas });
  } catch (err) {
    console.error("[Ausentismo POST]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
