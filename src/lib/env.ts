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
  | "ADM_MICROSOFT_TENANT_ID"
  | "ADM_MICROSOFT_CLIENT_ID"
  | "ADM_MICROSOFT_CLIENT_SECRET"
  | "ADM_MICROSOFT_EMAIL";

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
} as const;
