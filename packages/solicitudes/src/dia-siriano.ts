/**
 * Día siriano listo para montar.
 *
 * El día siriano es un beneficio ya concedido: el permiso **nace autorizado** y su
 * único papel es el documento que se emite al radicarlo. Por eso el paquete no se
 * limita a declarar el puerto `DiaSirianoInfra`: trae también el documento hecho
 * —maqueta institucional, logo, QR y firma de Gestión del Ser—, y la app solo
 * aporta dónde archivarlo.
 *
 * Si cada app escribiera su propio PDF, el mismo permiso saldría con distinta
 * cara según desde dónde se radicó, y la firma institucional acabaría copiada en
 * varios repositorios.
 *
 * ```ts
 * import { crearDiaSirianoInfra } from "@sirius/solicitudes/dia-siriano";
 *
 * const diaSiriano = crearDiaSirianoInfra({
 *   archivarDocumento: async ({ pdf, idCore, cedula, fechaPermiso }) => {
 *     // …sube el PDF a tu almacenamiento
 *     return { key, url, filename, sha256 };
 *   },
 * });
 * ```
 *
 * ⚠️ Requiere `pdf-lib` (dependencia opcional del paquete) y la variable
 * `FIRMA_GESTION_SER_BASE64`.
 */
import type { ArchivarDocumentoArgs, DiaSirianoInfra, DocumentoArchivado } from "./infra";
import {
  firmaGestionSerBase64,
  FIRMANTE_GESTION_SER,
  generarPdfPermisoSiriano,
} from "./pdf";

export interface OpcionesDiaSiriano {
  /**
   * Archiva el PDF ya emitido y devuelve su referencia. Es lo único que el
   * paquete no puede hacer: no conoce el almacenamiento de la app.
   */
  archivarDocumento(args: ArchivarDocumentoArgs): Promise<DocumentoArchivado>;
  /**
   * Ruta interna donde la app sirve los documentos de una solicitud, sin barra
   * final. Por defecto `/api/documentos`; el handler guarda
   * `{ruta}/permiso/{recordId}` como enlace estable en Airtable.
   *
   * ⚠️ Esa ruta tiene que existir en la app y controlar el acceso: el documento
   * lleva el motivo del permiso —a menudo médico—, la cédula y la firma
   * manuscrita. Si no la tienes, apunta aquí a donde sí puedas servirlo; dejar el
   * valor por defecto guarda un enlace muerto en el registro.
   */
  rutaDocumentos?: string;
}

export function crearDiaSirianoInfra(opciones: OpcionesDiaSiriano): DiaSirianoInfra {
  return {
    // Lanza si falta FIRMA_GESTION_SER_BASE64, y así debe ser: un documento sin
    // firma no acredita la autorización que él mismo declara, y el hueco es
    // invisible en el PDF resultante.
    firmaInstitucionalBase64: firmaGestionSerBase64,
    firmante: FIRMANTE_GESTION_SER,
    generarDocumento: (datos) => generarPdfPermisoSiriano(datos),
    archivarDocumento: opciones.archivarDocumento,
    rutaDocumentos: opciones.rutaDocumentos,
  };
}

export { generarPdfPermisoSiriano, firmaGestionSerBase64, FIRMANTE_GESTION_SER };
export type { PermisoSirianoPdfParams } from "./pdf";
