/**
 * API de Novedades Nómina
 *
 * GET  → Retorna datos del empleado logueado desde Airtable Nomina Core
 * POST → Reenvía la novedad al webhook correspondiente (vacaciones / permiso / novedad)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ─── GET: Datos del empleado logueado ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Traer registro completo del empleado por record ID (sub del JWT)
    const url = `https://api.airtable.com/v0/${env.airtable.baseNominaCore}/${encodeURIComponent(env.airtable.tablePersonal)}/${payload.sub}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.airtable.apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Novedades GET] Airtable error:", res.status);
      return NextResponse.json(
        { error: "Error al consultar datos del empleado" },
        { status: 500 }
      );
    }

    const record = await res.json();
    const f = record.fields;

    return NextResponse.json({
      nombre: f["Nombre completo"] || payload.nombre || "",
      cedula: f["Numero Documento"] || payload.cedula || "",
      cargo: f["Cargo"] || f["cargo"] || "",
      area: f["Area"] || f["Área"] || "",
      correo: f["Correo electrónico"] || "",
      telefono: f["Teléfono"] || "",
    });
  } catch (error) {
    console.error("[Novedades GET]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── POST: Enviar solicitud al webhook ───────────────────────────────────────

const WEBHOOKS: Record<string, string> = {
  vacaciones: env.webhooks.vacaciones,
  permiso: env.webhooks.permiso,
  novedad_nomina: env.webhooks.novedadNomina,
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    // ── Novedad (FormData con audio) ──────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const webhookUrl = WEBHOOKS.novedad_nomina;
      const fwd = new FormData();

      // Copiar todos los campos al FormData de reenvío
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          fwd.append(key, value, value.name);
        } else {
          fwd.append(key, value);
        }
      }

      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        body: fwd,
      });

      if (!webhookRes.ok) {
        console.error("[Novedades POST novedad] Webhook error:", webhookRes.status);
        return NextResponse.json(
          { error: "Error al enviar novedad" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // ── Vacaciones / Permiso (JSON) ───────────────────────────────────────
    const body = await req.json();
    const { tipoSolicitud, ...data } = body;

    const webhookUrl = WEBHOOKS[tipoSolicitud];
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Tipo de solicitud inválido" },
        { status: 400 }
      );
    }

    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!webhookRes.ok) {
      console.error("[Novedades POST] Webhook error:", webhookRes.status);
      return NextResponse.json(
        { error: "Error al enviar la solicitud" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Novedades POST]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
