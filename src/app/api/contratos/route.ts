/**
 * API Contratos Laborales
 *
 * GET  /api/contratos?empleado_id=X  → Lista contratos (Admin: todos o filtrado; Empleado: solo los propios)
 * POST /api/contratos                → Crear contrato (Admin Depto+)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";
import {
  mapearContrato,
  generarIdContrato,
  generarIdHistorial,
  generarIdAlerta,
  calcularFechasAlerta,
  TIPOS_CON_FECHA_FIN,
  TipoAlerta,
  TipoContrato,
  PeriodicidadPago,
} from "@/lib/contratos/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const BASE_NC = env.airtable.baseNominaCore;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_HISTORY = env.airtable.tableContractsHistory;
const TABLE_ALERTAS = env.airtable.tableContractsAlertas;

function headers() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function airtableUrl(table: string, params?: Record<string, string>) {
  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const empleadoIdParam = searchParams.get("empleado_id");
    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");

    // Empleados regulares solo pueden ver sus propios contratos
    const idEmpleadoFiltro = isAdmin
      ? (empleadoIdParam || null)
      : (payload.idCore || null);

    let filterFormula = "";
    if (idEmpleadoFiltro) {
      const safe = escapeAirtableValue(idEmpleadoFiltro);
      filterFormula = `{ID_Empleado}='${safe}'`;
    }

    const params: Record<string, string> = {
      "sort[0][field]": "Fecha_Creacion",
      "sort[0][direction]": "desc",
    };
    if (filterFormula) params["filterByFormula"] = filterFormula;

    const res = await fetch(airtableUrl(TABLE_CONTRATOS, params), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Contratos GET] Airtable error:", res.status, await res.text());
      return NextResponse.json({ error: "Error al consultar contratos" }, { status: 500 });
    }

    const data = await res.json();
    const contratos = (data.records || []).map(mapearContrato);

    return NextResponse.json({ contratos });
  } catch (err) {
    console.error("[Contratos GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para crear contratos" }, { status: 403 });
    }

    const body = await req.json();
    const {
      id_empleado,
      tipo_contrato,
      fecha_inicio,
      fecha_fin,
      salario_base,
      periodicidad_pago,
      jornada_id,
      observaciones,
    } = body;

    // Validaciones básicas
    if (!id_empleado || !tipo_contrato || !fecha_inicio || salario_base == null) {
      return NextResponse.json(
        { error: "Campos requeridos: id_empleado, tipo_contrato, fecha_inicio, salario_base" },
        { status: 400 }
      );
    }

    const tiposValidos: TipoContrato[] = [
      "fijo", "indefinido", "obra_labor", "aprendizaje", "prestacion_servicios",
    ];
    if (!tiposValidos.includes(tipo_contrato as TipoContrato)) {
      return NextResponse.json({ error: `tipo_contrato inválido: ${tipo_contrato}` }, { status: 400 });
    }

    if ((tipo_contrato === "fijo" || tipo_contrato === "obra_labor") && !fecha_fin) {
      return NextResponse.json(
        { error: "Los contratos fijo y obra_labor requieren fecha_fin" },
        { status: 400 }
      );
    }

    // Obtener nombre del empleado desde Nómina Core
    const safeId = escapeAirtableValue(id_empleado);
    const empUrl = new URL(
      `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(env.airtable.tablePersonal)}`
    );
    empUrl.searchParams.set("filterByFormula", `{ID Empleado}='${safeId}'`);
    empUrl.searchParams.set("maxRecords", "1");
    empUrl.searchParams.set("fields[]", "Nombre completo");

    const empRes = await fetch(empUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    let nombreEmpleado = id_empleado;
    if (empRes.ok) {
      const empData = await empRes.json();
      if (empData.records?.length) {
        nombreEmpleado = (empData.records[0].fields["Nombre completo"] as string) || id_empleado;
      }
    }

    // Verificar que no haya contrato activo para el empleado
    const activoUrl = airtableUrl(TABLE_CONTRATOS, {
      filterByFormula: `AND({ID_Empleado}='${safeId}',{Estado}='activo')`,
      maxRecords: "1",
    });
    const activoRes = await fetch(activoUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });
    if (activoRes.ok) {
      const activoData = await activoRes.json();
      if (activoData.records?.length) {
        return NextResponse.json(
          { error: "El empleado ya tiene un contrato activo. Debe terminarlo antes de crear uno nuevo." },
          { status: 409 }
        );
      }
    }

    // Generar ID secuencial
    const countRes = await fetch(
      airtableUrl(TABLE_CONTRATOS, { "fields[]": "ID_Contrato" }),
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
    );
    const countData = countRes.ok ? await countRes.json() : { records: [] };
    const idContrato = generarIdContrato((countData.records?.length || 0) + 1);

    const ahora = new Date().toISOString();

    // Crear contrato
    const createRes = await fetch(airtableUrl(TABLE_CONTRATOS), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        fields: {
          ID_Contrato: idContrato,
          ID_Empleado: id_empleado,
          Nombre_Empleado: nombreEmpleado,
          Tipo_Contrato: tipo_contrato,
          Fecha_Inicio: fecha_inicio,
          ...(fecha_fin ? { Fecha_Fin: fecha_fin } : {}),
          Salario_Base: Number(salario_base),
          Periodicidad_Pago: (periodicidad_pago as PeriodicidadPago) || "mensual",
          ...(jornada_id ? { Jornada_ID: jornada_id } : {}),
          Estado: "activo",
          Version: 1,
          Creado_Por: payload.nombre || "Admin",
          ...(observaciones ? { Observaciones: observaciones } : {}),
          Fecha_Creacion: ahora,
          Fecha_Actualizacion: ahora,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("[Contratos POST] Airtable error:", createRes.status, err);
      return NextResponse.json({ error: "Error al crear contrato en Airtable" }, { status: 500 });
    }

    const contratoCreado = await createRes.json();

    // Registrar en historial (no bloqueante)
    const historialId = generarIdHistorial(contratoCreado.id, "crear");
    fetch(airtableUrl(TABLE_HISTORY), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        fields: {
          ID_Historial: historialId,
          ID_Contrato: idContrato,
          Accion: "crear",
          Valor_Nuevo: JSON.stringify({ tipo_contrato, fecha_inicio, fecha_fin, salario_base }),
          Modificado_Por: payload.nombre || "Admin",
          ID_Usuario_Modificador: payload.idCore || payload.sub,
          Timestamp: ahora,
        },
      }),
    }).catch((e) => console.error("[Contratos POST] historial:", e));

    // Crear alertas si el contrato tiene fecha fin (fijo u obra_labor)
    if (fecha_fin && TIPOS_CON_FECHA_FIN.includes(tipo_contrato as TipoContrato)) {
      const tipos: TipoAlerta[] = ["30_dias", "15_dias", "7_dias"];
      for (const tipoAlerta of tipos) {
        const fechaAlerta = calcularFechasAlerta(fecha_fin, tipoAlerta);
        fetch(airtableUrl(TABLE_ALERTAS), {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            fields: {
              ID_Alerta: generarIdAlerta(idContrato, tipoAlerta),
              ID_Contrato: idContrato,
              ID_Empleado: id_empleado,
              Nombre_Empleado: nombreEmpleado,
              Tipo_Alerta: tipoAlerta,
              Fecha_Vencimiento: fecha_fin,
              Fecha_Alerta: fechaAlerta,
              Enviada: false,
            },
          }),
        }).catch((e) => console.error(`[Contratos POST] alerta ${tipoAlerta}:`, e));
      }
    }

    return NextResponse.json({ ok: true, contrato: mapearContrato(contratoCreado) }, { status: 201 });
  } catch (err) {
    console.error("[Contratos POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
