/**
 * Generación de documentos PDF de Gestión del Ser.
 *
 * La maqueta institucional, el logo, el QR, la firma de Gestión del Ser y el
 * documento del día siriano viven en `@sirius/solicitudes/pdf`: los emite también
 * PiroliApp, y un permiso no debería salir con distinta cara según desde qué app
 * se radicó. Aquí solo queda el documento de autorización, que depende del flujo
 * de aprobación de esta app.
 *
 * Este archivo se conserva como fachada para que el resto de la app siga
 * importando de `@/lib/pdf`.
 */

export {
  generarPdfPermisoSiriano,
  firmaGestionSerBase64,
  firmaGestionSerPng,
  FIRMANTE_GESTION_SER,
  type PermisoSirianoPdfParams,
} from "@sirius/solicitudes/pdf";

export {
  generarPdfAutorizacion,
  formatearFechaLarga,
  type AutorizacionPdfParams,
  type DiaCompensacionPdf,
  type TipoSolicitudPdf,
} from "./autorizacion";
