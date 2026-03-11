/**
 * POST /api/auth/set-password
 *
 * Recibe { cedula, password, confirmPassword } para usuarios que aún
 * no tienen contraseña. Hashea con scrypt y guarda en Airtable.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { hashPassword, signJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const { cedula, password, confirmPassword } = await req.json();

    if (!cedula || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const trimmedCedula = cedula.trim();
    const safeCedula = escapeAirtableValue(trimmedCedula);

    // Buscar usuario
    const filterFormula = `OR({Numero Documento}='${safeCedula}',{ID Empleado}='${safeCedula}')`;
    const searchUrl = new URL(
      `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${env.airtable.tablePersonal}`
    );
    searchUrl.searchParams.set("filterByFormula", filterFormula);
    searchUrl.searchParams.set("maxRecords", "1");

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${env.airtable.apiKey}` },
      cache: "no-store",
    });

    if (!searchRes.ok) {
      return NextResponse.json(
        { error: "Error al consultar la base de datos" },
        { status: 500 }
      );
    }

    const searchData = await searchRes.json();

    if (!searchData.records || searchData.records.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const record = searchData.records[0];

    // Verificar que NO tenga contraseña ya (evitar sobreescritura)
    if (record.fields["Password"]) {
      return NextResponse.json(
        { error: "Ya tienes una contraseña configurada. Usa el login normal." },
        { status: 409 }
      );
    }

    // Hashear y guardar
    const passwordHash = await hashPassword(password);

    const updateUrl = `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${env.airtable.tablePersonal}/${record.id}`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.airtable.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Password: passwordHash,
        },
      }),
    });

    if (!updateRes.ok) {
      const errorData = await updateRes.json().catch(() => ({}));
      console.error("[set-password] Airtable update error:", updateRes.status, errorData);
      return NextResponse.json(
        { error: "Error al guardar la contraseña" },
        { status: 500 }
      );
    }

    // Generar JWT (login automático después de crear contraseña)
    const nombre = (record.fields["Nombre completo"] as string) || "";
    const nivelAcceso = (record.fields["Nivel_Acceso"] as string | undefined) || "";
    const rol = nivelAcceso === "admin" || nivelAcceso === "rrhh" ? nivelAcceso : "empleado";

    const token = signJWT(
      {
        sub: record.id,
        cedula: trimmedCedula,
        nombre,
        rol,
      },
      env.auth.jwtSecret
    );

    const response = NextResponse.json({
      success: true,
      nombre,
    });

    response.cookies.set("sirius-auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    return response;
  } catch (error) {
    console.error("[set-password] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
