// Fuente única de verdad para nombres de tablas y campos de Airtable.
// NUNCA usar strings de tabla/campo directamente en el código — siempre importar desde aquí.
// Si se renombra una tabla o campo en Airtable, solo se cambia en este archivo.

// ── Tablas ────────────────────────────────────────────────────────────────────
// Los nombres de tabla se leen de env vars para permitir sobreescritura por entorno.
// Si la variable no está definida, se usa el nombre de tabla de producción como fallback.
export const TABLES = {
  // Nómina Core
  PERSONAL:    process.env.AIRTABLE_TABLE_PERSONAL           ?? "Personal",
  ROLES:       process.env.AIRTABLE_TABLE_ROLES              ?? "Roles y Permisos",
  // Novedades Nómina
  PERMISO:     process.env.AIRTABLE_TABLE_SOLICITUD_PERMISO  ?? "Solicitud_Permiso",
  VACACIONES:  process.env.AIRTABLE_TABLE_SOLICITUD_VACACIONES ?? "Solicitud_Vacaciones",
  NOVEDADES:   process.env.AIRTABLE_TABLE_NOVEDADES_NOMINA   ?? "Reportes Novedades Nomina",
} as const;

// ── FK compartida ─────────────────────────────────────────────────────────────
// Campo que referencia al empleado en todas las tablas de Novedades y Gestión del Ser.
// Valor: "SIRIUS-PER-XXXX" (payload.idCore). Ver CLAUDE.md § Identificador único.
export const FK_ID_CORE = "ID Personal Core";

// ── Campos por tabla ──────────────────────────────────────────────────────────
export const FIELDS = {
  PERSONAL: {
    NUMERO_DOCUMENTO: "Numero Documento",
    NOMBRE:           "Nombre completo",
    PASSWORD:         "Password",
    ESTADO:           "Estado de actividad",
    ROL:              "Rol",
    ID_EMPLEADO:      "ID Empleado",
  },
  ROLES: {
    ROL:          "Rol",
    NIVEL_ACCESO: "Nivel_Acceso",
  },
  PERMISO: {
    NOMBRE:          "Nombre",
    CEDULA:          "Cedula",
    CARGO:           "Cargo",
    FECHA_SOLICITUD: "Fecha de solicitud",
    TIPO:            "Tipo_Permiso",
    FECHA_INICIO:    "Fecha de permiso",
    FECHA_FIN:       "Fecha fin de permiso",
    HORAS:           "Horas_Permiso",
    MOTIVO:          "Motivo_Permiso",
    REMUNERADO:      "Remunerado",
    COMPENSADO:      "Compensado",
    FECHA_COMP:      "Fecha de compensatorio",
    ESTADO:          "Estado_Permiso",
  },
  VACACIONES: {
    NOMBRE:              "Nombre",
    CEDULA:              "Cedula",
    CARGO:               "Cargo",
    FECHA_PRESENTACION:  "Fecha de Presentacion",
    FECHA_INICIO:        "Fecha Inicio",
    FECHA_FIN:           "Fecha Fin",
    FECHA_REINTEGRO:     "Fecha Reintegro",
    DIAS:                "Dias Vacaciones",
    MOTIVO:              "Motivo",
    ESTADO:              "Estado Solicitud",
  },
  NOVEDADES: {
    TIPO:           "Tipo de Novedad",
    DESCRIPCION:    "Descripción de la Novedad",
    HORAS_EXTRA:    "Número Horas Extras",
    ESTADO:         "Estado del Registro",
    FECHA_CREACION: "Fecha Creación",
  },
} as const;

// ── Estados de actividad (tabla Personal) ─────────────────────────────────────
export const ESTADOS_ACTIVIDAD = {
  ACTIVO:  "Activo",
  DE_BAJA: "De baja",
} as const;

// ── Estado inicial de nuevas solicitudes ──────────────────────────────────────
export const ESTADO_PENDIENTE = "Pendiente";
