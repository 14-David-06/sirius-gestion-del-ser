/**
 * Lectura paginada de tablas de Airtable.
 *
 * Airtable devuelve máximo 100 registros por página: sin seguir el `offset`,
 * todo lo que esté más allá de la primera página nunca llega a la aplicación.
 */

export type RegistroAirtable = { id: string; fields: Record<string, unknown> };

/** Tope de seguridad: 20 páginas = 2000 registros. */
const MAX_PAGINAS = 20;

export async function fetchTodos(
  baseId: string,
  apiKey: string,
  tabla: string,
  params: Record<string, string | string[]> = {},
  maxPaginas = MAX_PAGINAS,
): Promise<RegistroAirtable[]> {
  const registros: RegistroAirtable[] = [];
  let offset: string | undefined;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const qs = new URLSearchParams({ pageSize: "100" });
    for (const [clave, valor] of Object.entries(params)) {
      // "fields[]" admite varios valores repitiendo la clave
      for (const v of Array.isArray(valor) ? valor : [valor]) qs.append(clave, v);
    }
    if (offset) qs.set("offset", offset);

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tabla)}?${qs}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[airtable-fetch] ${res.status} en ${tabla}:`, await res.text());
      break;
    }

    const data = await res.json();
    registros.push(...(data.records ?? []));

    if (!data.offset) break;
    offset = data.offset;
  }

  return registros;
}
