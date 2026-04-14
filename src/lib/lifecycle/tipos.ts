/**
 * Tipos y utilidades — Módulo Lifecycle (Ciclo de vida del empleado)
 * Orquesta vinculación (onboarding) y desvinculación (offboarding)
 */

// ─── Tipos de evento ─────────────────────────────────────────────────────────

export type TipoEvento = "vinculacion" | "desvinculacion" | "reactivacion" | "suspension";

export type TipoRetiro =
  | "renuncia_voluntaria"
  | "terminacion_con_justa_causa"
  | "terminacion_sin_justa_causa"
  | "mutuo_acuerdo"
  | "vencimiento_contrato"
  | "pension"
  | "fallecimiento";

export type TipoContrato =
  | "fijo"
  | "indefinido"
  | "obra_labor"
  | "aprendizaje"
  | "prestacion_servicios";

export type PeriodicidadPago = "quincenal" | "mensual";

// ─── Interfaces de datos ─────────────────────────────────────────────────────

export interface DatosPersonales {
  nombre: string;
  cedula: string;
  fechaNacimiento?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
}

export interface DatosLaborales {
  cargo: string;
  area: string;
  fechaInicio: string;
  tipoContrato: TipoContrato;
  fechaFin?: string | null;
  salarioBase: number;
  periodicidadPago: PeriodicidadPago;
  jornadaId: string;
}

export interface OnboardRequest {
  datosPersonales: DatosPersonales;
  datosLaborales: DatosLaborales;
}

export interface OffboardRequest {
  empleadoId: string;
  fechaEfectiva: string;
  tipoRetiro: TipoRetiro;
  motivo: string;
  notas?: string | null;
}

// ─── Interfaces del evento lifecycle ─────────────────────────────────────────

export interface DatosCascada {
  pasosCompletados: string[];
  empleadoId?: string;
  empleadoRecordId?: string;
  contratoId?: string;
  contratoRecordId?: string;
  asignacionId?: string;
  error?: string;
  advertencias?: string[];
}

export interface LifecycleEvent {
  id: string;
  empleadoId: string;
  tipoEvento: TipoEvento;
  subtipo: string | null;
  fechaEfectiva: string;
  documentoUrl: string | null;
  registradoPor: string;
  notas: string | null;
  datosCascada: DatosCascada | null;
  createdAt: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

export const TIPOS_CONTRATO: { value: TipoContrato; label: string }[] = [
  { value: "indefinido", label: "Indefinido" },
  { value: "fijo", label: "A término fijo" },
  { value: "obra_labor", label: "Obra o labor" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "prestacion_servicios", label: "Prestación de servicios" },
];

export const TIPOS_RETIRO: { value: TipoRetiro; label: string }[] = [
  { value: "renuncia_voluntaria", label: "Renuncia voluntaria" },
  { value: "terminacion_con_justa_causa", label: "Terminación con justa causa" },
  { value: "terminacion_sin_justa_causa", label: "Terminación sin justa causa" },
  { value: "mutuo_acuerdo", label: "Mutuo acuerdo" },
  { value: "vencimiento_contrato", label: "Vencimiento de contrato" },
  { value: "pension", label: "Pensión" },
  { value: "fallecimiento", label: "Fallecimiento" },
];

export const PERIODICIDADES_PAGO: { value: PeriodicidadPago; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Mapea un record de Airtable a LifecycleEvent */
export function mapearEvento(record: {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}): LifecycleEvent {
  const f = record.fields;
  let datosCascada: DatosCascada | null = null;
  
  if (f["Datos_Cascada"]) {
    try {
      datosCascada = JSON.parse(f["Datos_Cascada"] as string);
    } catch {
      datosCascada = null;
    }
  }

  return {
    id: record.id,
    empleadoId: (f["Empleado_ID"] as string) || "",
    tipoEvento: (f["Tipo_Evento"] as TipoEvento) || "vinculacion",
    subtipo: (f["Subtipo"] as string) || null,
    fechaEfectiva: (f["Fecha_Efectiva"] as string) || "",
    documentoUrl: (f["Documento_URL"] as string) || null,
    registradoPor: (f["Registrado_Por"] as string) || "",
    notas: (f["Notas"] as string) || null,
    datosCascada,
    createdAt: record.createdTime || (f["Created_At"] as string) || "",
  };
}

/** Genera un ID único para el evento */
export function generarIdEvento(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LC-${ts}-${random}`;
}
