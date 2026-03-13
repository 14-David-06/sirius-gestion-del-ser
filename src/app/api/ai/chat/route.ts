/**
 * API — Agente IA con Claude (Anthropic)
 *
 * POST /api/ai/chat
 * Body: { messages: [{ role: "user" | "assistant", content: string }] }
 * Response: text/event-stream (Server-Sent Events con el delta del texto)
 *
 * Requiere autenticación JWT.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

const SYSTEM_PROMPT = `Eres Sirius AI, un asistente inteligente integrado en el sistema de gestión de talento humano de Sirius Gestión del Ser.

Tu rol es ayudar al equipo de recursos humanos con:
- Preguntas sobre procesos de nómina, contratos y vinculación de personal
- Orientación sobre gestión de asistencia y horarios laborales
- Explicación de novedades de nómina (vacaciones, permisos, incapacidades)
- Apoyo en compliance documental y cumplimiento de requisitos laborales
- Consejos sobre gestión del talento humano y bienestar organizacional
- Respuestas sobre normativa laboral colombiana (Código Sustantivo del Trabajo)

Responde siempre en español, de forma clara, profesional y concisa.
Si te preguntan algo fuera de tu alcance (datos específicos de un empleado, por ejemplo), explica amablemente que no tienes acceso a esa información en tiempo real y sugiere revisar el módulo correspondiente del sistema.
No inventes datos, políticas ni normativas. Si no estás seguro, indícalo claramente.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  // ── Autenticación ──────────────────────────────────────────────────────────
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

  // ── Parsear body ───────────────────────────────────────────────────────────
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

  // Sanitizar: solo roles permitidos, content no vacío
  const sanitized = messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-20); // máximo 20 turnos de historial

  if (sanitized.length === 0) {
    return new Response(JSON.stringify({ error: "Mensajes vacíos" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Streaming con SSE ──────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: sanitized,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ delta: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error del servidor";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
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
