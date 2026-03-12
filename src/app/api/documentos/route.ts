/**
 * API de Gestión Documental — Registro de Cumplimiento
 *
 * GET   → Listar todos los registros con Tipo_Documento expandido
 * PATCH → Actualizar estado / campos de un registro (requiere `id` en body)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const TABLE_RC = env.airtable.tableRegistroCumplimiento;
const TABLE_TD = env.airtable.tableTipoDocumento;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

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

// ─── GET: Listar registros de cumplimiento + catálogo de tipos ───────────────

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  try {
    // Fetch Tipo_Documento (catalog) and Registro_Cumplimiento in parallel
    const [tiposDocs, registros] = await Promise.all([
      fetchAllRecords(TABLE_TD),
      fetchAllRecords(TABLE_RC),
    ]);

    // Build tipo documento lookup map
    const tipoMap = new Map<string, Record<string, unknown>>();
    for (const td of tiposDocs) {
      tipoMap.set(td.id, td.fields);
    }

    // Enrich registros with tipo documento info
    const enriched = registros.map((r) => {
      const tipoIds = (r.fields["Tipo Documento"] as string[]) || [];
      const tipoId = tipoIds[0];
      const tipo = tipoId ? tipoMap.get(tipoId) : null;

      return {
        id: r.id,
        fields: {
          "ID Registro": r.fields["ID Registro"] || "",
          "ID_Empleado": r.fields["ID_Empleado"] || "",
          "Nombre_Empleado": r.fields["Nombre_Empleado"] || "",
          "Código_Documento": tipo ? tipo["Código"] || "" : "",
          "Nombre_Documento": tipo ? tipo["Nombre del Documento"] || "" : "",
          "Capítulo": tipo ? tipo["Capítulo"] || "" : "",
          "Periodicidad": tipo ? tipo["Periodicidad"] || "" : "",
          "Estado": r.fields["Estado"] || "Pendiente",
          "Período": r.fields["Período"] || "",
          "Fecha de Cumplimiento": r.fields["Fecha de Cumplimiento"] || "",
          "Fecha de Carga": r.fields["Fecha de Carga"] || "",
          "Ruta_Carpeta": r.fields["Ruta_Carpeta"] || "",
          "URL_OneDrive": r.fields["URL_OneDrive"] || "",
          "Observaciones": r.fields["Observaciones"] || "",
          "Tipo_Documento_ID": tipoId || "",
        },
      };
    });

    return NextResponse.json({ registros: enriched, total: enriched.length });
  } catch (err) {
    console.error("[Documentos GET]", err);
    return NextResponse.json(
      { error: "Error al consultar registros documentales" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Actualizar un registro ───────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "Admin Depto")) {
    return NextResponse.json(
      { error: "No tienes permisos para modificar documentos" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Se requiere el ID del registro" },
        { status: 400 }
      );
    }

    // Only allow updating specific fields
    const allowedFields = [
      "Estado",
      "Fecha de Cumplimiento",
      "Fecha de Carga",
      "URL_OneDrive",
      "Ruta_Carpeta",
      "Observaciones",
      "ID_Responsable",
    ];

    const fields: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        fields[key] = updates[key];
      }
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron campos válidos para actualizar" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_RC)}/${id}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({ fields }),
      }
    );

    if (!res.ok) {
      const errData = await res.text();
      console.error("[Documentos PATCH] Airtable error:", res.status, errData);
      return NextResponse.json(
        { error: "Error al actualizar registro" },
        { status: 500 }
      );
    }

    const updated = await res.json();
    return NextResponse.json({ record: updated });
  } catch (err) {
    console.error("[Documentos PATCH]", err);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

// ─── Helper: fetch all paginated records ─────────────────────────────────────

async function fetchAllRecords(tableId: string) {
  const allRecords: Array<{
    id: string;
    fields: Record<string, unknown>;
    createdTime: string;
  }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableId)}`
    );
    if (offset) url.searchParams.set("offset", offset);
    url.searchParams.set("pageSize", "100");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}
