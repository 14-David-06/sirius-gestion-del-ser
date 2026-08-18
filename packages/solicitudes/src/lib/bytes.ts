/**
 * base64 → bytes sin `Buffer`.
 *
 * El paquete tiene que poder correr donde no hay Node —el runtime edge de Next,
 * un worker— y `Buffer` no existe ahí. `atob` sí está en los dos, y quien
 * necesite un `Buffer` (el adaptador de Airtable, por ejemplo) lo construye a
 * partir de estos bytes sin coste de copia adicional.
 */
export function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
