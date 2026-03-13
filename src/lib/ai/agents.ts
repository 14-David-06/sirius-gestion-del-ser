/**
 * Agentes especializados del sistema multi-agente de Sirius AI.
 *
 * Cada agente corre su propio loop autónomo (hasta MAX_ITERATIONS pasos),
 * consulta herramientas de Airtable según lo necesite y devuelve
 * un resumen estructurado al orquestador.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  HR_TOOLS,
  ATTENDANCE_TOOLS,
  executeAirtableTool,
} from "./tools";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

const MAX_ITERATIONS = 5;

// ─── Runner genérico ──────────────────────────────────────────────────────────

async function runAgentLoop(params: {
  systemPrompt: string;
  task: string;
  tools: Anthropic.Tool[];
  onToolCall?: (toolName: string) => void;
}): Promise<string> {
  const { systemPrompt, task, tools, onToolCall } = params;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    // Agregar respuesta al historial
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock && "text" in textBlock ? textBlock.text : "(sin respuesta)";
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        onToolCall?.(block.name);

        const result = await executeAirtableTool(
          block.name,
          block.input as Record<string, unknown>
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: "user", content: toolResults });
    } else {
      // stop_reason inesperado — salir sin loop infinito
      break;
    }
  }

  return "No pude completar la tarea en el número máximo de pasos permitidos.";
}

// ─── Agente HR ────────────────────────────────────────────────────────────────

const HR_SYSTEM = `Eres el Agente de Recursos Humanos de Sirius Gestión del Ser.
Tu especialidad es consultar y analizar datos de empleados, contratos y cumplimiento documental.

Cuando recibas una tarea:
1. Usa las herramientas disponibles para obtener los datos necesarios.
2. Analiza los datos obtenidos con precisión.
3. Devuelve un resumen estructurado con los hallazgos más relevantes.

Responde siempre en español, de forma clara y concisa. No inventes datos.`;

export async function runHRAgent(
  task: string,
  onToolCall?: (toolName: string) => void
): Promise<string> {
  return runAgentLoop({
    systemPrompt: HR_SYSTEM,
    task,
    tools: HR_TOOLS,
    onToolCall,
  });
}

// ─── Agente de Asistencia ─────────────────────────────────────────────────────

const ATTENDANCE_SYSTEM = `Eres el Agente de Asistencia y Horarios de Sirius Gestión del Ser.
Tu especialidad es consultar y analizar registros de asistencia, horarios laborales y cumplimiento de jornadas.

Cuando recibas una tarea:
1. Usa las herramientas disponibles para obtener los datos de asistencia y horarios.
2. Identifica patrones relevantes (ausencias, incumplimientos, etc.).
3. Devuelve un resumen estructurado con los hallazgos más relevantes.

Responde siempre en español, de forma clara y concisa. No inventes datos.`;

export async function runAttendanceAgent(
  task: string,
  onToolCall?: (toolName: string) => void
): Promise<string> {
  return runAgentLoop({
    systemPrompt: ATTENDANCE_SYSTEM,
    task,
    tools: ATTENDANCE_TOOLS,
    onToolCall,
  });
}
