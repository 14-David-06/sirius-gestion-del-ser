/**
 * Escapa un valor antes de interpolarlo en fórmulas de Airtable.
 * Previene inyección de fórmulas via caracteres de control, backslashes y comillas.
 */
export function escapeAirtableValue(value: string): string {
  return value
    .replace(/[\x00-\x1f\x7f]/g, "") // strip control chars
    .replace(/\\/g, "\\\\")           // escape backslashes
    .replace(/'/g, "\\'");            // escape single quotes
}
