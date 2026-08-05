/**
 * Entrega de los archivos de una solicitud a través de un route handler.
 *
 * El archivo se transmite por el servidor en lugar de redirigir a una URL
 * firmada de S3. Una URL firmada sale del perímetro de la aplicación: durante su
 * vigencia abre el documento **sin sesión**, y queda en el historial del
 * navegador, en el encabezado `Referer` y en los logs de cualquier proxy
 * intermedio. Con streaming, cada byte sigue detrás del JWT y del control de
 * acceso.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { obtenerObjetoS3 } from "@/lib/s3";
import {
  autorizarAccesoSolicitud,
  resolverRecurso,
  registrarAccesoDocumento,
  esTipoDocumento,
  esClaseRecurso,
  type ClaseRecurso,
} from "@/lib/acceso-documentos";

/**
 * Encabezados de una respuesta con un documento laboral.
 *
 * - `private, no-store`: ningún proxy ni caché compartida guarda el archivo.
 * - `nosniff` + CSP: si algún día entra un archivo con contenido activo, el
 *   navegador no lo interpreta como HTML ni ejecuta nada dentro.
 */
function encabezados(contentType: string, nombre: string, contentLength?: number) {
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${nombre}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; object-src 'none'; sandbox",
    "Referrer-Policy": "no-referrer",
  });

  if (contentLength !== undefined) {
    headers.set("Content-Length", String(contentLength));
  }

  return headers;
}

/**
 * Verifica sesión y permisos, y transmite el archivo pedido.
 *
 * @param tipo      "permiso" | "vacaciones" — llega del path, sin validar.
 * @param recordId  Record de la solicitud — llega del path, sin validar.
 * @param clase     Archivo pedido; por defecto el documento oficial.
 */
export async function servirDocumentoSolicitud(
  tipo: string,
  recordId: string,
  clase: string = "documento",
): Promise<NextResponse> {
  const token = (await cookies()).get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;

  if (!payload) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!esClaseRecurso(clase)) {
    return NextResponse.json({ error: "Archivo desconocido" }, { status: 400 });
  }

  try {
    const acceso = await autorizarAccesoSolicitud(payload, tipo, recordId);

    if (!acceso.permitido) {
      registrarAccesoDocumento({
        payload,
        tipo,
        recordId,
        recurso: clase,
        resultado: "denegado",
      });

      return NextResponse.json(
        {
          error:
            acceso.status === 400
              ? "Tipo de solicitud desconocido"
              : "Solicitud no encontrada",
        },
        { status: acceso.status },
      );
    }

    // Redundante tras autorizarAccesoSolicitud, pero es lo que le da a
    // TypeScript la certeza del tipo para indexar las tablas de campos.
    if (!esTipoDocumento(tipo)) {
      return NextResponse.json({ error: "Tipo de solicitud desconocido" }, { status: 400 });
    }

    const recurso = resolverRecurso(tipo, clase as ClaseRecurso, acceso.fields);

    if (!recurso.ok) {
      return NextResponse.json({ error: recurso.error }, { status: recurso.status });
    }

    const objeto = await obtenerObjetoS3(recurso.s3Key);

    if (!objeto) {
      registrarAccesoDocumento({
        payload,
        tipo,
        recordId,
        recurso: recurso.s3Key,
        resultado: "denegado",
      });

      return NextResponse.json(
        { error: "El archivo no está disponible en este momento" },
        { status: 404 },
      );
    }

    registrarAccesoDocumento({
      payload,
      tipo,
      recordId,
      recurso: recurso.s3Key,
      resultado: "concedido",
      motivo: acceso.motivo,
    });

    return new NextResponse(objeto.cuerpo, {
      headers: encabezados(objeto.contentType, recurso.nombre, objeto.contentLength),
    });
  } catch (error) {
    console.error("[servirDocumentoSolicitud]", error);
    return NextResponse.json(
      { error: "Error al abrir el documento" },
      { status: 500 },
    );
  }
}
