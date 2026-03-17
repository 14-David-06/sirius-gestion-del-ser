/**
 * API de Novedades Nómina
 *
 * GET  → Retorna datos del empleado logueado desde Airtable Nomina Core.
 * POST →
 *   1. Guarda la solicitud DIRECTAMENTE en la tabla Airtable correspondiente
 *      (Novedades_Asistencia, Solicitudes_Vacaciones, Solicitudes_Permisos)
 *      con relaciones normalizadas.
 *   2. Dispara el webhook de n8n de forma no-bloqueante para notificaciones
 *      y procesamiento de archivos adjuntos (firma, audio).
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ─── Airtable helpers ─────────────────────────────────────────────────────────

const AT_HEADERS = {
  Authorization:  `Bearer ${env.airtable.apiKey}`,
  "Content-Type": "application/json",
};

const BASE_GDS = env.airtable.baseGestionDelSer;

/** Fecha de hoy en Colombia (UTC-5). */
function fechaHoyColombia(): string {
  const now = new Date();
  const bogota = new Date(
    now.getTime() - 5 * 60 * 60 * 1000 + now.getTimezoneOffset() * 60 * 1000
  );
  return bogota.toISOString().split("T")[0];
}

/** Creates a record in an Airtable table. Returns the created record object. */
async function airtableCreate(
  tableName: string,
  fields: Record<string, unknown>
): Promise<{ id: string; fields: Record<string, unknown> }> {
  const url = `https://api.airtable.com/v0/${BASE_GDS}/${encodeURIComponent(tableName)}`;
  const res  = await fetch(url, {
    method:  "POST",
    headers: AT_HEADERS,
    body:    JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Airtable create ${tableName}] ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Fires a webhook in the background.
 * Never throws — errors are only logged.
 */
function fireWebhook(url: string, init: RequestInit): void {
  if (!url) return;
  fetch(url, init).catch((e) => console.error("[Webhook fire]", e));
}

/** Maps form permiso values to Airtable Single Select labels. */
const TIPO_PERMISO_MAP: Record<string, string> = {
  personal:   "Personal",
  medico:     "Médico",
  calamidad:  "Calamidad doméstica",
  maternidad: "Licencia de maternidad",
  paternidad: "Licencia de paternidad",
  bancaria:   "Diligencia bancaria",
};

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
      nombre:   f["Nombre completo"] || payload.nombre || "",
      cedula:   f["Numero Documento"] || payload.cedula || "",
      cargo:    f["Cargo"] || f["cargo"] || "",
      area:     f["Area"] || f["Área"] || "",
      correo:   f["Correo electrónico"] || "",
      telefono: f["Teléfono"] || "",
    });
  } catch (error) {
    console.error("[Novedades GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: Guardar solicitud + disparar webhook ───────────────────────────────

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

    // ── Novedad de asistencia (FormData con audio) ────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const nombre              = (formData.get("empleado")            as string) || payload.nombre || "";
      const cedula              = (formData.get("cedula")              as string) || payload.cedula || "";
      const transcripcion       = (formData.get("transcripcion")       as string) || "";
      const contexto            = (formData.get("contextoAsistencia")  as string) || "";
      const registroAsistenciaId = (formData.get("registroAsistenciaId") as string) || "";

      // 1. Guardar directamente en Novedades_Asistencia (texto + relaciones)
      const created = await airtableCreate("Novedades_Asistencia", {
        Nombre_Empleado:          nombre,
        Cedula_Empleado:          cedula,
        Empleado_RecordID:        payload.sub,
        Tipo_Novedad:             "Por fuera de horario",
        Fecha_Novedad:            fechaHoyColombia(),
        Descripcion:              transcripcion,
        Transcripcion_Voz:        transcripcion,
        Contexto_Asistencia:      contexto,
        ID_Registro_Asistencia:   registroAsistenciaId,
        // Linked record to Registro_Asistencia (same base)
        ...(registroAsistenciaId
          ? { Registro_Asistencia_Link: [registroAsistenciaId] }
          : {}),
        Estado:           "Pendiente",
        Usuario_Registro: payload.nombre,
      });

      // 2. Webhook (no-blocking) — n8n attaches audio file to created record
      const wUrl = env.webhooks.novedadNomina;
      if (wUrl) {
        const fwd = new FormData();
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) fwd.append(key, value, value.name);
          else fwd.append(key, value);
        }
        fwd.append("airtableRecordId", created.id);
        fwd.append("tableName", "Novedades_Asistencia");
        fireWebhook(wUrl, { method: "POST", body: fwd });
      }

      return NextResponse.json({ success: true, airtableId: created.id });
    }

    // ── Vacaciones / Permiso (JSON) ───────────────────────────────────────────
    const body = await req.json();
    const { tipoSolicitud, ...data } = body;

    // ── Vacaciones ─────────────────────────────────────────────────────────────
    if (tipoSolicitud === "vacaciones") {
      const created = await airtableCreate("Solicitudes_Vacaciones", {
        Nombre_Empleado:  data.nombre    || payload.nombre || "",
        Cedula_Empleado:  data.cedula    || payload.cedula || "",
        Empleado_RecordID: payload.sub,
        Cargo:            data.cargo     || "",
        Area:             data.area      || "",
        Fecha_Inicio:     data.fechavacaciones || "",
        Fecha_Fin:        data.fechaFinal      || "",
        Dias_Solicitados: parseInt(data.diasvacaciones, 10) || 0,
        Motivo:           data.motivo    || "",
        Estado:           "Pendiente",
        Usuario_Registro: payload.nombre,
      });

      // Webhook: n8n handles firma attachment + notifications
      fireWebhook(env.webhooks.vacaciones, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...data, airtableRecordId: created.id, tableName: "Solicitudes_Vacaciones" }),
      });

      return NextResponse.json({ success: true, airtableId: created.id });
    }

    // ── Permiso ────────────────────────────────────────────────────────────────
    if (tipoSolicitud === "permiso") {
      const tipoRaw      = (data.tipo as string) || "";
      const tipoAirtable = TIPO_PERMISO_MAP[tipoRaw.toLowerCase()] ?? "Otro";
      // If free-text (custom "otro" reason), prepend it to motivo for context
      const motivoFull   =
        tipoRaw && !TIPO_PERMISO_MAP[tipoRaw.toLowerCase()]
          ? `[${tipoRaw}] ${data.motivo || ""}`
          : (data.motivo || "");

      // Parse hours: "4 horas" → 4
      const horasNum = parseFloat(((data.horas as string) || "0").replace(/[^\d.]/g, "")) || 0;

      const created = await airtableCreate("Solicitudes_Permisos", {
        Nombre_Empleado:  data.nombre    || payload.nombre || "",
        Cedula_Empleado:  data.cedula    || payload.cedula || "",
        Empleado_RecordID: payload.sub,
        Tipo_Permiso:     tipoAirtable,
        Fecha_Permiso:    data.fechaPermiso || "",
        Duracion_Horas:   horasNum,
        Motivo:           motivoFull,
        Estado:           "Pendiente",
        Usuario_Registro: payload.nombre,
      });

      fireWebhook(env.webhooks.permiso, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...data, airtableRecordId: created.id, tableName: "Solicitudes_Permisos" }),
      });

      return NextResponse.json({ success: true, airtableId: created.id });
    }

    return NextResponse.json({ error: "Tipo de solicitud inválido" }, { status: 400 });

  } catch (error) {
    console.error("[Novedades POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
