/**
 * Lógica pura del módulo de asistencia: fechas en hora de Colombia, agrupación
 * de marcaciones por día y cálculo de la jornada trabajada.
 *
 * No toca Airtable ni React — así se puede probar sin red y se reutiliza tanto
 * en el route handler como en la UI.
 */

import { TIPOS_ASISTENCIA, type TipoAsistencia } from "./constants";
import { ZONA_BOGOTA, fechaBogota, horaBogota } from "./fecha-bogota";

// Se reexportan para que quien trabaje con asistencia no tenga que importar de
// dos módulos distintos; la implementación vive en fecha-bogota.ts.
export { ZONA_BOGOTA, fechaBogota, horaBogota };

/** Una marcación tal como la consume la aplicación. */
export interface Marcacion {
  id: string;
  tipo: TipoAsistencia;
  /** YYYY-MM-DD en hora de Colombia. */
  fecha: string;
  /** HH:mm en hora de Colombia. */
  hora: string;
  /** Instante exacto en ISO 8601 (UTC). Es el dato con el que se calcula. */
  fechaHora: string;
  notas?: string;
}

/** Resumen de un día de trabajo, ya emparejadas las entradas con las salidas. */
export interface DiaAsistencia {
  fecha: string;
  primeraEntrada: string | null;
  ultimaSalida: string | null;
  minutosTrabajados: number;
  /** Hay una entrada sin su salida: la jornada sigue abierta. */
  jornadaAbierta: boolean;
  marcaciones: Marcacion[];
}

/** Mes en curso en Colombia, formato YYYY-MM. */
export function mesBogota(momento: Date = new Date()): string {
  return fechaBogota(momento).slice(0, 7);
}

/**
 * Qué le toca marcar al colaborador ahora mismo.
 * Si su última marcación del día fue una entrada, sigue la salida; en cualquier
 * otro caso (sin marcaciones, o la última fue salida) sigue una entrada. Esto es
 * lo que permite que la pantalla tenga un único botón.
 */
export function siguienteTipo(marcacionesDelDia: Marcacion[]): TipoAsistencia {
  const ultima = ordenar(marcacionesDelDia).at(-1);
  return ultima?.tipo === TIPOS_ASISTENCIA.ENTRADA
    ? TIPOS_ASISTENCIA.SALIDA
    : TIPOS_ASISTENCIA.ENTRADA;
}

/** Ordena por instante real, no por la hora en texto. */
function ordenar(marcaciones: Marcacion[]): Marcacion[] {
  return [...marcaciones].sort(
    (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
  );
}

/**
 * Empareja entradas con salidas y suma el tiempo de cada tramo.
 *
 * Una entrada repetida sin salida intermedia no reinicia el conteo (se conserva
 * la primera) y una salida suelta se ignora: nadie debe perder horas por haber
 * pulsado dos veces.
 */
export function resumirDia(fecha: string, marcaciones: Marcacion[]): DiaAsistencia {
  const orden = ordenar(marcaciones);
  let minutos = 0;
  let entradaPendiente: Marcacion | null = null;
  let ultimaSalida: string | null = null;
  let primeraEntrada: string | null = null;

  for (const marcacion of orden) {
    if (marcacion.tipo === TIPOS_ASISTENCIA.ENTRADA) {
      if (!primeraEntrada) primeraEntrada = marcacion.hora;
      if (!entradaPendiente) entradaPendiente = marcacion;
      continue;
    }

    ultimaSalida = marcacion.hora;
    if (!entradaPendiente) continue;

    const tramo =
      new Date(marcacion.fechaHora).getTime() - new Date(entradaPendiente.fechaHora).getTime();
    if (tramo > 0) minutos += Math.round(tramo / 60_000);
    entradaPendiente = null;
  }

  return {
    fecha,
    primeraEntrada,
    ultimaSalida,
    minutosTrabajados: minutos,
    jornadaAbierta: entradaPendiente !== null,
    marcaciones: orden,
  };
}

/** Agrupa marcaciones sueltas en días, del más reciente al más antiguo. */
export function agruparPorDia(marcaciones: Marcacion[]): DiaAsistencia[] {
  const porFecha = new Map<string, Marcacion[]>();

  for (const marcacion of marcaciones) {
    const grupo = porFecha.get(marcacion.fecha);
    if (grupo) grupo.push(marcacion);
    else porFecha.set(marcacion.fecha, [marcacion]);
  }

  return [...porFecha.entries()]
    .map(([fecha, lista]) => resumirDia(fecha, lista))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** "7 h 45 min" — formato corto para la UI. */
export function formatearDuracion(minutos: number): string {
  if (minutos <= 0) return "0 min";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

/** "miércoles, 6 de agosto" — encabezado de la pantalla y filas del historial. */
export function formatearFechaLarga(fecha: string): string {
  // Se fuerza el mediodía UTC para que el cambio de zona no corra el día.
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${fecha}T12:00:00Z`));
}
