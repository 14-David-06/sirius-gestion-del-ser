/**
 * Maqueta institucional de los documentos de una solicitud.
 *
 * Vive en el paquete porque un permiso puede llegar por dos caminos —radicado
 * como día siriano, o resuelto por el flujo de autorización— y el trabajador no
 * debería recibir dos papeles con distinta cara según cuál fue. La app que emita
 * el documento de autorización construye su página con estas primitivas.
 *
 * ⚠️ Requiere `pdf-lib`, que es una dependencia **opcional** del paquete: una app
 * que solo monte los formularios no la instala. Importar esta subruta sin tenerla
 * falla al resolver el módulo.
 */
// `export *`: la maqueta es un juego completo de primitivas (medidas, colores,
// Cursor, rejilla, tarjetaFirma…). Enumerarlas aquí solo abre la puerta a que la
// app consumidora no encuentre una y se dibuje su propia versión.
export * from "./maqueta";

export { LOGO_PROPORCION, LOGO_SIRIUS_BASE64 } from "./logo";
export { QR_SIRIUS_BASE64 } from "./qr";

export {
  firmaGestionSerBase64,
  firmaGestionSerPng,
  FIRMANTE_GESTION_SER,
} from "./firma-gestion-ser";

export {
  generarPdfPermisoSiriano,
  type PermisoSirianoPdfParams,
} from "./permiso-siriano";

/**
 * Firma sintética para tests. No es la institucional: los tests necesitan *una*
 * firma, no *la* firma, y la real no puede entrar al repositorio.
 */
export { FIRMA_FIXTURE_BASE64, FIRMA_FIXTURE_TAMANO } from "./firma-fixture";
