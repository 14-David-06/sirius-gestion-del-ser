/**
 * Subida de archivos a campos de tipo Attachment en Airtable.
 *
 * El API normal de records solo acepta adjuntos por URL pública, y el bucket de
 * Sirius es privado. El endpoint uploadAttachment recibe el contenido en base64
 * directamente, así que no hace falta exponer nada públicamente.
 *
 * Límite de Airtable: 5 MB por archivo.
 */

const LIMITE_BYTES = 5 * 1024 * 1024;

export interface SubirAdjuntoParams {
  baseId: string;
  apiKey: string;
  recordId: string;
  /** Nombre o ID del campo de tipo Attachment. */
  campo: string;
  contenido: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Adjunta un archivo a un campo Attachment de un registro existente.
 *
 * No lanza: el adjunto es una comodidad para ver el documento dentro de
 * Airtable, mientras que la referencia canónica vive en S3. Si falla, se
 * registra y el flujo continúa.
 *
 * @returns true si Airtable aceptó el archivo.
 */
export async function subirAdjuntoAirtable(params: SubirAdjuntoParams): Promise<boolean> {
  const { baseId, apiKey, recordId, campo, contenido, filename, contentType } = params;

  if (contenido.byteLength > LIMITE_BYTES) {
    console.error(
      `[Airtable adjunto] ${filename} pesa ${contenido.byteLength} bytes; el límite es ${LIMITE_BYTES}`,
    );
    return false;
  }

  const url =
    `https://content.airtable.com/v0/${baseId}/${recordId}/` +
    `${encodeURIComponent(campo)}/uploadAttachment`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType,
        filename,
        file: contenido.toString("base64"),
      }),
    });

    if (!res.ok) {
      console.error(`[Airtable adjunto] ${campo} → ${res.status}:`, await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Airtable adjunto] Error al subir ${filename} a ${campo}:`, error);
    return false;
  }
}
