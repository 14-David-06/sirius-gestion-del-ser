/**
 * Módulo S3 para Sirius Gestión del Ser
 *
 * Proporciona almacenamiento seguro de firmas digitales con:
 * - Encriptación AES-256 en reposo
 * - Versionamiento habilitado (preserva historial)
 * - URLs firmadas con expiración corta
 * - Sin operaciones de borrado (seguridad)
 * - Metadatos de auditoría completos
 *
 * Estructura de carpetas en S3:
 * ├── firmas/
 * │   ├── permisos/
 * │   │   └── {idCore}/
 * │   │       └── {timestamp}_{cedula}.png
 * │   ├── vacaciones/
 * │   │   └── {idCore}/
 * │   │       └── {timestamp}_{cedula}.png
 * │   └── contratos/
 * │       └── {idCore}/
 * │           └── {timestamp}_{cedula}.png
 * └── permisos/
 *     └── dias-pacto/            PDFs de permisos de día de pacto (ya autorizados)
 *         └── {año}/{mes}/
 *             └── {idCore}_{cedula}_{fecha}_{timestamp}.pdf
 */

export { getS3Client, S3_CONFIG } from "./client";
export {
  uploadFirmaTrabajador,
  uploadPdfPermisoPacto,
  validateS3Key,
  type UploadFirmaParams,
  type UploadFirmaResult,
  type UploadPdfPermisoPactoParams,
  type UploadPdfResult,
} from "./upload";
export {
  getSignedUrlForFirma,
  getSignedUrlsForFirmas,
  type GetSignedUrlParams,
} from "./download";
