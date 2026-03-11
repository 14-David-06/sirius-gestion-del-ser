/**
 * API de Carga Documental — Subida a OneDrive
 *
 * POST → Recibe un archivo + ID del registro de cumplimiento,
 *         sube el archivo a la carpeta OneDrive correspondiente,
 *         y actualiza el registro en Airtable con la URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, validateOneDrivePath } from "@/lib/security";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const TABLE_RC = env.airtable.tableRegistroCumplimiento;
const API_KEY = env.airtable.apiKey;

const MS_TENANT = env.microsoft.tenantId;
const MS_CLIENT = env.microsoft.clientId;
const MS_SECRET = env.microsoft.clientSecret;
const MS_EMAIL = env.microsoft.email;

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

/** Gets a Microsoft Graph access token using client credentials flow */
async function getGraphToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: MS_CLIENT,
    client_secret: MS_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Upload] Token error:", res.status, text);
    throw new Error("No se pudo obtener token de Microsoft Graph");
  }

  const data = await res.json();
  return data.access_token as string;
}

/** Sanitize filename — remove path traversal, keep only the basename */
function sanitizeFilename(name: string): string {
  const basename = name.replace(/^.*[\\/]/, "");
  // Remove any characters that could cause issues in OneDrive
  return basename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "archivo";
}

// ─── POST: Upload file to OneDrive ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const role = getRoleFromPayload(auth.payload);
  if (!hasMinRole(role, "rrhh")) {
    return NextResponse.json(
      { error: "No tienes permisos para subir archivos" },
      { status: 403 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const recordId = formData.get("recordId") as string | null;
    const rutaCarpeta = formData.get("rutaCarpeta") as string | null;

    if (!file || !recordId || !rutaCarpeta) {
      return NextResponse.json(
        { error: "Se requiere archivo, recordId y rutaCarpeta" },
        { status: 400 },
      );
    }

    // Validar ruta contra allowlist (prevenir path traversal)
    if (!validateOneDrivePath(rutaCarpeta)) {
      return NextResponse.json(
        { error: "Ruta de carpeta no válida" },
        { status: 400 },
      );
    }

    // Validate file size (max 50MB for simple upload)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 50 MB" },
        { status: 400 },
      );
    }

    const filename = sanitizeFilename(file.name);
    // rutaCarpeta comes like "Gestion del Ser/01_VLC_VINCULACION_LABORAL/_Empleados/Name"
    // Build the full OneDrive path
    const onedrivePath = `${rutaCarpeta}/${filename}`;

    // 1. Get Graph access token
    const accessToken = await getGraphToken();

    // 2. Upload file to OneDrive
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadUrl =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_EMAIL)}` +
      `/drive/root:/${encodeURIComponent(onedrivePath).replace(/%2F/g, "/")}:/content`;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("[Upload] OneDrive upload error:", uploadRes.status, errText);
      return NextResponse.json(
        { error: "Error al subir archivo a OneDrive" },
        { status: 500 },
      );
    }

    const uploadData = await uploadRes.json();
    const driveItemId = uploadData.id as string;

    // 3. Create sharing link
    const shareRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_EMAIL)}/drive/items/${driveItemId}/createLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "view",
          scope: "organization",
        }),
      },
    );

    let shareUrl = uploadData.webUrl || "";
    if (shareRes.ok) {
      const shareData = await shareRes.json();
      shareUrl = shareData.link?.webUrl || shareUrl;
    }

    // 4. Update Airtable record with URL_OneDrive
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_RC)}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            URL_OneDrive: shareUrl,
            Estado: "Cumplido",
            "Fecha de Cumplimiento": new Date().toISOString().split("T")[0],
            "Fecha de Carga": new Date().toISOString().split("T")[0],
          },
        }),
      },
    );

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      console.error("[Upload] Airtable update error:", airtableRes.status, errText);
      // File was uploaded, but Airtable failed — still return success for the upload
      return NextResponse.json({
        success: true,
        url: shareUrl,
        warning: "Archivo subido pero no se pudo actualizar el registro",
      });
    }

    return NextResponse.json({
      success: true,
      url: shareUrl,
      filename,
      path: onedrivePath,
    });
  } catch (err) {
    console.error("[Upload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar la carga" },
      { status: 500 },
    );
  }
}
