/**
 * festivosColombia — Cálculo algorítmico de festivos colombianos
 *
 * Implementa la Ley 51 de 1983 (Ley Emiliani) y festivos fijos.
 * No requiere base de datos ni tabla externa.
 *
 * Retorna un array de strings "YYYY-MM-DD" para el año dado.
 */

// ─── Domingo de Pascua (algoritmo de Gauss/Meeus) ───────────────────────────

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
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

/** Ley Emiliani: si el festivo no cae lunes, se traslada al siguiente lunes */
function siguienteLunes(d: Date): Date {
  const dow = d.getDay(); // 0=dom
  if (dow === 1) return d; // ya es lunes
  const diasHastaLunes = dow === 0 ? 1 : 8 - dow;
  return sumarDias(d, diasHastaLunes);
}

// ─── Festivos de Colombia ────────────────────────────────────────────────────

export function festivosColombia(anio: number): string[] {
  const pascua = domingoPascua(anio);

  // ── Festivos fijos (no se trasladan) ──
  const fijos: string[] = [
    `${anio}-01-01`, // Año Nuevo
    `${anio}-05-01`, // Día del Trabajo
    `${anio}-07-20`, // Grito de Independencia
    `${anio}-08-07`, // Batalla de Boyacá
    `${anio}-12-08`, // Inmaculada Concepción
    `${anio}-12-25`, // Navidad
  ];

  // ── Festivos fijos trasladables (Ley Emiliani → lunes siguiente) ──
  const emilianiFijos: Date[] = [
    new Date(anio, 0, 6),   // Reyes Magos (6 ene)
    new Date(anio, 2, 19),  // San José (19 mar)
    new Date(anio, 5, 29),  // San Pedro y San Pablo (29 jun)
    new Date(anio, 7, 15),  // Asunción de la Virgen (15 ago)
    new Date(anio, 9, 12),  // Día de la Raza (12 oct)
    new Date(anio, 10, 1),  // Todos los Santos (1 nov)
    new Date(anio, 10, 11), // Independencia de Cartagena (11 nov)
  ];

  // ── Festivos relativos a Pascua (no se trasladan) ──
  const relativosFijos: string[] = [
    formatFecha(sumarDias(pascua, -3)), // Jueves Santo
    formatFecha(sumarDias(pascua, -2)), // Viernes Santo
  ];

  // ── Festivos relativos a Pascua trasladables (Ley Emiliani → lunes) ──
  const relativosEmiliani: Date[] = [
    sumarDias(pascua, 43),  // Ascensión del Señor (Pascua + 43)
    sumarDias(pascua, 64),  // Corpus Christi (Pascua + 64)
    sumarDias(pascua, 71),  // Sagrado Corazón (Pascua + 71)
  ];

  // Combinar todo
  const todos = [
    ...fijos,
    ...relativosFijos,
    ...emilianiFijos.map((d) => formatFecha(siguienteLunes(d))),
    ...relativosEmiliani.map((d) => formatFecha(siguienteLunes(d))),
  ];

  return todos.sort();
}
