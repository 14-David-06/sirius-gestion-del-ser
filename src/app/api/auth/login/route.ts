/**
 * POST /api/auth/login
 *
 * Recibe { cedula, password } y verifica contra el hash almacenado en Airtable.
 * Retorna un JWT en una cookie httpOnly si es correcto.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyPassword, signJWT } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { cedula, password } = await req.json();

    if (!cedula || !password) {
      return NextResponse.json(
        { error: "Cédula y contraseña requeridos" },
        { status: 400 }
      );
    }

    const trimmedCedula = cedula.trim();

    // Buscar usuario
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
      return NextResponse.json(
        { error: "Error al consultar la base de datos" },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (!data.records || data.records.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 }
      );
    }

    const record = data.records[0];
    const storedHash = record.fields["Password"] as string;

    if (!storedHash) {
      return NextResponse.json(
        { error: "No tienes contraseña configurada. Debes crear una primero." },
        { status: 403 }
      );
    }

    // Verificar contraseña
    const valid = await verifyPassword(password, storedHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    // Generar JWT
    const nombre = (record.fields["Nombre completo"] as string) || "";
    const token = signJWT(
      {
        sub: record.id,
        cedula: trimmedCedula,
        nombre,
      },
      env.auth.jwtSecret
    );

    // Enviar token en cookie httpOnly
    const response = NextResponse.json({
      success: true,
      nombre,
    });

    response.cookies.set("sirius-auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24 horas
    });

    return response;
  } catch (error) {
    console.error("[login] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
