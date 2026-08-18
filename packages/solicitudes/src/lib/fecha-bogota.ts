/**
 * Fecha y hora en Colombia.
 *
 * `new Date().toISOString()` devuelve UTC: después de las 19:00 en Bogotá daría
 * el día siguiente, y un documento o una marcación quedarían archivados con la
 * fecha equivocada. Todo el proyecto pasa por aquí para no repetir ese error.
 */

export const ZONA_BOGOTA = "America/Bogota";

/** Fecha en Colombia, formato YYYY-MM-DD. */
export function fechaBogota(momento: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(momento);
}

/** Hora en Colombia, formato HH:mm (24 h). */
export function horaBogota(momento: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(momento);
}

/** Alias explícito para el caso más común: la fecha de hoy. */
export const fechaHoyBogota = (): string => fechaBogota();
