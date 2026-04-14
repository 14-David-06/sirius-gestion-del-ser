/**
 * Validación centralizada de variables de entorno.
 *
 * Se ejecuta una sola vez al importar el módulo.
 * Si falta alguna variable requerida, el proceso se detiene
 * con un mensaje claro (sin exponer valores).
 */

const requiredVars = [
  "AIRTABLE_API_KEY",
  "AIRTABLE_BASE_GESTION_DEL_SER",
  "AIRTABLE_BASE_NOMINA_CORE",
  "AIRTABLE_TABLE_NOMINA_PERSONAL",
  "JWT_SECRET",
] as const;

type EnvKey =
  | (typeof requiredVars)[number]
  | "AIRTABLE_REVALIDATE_SECONDS"
  | "AIRTABLE_TABLE_NOMINA_AREAS"
  | "AIRTABLE_TABLE_NOMINA_SISTEMAS_APLICACIONES"
  | "AIRTABLE_TABLE_REGISTRO_CUMPLIMIENTO"
  | "AIRTABLE_TABLE_TIPO_DOCUMENTO"
  | "AIRTABLE_TABLE_CONFIGURACION_HORARIOS"
  | "AIRTABLE_TABLE_ASIGNACION_HORARIO"
  | "AIRTABLE_TABLE_NOMINA_ROLES_PERMISOS"
  | "AIRTABLE_TABLE_NOVEDADES_ASISTENCIA"
  | "AIRTABLE_TABLE_SOLICITUDES_VACACIONES"
  | "AIRTABLE_TABLE_SOLICITUDES_PERMISOS"
  | "AIRTABLE_TABLE_FESTIVOS_COLOMBIA"
  | "AIRTABLE_TABLE_CAMBIOS_HORARIO"
  | "AIRTABLE_TABLE_SCHEDULES_HISTORIAL"
  | "AIRTABLE_TABLE_REQUESTS_REQUESTS"
  | "AIRTABLE_TABLE_REQUESTS_TIPOS"
  | "AIRTABLE_TABLE_REQUESTS_SALDOS"
  | "AIRTABLE_TABLE_REQUESTS_FESTIVOS"
  | "AIRTABLE_TABLE_CONTRACTS_CONTRACTS"
  | "AIRTABLE_TABLE_CONTRACTS_HISTORY"
  | "AIRTABLE_TABLE_CONTRACTS_ALERTAS"
  | "AIRTABLE_TABLE_LIFECYCLE_EVENTS"
  | "AWS_S3_BUCKET_CONTRACTS"
  | "AWS_S3_REGION"
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "SENDGRID_API_KEY"
  | "ALERT_EMAIL_FROM"
  | "ALERT_EMAIL_TO"
  | "ADM_MICROSOFT_TENANT_ID"
  | "ADM_MICROSOFT_CLIENT_ID"
  | "ADM_MICROSOFT_CLIENT_SECRET"
  | "ADM_MICROSOFT_EMAIL"
  | "WEBHOOK_NOVEDAD_NOMINA"
  | "CRON_SECRET"
  | "ANTHROPIC_API_KEY";

function getEnvVar(key: EnvKey): string {
  const value = process.env[key];
  if (!value && requiredVars.includes(key as (typeof requiredVars)[number])) {
    throw new Error(
      `[ENV] Variable de entorno requerida no definida: ${key}. ` +
        `Revisa el archivo .env.local (ver .env.example como referencia).`
    );
  }
  return value ?? "";
}

/** Configuración validada — solo accesible del lado del servidor */
export const env = {
  airtable: {
    apiKey: getEnvVar("AIRTABLE_API_KEY"),
    baseGestionDelSer: getEnvVar("AIRTABLE_BASE_GESTION_DEL_SER"),
    baseNominaCore: getEnvVar("AIRTABLE_BASE_NOMINA_CORE"),
    tablePersonal: getEnvVar("AIRTABLE_TABLE_NOMINA_PERSONAL"),
    tableAreas: getEnvVar("AIRTABLE_TABLE_NOMINA_AREAS"),
    tableSistemasAplicaciones: getEnvVar("AIRTABLE_TABLE_NOMINA_SISTEMAS_APLICACIONES"),
    tableRegistroCumplimiento: getEnvVar("AIRTABLE_TABLE_REGISTRO_CUMPLIMIENTO"),
    tableTipoDocumento: getEnvVar("AIRTABLE_TABLE_TIPO_DOCUMENTO"),
    tableConfiguracionHorarios: getEnvVar("AIRTABLE_TABLE_CONFIGURACION_HORARIOS"),
    tableAsignacionHorario: getEnvVar("AIRTABLE_TABLE_ASIGNACION_HORARIO"),
    tableRolesPermisos: getEnvVar("AIRTABLE_TABLE_NOMINA_ROLES_PERMISOS"),
    tableNovedadesAsistencia: getEnvVar("AIRTABLE_TABLE_NOVEDADES_ASISTENCIA"),
    tableSolicitudesVacaciones: getEnvVar("AIRTABLE_TABLE_SOLICITUDES_VACACIONES"),
    tableSolicitudesPermisos: getEnvVar("AIRTABLE_TABLE_SOLICITUDES_PERMISOS"),
    tableFestivosColombia: getEnvVar("AIRTABLE_TABLE_FESTIVOS_COLOMBIA"),
    tableCambiosHorario: getEnvVar("AIRTABLE_TABLE_CAMBIOS_HORARIO"),
    tableSchedulesHistorial: getEnvVar("AIRTABLE_TABLE_SCHEDULES_HISTORIAL") || "schedules_historial",
    tableRequestsRequests: getEnvVar("AIRTABLE_TABLE_REQUESTS_REQUESTS") || "requests_requests",
    tableRequestsTipos: getEnvVar("AIRTABLE_TABLE_REQUESTS_TIPOS") || "requests_tipos_solicitud",
    tableRequestsSaldos: getEnvVar("AIRTABLE_TABLE_REQUESTS_SALDOS") || "requests_saldos_vacaciones",
    tableRequestsFestivos: getEnvVar("AIRTABLE_TABLE_REQUESTS_FESTIVOS") || "requests_festivos_colombia",
    tableContractsContracts: getEnvVar("AIRTABLE_TABLE_CONTRACTS_CONTRACTS") || "contracts_contracts",
    tableContractsHistory: getEnvVar("AIRTABLE_TABLE_CONTRACTS_HISTORY") || "contracts_history",
    tableContractsAlertas: getEnvVar("AIRTABLE_TABLE_CONTRACTS_ALERTAS") || "contracts_alertas",
    tableLifecycleEvents: getEnvVar("AIRTABLE_TABLE_LIFECYCLE_EVENTS") || "lifecycle_events",
    revalidateSeconds: parseInt(
      getEnvVar("AIRTABLE_REVALIDATE_SECONDS") || "60",
      10
    ),
  },
  auth: {
    jwtSecret: getEnvVar("JWT_SECRET"),
  },
  microsoft: {
    tenantId: getEnvVar("ADM_MICROSOFT_TENANT_ID"),
    clientId: getEnvVar("ADM_MICROSOFT_CLIENT_ID"),
    clientSecret: getEnvVar("ADM_MICROSOFT_CLIENT_SECRET"),
    email: getEnvVar("ADM_MICROSOFT_EMAIL"),
  },
  webhooks: {
    novedadNomina: getEnvVar("WEBHOOK_NOVEDAD_NOMINA"),
  },
  anthropic: {
    apiKey: getEnvVar("ANTHROPIC_API_KEY"),
  },
  cron: {
    cronSecret: getEnvVar("CRON_SECRET"),
  },
  s3: {
    bucket: getEnvVar("AWS_S3_BUCKET_CONTRACTS"),
    region: getEnvVar("AWS_S3_REGION") || "us-east-1",
    accessKeyId: getEnvVar("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getEnvVar("AWS_SECRET_ACCESS_KEY"),
  },
  sendgrid: {
    apiKey: getEnvVar("SENDGRID_API_KEY"),
    emailFrom: getEnvVar("ALERT_EMAIL_FROM"),
    emailTo: getEnvVar("ALERT_EMAIL_TO"),
  },
} as const;
