/**
 * GET /api/schedules/active-shift?empleado_id=recXXX&fecha=YYYY-MM-DD
 *
 * Retorna el turno activo de un empleado para una fecha específica.
 * Un empleado puede ver su propio turno. Admin Depto+ puede ver cualquiera.
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

// Mapa de nombre de día (en español) al índice getDay() de JS (0=domingo)
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

/**
 * Convierte segundos desde medianoche a formato "HH:MM".
 */
function secondsToHHMM(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(Number(seconds))) return "00:00";
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Determina si una fecha ISO (YYYY-MM-DD) es día laboral
 * según la lista de días del horario.
 */
function esDiaLaboral(fecha: string, diasLaborales: string[]): boolean {
  // Parsear la fecha como UTC para evitar desfase de zona horaria
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const indice = date.getUTCDay(); // 0=domingo
  return diasLaborales.some((dia) => DIA_A_INDICE[dia] === indice);
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

  const { searchParams } = new URL(req.url);
  // Si no se provee empleado_id, se usa el del JWT (empleado viendo su propio turno)
  const empleadoId = searchParams.get("empleado_id") || payload.sub;
  const fecha = searchParams.get("fecha");

  // Validación de parámetros
  if (!empleadoId) {
    return NextResponse.json({ error: "El parámetro empleado_id es obligatorio" }, { status: 400 });
  }

  if (!fecha) {
    return NextResponse.json({ error: "El parámetro fecha es obligatorio (YYYY-MM-DD)" }, { status: 400 });
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" }, { status: 400 });
  }
  const fechaDate = new Date(fecha + "T00:00:00Z");
  if (isNaN(fechaDate.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  // RBAC: un empleado solo puede ver su propio turno
  const role = getRoleFromPayload(payload);
  const esAdmin = hasMinRole(role, "Admin Depto");
  if (!esAdmin && empleadoId !== payload.sub) {
    return NextResponse.json(
      { error: "No tienes permisos para ver el turno de otro empleado" },
      { status: 403 }
    );
  }

  try {
    const safeFecha = escapeAirtableValue(fecha);

    // Resolver el ID Core (SIRIUS-PER-XXXX) del empleado.
    // Si se proporcionó empleado_id explícito (admin), se usa directamente.
    // Si el JWT ya trae idCore (sesión reciente), se usa.
    // Fallback: consultar la tabla Personal para obtenerlo.
    let idCoreResuelto: string | null = null;

    if (searchParams.get("empleado_id")) {
      // Admin especificó el ID directamente — debe ser SIRIUS-PER-XXXX
      idCoreResuelto = empleadoId;
    } else if (payload.idCore) {
      // JWT reciente ya incluye el ID Core
      idCoreResuelto = payload.idCore;
    } else {
      // Sesión antigua sin idCore en el JWT — consultar Personal
      const personalUrl = `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${encodeURIComponent(env.airtable.tablePersonal)}/${payload.sub}`;
      const personalRes = await fetch(personalUrl, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      });
      if (personalRes.ok) {
        const personalRecord = await personalRes.json();
        idCoreResuelto = (personalRecord.fields["ID Empleado"] as string) || null;
      }
    }

    if (!idCoreResuelto) {
      return NextResponse.json({
        tiene_turno: false,
        empleado_id: empleadoId,
        fecha,
        dia_laboral: false,
        horario: null,
      });
    }

    const safeIdCore = escapeAirtableValue(idCoreResuelto);

    // Buscar asignaciones activas donde la fecha esté dentro del rango
    // Incluye asignaciones sin Fecha_Fin (contrato indefinido)
    const formula = `AND(
      {ID Core Usuario Asignado}='${safeIdCore}',
      {Estado}='Activo',
      {Fecha_Inicio}<='${safeFecha}',
      OR(
        {Fecha_Fin}>='${safeFecha}',
        {Fecha_Fin}=''
      )
    )`;

    const asignaciones = await fetchPaginated(BASE_GESTION, TABLE_ASIGNACION, formula);

    // Sin asignación activa
    if (asignaciones.length === 0) {
      return NextResponse.json({
        tiene_turno: false,
        empleado_id: empleadoId,
        fecha,
        dia_laboral: false,
        horario: null,
      });
    }

    // Tomar la primera asignación vigente (la más reciente por Fecha_Inicio)
    const asignacion = asignaciones[0];
    const horarioIds = (asignacion.fields["Horario"] as string[]) || [];

    if (horarioIds.length === 0) {
      return NextResponse.json({
        tiene_turno: false,
        empleado_id: empleadoId,
        fecha,
        dia_laboral: false,
        horario: null,
      });
    }

    // Resolver TODOS los horarios vinculados y seleccionar el que aplica para la fecha.
    // Si ninguno aplica, se retorna el primero como referencia visual con dia_laboral=false.
    const horariosResueltos = await Promise.all(
      horarioIds.map(async (horarioId) => {
        const horarioUrl = `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_HORARIOS)}/${horarioId}`;
        const horarioRes = await fetch(horarioUrl, {
          headers: { Authorization: `Bearer ${API_KEY}` },
          cache: "no-store",
        });
        if (!horarioRes.ok) return null;

        const horarioRecord = await horarioRes.json();
        const hf = horarioRecord.fields as Record<string, unknown>;
        const diasLaborales = (hf["Dias_Laborales"] as string[]) || [];
        return {
          horarioRecord,
          hf,
          diasLaborales,
          diaLaboral: esDiaLaboral(fecha, diasLaborales),
        };
      })
    );

    const horariosValidos = horariosResueltos.filter(
      (h): h is NonNullable<typeof h> => h !== null
    );

    if (horariosValidos.length === 0) {
      return NextResponse.json({ error: "Error al obtener datos del horario" }, { status: 500 });
    }

    const horarioDelDia = horariosValidos.find((h) => h.diaLaboral);
    const seleccionado = horarioDelDia ?? horariosValidos[0];
    const { horarioRecord, hf, diasLaborales } = seleccionado;
    const diaLaboral = Boolean(horarioDelDia);

    const horaInicioSeg = hf["Hora_Entrada"] as number;
    const horaFinSeg = hf["Hora_Salida"] as number;

    return NextResponse.json({
      tiene_turno: true,
      empleado_id: empleadoId,
      fecha,
      dia_laboral: diaLaboral,
      horario: {
        id: horarioRecord.id,
        nombre: (hf["Nombre_Horario"] as string) || "",
        hora_inicio: secondsToHHMM(horaInicioSeg),
        hora_fin: secondsToHHMM(horaFinSeg),
        hora_inicio_seg: horaInicioSeg ?? 0,
        hora_fin_seg: horaFinSeg ?? 0,
        dias_laborales: diasLaborales,
        total_horas_dia: (hf["Total_Horas_Dia"] as number) || 0,
        tolerancia_min: (hf["Tolerancia_Min"] as number) || 0,
      },
    });
  } catch (err) {
    console.error("[ActiveShift GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
