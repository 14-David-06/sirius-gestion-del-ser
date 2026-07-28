/**
 * Festivos de Colombia — calculados, sin dependencias externas.
 *
 * Reglas:
 *  - Festivos de fecha fija (Año Nuevo, Trabajo, Independencia, Boyacá, Inmaculada, Navidad).
 *  - Ley 51 de 1983 ("Ley Emiliani"): ciertos festivos se trasladan al lunes siguiente.
 *  - Festivos móviles ligados a la Pascua: Jueves y Viernes Santo (sin traslado);
 *    Ascensión (+43), Corpus Christi (+64) y Sagrado Corazón (+71), ya trasladados a lunes.
 */

/** Domingo de Pascua — algoritmo gregoriano anónimo (Meeus/Jones/Butcher). */
function domingoPascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function sumarDias(base: Date, dias: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + dias);
  return d;
}

/** Traslada al lunes siguiente si la fecha no cae ya en lunes (Ley Emiliani). */
function trasladarALunes(d: Date): Date {
  const diaSemana = d.getDay(); // 0 = domingo, 1 = lunes
  if (diaSemana === 1) return d;
  return sumarDias(d, (8 - diaSemana) % 7);
}

const cache = new Map<number, Set<string>>();

/** Set de festivos del año en formato "YYYY-MM-DD". */
export function festivosColombia(anio: number): Set<string> {
  const enCache = cache.get(anio);
  if (enCache) return enCache;

  const fechas: Date[] = [];

  // Fecha fija — no se trasladan.
  const fijos: [number, number][] = [
    [0, 1],   // Año Nuevo
    [4, 1],   // Día del Trabajo
    [6, 20],  // Grito de Independencia
    [7, 7],   // Batalla de Boyacá
    [11, 8],  // Inmaculada Concepción
    [11, 25], // Navidad
  ];
  for (const [mes, dia] of fijos) fechas.push(new Date(anio, mes, dia));

  // Ley Emiliani — se trasladan al lunes siguiente.
  const trasladables: [number, number][] = [
    [0, 6],   // Reyes Magos
    [2, 19],  // San José
    [5, 29],  // San Pedro y San Pablo
    [7, 15],  // Asunción de la Virgen
    [9, 12],  // Día de la Raza
    [10, 1],  // Todos los Santos
    [10, 11], // Independencia de Cartagena
  ];
  for (const [mes, dia] of trasladables) {
    fechas.push(trasladarALunes(new Date(anio, mes, dia)));
  }

  // Móviles ligados a la Pascua.
  const pascua = domingoPascua(anio);
  fechas.push(sumarDias(pascua, -3)); // Jueves Santo
  fechas.push(sumarDias(pascua, -2)); // Viernes Santo
  fechas.push(sumarDias(pascua, 43)); // Ascensión del Señor
  fechas.push(sumarDias(pascua, 64)); // Corpus Christi
  fechas.push(sumarDias(pascua, 71)); // Sagrado Corazón

  const set = new Set(fechas.map(toISODate));
  cache.set(anio, set);
  return set;
}

/** ¿La fecha ISO "YYYY-MM-DD" es festivo en Colombia? */
export function esFestivo(iso: string): boolean {
  const anio = Number(iso.slice(0, 4));
  if (!Number.isFinite(anio)) return false;
  return festivosColombia(anio).has(iso);
}
