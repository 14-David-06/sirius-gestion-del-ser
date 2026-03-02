/**
 * POST /api/auth/check-user
 *
 * Recibe { cedula } y busca en la tabla Personal de Nomina Core.
 * Retorna si el usuario existe y si ya tiene contraseña configurada.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { cedula } = await req.json();

    if (!cedula || typeof cedula !== "string") {
      return NextResponse.json(
        { error: "Número de cédula requerido" },
        { status: 400 }
      );
    }

    const trimmedCedula = cedula.trim();

    // Buscar en Airtable por "Numero Documento" o "ID Empleado"
    const filterFormula = `OR({Numero Documento}='${trimmedCedula}',{ID Empleado}='${trimmedCedula}')`;
    const url = new URL(
      `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${env.airtable.tablePersonal}`
    );
    url.searchParams.set("filterByFormula", filterFormula);
    url.searchParams.set("maxRecords", "1");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${env.airtable.apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[check-user] Airtable error:", res.status, errorBody);
      return NextResponse.json(
        { error: "Error al consultar la base de datos" },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (!data.records || data.records.length === 0) {
      return NextResponse.json(
        { exists: false, hasPassword: false },
        { status: 200 }
      );
    }

    const record = data.records[0];
    const hasPassword = !!record.fields["Password"];
    const nombre = (record.fields["Nombre completo"] as string) || "";

    return NextResponse.json({
      exists: true,
      hasPassword,
      nombre,
      recordId: record.id,
    });
  } catch (error) {
    console.error("[check-user] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
