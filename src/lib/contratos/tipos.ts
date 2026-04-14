/**
 * Tipos y lógica de dominio — Módulo Contratos Laborales
 * Fase 1: Contratos Laborales (Semanas 1-4)
 */

export type TipoContrato =
  | "fijo"
  | "indefinido"
  | "obra_labor"
  | "aprendizaje"
  | "prestacion_servicios";

export type EstadoContrato = "activo" | "vencido" | "terminado" | "suspendido";
export type PeriodicidadPago = "quincenal" | "mensual";
export type AccionHistorial = "crear" | "modificar" | "terminar" | "suspender" | "reactivar";
export type TipoAlerta = "30_dias" | "15_dias" | "7_dias";

export interface Contrato {
  id: string;           // Airtable record ID
  idContrato: string;   // SIRIUS-CON-XXXX
  idEmpleado: string;   // SIRIUS-PER-XXXX
  nombreEmpleado: string;
  tipoContrato: TipoContrato;
  fechaInicio: string;  // YYYY-MM-DD
  fechaFin: string | null;
  salarioBase: number;
  periodicidadPago: PeriodicidadPago;
  jornadaId: string | null;
  estado: EstadoContrato;
  version: number;
  motivoTerminacion: string | null;
  fechaTerminacion: string | null;
  documentoUrl: string | null;
  creadoPor: string;
  observaciones: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface HistorialContrato {
  id: string;
  idHistorial: string;
  idContrato: string;
  accion: AccionHistorial;
  campoModificado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  modificadoPor: string;
  idUsuarioModificador: string;
  timestamp: string;
}

export interface AlertaContrato {
  id: string;
  idAlerta: string;
  idContrato: string;
  idEmpleado: string;
  nombreEmpleado: string;
  tipoAlerta: TipoAlerta;
  fechaVencimiento: string;
  fechaAlerta: string;
  enviada: boolean;
  fechaEnvio: string | null;
}

/** Tipos que requieren fecha_fin para generar alertas */
export const TIPOS_CON_FECHA_FIN: TipoContrato[] = ["fijo", "obra_labor"];

/** Días de anticipación para cada tipo de alerta */
export const DIAS_ALERTA: Record<TipoAlerta, number> = {
  "30_dias": 30,
  "15_dias": 15,
  "7_dias": 7,
};

/** Genera el ID de contrato dado el conteo actual */
export function generarIdContrato(count: number): string {
  return `SIRIUS-CON-${String(count).padStart(4, "0")}`;
}

/** Genera el ID de historial */
export function generarIdHistorial(contratoRecordId: string, accion: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `HIST-${contratoRecordId.slice(-6)}-${accion.slice(0, 3).toUpperCase()}-${ts}`;
}

/** Genera el ID de alerta */
export function generarIdAlerta(contratoId: string, tipo: TipoAlerta): string {
  return `ALERTA-${contratoId}-${tipo}`;
}

/**
 * Calcula las fechas en que deben generarse alertas dado un fecha_fin.
 * Solo para contratos tipo fijo y obra_labor.
 */
export function calcularFechasAlerta(
  fechaFin: string,
  tipo: TipoAlerta
): string {
  const fin = new Date(fechaFin);
  fin.setDate(fin.getDate() - DIAS_ALERTA[tipo]);
  return fin.toISOString().split("T")[0];
}

/** Mapea un record de Airtable a la interfaz Contrato */
export function mapearContrato(record: {
  id: string;
  fields: Record<string, unknown>;
}): Contrato {
  const f = record.fields;
  return {
    id: record.id,
    idContrato: (f["ID_Contrato"] as string) || "",
    idEmpleado: (f["ID_Empleado"] as string) || "",
    nombreEmpleado: (f["Nombre_Empleado"] as string) || "",
    tipoContrato: (f["Tipo_Contrato"] as TipoContrato) || "indefinido",
    fechaInicio: (f["Fecha_Inicio"] as string) || "",
    fechaFin: (f["Fecha_Fin"] as string) || null,
    salarioBase: (f["Salario_Base"] as number) || 0,
    periodicidadPago: (f["Periodicidad_Pago"] as PeriodicidadPago) || "mensual",
    jornadaId: (f["Jornada_ID"] as string) || null,
    estado: (f["Estado"] as EstadoContrato) || "activo",
    version: (f["Version"] as number) || 1,
    motivoTerminacion: (f["Motivo_Terminacion"] as string) || null,
    fechaTerminacion: (f["Fecha_Terminacion"] as string) || null,
    documentoUrl: (f["Documento_URL"] as string) || null,
    creadoPor: (f["Creado_Por"] as string) || "",
    observaciones: (f["Observaciones"] as string) || null,
    fechaCreacion: (f["Fecha_Creacion"] as string) || "",
    fechaActualizacion: (f["Fecha_Actualizacion"] as string) || "",
  };
}
