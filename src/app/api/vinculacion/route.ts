/**
 * API de Vinculación — CRUD de Personal
 *
 * GET    → Listar todos los empleados desde Nomina Core → Personal
 * POST   → Crear un nuevo registro de personal
 * PUT    → Actualizar un registro existente (requiere `id` en body)
 * DELETE → Eliminar un registro (requiere `id` en body)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseNominaCore;
const TABLE = env.airtable.tablePersonal;
const TABLE_AREAS = env.airtable.tableAreas;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Authenticate request — returns JWT payload or error response */
function authenticate(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return { error: NextResponse.json({ error: "Token inválido" }, { status: 401 }) };
  }
  return { payload };
}

// ─── GET: Listar todo el personal ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  try {
    // Fetch Personal + Areas in parallel
    const fetchPaginated = async (table: string, sort?: string) => {
      const records: Array<{ id: string; fields: Record<string, unknown>; createdTime: string }> = [];
      let offset: string | undefined;
      do {
        const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`);
        if (offset) url.searchParams.set("offset", offset);
        if (sort) {
          url.searchParams.set("sort[0][field]", sort);
          url.searchParams.set("sort[0][direction]", "asc");
        }
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" });
        if (!res.ok) throw new Error(`Airtable ${table} error: ${res.status}`);
        const data = await res.json();
        records.push(...data.records);
        offset = data.offset;
      } while (offset);
      return records;
    };

    const [allRecords, areasRecords] = await Promise.all([
      fetchPaginated(TABLE, "ID Empleado"),
      fetchPaginated(TABLE_AREAS),
    ]);

    // Build Areas lookup: recordId → area name
    const areaMap = new Map<string, string>();
    for (const a of areasRecords) {
      areaMap.set(a.id, (a.fields["Nombre del Area"] as string) || "");
    }

    // Resolve linked Areas for each employee
    const personal = allRecords.map((r) => {
      const areaIds = (r.fields["Areas"] as string[]) || [];
      const areaName = areaIds.length > 0 ? (areaMap.get(areaIds[0]) || "") : "";

      return {
        id: r.id,
        createdTime: r.createdTime,
        fields: {
          "ID Empleado": r.fields["ID Empleado"] || "",
          "Nombre completo": r.fields["Nombre completo"] || "",
          "Tipo Personal": r.fields["Tipo Personal"] || "",
          "Estado de actividad": r.fields["Estado de actividad"] || "",
          "Correo electrónico": r.fields["Correo electrónico"] || "",
          "Teléfono": r.fields["Teléfono"] || "",
          "Numero Documento": r.fields["Numero Documento"] || "",
          "Cargo": r.fields["Cargo"] || (r.fields["Rol (from Rol)"] as string[] | undefined)?.[0] || "",
          "Area": areaName,
          "Fecha de Ingreso": r.fields["Fecha de incorporación"] || r.fields["Fecha de Ingreso"] || "",
          "Fecha de Retiro": r.fields["Fecha de Retiro"] || "",
        },
      };
    });

    return NextResponse.json({ personal, areas: areasRecords.map((a) => ({ id: a.id, name: (a.fields["Nombre del Area"] as string) || "" })) });
  } catch (err) {
    console.error("[Vinculacion GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Crear nuevo registro de personal ──────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para crear registros" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Validaciones básicas
    if (!body.nombreCompleto || !body.tipoPersonal) {
      return NextResponse.json(
        { error: "Nombre completo y Tipo Personal son obligatorios" },
        { status: 400 }
      );
    }

    const fields: Record<string, unknown> = {
      "Nombre completo": body.nombreCompleto,
      "Tipo Personal": body.tipoPersonal,
      "Estado de actividad": body.estadoActividad || "Activo",
    };

    if (body.correo) fields["Correo electrónico"] = body.correo;
    if (body.telefono) fields["Teléfono"] = body.telefono;
    if (body.cedula) fields["Numero Documento"] = body.cedula;
    if (body.cargo) fields["Cargo"] = body.cargo;
    if (body.area) fields["Area"] = body.area;
    if (body.fechaIngreso) fields["Fecha de Ingreso"] = body.fechaIngreso;

    const createUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

    const res = await fetch(createUrl, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Vinculacion POST] Airtable error:", res.status, errorText);
      return NextResponse.json(
        { error: "Error al crear registro en Airtable" },
        { status: 500 }
      );
    }

    const created = await res.json();

    return NextResponse.json({
      ok: true,
      record: {
        id: created.id,
        fields: created.fields,
      },
    });
  } catch (err) {
    console.error("[Vinculacion POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── PUT: Actualizar registro existente ──────────────────────────────────────

export async function PUT(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json({ error: "No tienes permisos para editar registros" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID del registro es obligatorio" }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};

    if (body.nombreCompleto !== undefined) fields["Nombre completo"] = body.nombreCompleto;
    if (body.tipoPersonal !== undefined) fields["Tipo Personal"] = body.tipoPersonal;
    if (body.estadoActividad !== undefined) fields["Estado de actividad"] = body.estadoActividad;
    if (body.correo !== undefined) fields["Correo electrónico"] = body.correo;
    if (body.telefono !== undefined) fields["Teléfono"] = body.telefono;
    if (body.cedula !== undefined) fields["Numero Documento"] = body.cedula;
    if (body.cargo !== undefined) fields["Cargo"] = body.cargo;
    if (body.area !== undefined) fields["Area"] = body.area;
    if (body.fechaIngreso !== undefined) fields["Fecha de Ingreso"] = body.fechaIngreso;
    if (body.fechaRetiro !== undefined) fields["Fecha de Retiro"] = body.fechaRetiro;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updateUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${body.id}`;

    const res = await fetch(updateUrl, {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Vinculacion PUT] Airtable error:", res.status, errorText);
      return NextResponse.json(
        { error: "Error al actualizar registro en Airtable" },
        { status: 500 }
      );
    }

    const updated = await res.json();

    return NextResponse.json({
      ok: true,
      record: {
        id: updated.id,
        fields: updated.fields,
      },
    });
  } catch (err) {
    console.error("[Vinculacion PUT] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── DELETE: Eliminar registro ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Super Admin")) {
    return NextResponse.json({ error: "Solo administradores pueden eliminar registros" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "ID del registro es obligatorio" }, { status: 400 });
    }

    const deleteUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${body.id}`;

    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Vinculacion DELETE] Airtable error:", res.status, errorText);
      return NextResponse.json(
        { error: "Error al eliminar registro en Airtable" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, deletedId: body.id });
  } catch (err) {
    console.error("[Vinculacion DELETE] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
