import type { AirtableConfig, SolicitudesInfra } from "./infra";

export type SiriusEmployee = {
  idCore: string;
  nombre: string;
  cedula: string;
};

// Función que cada app inyecta para resolver la sesión activa.
// El paquete no sabe qué sistema de auth usa la app consumidora.
export type ResolvePayload = () => Promise<SiriusEmployee | null>;

/** Lo que cada app inyecta al montar los route handlers del módulo. */
export type OpcionesHandlers = {
  resolvePayload: ResolvePayload;
  /**
   * Almacenamiento de firmas y emisión de documentos. Sin él, una solicitud con
   * firma se rechaza: el paquete no tiene dónde archivar el PNG y guardarlo en
   * Airtable no es una alternativa.
   */
  infra?: SolicitudesInfra;
  /** Por defecto, las variables de entorno de la base Novedades Nómina. */
  airtable?: AirtableConfig;
};
