/**
 * Consultas a la tabla Personal de Nómina Core.
 *
 * El cargo no vive en Personal sino en Roles y Permisos: Personal.Rol es un
 * enlace y hay que resolverlo. Se centraliza aquí para no repetir la doble
 * consulta en cada endpoint que necesita mostrar el cargo.
 */

import { TABLES, FIELDS } from "@/lib/airtable-schema";
import { escapeAirtableValue } from "@/lib/security";

const BASE_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

export interface DatosEmpleado {
  nombre: string;
  cedula: string;
  idCore: string;
  cargo: string;
}

async function airtable(path: string): Promise<{ id?: string; fields?: Record<string, unknown>; records?: { id: string; fields: Record<string, unknown> }[] } | null> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_CORE}/${path}`, {
      headers: { Authorization: `Bearer ${KEY_CORE}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[empleados] Airtable ${res.status} en ${path}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error(`[empleados] Error consultando ${path}:`, error);
    return null;
  }
}

/** Resuelve el nombre del cargo a partir de los enlaces de Personal.Rol. */
async function resolverCargo(rolLinks: unknown): Promise<string> {
  const links = Array.isArray(rolLinks) ? (rolLinks as string[]) : [];
  if (links.length === 0) return "";

  const rol = await airtable(`${encodeURIComponent(TABLES.ROLES)}/${links[0]}`);
  return (rol?.fields?.[FIELDS.ROLES.ROL] as string) ?? "";
}

/**
 * Cargo de un empleado por su record ID de Airtable (payload.sub).
 * Devuelve "" si no se puede resolver — nunca es bloqueante.
 */
export async function obtenerCargoPorRecordId(recordId: string): Promise<string> {
  const persona = await airtable(`${encodeURIComponent(TABLES.PERSONAL)}/${recordId}`);
  if (!persona?.fields) return "";
  return resolverCargo(persona.fields[FIELDS.PERSONAL.ROL]);
}

/** Nombre, cédula y cargo de un empleado por su record ID (payload.sub). */
export async function obtenerEmpleadoPorRecordId(
  recordId: string,
): Promise<DatosEmpleado | null> {
  const persona = await airtable(`${encodeURIComponent(TABLES.PERSONAL)}/${recordId}`);
  if (!persona?.fields) return null;

  return {
    nombre: (persona.fields[FIELDS.PERSONAL.NOMBRE] as string) ?? "",
    cedula: (persona.fields[FIELDS.PERSONAL.NUMERO_DOCUMENTO] as string) ?? "",
    idCore: (persona.fields[FIELDS.PERSONAL.ID_EMPLEADO] as string) ?? "",
    cargo: await resolverCargo(persona.fields[FIELDS.PERSONAL.ROL]),
  };
}

/**
 * Nombre, cédula y cargo de un empleado por su idCore ("SIRIUS-PER-XXXX").
 *
 * Necesario para las novedades de nómina: esa tabla solo guarda el idCore,
 * sin nombre ni cédula del reportante.
 */
export async function obtenerEmpleadoPorIdCore(
  idCore: string,
): Promise<DatosEmpleado | null> {
  const formula = `{${FIELDS.PERSONAL.ID_EMPLEADO}}='${escapeAirtableValue(idCore)}'`;
  const data = await airtable(
    `${encodeURIComponent(TABLES.PERSONAL)}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`,
  );

  const registro = data?.records?.[0];
  if (!registro) return null;

  return {
    nombre: (registro.fields[FIELDS.PERSONAL.NOMBRE] as string) ?? "",
    cedula: (registro.fields[FIELDS.PERSONAL.NUMERO_DOCUMENTO] as string) ?? "",
    idCore: (registro.fields[FIELDS.PERSONAL.ID_EMPLEADO] as string) ?? idCore,
    cargo: await resolverCargo(registro.fields[FIELDS.PERSONAL.ROL]),
  };
}
