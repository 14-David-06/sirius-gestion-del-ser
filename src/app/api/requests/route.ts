/**
 * API Solicitudes
 *
 * GET  /api/requests  → Lista solicitudes con filtros
 * POST /api/requests  → Crear solicitud
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";
import {
  mapearSolicitud,
  generarIdSolicitud,
  TipoSolicitud,
} from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const BASE_NC = env.airtable.baseNominaCore;
const API_KEY = env.airtable.apiKey;
const TABLE_REQUESTS = env.airtable.tableRequestsRequests;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function baseUrl(table: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
}

// ─── Helper: Fetch paginado ──────────────────────────────────────────────────

/**
 * Obtiene todos los registros de una tabla Airtable con paginación automática.
 * Itera sobre el campo `offset` hasta obtener todos los registros.
 */
async function fetchPaginated(
  table: string,
  formula?: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const results: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`
    );
    if (formula) url.searchParams.set("filterByFormula", formula);
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

// ─── Helper: Resolver ID canónico del empleado ───────────────────────────────

/**
 * Devuelve el SIRIUS-PER-XXXX del empleado.
 * Fallback para sesiones emitidas antes de que idCore existiera en el JWT.
 */
async function resolverIdCore(payload: { sub: string; idCore?: string }): Promise<string> {
  if (payload.idCore) return payload.idCore;

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(env.airtable.tablePersonal)}/${payload.sub}`,
    { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
  );

  if (!res.ok) throw new Error("No se pudo resolver el ID del empleado desde Nómina Core");
  const data = await res.json();
  return (data.fields["ID Empleado"] as string) || payload.sub;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const empleadoIdParam = sp.get("empleado_id");
    const estadoParam = sp.get("estado");
    const tipoParam = sp.get("tipo");
    const fechaInicioParam = sp.get("fecha_inicio");
    const fechaFinParam = sp.get("fecha_fin");
    // Filtros de rango para Asistencia: consulta solicitudes que cubren una fecha específica
    const fechaInicioLte = sp.get("fecha_inicio_lte"); // Fecha_Inicio <= valor
    const fechaFinGte = sp.get("fecha_fin_gte");       // Fecha_Fin >= valor

    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");

    // Caso especial: estado=aprobado sin empleado_id se usa en el módulo Asistencia
    // para verificar vacaciones activas de todos los empleados — aplica a cualquier rol.
    const verTodo = isAdmin || (estadoParam === "aprobado" && !empleadoIdParam);
    const idEmpleadoFiltro = verTodo ? (empleadoIdParam || null) : (payload.idCore || null);

    // Construir condiciones de filtro
    const conditions: string[] = [];

    if (idEmpleadoFiltro) {
      const safe = escapeAirtableValue(idEmpleadoFiltro);
      conditions.push(`{Empleado_ID}='${safe}'`);
    }

    if (estadoParam) {
      const safeEstado = escapeAirtableValue(estadoParam);
      conditions.push(`{Estado}='${safeEstado}'`);
    }

    if (tipoParam) {
      const safeTipo = escapeAirtableValue(tipoParam);
      conditions.push(`{Tipo}='${safeTipo}'`);
    }

    if (fechaInicioParam) {
      const safe = escapeAirtableValue(fechaInicioParam);
      conditions.push(`{Fecha_Inicio}>='${safe}'`);
    }

    if (fechaFinParam) {
      const safe = escapeAirtableValue(fechaFinParam);
      conditions.push(`{Fecha_Inicio}<='${safe}'`);
    }

    // Filtros de rango para Asistencia
    // Permite consultar solicitudes que "cubren" una fecha específica
    // Uso: GET /api/requests?estado=aprobado&empleado_id=X&fecha_inicio_lte=YYYY-MM-DD&fecha_fin_gte=YYYY-MM-DD
    if (fechaInicioLte) {
      const safe = escapeAirtableValue(fechaInicioLte);
      conditions.push(`{Fecha_Inicio}<='${safe}'`);
    }

    if (fechaFinGte) {
      const safe = escapeAirtableValue(fechaFinGte);
      // Incluye solicitudes con Fecha_Fin >= valor O donde Fecha_Fin está vacía (permisos de horas)
      conditions.push(`OR({Fecha_Fin}>='${safe}',AND({Fecha_Fin}='',{Fecha_Inicio}>='${safe}'))`);
    }

    const formula =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
        ? conditions[0]
        : `AND(${conditions.join(",")})`;

    const records = await fetchPaginated(TABLE_REQUESTS, formula);
    const solicitudes = records.map(mapearSolicitud);

    return NextResponse.json({ solicitudes });
  } catch (err) {
    console.error("[Requests GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

const TIPOS_VALIDOS: TipoSolicitud[] = ["vacaciones", "permiso", "novedad_nomina"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const body = await req.json();
    const {
      tipo,
      subtipo,
      fechaInicio,
      fechaFin,
      duracionHoras,
      descripcion,
      soporteUrl,
      diasHabilesCalculados,
      adminDirecta,
      empleadoId: empleadoIdBody,
      nombreEmpleado: nombreEmpleadoBody,
    } = body as {
      tipo: string;
      subtipo?: string;
      fechaInicio: string;
      fechaFin?: string;
      duracionHoras?: number;
      descripcion: string;
      soporteUrl?: string;
      diasHabilesCalculados?: number;
      adminDirecta?: boolean;
      empleadoId?: string;
      nombreEmpleado?: string;
    };

    // Validaciones
    if (!tipo || !TIPOS_VALIDOS.includes(tipo as TipoSolicitud)) {
      return NextResponse.json(
        { error: `tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!fechaInicio || !DATE_REGEX.test(fechaInicio)) {
      return NextResponse.json(
        { error: "fechaInicio es requerida y debe estar en formato YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (tipo === "vacaciones" && !fechaFin) {
      return NextResponse.json(
        { error: "fechaFin es requerida para solicitudes de tipo vacaciones" },
        { status: 400 }
      );
    }

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "descripcion es requerida" }, { status: 400 });
    }

    // Determinar empleado y estado
    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    const esAdminDirecta = adminDirecta === true && isAdmin;

    let empleadoId: string;
    let nombreEmpleado: string;

    if (esAdminDirecta && empleadoIdBody) {
      empleadoId = empleadoIdBody;
      nombreEmpleado = nombreEmpleadoBody || empleadoIdBody;
    } else {
      empleadoId = await resolverIdCore(payload);
      nombreEmpleado = payload.nombre || empleadoId;
    }

    const estado = esAdminDirecta ? "aprobado" : "pendiente";

    // Generar ID secuencial contando registros existentes
    const countRes = await fetch(`${baseUrl(TABLE_REQUESTS)}?fields[]=ID_Solicitud`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    const countData = countRes.ok ? await countRes.json() : { records: [] };
    const idSolicitud = generarIdSolicitud(((countData.records as unknown[])?.length || 0) + 1);

    const ahora = new Date().toISOString();

    const createRes = await fetch(baseUrl(TABLE_REQUESTS), {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          ID_Solicitud: idSolicitud,
          Empleado_ID: empleadoId,
          Nombre_Empleado: nombreEmpleado,
          Tipo: tipo,
          ...(subtipo ? { Subtipo: subtipo } : {}),
          Fecha_Inicio: fechaInicio,
          ...(fechaFin ? { Fecha_Fin: fechaFin } : {}),
          ...(duracionHoras != null ? { Duracion_Horas: duracionHoras } : {}),
          ...(diasHabilesCalculados != null
            ? { Dias_Habiles_Calculados: diasHabilesCalculados }
            : {}),
          Descripcion: descripcion,
          ...(soporteUrl ? { Soporte_URL: soporteUrl } : {}),
          Estado: estado,
          Procesado_Nomina: false,
          Created_At: ahora,
          Updated_At: ahora,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("[Requests POST] Airtable error:", createRes.status, errText);
      return NextResponse.json({ error: "Error al crear la solicitud en Airtable" }, { status: 500 });
    }

    const created = await createRes.json();
    return NextResponse.json({ ok: true, solicitud: mapearSolicitud(created) }, { status: 201 });
  } catch (err) {
    console.error("[Requests POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
