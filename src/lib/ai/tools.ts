/**
 * Definiciones de herramientas (tools) para los agentes de IA.
 * Cada herramienta ejecuta una consulta real a Airtable.
 */

import type Anthropic from "@anthropic-ai/sdk";
import {
  getPersonal,
  getContratos,
  getListaChequeo,
  getConfiguracionHorarios,
  getAsignacionHorarios,
  getRegistroCumplimiento,
} from "@/lib/airtable";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AirtableRecord = { id: string; fields: Record<string, unknown> };

// ─── Herramientas del Agente HR ───────────────────────────────────────────────

export const HR_TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_empleados",
    description:
      "Consulta la lista de empleados (sirianos) con sus datos: nombre, cédula, cargo, área, estado y tipo de contrato. Usa esta herramienta cuando necesites información sobre el personal activo o buscar datos de alguien específico.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "string",
          description:
            "Texto para filtrar por nombre, cédula o cargo. Omitir para obtener todos los empleados.",
        },
      },
    },
  },
  {
    name: "consultar_contratos",
    description:
      "Consulta contratos de empleados: tipo (término fijo, indefinido, prestación de servicios), fechas de inicio y fin, salario base y estado del contrato.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "string",
          description:
            "Nombre del empleado o tipo de contrato para filtrar. Omitir para ver todos.",
        },
      },
    },
  },
  {
    name: "consultar_lista_chequeo",
    description:
      "Verifica el estado de documentos requeridos para cada empleado (cédula, hoja de vida, exámenes médicos, etc.). Útil para auditorías de compliance documental y procesos de vinculación.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "string",
          description: "Nombre del empleado para filtrar. Omitir para ver estado general.",
        },
      },
    },
  },
];

// ─── Herramientas del Agente de Asistencia ────────────────────────────────────

export const ATTENDANCE_TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_horarios",
    description:
      "Obtiene la configuración de turnos laborales y las asignaciones de horarios a empleados. Útil para preguntas sobre jornadas, turnos rotativos y horarios específicos.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "consultar_asistencia",
    description:
      "Consulta los registros de cumplimiento y asistencia de los empleados. Muestra quiénes cumplieron o no con su jornada en un periodo determinado.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "string",
          description:
            "Nombre del empleado para filtrar registros específicos. Omitir para ver todos.",
        },
      },
    },
  },
];

// ─── Todas las herramientas (para el orquestador con acceso directo) ──────────

export const ALL_AIRTABLE_TOOLS: Anthropic.Tool[] = [
  ...HR_TOOLS,
  ...ATTENDANCE_TOOLS,
];

// ─── Helpers internos ─────────────────────────────────────────────────────────

function truncateFields(
  fields: Record<string, unknown>,
  limit = 8
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(fields)
      .slice(0, limit)
      .map((k) => {
        const v = fields[k];
        if (Array.isArray(v)) return [k, v.slice(0, 3)];
        if (typeof v === "string" && v.length > 200)
          return [k, v.slice(0, 200) + "…"];
        return [k, v];
      })
  );
}

function applyFilter(
  records: AirtableRecord[],
  filtro: string | undefined,
  max = 25
): AirtableRecord[] {
  if (!filtro) return records.slice(0, max);
  const q = filtro.toLowerCase();
  return records
    .filter((r) =>
      Object.values(r.fields).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(q)
      )
    )
    .slice(0, max);
}

// ─── Ejecutor de herramientas ─────────────────────────────────────────────────

export async function executeAirtableTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const filtro = typeof input.filtro === "string" ? input.filtro : undefined;

  try {
    switch (name) {
      case "consultar_empleados": {
        const records = await getPersonal();
        const filtered = applyFilter(records, filtro);
        return JSON.stringify({
          total: filtered.length,
          empleados: filtered.map((r) => truncateFields(r.fields)),
        });
      }

      case "consultar_contratos": {
        const records = await getContratos();
        const filtered = applyFilter(records, filtro);
        return JSON.stringify({
          total: filtered.length,
          contratos: filtered.map((r) => truncateFields(r.fields)),
        });
      }

      case "consultar_lista_chequeo": {
        const records = await getListaChequeo();
        const filtered = applyFilter(records, filtro);
        return JSON.stringify({
          total: filtered.length,
          chequeos: filtered.map((r) => truncateFields(r.fields, 12)),
        });
      }

      case "consultar_horarios": {
        const [config, asig] = await Promise.all([
          getConfiguracionHorarios(),
          getAsignacionHorarios(),
        ]);
        return JSON.stringify({
          configuraciones: config.slice(0, 10).map((r) => truncateFields(r.fields)),
          asignaciones: asig.slice(0, 20).map((r) => truncateFields(r.fields)),
        });
      }

      case "consultar_asistencia": {
        const records = await getRegistroCumplimiento();
        const filtered = applyFilter(records, filtro);
        return JSON.stringify({
          total: filtered.length,
          registros: filtered.map((r) => truncateFields(r.fields)),
        });
      }

      default:
        return JSON.stringify({ error: `Herramienta "${name}" no reconocida` });
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : "Error al consultar datos",
    });
  }
}
