import { env } from "./env";

const { apiKey, baseGestionDelSer, baseNominaCore, revalidateSeconds } =
  env.airtable;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function fetchAllRecords(
  baseId: string,
  tableName: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) {
      throw new Error(`Airtable error: ${res.status} ${res.statusText}`);
    }

    const data: AirtableResponse = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// ── Sirius Gestión del Ser ──
export async function getListaChequeo() {
  return fetchAllRecords(baseGestionDelSer, "Lista de Chequeo - Sirianos");
}

export async function getTipoDocumento() {
  return fetchAllRecords(baseGestionDelSer, "Tipo_Documento");
}

export async function getContratos() {
  return fetchAllRecords(baseGestionDelSer, "Contratos");
}

export async function getRegistroCumplimiento() {
  return fetchAllRecords(baseGestionDelSer, "Registro_Cumplimiento");
}

export async function getConfiguracionHorarios() {
  return fetchAllRecords(baseGestionDelSer, "Configuracion_Horarios");
}

export async function getAsignacionHorarios() {
  return fetchAllRecords(baseGestionDelSer, "Asignacion_Horarios");
}

// ── Sirius Nomina Core (datos relacionados) ──
export async function getPersonal() {
  return fetchAllRecords(baseNominaCore, "Personal");
}

export async function getRoles() {
  return fetchAllRecords(baseNominaCore, "Roles y Permisos");
}

export async function getAreas() {
  return fetchAllRecords(baseNominaCore, "Areas");
}

// ── Helper: crear mapa de empleados por ID ──
export function buildEmpleadoMap(
  personalRecords: AirtableRecord[]
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const rec of personalRecords) {
    const id = rec.fields["ID Empleado"] as string;
    if (id) map.set(id, rec.fields);
  }
  return map;
}
