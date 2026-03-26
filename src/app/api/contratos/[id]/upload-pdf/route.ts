/**
 * Gestión de PDF de contratos en S3
 *
 * POST /api/contratos/:id/upload-pdf → Subir PDF firmado (Admin Depto+)
 * GET  /api/contratos/:id/upload-pdf → Obtener URL firmada de descarga (Admin y empleado propio)
 *
 * El PDF se almacena en S3 (nunca público).
 * El campo documento_url en Airtable guarda la S3 key (no la URL firmada que expira).
 * Las URLs de descarga se generan bajo demanda con expiración de 1 hora.
 *
 * ⚠️ Límite de tamaño: 10 MB. En Vercel Free tier el límite de body es 4.5 MB.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearContrato } from "@/lib/contratos/tipos";
import {
  s3Configurado,
  subirContratoPdf,
  getPresignedDownloadUrl,
  generarS3Key,
} from "@/lib/contratos/s3";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Tiempo máximo para upload de PDFs grandes

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

// ─── GET: obtener URL firmada de descarga ────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const { id } = await params;

    // Obtener contrato
    const contratoRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
    );
    if (!contratoRes.ok) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    const record = await contratoRes.json();
    const contrato = mapearContrato(record);

    // RBAC: empleados solo pueden ver su propio contrato
    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    if (!isAdmin && contrato.idEmpleado !== payload.idCore) {
      return NextResponse.json({ error: "Sin acceso a este contrato" }, { status: 403 });
    }

    if (!contrato.documentoUrl) {
      return NextResponse.json({ error: "Este contrato no tiene PDF cargado" }, { status: 404 });
    }

    if (!s3Configurado()) {
      return NextResponse.json({ error: "S3 no configurado en el servidor" }, { status: 503 });
    }

    // Generar presigned URL de descarga (1 hora)
    const url = await getPresignedDownloadUrl(contrato.documentoUrl, 3600);
    return NextResponse.json({ url, expira_en: 3600 });
  } catch (err) {
    console.error("[upload-pdf GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: subir PDF firmado ──────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Solo administradores pueden subir PDFs" }, { status: 403 });
    }

    if (!s3Configurado()) {
      return NextResponse.json({ error: "S3 no configurado. Agrega AWS_S3_BUCKET_CONTRACTS, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY a las variables de entorno." }, { status: 503 });
    }

    const { id } = await params;

    // Obtener contrato actual (necesitamos empleado_id, id_contrato, version)
    const contratoRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
    );
    if (!contratoRes.ok) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }
    const record = await contratoRes.json();
    const contrato = mapearContrato(record);

    // Parsear multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "El cuerpo debe ser multipart/form-data" }, { status: 400 });
    }

    const archivo = formData.get("archivo");
    if (!archivo || !(archivo instanceof File)) {
      return NextResponse.json({ error: "Campo 'archivo' requerido (PDF)" }, { status: 400 });
    }

    // Validar tipo MIME
    const mime = archivo.type;
    if (mime !== "application/pdf" && !archivo.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }

    // Validar tamaño
    const buffer = Buffer.from(await archivo.arrayBuffer());
    if (buffer.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `El archivo excede el límite de 10 MB (${(buffer.length / 1024 / 1024).toFixed(1)} MB)` },
        { status: 413 }
      );
    }

    // Generar clave S3 (usa la versión actual del contrato)
    const s3Key = generarS3Key(contrato.idEmpleado, contrato.idContrato, contrato.version);

    // Subir a S3
    await subirContratoPdf(buffer, s3Key);

    // Guardar la S3 key en Airtable (no la presigned URL, que expira)
    const updateRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRATOS)}/${id}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            Documento_URL: s3Key,
            Fecha_Actualizacion: new Date().toISOString(),
          },
        }),
      }
    );

    if (!updateRes.ok) {
      console.error("[upload-pdf POST] Airtable update error:", await updateRes.text());
      return NextResponse.json({ error: "PDF subido pero error al actualizar el registro" }, { status: 500 });
    }

    // Generar URL de descarga inmediata para mostrar en la UI
    const downloadUrl = await getPresignedDownloadUrl(s3Key, 3600);

    return NextResponse.json({
      ok: true,
      s3Key,
      downloadUrl,
      expira_en: 3600,
      tamanio_bytes: buffer.length,
    });
  } catch (err) {
    console.error("[upload-pdf POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
