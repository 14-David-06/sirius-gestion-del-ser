/**
 * API de Asistencia
 *
 * GET  → Retorna los registros de asistencia del empleado logueado
 *        (hoy + historial reciente). También devuelve info del empleado.
 * POST → Crea un nuevo registro de asistencia (entrada/salida) en Airtable.
 *        Responde con `fueraHorario: true` cuando la marcación cae fuera del
 *        horario asignado, para que el frontend active el formulario de novedad.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";

export const dynamic = "force-dynamic";

const TABLE_ASISTENCIA = "Registro_Asistencia";
const BASE_ID = env.airtable.baseGestionDelSer;
const BASE_NOMINA = env.airtable.baseNominaCore;
const API_KEY = env.airtable.apiKey;
const TABLE_ASIGNACION = env.airtable.tableAsignacionHorario;
const TABLE_HORARIOS = env.airtable.tableConfiguracionHorarios;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function airtableHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Fecha actual en zona horaria de Colombia (America/Bogota = UTC-5) */
function fechaHoyColombia(): string {
  const now = new Date();
  // Colombia is UTC -5
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000);
  return bogota.toISOString().split("T")[0];
}

/** Hora actual en Colombia formato HH:MM */
function horaAhoraColombia(): string {
  const now = new Date();
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000);
  const hh = String(bogota.getHours()).padStart(2, "0");
  const mm = String(bogota.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** ISO datetime for Airtable dateTime field (in Bogota tz, stored as UTC) */
function isoAhoraColombia(): string {
  return new Date().toISOString();
}

/** Tolerance in minutes for schedule comparison (±10 min grace period) */
const TOLERANCIA_MIN = 10;

/**
 * Fetches the active schedule assigned to an employee (by cédula) and
 * checks whether `horaHH:MM` falls within the allowed window.
 *
 * Returns:
 *  - `fueraHorario: false` when within schedule or no schedule exists.
 *  - `fueraHorario: true`  when outside schedule, with context strings.
 */
async function checkFueraHorario(
  cedula: string,
  tipo: "Entrada" | "Salida",
  horaHHMM: string  // "HH:MM"
): Promise<{ fueraHorario: boolean; horarioNombre?: string; horarioEsperado?: string }> {
  try {
    const safeCedula = escapeAirtableValue(cedula);

    // 1. Find active assignment for this employee
    const asignUrl = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_ASIGNACION)}`
    );
    asignUrl.searchParams.set(
      "filterByFormula",
      `AND({Cedula_Empleado}='${safeCedula}',{Estado}='Activo')`
    );
    asignUrl.searchParams.set("maxRecords", "1");

    const asignRes = await fetch(asignUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (!asignRes.ok) return { fueraHorario: false };

    const asignData = await asignRes.json();
    if (!asignData.records?.length) return { fueraHorario: false };

    const asignacion = asignData.records[0];
    const horarioIds: string[] = (asignacion.fields["Horario"] as string[]) || [];
    if (!horarioIds.length) return { fueraHorario: false };

    // 2. Fetch schedule details (first linked schedule)
    const horUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_HORARIOS)}/${horarioIds[0]}`;
    const horRes = await fetch(horUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (!horRes.ok) return { fueraHorario: false };

    const horario = await horRes.json();
    const f = horario.fields;

    // Hora_Entrada and Hora_Salida are stored as seconds from midnight (Airtable duration)
    const entradaSeg = f["Hora_Entrada"] as number | null;
    const salidaSeg  = f["Hora_Salida"]  as number | null;
    if (entradaSeg == null || salidaSeg == null) return { fueraHorario: false };

    const nombreHorario = (f["Nombre_Horario"] as string) || "Sin nombre";

    // 3. Convert current time to seconds from midnight
    const [hh, mm] = horaHHMM.split(":").map(Number);
    const ahoraSeg = hh * 3600 + mm * 60;

    // 4. Compare with ±tolerance window
    const toleranciaSeg = TOLERANCIA_MIN * 60;
    let fueraHorario = false;
    let horarioEsperado = "";

    const toHHMM = (seg: number) => {
      const h = Math.floor(seg / 3600).toString().padStart(2, "0");
      const m = Math.floor((seg % 3600) / 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    if (tipo === "Entrada") {
      // Alert if marked more than 10 min early OR more than 10 min late vs scheduled entry
      fueraHorario =
        ahoraSeg < entradaSeg - toleranciaSeg ||
        ahoraSeg > entradaSeg + toleranciaSeg;
      horarioEsperado = toHHMM(entradaSeg);
    } else {
      // Alert if marked more than 10 min early (salida anticipada) OR more than 10 min late
      fueraHorario =
        ahoraSeg < salidaSeg - toleranciaSeg ||
        ahoraSeg > salidaSeg + toleranciaSeg;
      horarioEsperado = toHHMM(salidaSeg);
    }

    return {
      fueraHorario,
      horarioNombre: nombreHorario,
      horarioEsperado: `${tipo === "Entrada" ? "Entrada esperada" : "Salida esperada"} a las ${horarioEsperado}`,
    };
  } catch {
    // Non-critical: if schedule check fails, allow the mark
    return { fueraHorario: false };
  }
}

// ─── GET: registros de asistencia del empleado ──────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Fetch employee info
    const empUrl = `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${encodeURIComponent(env.airtable.tablePersonal)}/${payload.sub}`;
    const empRes = await fetch(empUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    let nombreEmpleado = payload.nombre || "";
    let cedulaEmpleado = payload.cedula || "";
    if (empRes.ok) {
      const empRecord = await empRes.json();
      nombreEmpleado = empRecord.fields["Nombre completo"] || nombreEmpleado;
      cedulaEmpleado = empRecord.fields["Numero Documento"] || cedulaEmpleado;
    }

    // Fetch attendance records for this employee (filter by Empleado_RecordID)
    // Sort by Fecha_Hora descending to get most recent first
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_ASISTENCIA)}`
    );
    url.searchParams.set(
      "filterByFormula",
      `{Empleado_RecordID}='${payload.sub}'`
    );
    url.searchParams.set("sort[0][field]", "Fecha_Hora");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("maxRecords", "50");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Asistencia GET] Airtable error:", res.status, await res.text());
      return NextResponse.json(
        { error: "Error al consultar registros de asistencia" },
        { status: 500 }
      );
    }

    const data = await res.json();

    const hoy = fechaHoyColombia();

    // Map records to a cleaner structure
    const registros = (data.records || []).map(
      (r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        tipo: r.fields["Tipo"] || "",
        fecha: r.fields["Fecha"] || "",
        hora: r.fields["Hora"] || "",
        fechaHora: r.fields["Fecha_Hora"] || "",
        ubicacion: r.fields["Ubicacion"] || "",
        notas: r.fields["Notas"] || "",
      })
    );

    // Separate today's records
    const registrosHoy = registros.filter(
      (r: { fecha: string }) => r.fecha === hoy
    );

    return NextResponse.json({
      empleado: {
        recordId: payload.sub,
        nombre: nombreEmpleado,
        cedula: cedulaEmpleado,
      },
      hoy,
      registrosHoy,
      registros, // all recent records
    });
  } catch (err) {
    console.error("[Asistencia GET] Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── POST: crear nuevo registro de asistencia ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const body = await req.json();
    const tipo = body.tipo as string; // "Entrada" or "Salida"
    const ubicacion = (body.ubicacion as string) || "Plataforma Web";
    const notas = (body.notas as string) || "";

    if (!tipo || !["Entrada", "Salida"].includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo inválido. Debe ser 'Entrada' o 'Salida'" },
        { status: 400 }
      );
    }

    // Get employee info
    const empUrl = `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${encodeURIComponent(env.airtable.tablePersonal)}/${payload.sub}`;
    const empRes = await fetch(empUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    let nombreEmpleado = payload.nombre || "";
    let cedulaEmpleado = payload.cedula || "";
    if (empRes.ok) {
      const empRecord = await empRes.json();
      nombreEmpleado = empRecord.fields["Nombre completo"] || nombreEmpleado;
      cedulaEmpleado = empRecord.fields["Numero Documento"] || cedulaEmpleado;
    }

    const fecha = fechaHoyColombia();
    const hora = horaAhoraColombia();
    const fechaHora = isoAhoraColombia();

    // ── Check if marcación is within the employee's assigned schedule ──────
    const scheduleCheck = await checkFueraHorario(cedulaEmpleado, tipo as "Entrada" | "Salida", hora);

    // Create the record in Airtable
    const createUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_ASISTENCIA)}`;

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Empleado_RecordID: payload.sub,
          Nombre_Empleado: nombreEmpleado,
          Cedula: cedulaEmpleado,
          Tipo: tipo,
          Fecha: fecha,
          Hora: hora,
          Fecha_Hora: fechaHora,
          Ubicacion: ubicacion,
          Notas: notas,
        },
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("[Asistencia POST] Airtable error:", createRes.status, errorText);
      return NextResponse.json(
        { error: "Error al registrar asistencia en Airtable" },
        { status: 500 }
      );
    }

    const created = await createRes.json();

    // ── If outside schedule, auto-save novedad silently (no UI shown) ──────
    if (scheduleCheck.fueraHorario) {
      const novUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(env.airtable.tableNovedadesAsistencia)}`;
      const contexto = `${tipo} a las ${hora} — ${scheduleCheck.horarioEsperado ?? ""}${
        scheduleCheck.horarioNombre ? ` (${scheduleCheck.horarioNombre})` : ""
      }`;
      fetch(novUrl, {
        method: "POST",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            Nombre_Empleado:          nombreEmpleado,
            Cedula_Empleado:          cedulaEmpleado,
            Empleado_RecordID:        payload.sub,
            Tipo_Novedad:             "Por fuera de horario",
            Fecha_Novedad:            fecha,
            Contexto_Asistencia:      contexto,
            ID_Registro_Asistencia:   created.id,
            Registro_Asistencia_Link: [created.id],
            Estado:                   "Pendiente",
            Usuario_Registro:         nombreEmpleado,
          },
        }),
      }).catch((e) => console.error("[Asistencia POST] novedad auto-save:", e));
    }

    return NextResponse.json({
      ok: true,
      registro: {
        id: created.id,
        tipo,
        fecha,
        hora,
        fechaHora,
        ubicacion,
        nombreEmpleado,
      },
    });
  } catch (err) {
    console.error("[Asistencia POST] Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
