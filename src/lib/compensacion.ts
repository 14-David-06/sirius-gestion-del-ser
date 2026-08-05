/**
 * Planes con los que un trabajador repone las horas de un permiso compensable.
 *
 * El trabajador propone uno al radicar la solicitud; Gestión del Ser lo confirma
 * o lo cambia al autorizar. Los tres planes desembocan en la misma estructura —
 * una lista de días con fecha, horas y descripción — que es la que ya viajaba al
 * PDF de autorización y al histórico, así que nada aguas abajo cambia de forma.
 *
 * Módulo puro (sin acceso a red ni a Node): lo importan tanto los componentes
 * cliente como los route handlers.
 */

export interface DiaCompensacion {
  /** ISO "YYYY-MM-DD". */
  fecha: string;
  horas: number;
  descripcion: string;
}

/** Jornada laboral completa: base para estimar las horas de un permiso por días. */
export const HORAS_JORNADA = 8;

/** Tope de días hábiles del plan de una hora diaria — evita un bucle infinito. */
const MAX_DIAS_HABILES = 60;

export const PLANES_COMPENSACION = [
  {
    id: "sabado",
    nombre: "Sábado de 7:00 a. m. a 12:00 m.",
    resumen: "Asistir uno o varios sábados en jornada de 5 horas.",
    horasJornada: 5,
  },
  {
    id: "hora-diaria",
    nombre: "Una hora diaria hasta completar",
    resumen: "Quedarse una hora adicional cada día hábil hasta cubrir el permiso.",
    horasJornada: 1,
  },
  {
    id: "reto",
    nombre: "Cumplir con un reto",
    resumen: "Asumir un reto acordado con Gestión del Ser, con fecha límite.",
    horasJornada: 0,
  },
] as const;

export type PlanCompensacion = (typeof PLANES_COMPENSACION)[number];
export type PlanCompensacionId = PlanCompensacion["id"];

export const PLAN_SABADO: PlanCompensacionId = "sabado";
export const PLAN_HORA_DIARIA: PlanCompensacionId = "hora-diaria";
export const PLAN_RETO: PlanCompensacionId = "reto";

export function planCompensacion(id: string | null | undefined): PlanCompensacion | null {
  return PLANES_COMPENSACION.find((p) => p.id === id) ?? null;
}

/**
 * Nombre legible del plan: es lo que se guarda en Airtable y lo que sale en el
 * PDF. Se persiste el nombre y no el id — igual que `Tipo_Permiso` — para que la
 * tabla siga siendo legible sin traducir códigos.
 */
export function nombrePlan(id: string | null | undefined): string {
  return planCompensacion(id)?.nombre ?? "";
}

/** Vuelve del nombre guardado en Airtable al id del plan. */
export function planPorNombre(nombre: unknown): PlanCompensacionId | null {
  if (typeof nombre !== "string" || !nombre.trim()) return null;
  const limpio = nombre.trim();
  return PLANES_COMPENSACION.find((p) => p.nombre === limpio)?.id ?? null;
}

// ── Utilidades de fecha ───────────────────────────────────────────────────────
// Las fechas ISO se parsean a mano: `new Date("2026-08-08")` es medianoche UTC y
// en Colombia (-5) devolvería el día anterior.

function aFecha(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function aISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Las horas se pactan en fracciones de media hora. */
function redondear(horas: number): number {
  return Math.round(horas * 2) / 2;
}

export function esSabado(iso: string): boolean {
  const d = aFecha(iso);
  return d ? d.getDay() === 6 : false;
}

/** Días de calendario que cubre un permiso, extremos incluidos. */
export function diasEntre(inicio: string, fin?: string | null): number {
  const desde = aFecha(inicio);
  if (!desde) return 0;
  const hasta = fin ? aFecha(fin) : null;
  if (!hasta || hasta < desde) return 1;
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
}

/**
 * Horas que el trabajador debe reponer: las del permiso por horas, o una jornada
 * completa por cada día si el permiso se pidió por días.
 */
export function horasAReponer(horas: unknown, diasCalendario: number): number {
  const n = Number(typeof horas === "string" ? horas.trim().replace(",", ".") : horas);
  if (Number.isFinite(n) && n > 0) return redondear(n);
  return Math.max(1, diasCalendario) * HORAS_JORNADA;
}

/** Cuántos sábados hacen falta para cubrir las horas del permiso. */
export function sabadosNecesarios(horasTotal: number): number {
  const jornada = planCompensacion(PLAN_SABADO)!.horasJornada;
  return Math.max(1, Math.ceil(horasTotal / jornada));
}

// ── Generación de los días de cada plan ───────────────────────────────────────

/** Plan 1 — reparte las horas en jornadas de sábado de 5 h. */
export function diasPlanSabado(fechas: string[], horasTotal: number): DiaCompensacion[] {
  const jornada = planCompensacion(PLAN_SABADO)!.horasJornada;
  const validas = [...new Set(fechas.filter(Boolean))].sort();
  let restante = horasTotal;

  return validas.map((fecha) => {
    // Si el trabajador eligió más sábados de los necesarios, los sobrantes salen
    // en 0 h y se descartan al guardar: nadie repone más de lo que pidió.
    const horas = restante > 0 ? Math.min(jornada, redondear(restante)) : 0;
    restante -= horas;
    return {
      fecha,
      horas,
      descripcion: "Jornada de compensación: sábado de 7:00 a. m. a 12:00 m.",
    };
  });
}

/** Plan 2 — una hora adicional por día hábil (lunes a viernes) desde `desde`. */
export function diasPlanHoraDiaria(desde: string, horasTotal: number): DiaCompensacion[] {
  const inicio = aFecha(desde);
  if (!inicio || horasTotal <= 0) return [];

  const dias: DiaCompensacion[] = [];
  const cursor = new Date(inicio);
  let restante = horasTotal;

  while (restante > 0 && dias.length < MAX_DIAS_HABILES) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      const horas = Math.min(1, redondear(restante));
      dias.push({
        fecha: aISO(cursor),
        horas,
        descripcion: "Una hora adicional al final de la jornada.",
      });
      restante -= horas;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

/** Plan 3 — una sola entrada: el reto pactado y su fecha límite. */
export function diasPlanReto(
  fechaLimite: string,
  horasTotal: number,
  reto: string
): DiaCompensacion[] {
  if (!fechaLimite) return [];
  return [
    {
      fecha: fechaLimite,
      horas: redondear(horasTotal),
      descripcion: reto.trim() || "Reto acordado con Gestión del Ser.",
    },
  ];
}

export interface OpcionesPlan {
  horasTotal: number;
  /** Plan 1: sábados elegidos. */
  fechas?: string[];
  /** Plan 2: primer día de la reposición. */
  desde?: string;
  /** Plan 3: fecha límite del reto. */
  fechaLimite?: string;
  /** Plan 3: en qué consiste el reto. */
  reto?: string;
}

/** Traduce un plan y sus datos a la lista de días que se guarda y se imprime. */
export function generarDiasCompensacion(
  plan: string | null | undefined,
  opciones: OpcionesPlan
): DiaCompensacion[] {
  const { horasTotal, fechas = [], desde = "", fechaLimite = "", reto = "" } = opciones;

  switch (plan) {
    case PLAN_SABADO:
      return diasPlanSabado(fechas, horasTotal);
    case PLAN_HORA_DIARIA:
      return diasPlanHoraDiaria(desde, horasTotal);
    case PLAN_RETO:
      return diasPlanReto(fechaLimite, horasTotal, reto);
    default:
      return [];
  }
}

/** Descarta las filas incompletas antes de guardar. */
export function diasValidos(dias: DiaCompensacion[] | undefined | null): DiaCompensacion[] {
  return (dias ?? []).filter((d) => d && d.fecha && Number(d.horas) > 0);
}

/** Lee el JSON de un campo de texto largo de Airtable. */
export function parseDiasCompensacion(valor: unknown): DiaCompensacion[] {
  if (typeof valor !== "string" || !valor.trim()) return [];
  try {
    const dias = JSON.parse(valor);
    if (!Array.isArray(dias)) return [];
    return diasValidos(
      dias.map((d) => ({
        fecha: String(d?.fecha ?? ""),
        horas: Number(d?.horas) || 0,
        descripcion: String(d?.descripcion ?? ""),
      }))
    );
  } catch {
    return [];
  }
}
