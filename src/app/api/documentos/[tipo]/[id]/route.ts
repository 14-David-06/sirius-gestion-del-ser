/**
 * GET /api/documentos/{permiso|vacaciones}/{recordId}
 *
 * Documento oficial de una solicitud autorizada.
 *
 * Es el enlace que queda guardado en Airtable (`PDF_Autorizacion_URL`): el objeto
 * de S3 es privado, así que el archivo se transmite por aquí, siempre detrás de
 * la sesión. Equivale a `.../{recordId}/documento`.
 *
 * Seguridad: solo acceden el dueño de la solicitud, quien la autorizó y quien
 * tiene potestad de autorizarla — ver `autorizarAccesoSolicitud()`.
 */

import { NextRequest } from "next/server";
import { servirDocumentoSolicitud } from "@/lib/servir-documento";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo, id } = await params;
  return servirDocumentoSolicitud(tipo, id, "documento");
}
