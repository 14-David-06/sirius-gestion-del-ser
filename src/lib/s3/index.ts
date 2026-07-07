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
 */

export { getS3Client, S3_CONFIG } from "./client";
export {
  uploadFirmaTrabajador,
  validateS3Key,
  type UploadFirmaParams,
  type UploadFirmaResult,
} from "./upload";
export {
  getSignedUrlForFirma,
  getSignedUrlsForFirmas,
  type GetSignedUrlParams,
} from "./download";
