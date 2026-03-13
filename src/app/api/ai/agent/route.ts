/**
 * API — Sistema Multi-Agente Sirius AI (Orchestrator)
 *
 * POST /api/ai/agent
 * Body: { messages: [{ role: "user" | "assistant", content: string }] }
 * Response: text/event-stream (Server-Sent Events)
 *
 * Eventos SSE:
 *   { "type": "agent_status", "agent": "...", "message": "..." }
 *   { "type": "tool_call",    "tool": "...",  "agent": "..." }
 *   { "type": "tool_result",  "tool": "...",  "preview": "..." }
 *   { "type": "delta",        "text": "..." }
 *   { "type": "done" }
 *   { "type": "error",        "text": "..." }
 *
 * Requiere autenticación JWT.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { runHRAgent, runAttendanceAgent } from "@/lib/ai/agents";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

// ─── Herramientas del Orquestador ─────────────────────────────────────────────

const ORCHESTRATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: "llamar_agente_hr",
    description:
      "Delega una tarea al Agente de Recursos Humanos. Úsalo para consultas sobre empleados, contratos, documentación de vinculación y cumplimiento documental. El agente consultará Airtable de forma autónoma y devolverá los datos relevantes.",
    input_schema: {
      type: "object",
      properties: {
        tarea: {
          type: "string",
          description:
            "Instrucción detallada de lo que debe investigar el Agente HR. Sé específico: qué datos necesitas y para qué.",
        },
      },
      required: ["tarea"],
    },
  },
  {
    name: "llamar_agente_asistencia",
    description:
      "Delega una tarea al Agente de Asistencia. Úsalo para consultas sobre registros de asistencia, horarios laborales, turnos y cumplimiento de jornadas. El agente consultará Airtable de forma autónoma y devolverá los datos relevantes.",
    input_schema: {
      type: "object",
      properties: {
        tarea: {
          type: "string",
          description:
            "Instrucción detallada de lo que debe investigar el Agente de Asistencia. Sé específico: qué datos necesitas y para qué.",
        },
      },
      required: ["tarea"],
    },
  },
];

const ORCHESTRATOR_SYSTEM = `Eres Sirius AI, el orquestador principal del sistema de gestión de talento humano de Sirius Gestión del Ser.

Tienes acceso a agentes especializados que trabajan de forma autónoma:
- **llamar_agente_hr**: Especialista en empleados, contratos y documentación de vinculación.
- **llamar_agente_asistencia**: Especialista en asistencia, horarios y cumplimiento de jornadas.

Tu flujo de trabajo:
1. Analiza la consulta del usuario para entender qué información se necesita.
2. Delega las tareas de recopilación de datos a los agentes especializados según corresponda.
3. Puedes llamar múltiples agentes si la consulta lo requiere.
4. Sintetiza los resultados obtenidos en una respuesta clara, estructurada y útil.

Si la consulta no requiere datos en tiempo real (preguntas sobre normativa, procesos generales, conceptos HR), respóndela directamente con tu conocimiento sin llamar agentes.

Siempre responde en español. Sé preciso, profesional y conciso. No inventes datos.`;

// ─── Tipos de eventos SSE ─────────────────────────────────────────────────────

type AgentEvent =
  | { type: "agent_status"; agent: string; message: string }
  | { type: "tool_call"; tool: string; agent: string }
  | { type: "tool_result"; tool: string; preview: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; text: string };

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_ITERATIONS = 8;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Autenticación
  const token = req.cookies.get("sirius-auth")?.value;

  if (!token) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = verifyJWT(token, env.auth.jwtSecret);
  if (!user) {
    return new Response(JSON.stringify({ error: "Token inválido o expirado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parsear body
  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sanitized = messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20);

  if (sanitized.length === 0) {
    return new Response(JSON.stringify({ error: "Mensajes vacíos" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── SSE Stream ──────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  function encode(event: AgentEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encode(event));

      try {
        send({
          type: "agent_status",
          agent: "Sirius AI",
          message: "Analizando tu consulta…",
        });

        // El historial que el orquestador mantiene durante el loop
        const agentMessages: Anthropic.MessageParam[] = sanitized.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2048,
            system: ORCHESTRATOR_SYSTEM,
            tools: ORCHESTRATOR_TOOLS,
            messages: agentMessages,
          });

          agentMessages.push({
            role: "assistant",
            content: response.content,
          });

          // ── Respuesta final de texto ──────────────────────────────────────
          if (response.stop_reason === "end_turn") {
            const textBlock = response.content.find((b) => b.type === "text");
            if (textBlock && "text" in textBlock) {
              // Stream carácter a carácter para efecto fluido
              const text: string = textBlock.text;
              const chunkSize = 4;
              for (let i = 0; i < text.length; i += chunkSize) {
                send({ type: "delta", text: text.slice(i, i + chunkSize) });
              }
            }
            break;
          }

          // ── Llamadas a herramientas (sub-agentes) ─────────────────────────
          if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
              if (block.type !== "tool_use") continue;

              const toolName = block.name;
              const toolInput = block.input as { tarea?: string };
              const tarea = toolInput.tarea ?? "Consulta general";

              const agentLabel =
                toolName === "llamar_agente_hr"
                  ? "Agente HR"
                  : "Agente de Asistencia";

              send({ type: "tool_call", tool: toolName, agent: agentLabel });

              let agentResult: string;
              try {
                if (toolName === "llamar_agente_hr") {
                  send({
                    type: "agent_status",
                    agent: "Agente HR",
                    message: "Consultando empleados y contratos en Airtable…",
                  });
                  agentResult = await runHRAgent(tarea, (toolUsed) => {
                    send({ type: "tool_call", tool: toolUsed, agent: "Agente HR" });
                  });
                } else if (toolName === "llamar_agente_asistencia") {
                  send({
                    type: "agent_status",
                    agent: "Agente de Asistencia",
                    message: "Consultando asistencia y horarios en Airtable…",
                  });
                  agentResult = await runAttendanceAgent(tarea, (toolUsed) => {
                    send({
                      type: "tool_call",
                      tool: toolUsed,
                      agent: "Agente de Asistencia",
                    });
                  });
                } else {
                  agentResult = JSON.stringify({ error: "Agente no reconocido" });
                }
              } catch (err) {
                agentResult = JSON.stringify({
                  error: err instanceof Error ? err.message : "Error en sub-agente",
                });
              }

              // Preview del resultado para el cliente
              const preview =
                agentResult.length > 150
                  ? agentResult.slice(0, 150) + "…"
                  : agentResult;

              send({ type: "tool_result", tool: toolName, preview });

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: agentResult,
              });
            }

            agentMessages.push({ role: "user", content: toolResults });

            send({
              type: "agent_status",
              agent: "Sirius AI",
              message: "Sintetizando resultados…",
            });
          } else {
            // stop_reason inesperado — terminar loop
            break;
          }
        }

        send({ type: "done" });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Error interno del servidor";
        send({ type: "error", text: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
