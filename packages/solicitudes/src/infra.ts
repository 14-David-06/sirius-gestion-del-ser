/**
 * Puertos de infraestructura del módulo de solicitudes.
 *
 * Radicar una solicitud archiva una firma manuscrita y, en el caso del día
 * siriano, emite un documento oficial. Eso es almacenamiento privado y
 * generación de PDF: dos cosas que cada app resuelve con su propio proveedor.
 * El paquete declara aquí lo que necesita y la app inyecta la implementación al
 * crear los handlers, así que `@sirius/solicitudes` no arrastra el SDK de AWS ni
 * `pdf-lib` a quien monte solo los formularios.
 *
 * Lo que el paquete promete a cambio: **nunca guarda el PNG ni el PDF en
 * Airtable**, solo la `key` que devuelva el adaptador. Un base64 de firma en un
 * campo de texto queda legible para cualquiera con acceso a la tabla.
 */
import { TABLES } from "./lib/schema";

/** Firma manuscrita ya archivada por la app. */
export interface FirmaArchivada {
  /**
   * Ruta del objeto en el almacenamiento de la app. Es lo único que se guarda en
   * Airtable, y por eso no debe ser una URL firmada: esas expiran y quedarían
   * como un enlace muerto en el registro.
   */
  key: string;
  /** Instante ISO en que quedó archivada. */
  archivadaEn: string;
}

export interface GuardarFirmaArgs {
  /** PNG en base64, sin el prefijo `data:`. */
  base64: string;
  cedula: string;
  idCore: string;
  /**
   * Trámite que se firmó. `autorizacion-permiso` es la firma institucional del
   * día siriano, no la del trabajador.
   */
  tipo: "permiso" | "vacaciones" | "autorizacion-permiso";
  metadata?: Record<string, string>;
}

/** Documento oficial ya archivado por la app. */
export interface DocumentoArchivado {
  key: string;
  /** URL del objeto — privada; sirve de referencia, no de enlace para el navegador. */
  url: string;
  filename: string;
  /** SHA-256 en hexadecimal: la huella que queda en Airtable. */
  sha256: string;
}

export interface AdjuntarArgs {
  /** Registro ya creado en Airtable (recXXX). */
  recordId: string;
  /** Nombre o ID del campo de tipo Attachment. */
  campo: string;
  contenido: Uint8Array;
  filename: string;
  contentType: string;
}

export interface DatosDocumentoDiaSiriano {
  /** Registro en Solicitud_Permiso (recXXX) — hace de folio del documento. */
  solicitudId: string;
  nombre: string;
  cedula: string;
  cargo: string;
  idCore: string;
  /** Día siriano concedido, ISO "YYYY-MM-DD". */
  fechaPermiso: string;
  fechaSolicitud: string;
  motivo: string;
  periodo: string;
  /** Saldo que le queda al colaborador después de este permiso. */
  saldoRestante: number;
  /** Firma del trabajador en PNG base64, sin el prefijo `data:`. */
  firmaBase64?: string;
}

export interface ArchivarDocumentoArgs {
  pdf: Uint8Array;
  cedula: string;
  idCore: string;
  fechaPermiso: string;
  metadata?: Record<string, string>;
}

/**
 * Emisión del documento del día siriano.
 *
 * Va aparte porque es opcional: el día siriano es un beneficio de Sirius, y una
 * app que solo reciba permisos y vacaciones no tiene por qué implementarlo. Si
 * no se inyecta, el handler **rechaza** las solicitudes de día siriano en vez de
 * registrarlas: nacen autorizadas, y una autorización sin documento no acredita
 * nada.
 */
export interface DiaSirianoInfra {
  /**
   * Firma institucional en PNG base64. Debe lanzar si no está configurada —
   * devolver vacío dejaría un documento sin firma y el fallo sería invisible en
   * el PDF resultante.
   */
  firmaInstitucionalBase64(): string;
  /** Quién queda como aprobador. Acredita a la dependencia, no a una persona. */
  firmante: { nombre: string; cargo: string };
  generarDocumento(datos: DatosDocumentoDiaSiriano): Promise<Uint8Array>;
  archivarDocumento(args: ArchivarDocumentoArgs): Promise<DocumentoArchivado>;
  /**
   * Ruta interna donde la app sirve el documento de una solicitud, sin barra
   * final. El handler guarda `{rutaDocumentos}/permiso/{recordId}` como enlace
   * estable, porque el objeto es privado y hay que firmar una URL nueva en cada
   * visita. Por defecto `/api/documentos`.
   */
  rutaDocumentos?: string;
}

export interface SolicitudesInfra {
  /** Archiva la firma manuscrita del trabajador. */
  guardarFirma(args: GuardarFirmaArgs): Promise<FirmaArchivada>;
  /**
   * Copia el archivo en un campo Attachment de Airtable, para consultarlo desde
   * la tabla. Es comodidad, no la referencia canónica: si falla, el handler lo
   * registra y sigue. Omitirlo desactiva los adjuntos.
   */
  adjuntar?(args: AdjuntarArgs): Promise<unknown>;
  diaSiriano?: DiaSirianoInfra;
}

/**
 * Tablas del módulo. Cada valor puede ser el nombre o el ID (`tblXXX`) — el API
 * de Airtable acepta los dos, y hay apps que llevan los IDs en su config para no
 * romperse si alguien renombra una tabla.
 */
export interface TablasSolicitudes {
  permiso?: string;
  vacaciones?: string;
  novedades?: string;
  diasSirianos?: string;
}

/** Base de Airtable donde viven las tablas de solicitudes. */
export interface AirtableConfig {
  baseId: string;
  apiKey: string;
  tablas?: TablasSolicitudes;
}

export interface AirtableResuelto {
  baseId: string;
  apiKey: string;
  tablas: Required<TablasSolicitudes>;
}

/**
 * Credenciales y tablas de Airtable. Lo que la app no pase se lee del entorno:
 * `AIRTABLE_BASE_ID_NOVEDADES_NOMINA` / `AIRTABLE_API_KEY_NOVEDADES_NOMINA` y
 * `AIRTABLE_TABLE_*`.
 *
 * Se resuelve en cada request y no al importar el módulo: en Vercel las
 * variables no están disponibles durante el build.
 */
export function resolverAirtable(config?: AirtableConfig): AirtableResuelto {
  const baseId = config?.baseId ?? process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA;
  const apiKey = config?.apiKey ?? process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA;

  if (!baseId || !apiKey) {
    throw new Error(
      "@sirius/solicitudes: falta la base de Airtable. Pasa `airtable: { baseId, apiKey }` " +
        "al crear los handlers o define AIRTABLE_BASE_ID_NOVEDADES_NOMINA y " +
        "AIRTABLE_API_KEY_NOVEDADES_NOMINA.",
    );
  }

  const t = config?.tablas;

  return {
    baseId,
    apiKey,
    tablas: {
      permiso:      t?.permiso      ?? TABLES.PERMISO,
      vacaciones:   t?.vacaciones   ?? TABLES.VACACIONES,
      novedades:    t?.novedades    ?? TABLES.NOVEDADES,
      diasSirianos: t?.diasSirianos ?? TABLES.DIAS_SIRIANOS,
    },
  };
}
