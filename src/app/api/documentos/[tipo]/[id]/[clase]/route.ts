/**
 * GET /api/documentos/{permiso|vacaciones}/{recordId}/{clase}
 *
 * clase: documento | firma-trabajador | firma-autorizador
 *
 * Sustituye a /api/firmas/{s3Key}. La diferencia es el modelo de confianza: el
 * cliente pide **qué archivo de qué solicitud** quiere, no una ruta de S3. Así el
 * servidor puede comprobar que quien pide tiene derecho a esa solicitud, algo
 * imposible cuando el identificador es una key opaca del bucket.
 */

import { NextRequest } from "next/server";
import { servirDocumentoSolicitud } from "@/lib/servir-documento";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tipo: string; id: string; clase: string }> },
) {
  const { tipo, id, clase } = await params;
  return servirDocumentoSolicitud(tipo, id, clase);
}
