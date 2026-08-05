/**
 * Extracción de todos los documentos asociados a una solicitud.
 *
 * Los archivos de una solicitud están repartidos en varios campos y en dos
 * generaciones del sistema:
 *
 * - `PDF_Autorizacion_*` — el documento oficial que emite esta aplicación.
 * - `Archivo_Generado` / `Archivo` — los HTML del sistema anterior en S3.
 * - Campos Attachment — firmas y evidencia que subió el colaborador.
 * - `Firma_S3_Key` / `Firma_Autorizador_S3_Key` — firmas en el bucket privado.
 *
 * Este módulo los unifica para que la pestaña de documentos del histórico pueda
 * mostrarlos todos con la misma forma.
 */

import { FIELDS, FIELDS_AUTORIZACION } from "@/lib/airtable-schema";

export type CategoriaSolicitud = "permisos" | "vacaciones" | "novedades";

/** Naturaleza del documento — determina el icono y el agrupamiento en la UI. */
export type ClaseDocumento = "autorizacion" | "firma" | "adjunto" | "heredado";

export interface DocumentoSolicitud {
  /** Clave estable para React. */
  id: string;
  categoria: CategoriaSolicitud;
  recordId: string;
  clase: ClaseDocumento;
  titulo: string;
  /** Enlace listo para abrir en una pestaña nueva. */
  url: string;
  /** Tamaño en bytes, cuando Airtable lo reporta. */
  tamano?: number;
  /** MIME type, cuando se conoce. */
  formato?: string;
}

interface AdjuntoAirtable {
  id?: string;
  url?: string;
  filename?: string;
  size?: number;
  type?: string;
}

/** Tipo de solicitud en la URL de /api/documentos (singular). */
const TIPO_EN_RUTA: Partial<Record<CategoriaSolicitud, string>> = {
  permisos: "permiso",
  vacaciones: "vacaciones",
};

/**
 * Enlace autenticado a un archivo de la solicitud.
 *
 * Se identifica por (tipo, recordId, clase) y **nunca** por su S3 key: el
 * endpoint tiene que poder comprobar que quien pide el archivo tiene derecho a
 * esa solicitud, y una key de S3 no dice a quién pertenece.
 */
function enlaceArchivo(
  categoria: CategoriaSolicitud,
  recordId: string,
  clase: "documento" | "firma-trabajador" | "firma-autorizador",
): string | null {
  const tipo = TIPO_EN_RUTA[categoria];
  return tipo ? `/api/documentos/${tipo}/${recordId}/${clase}` : null;
}

/**
 * Documentos de un registro de solicitud.
 *
 * Nota: las URLs de los campos Attachment las genera Airtable y **expiran a las
 * 2 horas**. La lista se reconstruye en cada carga del histórico, así que los
 * enlaces están frescos al mostrarse; una pestaña abierta mucho tiempo puede
 * quedar con enlaces vencidos.
 */
export function documentosDeSolicitud(
  categoria: CategoriaSolicitud,
  recordId: string,
  fields: Record<string, unknown>,
): DocumentoSolicitud[] {
  const documentos: DocumentoSolicitud[] = [];

  const agregar = (
    clase: ClaseDocumento,
    titulo: string,
    url: unknown,
    extra?: { tamano?: number; formato?: string; sufijo?: string },
  ) => {
    if (typeof url !== "string" || !url.trim()) return;
    documentos.push({
      id: `${categoria}-${recordId}-${clase}-${extra?.sufijo ?? documentos.length}`,
      categoria,
      recordId,
      clase,
      titulo,
      url,
      tamano: extra?.tamano,
      formato: extra?.formato,
    });
  };

  /** Añade cada archivo de un campo de tipo Attachment. */
  const agregarAdjuntos = (clase: ClaseDocumento, etiqueta: string, valor: unknown) => {
    if (!Array.isArray(valor)) return;
    (valor as AdjuntoAirtable[]).forEach((a, i) => {
      if (!a?.url) return;
      agregar(clase, a.filename ? `${etiqueta} — ${a.filename}` : etiqueta, a.url, {
        tamano: a.size,
        formato: a.type,
        sufijo: a.id ?? String(i),
      });
    });
  };

  // ── Firma de quien autorizó (común a permisos y vacaciones) ──
  const firmaAutorizador = fields[FIELDS_AUTORIZACION.FIRMA_S3_KEY];
  if (typeof firmaAutorizador === "string" && firmaAutorizador) {
    agregar(
      "firma",
      "Firma del autorizador",
      enlaceArchivo(categoria, recordId, "firma-autorizador"),
      { formato: "image/png", sufijo: "aut" },
    );
  }

  if (categoria === "permisos") {
    const F = FIELDS.PERMISO;
    // Se deriva el enlace en vez de usar PDF_Autorizacion_URL: ese campo guarda
    // una URL absoluta con el origen de quien autorizó (hay registros con
    // "http://localhost:3000"), así que solo sirve como rastro de auditoría.
    if (fields[F.PDF_AUTORIZACION_S3_KEY]) {
      agregar(
        "autorizacion",
        "Documento de autorización (PDF)",
        enlaceArchivo(categoria, recordId, "documento"),
        { formato: "application/pdf", sufijo: "pdf" },
      );
    }
    agregarAdjuntos("autorizacion", "PDF firmado", fields[F.PDF_FIRMADO]);

    const firmaTrab = fields[F.FIRMA_S3_KEY];
    if (typeof firmaTrab === "string" && firmaTrab) {
      agregar(
        "firma",
        "Firma del trabajador",
        enlaceArchivo(categoria, recordId, "firma-trabajador"),
        { formato: "image/png", sufijo: "trab" },
      );
    }
    agregarAdjuntos("firma", "Firma del trabajador", fields[F.FIRMA_TRAB_ADJUNTO]);
    agregarAdjuntos("firma", "Firma de Gestión del Ser", fields[F.FIRMA_GESTION]);
    agregarAdjuntos("firma", "Firma del aprobador", fields[F.FIRMA_APROBADOR]);

    agregar(
      "heredado",
      `Documento del sistema anterior${
        fields[F.NOMBRE_ARCHIVO] ? ` — ${fields[F.NOMBRE_ARCHIVO]}` : ""
      }`,
      fields[F.ARCHIVO_GENERADO],
      { sufijo: "legacy" },
    );
    agregarAdjuntos("heredado", "Documento adjunto", fields[F.DOCUMENTO_ADJUNTO]);

    return documentos;
  }

  if (categoria === "vacaciones") {
    const F = FIELDS.VACACIONES;
    // Se deriva el enlace en vez de usar PDF_Autorizacion_URL: ese campo guarda
    // una URL absoluta con el origen de quien autorizó (hay registros con
    // "http://localhost:3000"), así que solo sirve como rastro de auditoría.
    if (fields[F.PDF_AUTORIZACION_S3_KEY]) {
      agregar(
        "autorizacion",
        "Documento de autorización (PDF)",
        enlaceArchivo(categoria, recordId, "documento"),
        { formato: "application/pdf", sufijo: "pdf" },
      );
    }

    const firmaTrab = fields[F.FIRMA_S3_KEY];
    if (typeof firmaTrab === "string" && firmaTrab) {
      agregar(
        "firma",
        "Firma del trabajador",
        enlaceArchivo(categoria, recordId, "firma-trabajador"),
        { formato: "image/png", sufijo: "trab" },
      );
    }
    agregarAdjuntos("firma", "Firma del trabajador", fields[F.FIRMA_TRAB_ADJUNTO]);
    agregarAdjuntos("firma", "Firma de Gestión del Ser", fields[F.FIRMA_GESTION]);

    agregar(
      "heredado",
      `Documento del sistema anterior${
        fields[F.NOMBRE_ARCHIVO] ? ` — ${fields[F.NOMBRE_ARCHIVO]}` : ""
      }`,
      fields[F.ARCHIVO_GENERADO],
      { sufijo: "legacy" },
    );

    return documentos;
  }

  // Novedades: solo la evidencia que adjuntó el colaborador
  agregarAdjuntos("adjunto", "Documentación adicional", fields[FIELDS.NOVEDADES.ADJUNTOS]);
  return documentos;
}
