/**
 * API Solicitudes — Nómina Pendientes
 *
 * GET /api/requests/nomina-pendientes → Lista solicitudes aprobadas pendientes de procesar por nómina
 *
 * Filtros:
 * - ?periodo=YYYY-MM → Filtra solicitudes cuyo rango intersecta con el mes indicado
 * - ?tipo=novedad_nomina → Filtra por tipo de solicitud
 *
 * Uso: El módulo de Nómina (futuro) consultará este endpoint para obtener
 * las novedades que debe incluir en el cálculo de nómina.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload, escapeAirtableValue } from "@/lib/security";
import { mapearSolicitud } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_REQUESTS = env.airtable.tableRequestsRequests;

async function fetchPaginated(
  formula: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const results: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_REQUESTS)}`
    );
    url.searchParams.set("filterByFormula", formula);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    results.push(...((data.records as Array<{ id: string; fields: Record<string, unknown> }>) ?? []));
    offset = data.offset as string | undefined;
  } while (offset);

  return results;
}

/**
 * Obtiene el primer y último día de un mes dado en formato YYYY-MM.
 */
function obtenerRangoMes(periodo: string): { inicioMes: string; finMes: string } {
  const [anio, mes] = periodo.split("-").map(Number);
  const inicioMes = `${anio}-${String(mes).padStart(2, "0")}-01`;

  // Último día del mes
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const finMes = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  return { inicioMes, finMes };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    // Solo admin puede consultar pendientes de nómina
    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para consultar pendientes de nómina" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const periodoParam = sp.get("periodo"); // YYYY-MM
    const tipoParam = sp.get("tipo");

    // Condiciones base: aprobadas y NO procesadas
    const conditions: string[] = [
      "{Estado}='aprobado'",
      "{Procesado_Nomina}=FALSE()",
    ];

    // Filtro por tipo
    if (tipoParam) {
      const safeTipo = escapeAirtableValue(tipoParam);
      conditions.push(`{Tipo}='${safeTipo}'`);
    }

    // Filtro por período: busca solicitudes cuyo rango (Fecha_Inicio..Fecha_Fin) intersecta con el mes
    if (periodoParam && /^\d{4}-\d{2}$/.test(periodoParam)) {
      const { inicioMes, finMes } = obtenerRangoMes(periodoParam);
      // Una solicitud intersecta con el mes si:
      // Fecha_Inicio <= finMes AND (Fecha_Fin >= inicioMes OR Fecha_Fin is blank AND Fecha_Inicio >= inicioMes)
      conditions.push(
        `AND({Fecha_Inicio}<='${finMes}',OR({Fecha_Fin}>='${inicioMes}',AND({Fecha_Fin}='',{Fecha_Inicio}>='${inicioMes}')))`
      );
    }

    const formula = conditions.length === 1
      ? conditions[0]
      : `AND(${conditions.join(",")})`;

    const records = await fetchPaginated(formula);
    const solicitudes = records.map(mapearSolicitud);

    return NextResponse.json({
      pendientes: solicitudes.map((s) => ({
        id: s.id,
        idSolicitud: s.idSolicitud,
        empleadoId: s.empleadoId,
        nombreEmpleado: s.nombreEmpleado,
        tipo: s.tipo,
        subtipo: s.subtipo,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        duracionHoras: s.duracionHoras,
        diasHabilesCalculados: s.diasHabilesCalculados,
        descripcion: s.descripcion,
      })),
      total: solicitudes.length,
    });
  } catch (err) {
    console.error("[Requests nomina-pendientes] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
