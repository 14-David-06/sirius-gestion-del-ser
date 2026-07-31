/**
 * Funciones de upload a S3 con seguridad y auditoría
 *
 * IMPORTANTE: Este módulo NUNCA borra archivos.
 * El versionamiento del bucket preserva todas las versiones.
 */

import { createHash } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, S3_CONFIG } from "./client";

/**
 * Sanitiza string para metadatos S3 (solo ASCII)
 * Reemplaza caracteres especiales por su equivalente ASCII
 */
function sanitizeForS3Metadata(value: string): string {
  return value
    .normalize("NFD") // Descompone caracteres acentuados
    .replace(/[̀-ͯ]/g, "") // Elimina diacríticos
    .replace(/[^\x00-\x7F]/g, ""); // Elimina no-ASCII restantes
}

export interface UploadFirmaParams {
  base64: string;
  cedula: string;
  idCore: string;
  tipo: "permiso" | "vacaciones" | "contrato" | "autorizacion-permiso" | "autorizacion-vacaciones" | "autorizacion-novedades";
  metadata?: Record<string, string>;
}

export interface UploadFirmaResult {
  s3Key: string;
  bucket: string;
  uploadedAt: string;
}

/**
 * Sube una firma digital a S3 con encriptación y metadatos de auditoría
 *
 * Naming convention de S3 keys:
 * firmas/{tipo}/{idCore}/{timestamp}_{cedula}.png
 *
 * Ejemplo: firmas/permisos/SIRIUS-PER-0002/1720353600000_1006774686.png
 *
 * @param params - Parámetros de la firma a subir
 * @returns Información del archivo subido (key, bucket, fecha)
 */
export async function uploadFirmaTrabajador(
  params: UploadFirmaParams
): Promise<UploadFirmaResult> {
  const { base64, cedula, idCore, tipo, metadata = {} } = params;

  // Validar base64
  if (!base64 || base64.length < 100) {
    throw new Error("Base64 de firma inválido o vacío");
  }

  // Convertir base64 a Buffer
  const buffer = Buffer.from(base64, "base64");

  // Generar S3 key único con timestamp
  const timestamp = Date.now();
  const pathPrefix =
    tipo === "permiso"
      ? S3_CONFIG.PATHS.FIRMAS_PERMISOS
      : tipo === "vacaciones"
      ? S3_CONFIG.PATHS.FIRMAS_VACACIONES
      : S3_CONFIG.PATHS.FIRMAS_CONTRATOS;

  const s3Key = `${pathPrefix}/${idCore}/${timestamp}_${cedula}.png`;

  // Timestamp ISO para metadatos
  const uploadedAt = new Date().toISOString();

  // Metadatos de auditoría (límite AWS: 2KB total, solo ASCII)
  const auditMetadata: Record<string, string> = {
    cedula,
    idCore,
    tipo,
    uploadedAt,
    source: "sirius-gestion-del-ser",
  };

  // Agregar metadata adicional sanitizado
  for (const [key, value] of Object.entries(metadata)) {
    auditMetadata[key] = sanitizeForS3Metadata(value);
  }

  // Upload a S3 con encriptación
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: S3_CONFIG.BUCKET_FIRMAS,
    Key: s3Key,
    Body: buffer,
    ContentType: "image/png",
    ServerSideEncryption: "AES256", // Encriptación AES-256 en reposo
    Metadata: auditMetadata,
  });

  try {
    await client.send(command);

    return {
      s3Key,
      bucket: S3_CONFIG.BUCKET_FIRMAS,
      uploadedAt,
    };
  } catch (error) {
    console.error("[S3 Upload Error]", error);
    throw new Error(
      `Error al subir firma a S3: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Valida que un S3 key tenga el formato correcto
 */
export function validateS3Key(s3Key: string): boolean {
  // Firmas:  firmas/{tipo}/{idCore}/{timestamp}_{cedula}.png
  const firmas = /^firmas\/(permisos|vacaciones|contratos)\/SIRIUS-PER-\d{4}\/\d+_\d+\.png$/;
  // PDFs de día de pacto: permisos/dias-pacto/{año}/{mes}/{idCore}_{cedula}_{fecha}_{timestamp}.pdf
  const pdfPacto =
    /^permisos\/dias-pacto\/\d{4}\/\d{2}\/SIRIUS-PER-\d{4}_\d+_\d{4}-\d{2}-\d{2}_\d+\.pdf$/;
  return firmas.test(s3Key) || pdfPacto.test(s3Key);
}

export interface UploadPdfPermisoPactoParams {
  pdf: Uint8Array;
  cedula: string;
  idCore: string;
  /** Día de pacto autorizado, ISO "YYYY-MM-DD" — organiza el archivo por año/mes. */
  fechaPermiso: string;
  metadata?: Record<string, string>;
}

export interface UploadPdfResult extends UploadFirmaResult {
  /** URL del objeto en S3 (privado — requiere URL firmada para abrirlo). */
  url: string;
  /** SHA-256 del PDF, para verificar integridad del documento. */
  sha256: string;
  filename: string;
}

/**
 * Archiva en S3 el PDF de un permiso de día de pacto ya autorizado.
 *
 * Estructura: permisos/dias-pacto/{año}/{mes}/{idCore}_{cedula}_{fecha}_{timestamp}.pdf
 * Ejemplo:    permisos/dias-pacto/2026/07/SIRIUS-PER-0002_1006774686_2026-07-31_1785442156866.pdf
 */
export async function uploadPdfPermisoPacto(
  params: UploadPdfPermisoPactoParams
): Promise<UploadPdfResult> {
  const { pdf, cedula, idCore, fechaPermiso, metadata = {} } = params;

  if (!pdf || pdf.byteLength === 0) {
    throw new Error("PDF vacío");
  }

  const [anio, mes] = fechaPermiso.split("-");
  if (!anio || !mes) {
    throw new Error(`fechaPermiso inválida: ${fechaPermiso}`);
  }

  const timestamp = Date.now();
  const filename = `${idCore}_${cedula}_${fechaPermiso}_${timestamp}.pdf`;
  const s3Key = `${S3_CONFIG.PATHS.PDF_PERMISOS_PACTO}/${anio}/${mes}/${filename}`;
  const uploadedAt = new Date().toISOString();
  const buffer = Buffer.from(pdf);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const auditMetadata: Record<string, string> = {
    cedula,
    idCore,
    tipo: "permiso-dia-pacto",
    fechaPermiso,
    estado: "autorizado",
    sha256,
    uploadedAt,
    source: "sirius-gestion-del-ser",
  };
  for (const [clave, valor] of Object.entries(metadata)) {
    auditMetadata[clave] = sanitizeForS3Metadata(valor);
  }

  const client = getS3Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: S3_CONFIG.BUCKET_FIRMAS,
        Key: s3Key,
        Body: buffer,
        ContentType: "application/pdf",
        ContentDisposition: `inline; filename="${filename}"`,
        ServerSideEncryption: "AES256",
        Metadata: auditMetadata,
      })
    );

    return {
      s3Key,
      bucket: S3_CONFIG.BUCKET_FIRMAS,
      uploadedAt,
      url: `https://${S3_CONFIG.BUCKET_FIRMAS}.s3.${S3_CONFIG.REGION}.amazonaws.com/${s3Key}`,
      sha256,
      filename,
    };
  } catch (error) {
    console.error("[S3 Upload PDF Error]", error);
    throw new Error(
      `Error al subir PDF a S3: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
