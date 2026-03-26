/**
 * Helpers de AWS S3 para el módulo de contratos.
 * Usado para subir y descargar PDFs de contratos firmados.
 * Si AWS no está configurado, las funciones lanzan un error descriptivo.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function s3Configurado(): boolean {
  return !!(
    process.env.AWS_S3_BUCKET_CONTRACTS &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

function getClient(): S3Client {
  return new S3Client({
    region: process.env.AWS_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

function getBucket(): string {
  const b = process.env.AWS_S3_BUCKET_CONTRACTS;
  if (!b) throw new Error("AWS_S3_BUCKET_CONTRACTS no configurado");
  return b;
}

/** Genera la clave S3 canónica para un PDF de contrato */
export function generarS3Key(
  empleadoId: string,
  contratoId: string,
  version: number
): string {
  return `contratos/${empleadoId}/${contratoId}/contrato_v${version}.pdf`;
}

/** Sube un Buffer PDF a S3 */
export async function subirContratoPdf(buffer: Buffer, key: string): Promise<void> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      // Nunca hacer pública la URL — solo acceso vía presigned URLs
      ACL: undefined,
    })
  );
}

/**
 * Genera una presigned URL para descargar un PDF.
 * La URL expira en `expiresInSeconds` (default: 1 hora).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const s3 = getClient();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}
