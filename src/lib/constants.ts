// Valores de negocio controlados — reemplazan texto libre del sistema legacy S3.
// Seguro para importar desde componentes cliente y servidor.

export const TIPOS_PERMISO = [
  "Médico / Cita médica",
  "Personal",
  "Calamidad doméstica",
  "Capacitación / Formación",
  "Trámite legal o personal",
  "Jurado de votación",
  "Lactancia",
  "Otro",
] as const;

export const TIPOS_NOVEDAD = [
  "Horas Extra",
  "Incapacidad médica",
  "Cambio de horario",
  "Trabajo remoto",
  "Registro biométrico incompleto",
  "Licencia de maternidad / paternidad",
  "Otra",
] as const;

// Usado para mostrar/ocultar el campo "Número de horas extra"
export const TIPO_HORAS_EXTRA = "Horas Extra" as const;
