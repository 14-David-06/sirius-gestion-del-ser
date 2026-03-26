/**
 * Tipos de dominio y helpers para el módulo de Solicitudes (Fase 3).
 *
 * Lógica de negocio:
 * - Cálculo de días hábiles según turno del empleado + festivos Colombia
 * - Cálculo de saldo de vacaciones (CST Art. 186: 15 días / año trabajado)
 */

// ─── Enums / Tipos ────────────────────────────────────────────────────────────

export type TipoSolicitud = "vacaciones" | "permiso" | "novedad_nomina";
export type EstadoSolicitud = "pendiente" | "aprobado" | "rechazado" | "cancelado";

// ─── Interfaces de dominio ────────────────────────────────────────────────────

export interface Solicitud {
  id: string;
  idSolicitud: string;
  empleadoId: string;
  nombreEmpleado: string;
  tipo: TipoSolicitud;
  subtipo: string;
  fechaInicio: string;
  fechaFin: string | null;
  duracionHoras: number | null;
  diasHabilesCalculados: number | null;
  descripcion: string;
  soporteUrl: string | null;
  estado: EstadoSolicitud;
  comentarioAdmin: string | null;
  revisadoPor: string | null;
  procesadoNomina: boolean;
  fechaProcesadoNomina: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TipoCatalogo {
  id: string;
  nombre: string;
  tipoPadre: TipoSolicitud | "";
  requiereSoporte: boolean;
  afectaNomina: boolean;
}

export interface SaldoVacaciones {
  id: string | null;
  empleadoId: string;
  nombreEmpleado: string;
  diasTotales: number;
  diasUsados: number;
  diasDisponibles: number;
  ultimoCalculo: string;
}

export interface FestivoColombia {
  fecha: string;      // YYYY-MM-DD
  nombre: string;
  anio: number;
}

// ─── Helpers de ID ────────────────────────────────────────────────────────────

export function generarIdSolicitud(count: number): string {
  return `SIRIUS-SOL-${String(count).padStart(5, "0")}`;
}

// ─── Constantes de días de la semana (getUTCDay → nombre en español) ──────────

const DIA_INDICE_A_NOMBRE: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

// Acepta variantes con/sin tilde para compatibilidad con Airtable
const NOMBRE_A_INDICE: Record<string, number> = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  "Miércoles": 3,
  Miercoles: 3,
  Jueves: 4,
  Viernes: 5,
  "Sábado": 6,
  Sabado: 6,
};

/**
 * Calcula los días hábiles entre fechaInicio y fechaFin (inclusive).
 *
 * "Hábil" = día que coincide con el turno del empleado (diasSemana)
 *           Y que no es festivo Colombia.
 *
 * @param fechaInicio  YYYY-MM-DD
 * @param fechaFin     YYYY-MM-DD
 * @param diasSemana   Nombres de los días laborales del turno (ej: ["Lunes","Martes",...])
 * @param festivos     Set de fechas festivas en formato YYYY-MM-DD
 */
export function calcularDiasHabiles(
  fechaInicio: string,
  fechaFin: string,
  diasSemana: string[],
  festivos: Set<string>
): number {
  if (!fechaInicio || !fechaFin) return 0;

  // Normalizar los días de la semana a sus índices JS
  const indicesDiasTrabajo = new Set<number>();
  for (const dia of diasSemana) {
    const idx = NOMBRE_A_INDICE[dia];
    if (idx !== undefined) indicesDiasTrabajo.add(idx);
  }

  // Si no hay días laborales configurados, asumir L-V (0-based: 1-5)
  const diasTrabajo = indicesDiasTrabajo.size > 0
    ? indicesDiasTrabajo
    : new Set([1, 2, 3, 4, 5]);

  const [sy, sm, sd] = fechaInicio.split("-").map(Number);
  const [ey, em, ed] = fechaFin.split("-").map(Number);

  const inicio = new Date(Date.UTC(sy, sm - 1, sd));
  const fin = new Date(Date.UTC(ey, em - 1, ed));

  if (inicio > fin) return 0;

  let count = 0;
  const cursor = new Date(inicio);

  while (cursor <= fin) {
    const diaSemana = cursor.getUTCDay();
    const fechaStr = cursor.toISOString().split("T")[0];

    if (diasTrabajo.has(diaSemana) && !festivos.has(fechaStr)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/**
 * Calcula el saldo de días de vacaciones acumulados según CST Art. 186.
 * 15 días hábiles por cada año trabajado (proporcional al tiempo transcurrido).
 *
 * @param fechaInicioContrato  YYYY-MM-DD — primer día del contrato
 * @param diasUsados           Días de vacaciones ya usados
 * @returns { diasTotales, diasUsados, diasDisponibles }
 */
export function calcularSaldoVacaciones(
  fechaInicioContrato: string,
  diasUsados: number
): { diasTotales: number; diasUsados: number; diasDisponibles: number } {
  const [y, m, d] = fechaInicioContrato.split("-").map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, d));
  const ahora = new Date();
  const ahora_utc = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));

  const diffMs = ahora_utc.getTime() - inicio.getTime();
  if (diffMs <= 0) return { diasTotales: 0, diasUsados: 0, diasDisponibles: 0 };

  const diasTranscurridos = diffMs / (1000 * 60 * 60 * 24);
  const aniosTrabajados = diasTranscurridos / 365;

  // 15 días hábiles por año, proporcional
  const diasTotales = Math.floor(aniosTrabajados * 15 * 100) / 100;
  const disponibles = Math.max(0, Math.round((diasTotales - diasUsados) * 100) / 100);

  return {
    diasTotales: Math.round(diasTotales * 100) / 100,
    diasUsados: diasUsados,
    diasDisponibles: disponibles,
  };
}

/**
 * Mapea un registro Airtable de requests_requests → Solicitud de dominio.
 */
export function mapearSolicitud(record: { id: string; fields: Record<string, unknown> }): Solicitud {
  const f = record.fields;
  return {
    id: record.id,
    idSolicitud: (f["ID_Solicitud"] as string) || "",
    empleadoId: (f["Empleado_ID"] as string) || "",
    nombreEmpleado: (f["Nombre_Empleado"] as string) || "",
    tipo: ((f["Tipo"] as string) || "vacaciones") as TipoSolicitud,
    subtipo: (f["Subtipo"] as string) || "",
    fechaInicio: (f["Fecha_Inicio"] as string) || "",
    fechaFin: (f["Fecha_Fin"] as string) || null,
    duracionHoras: (f["Duracion_Horas"] as number) ?? null,
    diasHabilesCalculados: (f["Dias_Habiles_Calculados"] as number) ?? null,
    descripcion: (f["Descripcion"] as string) || "",
    soporteUrl: (f["Soporte_URL"] as string) || null,
    estado: ((f["Estado"] as string) || "pendiente") as EstadoSolicitud,
    comentarioAdmin: (f["Comentario_Admin"] as string) || null,
    revisadoPor: (f["Revisado_Por"] as string) || null,
    procesadoNomina: Boolean(f["Procesado_Nomina"]),
    fechaProcesadoNomina: (f["Fecha_Procesado_Nomina"] as string) || null,
    createdAt: (f["Created_At"] as string) || "",
    updatedAt: (f["Updated_At"] as string) || "",
  };
}

/**
 * Mapea un registro Airtable de requests_tipos_solicitud → TipoCatalogo.
 */
export function mapearTipoCatalogo(record: { id: string; fields: Record<string, unknown> }): TipoCatalogo {
  const f = record.fields;
  return {
    id: record.id,
    nombre: (f["Nombre"] as string) || "",
    tipoPadre: ((f["Tipo_Padre"] as string) || "") as TipoSolicitud | "",
    requiereSoporte: Boolean(f["Requiere_Soporte"]),
    afectaNomina: Boolean(f["Afecta_Nomina"]),
  };
}

export { DIA_INDICE_A_NOMBRE };
