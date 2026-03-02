/**
 * POST /api/auth/logout
 *
 * Elimina la cookie de sesión.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set("sirius-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Eliminar cookie
  });

  return response;
}
