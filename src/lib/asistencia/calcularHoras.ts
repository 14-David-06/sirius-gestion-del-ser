/**
 * calcularHoras — Módulo de liquidación de horas laborales
 *
 * Calcula horas ordinarias, extras, nocturnas, dominicales y faltantes
 * a partir de registros de asistencia y la configuración del horario asignado.
 *
 * Tramos legales colombianos (Código Sustantivo del Trabajo):
 *  - Diurno:   06:00–21:00
 *  - Nocturno: 21:00–06:00 (recargo 35%)
 *  - Ordinarias: hasta 8 h/día en tramo diurno
 *  - Extras diurnas: más de 8 h/día en tramo diurno
 *  - Extras nocturnas: horas trabajadas en tramo nocturno
 *  - Dominicales: horas trabajadas en domingo
 *  - Festivos: horas trabajadas en días de la tabla de festivos Colombia
 */

export interface RegistroAsistencia {
  tipo: "Entrada" | "Salida";
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:MM
}

export interface HorarioConfig {
  horaEntradaSeg: number;   // segundos desde medianoche
  horaSalidaSeg: number;    // segundos desde medianoche
  diasLaborales: string[];  // ["Lunes","Martes",...]
  totalHorasDia: number;    // normalmente 8
}

export interface ResultadoHoras {
  horas_ordinarias_diurnas: number;
  horas_extras_diurnas: number;
  horas_extras_nocturnas: number;
  horas_nocturnas: number;       // recargo 35%, tramo 9PM–6AM
  horas_dominicales: number;
  horas_festivos: number;
  horas_faltantes: number;
  dias_analizados: number;
}

// Nombres de día de la semana usados en Colombia (índice 0 = Domingo)
const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

// Tramo nocturno: 21:00–06:00 (en segundos desde medianoche)
const TRAMO_NOCTURNO_INICIO = 21 * 3600; // 75600 s
const TRAMO_NOCTURNO_FIN    =  6 * 3600; // 21600 s

/**
 * Calcula cuántos segundos de un intervalo [inicioSeg, finSeg) caen
 * dentro del tramo nocturno (21:00–06:00).
 *
 * Asume que el intervalo no cruza la medianoche (cada día se trata por separado).
 */
function segundosNocturnos(inicioSeg: number, finSeg: number): number {
  let nocturno = 0;

  // Segmento desde medianoche hasta fin del tramo nocturno matutino (00:00–06:00)
  const tramoMatutino = { desde: 0, hasta: TRAMO_NOCTURNO_FIN };
  // Segmento desde inicio del tramo nocturno vespertino hasta fin del día (21:00–24:00)
  const tramoVespertino = { desde: TRAMO_NOCTURNO_INICIO, hasta: 24 * 3600 };

  for (const tramo of [tramoMatutino, tramoVespertino]) {
    const overlap = Math.max(
      0,
      Math.min(finSeg, tramo.hasta) - Math.max(inicioSeg, tramo.desde)
    );
    nocturno += overlap;
  }

  return nocturno;
}

// Hora de fin de jornada por defecto cuando no hay horario configurado (17:00)
const HORA_FIN_FALLBACK = "17:00";

/**
 * Convierte "HH:MM" a segundos desde medianoche.
 */
function horaASegundos(hora: string): number {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 3600 + mm * 60;
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD (zona local).
 * Se expone como función para facilitar el mocking en tests.
 */
export function obtenerFechaHoy(): string {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

export function calcularHoras(
  registros: RegistroAsistencia[],
  horario: HorarioConfig,
  festivos: string[],   // array de fechas YYYY-MM-DD
  inicio: string,       // YYYY-MM-DD
  fin: string,          // YYYY-MM-DD
  _fechaHoy?: string    // inyectable para tests; si se omite usa la fecha real del sistema
): ResultadoHoras {
  const fechaHoyEfectiva = _fechaHoy ?? obtenerFechaHoy();
  const result: ResultadoHoras = {
    horas_ordinarias_diurnas: 0,
    horas_extras_diurnas: 0,
    horas_extras_nocturnas: 0,
    horas_nocturnas: 0,
    horas_dominicales: 0,
    horas_festivos: 0,
    horas_faltantes: 0,
    dias_analizados: 0,
  };

  const festivosSet = new Set(festivos);

  // Agrupar registros de Entrada+Salida por fecha
  const porFecha = new Map<string, { entradas: string[]; salidas: string[] }>();
  for (const r of registros) {
    if (!porFecha.has(r.fecha)) {
      porFecha.set(r.fecha, { entradas: [], salidas: [] });
    }
    const grupo = porFecha.get(r.fecha)!;
    if (r.tipo === "Entrada") grupo.entradas.push(r.hora);
    else grupo.salidas.push(r.hora);
  }

  // Iterar sobre cada día del periodo
  const fechaInicio = new Date(`${inicio}T00:00:00`);
  const fechaFin    = new Date(`${fin}T00:00:00`);

  for (
    let d = new Date(fechaInicio);
    d <= fechaFin;
    d.setDate(d.getDate() + 1)
  ) {
    const fechaStr = d.toISOString().split("T")[0];
    const diaSemana = DIAS_SEMANA[d.getDay()];
    const esDomingo = d.getDay() === 0;
    const esFestivo = festivosSet.has(fechaStr);
    const esDiaLaboral = horario.diasLaborales.includes(diaSemana);

    result.dias_analizados++;

    const grupo = porFecha.get(fechaStr);

    // Si es día laboral y no tiene ninguna entrada → faltante
    if (esDiaLaboral && (!grupo || grupo.entradas.length === 0)) {
      result.horas_faltantes++;
      continue;
    }

    if (!grupo) continue;

    // Ordenar entradas y salidas
    const entradas = [...grupo.entradas].sort();
    const salidas  = [...grupo.salidas].sort();

    // Emparejar Entrada+Salida en orden (primera entrada con primera salida, etc.)
    const pares = Math.min(entradas.length, salidas.length);
    let horasDiurnasDia = 0;
    let horasNocturnasDia = 0;

    for (let i = 0; i < pares; i++) {
      const [ehh, emm] = entradas[i].split(":").map(Number);
      const [shh, smm] = salidas[i].split(":").map(Number);
      const entradaSeg = ehh * 3600 + emm * 60;
      const salidaSeg  = shh * 3600 + smm * 60;

      if (salidaSeg <= entradaSeg) continue; // ignorar pares inválidos

      const totalSeg    = salidaSeg - entradaSeg;
      const noctSeg     = segundosNocturnos(entradaSeg, salidaSeg);
      const diurnaSeg   = totalSeg - noctSeg;

      horasDiurnasDia  += diurnaSeg  / 3600;
      horasNocturnasDia += noctSeg   / 3600;
    }

    // Manejar entradas sin salida correspondiente
    const entradasSinSalida = entradas.length - pares;
    if (entradasSinSalida > 0) {
      if (fechaStr === fechaHoyEfectiva) {
        // Jornada en curso: ignorar, la jornada no ha terminado todavía
      } else {
        // Día pasado con entrada sin salida: estimar hasta hora_fin del horario
        // como estimación conservadora ("salida al cierre de oficina")
        const horaFinSeg = horario.horaSalidaSeg > 0
          ? horario.horaSalidaSeg
          : horaASegundos(HORA_FIN_FALLBACK);

        for (let i = pares; i < entradas.length; i++) {
          const entradaSeg = horaASegundos(entradas[i]);
          const salidaEstimadaSeg = horaFinSeg;

          if (salidaEstimadaSeg <= entradaSeg) continue; // entrada después del cierre, ignorar

          const totalSeg  = salidaEstimadaSeg - entradaSeg;
          const noctSeg   = segundosNocturnos(entradaSeg, salidaEstimadaSeg);
          const diurnaSeg = totalSeg - noctSeg;

          horasDiurnasDia  += diurnaSeg  / 3600;
          horasNocturnasDia += noctSeg   / 3600;
        }
      }
    }

    const ordinarias    = Math.min(horasDiurnasDia, horario.totalHorasDia);
    const extrasDiurnas = Math.max(0, horasDiurnasDia - horario.totalHorasDia);

    if (esFestivo) {
      result.horas_festivos     += horasDiurnasDia + horasNocturnasDia;
    } else if (esDomingo) {
      result.horas_dominicales  += horasDiurnasDia + horasNocturnasDia;
    } else {
      result.horas_ordinarias_diurnas  += ordinarias;
      result.horas_extras_diurnas      += extrasDiurnas;
      result.horas_nocturnas           += horasNocturnasDia;
      result.horas_extras_nocturnas    += horasNocturnasDia; // todo tramo nocturno es extra
    }
  }

  // Redondear a 2 decimales para evitar aritmética de punto flotante
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    horas_ordinarias_diurnas: round2(result.horas_ordinarias_diurnas),
    horas_extras_diurnas:     round2(result.horas_extras_diurnas),
    horas_extras_nocturnas:   round2(result.horas_extras_nocturnas),
    horas_nocturnas:          round2(result.horas_nocturnas),
    horas_dominicales:        round2(result.horas_dominicales),
    horas_festivos:           round2(result.horas_festivos),
    horas_faltantes:          result.horas_faltantes,
    dias_analizados:          result.dias_analizados,
  };
}
