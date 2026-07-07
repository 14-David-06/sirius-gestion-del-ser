/**
 * Funciones de upload a S3 con seguridad y auditoría
 *
 * IMPORTANTE: Este módulo NUNCA borra archivos.
 * El versionamiento del bucket preserva todas las versiones.
 */

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, S3_CONFIG } from "./client";

export interface UploadFirmaParams {
  base64: string;
  cedula: string;
  idCore: string;
  tipo: "permiso" | "vacaciones" | "contrato";
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
  // Formato: firmas/{tipo}/{idCore}/{timestamp}_{cedula}.png
  const pattern = /^firmas\/(permisos|vacaciones|contratos)\/SIRIUS-PER-\d{4}\/\d+_\d+\.png$/;
  return pattern.test(s3Key);
}
