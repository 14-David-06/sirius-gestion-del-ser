/**
 * GET /api/firmas/[id]
 *
 * Genera una URL firmada temporal para visualizar una firma almacenada en S3
 *
 * Parámetros:
 * - id: S3 key de la firma (URL encoded)
 *
 * Query params opcionales:
 * - expiresIn: tiempo de expiración en segundos (default: 300, max: 3600)
 *
 * Respuesta:
 * - 200: { url: string, expiresAt: string }
 * - 401: No autorizado
 * - 400: S3 key inválido
 * - 500: Error al generar URL firmada
 *
 * Seguridad:
 * - Requiere autenticación JWT
 * - Solo genera URLs, no expone archivos directamente
 * - URLs expiran automáticamente
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { getSignedUrlForFirma, validateS3Key } from "@/lib/s3";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verificar autenticación
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;

  if (!payload) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const s3Key = decodeURIComponent(id);

    // Validar formato de S3 key
    if (!validateS3Key(s3Key)) {
      return NextResponse.json(
        { error: "S3 key inválido" },
        { status: 400 }
      );
    }

    // Obtener expiresIn de query params (default: 300s)
    const url = new URL(_req.url);
    const expiresInParam = url.searchParams.get("expiresIn");
    const expiresIn = expiresInParam ? parseInt(expiresInParam, 10) : 300;

    // Validar rango
    if (expiresIn < 60 || expiresIn > 3600) {
      return NextResponse.json(
        { error: "expiresIn debe estar entre 60 y 3600 segundos" },
        { status: 400 }
      );
    }

    // Generar URL firmada
    const signedUrl = await getSignedUrlForFirma({ s3Key, expiresIn });

    // Calcular timestamp de expiración
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return NextResponse.json({
      url: signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("[/api/firmas/[id] GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al generar URL firmada",
      },
      { status: 500 }
    );
  }
}
