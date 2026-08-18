/**
 * Entrada de servidor de `@sirius/solicitudes`: los route handlers del módulo.
 *
 * Cada app los monta en sus rutas inyectando dos cosas — cómo resuelve la sesión
 * (`resolvePayload`) y dónde archiva firmas y documentos (`infra`) —, porque el
 * paquete no conoce el sistema de auth ni el proveedor de almacenamiento de la
 * app que lo consume. Ver `./infra` para los puertos.
 *
 * ```ts
 * // app/api/solicitudes/permiso/route.ts
 * export const { GET, POST } = createPermisoHandlers({
 *   resolvePayload: miSesion,
 *   infra: miInfra,
 * });
 * ```
 */
export { createPermisoHandlers }    from "./handlers/permiso";
export { createVacacionesHandlers } from "./handlers/vacaciones";
export { createNovedadesHandlers }  from "./handlers/novedades";
// Saldo del beneficio de día siriano: solo lo monta la app que lo tenga.
export { createDiasSirianosHandlers } from "./handlers/dias-sirianos";

export type {
  ResolvePayload,
  SiriusEmployee,
  OpcionesHandlers,
} from "./types";

export type {
  SolicitudesInfra,
  DiaSirianoInfra,
  AirtableConfig,
  FirmaArchivada,
  GuardarFirmaArgs,
  DocumentoArchivado,
  AdjuntarArgs,
  DatosDocumentoDiaSiriano,
  ArchivarDocumentoArgs,
} from "./infra";

// Esquema y enums de la base: los necesita quien lea las tablas por fuera de
// estos handlers (un histórico, un dashboard de autorizaciones).
export { TABLES, FIELDS, FK_ID_CORE } from "./lib/schema";
export { escapeAirtableValue } from "./lib/security";
