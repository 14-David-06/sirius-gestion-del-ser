/**
 * GET /api/documentos/{permiso|vacaciones}/{recordId}
 *
 * Redirige al documento oficial de una solicitud autorizada.
 *
 * Es el enlace que queda guardado en Airtable: el objeto de S3 es privado y las
 * URLs firmadas expiran en minutos, así que guardar una URL firmada dejaría un
 * enlace muerto. Este endpoint genera una nueva en cada visita.
 *
 * Requiere sesión activa — el enlace no expone el documento a terceros.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { getSignedUrlForFirma } from "@/lib/s3";
import { TABLES, FIELDS } from "@/lib/airtable-schema";

const BASE_ID = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

const TABLA: Record<string, string> = {
  permiso: TABLES.PERMISO,
  vacaciones: TABLES.VACACIONES,
};

const CAMPO_S3_KEY: Record<string, string> = {
  permiso: FIELDS.PERMISO.PDF_AUTORIZACION_S3_KEY,
  vacaciones: FIELDS.VACACIONES.PDF_AUTORIZACION_S3_KEY,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;

  if (!payload) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { tipo, id } = await params;

  if (!TABLA[tipo]) {
    return NextResponse.json({ error: "Tipo de solicitud desconocido" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLA[tipo])}/${id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const { fields } = await res.json();
    const s3Key = fields?.[CAMPO_S3_KEY[tipo]] as string | undefined;

    if (!s3Key) {
      return NextResponse.json(
        { error: "Esta solicitud todavía no tiene documento oficial" },
        { status: 404 },
      );
    }

    const url = await getSignedUrlForFirma({ s3Key, expiresIn: 300 });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[/api/documentos] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al abrir el documento" },
      { status: 500 },
    );
  }
}
