/**
 * API de Novedades de Asistencia
 *
 * GET  → Lista novedades. Filtros opcionales: ?empleado_id=X, ?estado=Pendiente
 *        Empleado solo ve las suyas; Admin Depto+ puede ver todas.
 *
 * POST → Crear novedad manual (requiere Admin Depto+).
 *        Body: { empleado_id, tipo_novedad, fecha_inicio, fecha_fin, descripcion }
 *
 * PUT  → Aprobar o rechazar una novedad (requiere Admin Depto+).
 *        Body: { id, estado: "Aprobado"|"Rechazado", aprobado_por? }
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import {
  escapeAirtableValue,
  getRoleFromPayload,
  hasMinRole,
} from "@/lib/security";

export const dynamic = "force-dynamic";

const API_KEY = env.airtable.apiKey;
const BASE_ID = env.airtable.baseGestionDelSer;
const TABLE   = env.airtable.tableNovedadesAsistencia;

const TIPOS_VALIDOS = [
  "Incapacidad",
  "Licencia con goce",
  "Licencia sin goce",
  "Permiso",
  "Falta Injustificada",
] as const;

type TipoNovedad = (typeof TIPOS_VALIDOS)[number];
type EstadoNovedad = "Aprobado" | "Rechazado";

function atHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Fecha actual en Colombia (UTC-5) como YYYY-MM-DD */
function fechaHoyColombia(): string {
  const now = new Date();
  const bogota = new Date(
    now.getTime() - 5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000
  );
  return bogota.toISOString().split("T")[0];
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const empleadoIdParam = searchParams.get("empleado_id");
    const estadoParam     = searchParams.get("estado");

    const role = getRoleFromPayload(payload);
    const esAdmin = hasMinRole(role, "Admin Depto");

    // Si no es admin, forzar filtro al propio empleado
    const empleadoId = esAdmin
      ? (empleadoIdParam ?? null)
      : payload.sub;

    // Construir fórmula Airtable
    const filtros: string[] = [];

    if (empleadoId) {
      const safeId = escapeAirtableValue(empleadoId);
      filtros.push(`{Empleado_RecordID}='${safeId}'`);
    }

    if (estadoParam) {
      const safeEstado = escapeAirtableValue(estadoParam);
      filtros.push(`{Estado}='${safeEstado}'`);
    }

    const formula =
      filtros.length === 0
        ? ""
        : filtros.length === 1
        ? filtros[0]
        : `AND(${filtros.join(",")})`;

    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`
    );
    if (formula) url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("sort[0][field]", "Fecha_Novedad");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("maxRecords", "100");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Novedades GET] Airtable error:", res.status, await res.text());
      return NextResponse.json(
        { error: "Error al consultar novedades" },
        { status: 500 }
      );
    }

    const data = await res.json();

    const novedades = (data.records ?? []).map(
      (r: { id: string; fields: Record<string, unknown> }) => ({
        id:              r.id,
        empleadoId:      r.fields["Empleado_RecordID"] ?? "",
        nombre:          r.fields["Nombre_Empleado"]   ?? "",
        cedula:          r.fields["Cedula_Empleado"]   ?? "",
        tipoNovedad:     r.fields["Tipo_Novedad"]      ?? "",
        fechaInicio:     r.fields["Fecha_Inicio"]      ?? r.fields["Fecha_Novedad"] ?? "",
        fechaFin:        r.fields["Fecha_Fin"]         ?? "",
        descripcion:     r.fields["Descripcion"]       ?? "",
        estado:          r.fields["Estado"]            ?? "",
        aprobadoPor:     r.fields["Aprobado_Por"]      ?? "",
        fechaGestion:    r.fields["Fecha_Gestion"]     ?? "",
      })
    );

    return NextResponse.json({ novedades });
  } catch (err) {
    console.error("[Novedades GET]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Crear novedad manual ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const role = getRoleFromPayload(payload);
    if (!hasMinRole(role, "Admin Depto")) {
      return NextResponse.json(
        { error: "Se requiere rol Admin Depto o superior" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      empleado_id,
      tipo_novedad,
      fecha_inicio,
      fecha_fin,
      descripcion,
    } = body as {
      empleado_id:  string;
      tipo_novedad: string;
      fecha_inicio: string;
      fecha_fin:    string;
      descripcion:  string;
    };

    if (!empleado_id || !tipo_novedad || !fecha_inicio) {
      return NextResponse.json(
        { error: "Campos requeridos: empleado_id, tipo_novedad, fecha_inicio" },
        { status: 400 }
      );
    }

    if (!TIPOS_VALIDOS.includes(tipo_novedad as TipoNovedad)) {
      return NextResponse.json(
        {
          error: `Tipo de novedad inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: atHeaders(),
      body: JSON.stringify({
        fields: {
          Empleado_RecordID: empleado_id,
          Tipo_Novedad:      tipo_novedad,
          Fecha_Inicio:      fecha_inicio,
          Fecha_Fin:         fecha_fin    || "",
          Descripcion:       descripcion  || "",
          Fecha_Novedad:     fecha_inicio,
          Estado:            "Pendiente",
          Usuario_Registro:  payload.nombre || "",
        },
      }),
    });

    if (!res.ok) {
      console.error("[Novedades POST] Airtable error:", res.status, await res.text());
      return NextResponse.json(
        { error: "Error al crear la novedad" },
        { status: 500 }
      );
    }

    const created = await res.json();
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[Novedades POST]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT: Aprobar o rechazar novedad ─────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const role = getRoleFromPayload(payload);
    if (!hasMinRole(role, "Admin Depto")) {
      return NextResponse.json(
        { error: "Se requiere rol Admin Depto o superior" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      estado,
      aprobado_por,
    } = body as {
      id:           string;
      estado:       string;
      aprobado_por?: string;
    };

    if (!id || !estado) {
      return NextResponse.json(
        { error: "Campos requeridos: id, estado" },
        { status: 400 }
      );
    }

    const estadosValidos: EstadoNovedad[] = ["Aprobado", "Rechazado"];
    if (!estadosValidos.includes(estado as EstadoNovedad)) {
      return NextResponse.json(
        { error: "Estado inválido. Use 'Aprobado' o 'Rechazado'" },
        { status: 400 }
      );
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${escapeAirtableValue(id)}`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: atHeaders(),
      body: JSON.stringify({
        fields: {
          Estado:        estado,
          Aprobado_Por:  aprobado_por || payload.nombre || "",
          Fecha_Gestion: fechaHoyColombia(),
        },
      }),
    });

    if (!res.ok) {
      console.error("[Novedades PUT] Airtable error:", res.status, await res.text());
      return NextResponse.json(
        { error: "Error al actualizar la novedad" },
        { status: 500 }
      );
    }

    const updated = await res.json();
    return NextResponse.json({ ok: true, id: updated.id, estado: updated.fields?.Estado });
  } catch (err) {
    console.error("[Novedades PUT]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
