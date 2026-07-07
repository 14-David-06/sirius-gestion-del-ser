/**
 * Funciones de descarga segura desde S3
 *
 * Genera URLs firmadas con expiración corta para acceso controlado
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, S3_CONFIG } from "./client";
import { validateS3Key } from "./upload";

export interface GetSignedUrlParams {
  s3Key: string;
  expiresIn?: number; // segundos (default: 300 = 5 min)
}

/**
 * Genera una URL firmada temporal para descargar una firma desde S3
 *
 * La URL expira en 5 minutos por defecto (configurable).
 * Solo quien tenga la URL puede acceder al archivo durante ese tiempo.
 *
 * Casos de uso:
 * - RRHH visualiza firma en interfaz web
 * - Generación de PDFs con firmas incluidas
 * - Auditorías que requieren ver el documento original
 *
 * @param params - S3 key del archivo y tiempo de expiración opcional
 * @returns URL firmada temporal
 */
export async function getSignedUrlForFirma(
  params: GetSignedUrlParams
): Promise<string> {
  const { s3Key, expiresIn = S3_CONFIG.SIGNED_URL_EXPIRATION } = params;

  // Validar formato de S3 key
  if (!validateS3Key(s3Key)) {
    throw new Error(`S3 key inválido: ${s3Key}`);
  }

  // Validar rango de expiración (1 min - 1 hora)
  if (expiresIn < 60 || expiresIn > 3600) {
    throw new Error("expiresIn debe estar entre 60 y 3600 segundos");
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: S3_CONFIG.BUCKET_FIRMAS,
    Key: s3Key,
  });

  try {
    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("[S3 Signed URL Error]", error);
    throw new Error(
      `Error al generar URL firmada: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Genera múltiples URLs firmadas en paralelo
 *
 * Útil para interfaces que muestran listas de solicitudes con firmas
 */
export async function getSignedUrlsForFirmas(
  s3Keys: string[],
  expiresIn?: number
): Promise<Map<string, string>> {
  const urlPromises = s3Keys.map(async (s3Key) => {
    try {
      const url = await getSignedUrlForFirma({ s3Key, expiresIn });
      return [s3Key, url] as const;
    } catch (error) {
      console.error(`[S3 Signed URL Error - ${s3Key}]`, error);
      return [s3Key, ""] as const; // URL vacía en caso de error
    }
  });

  const results = await Promise.all(urlPromises);
  return new Map(results);
}
