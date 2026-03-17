/**
 * API — Transcripción de audio con Claude
 *
 * POST /api/ai/transcribe
 * Body: FormData { audio: File (audio/webm) }
 * Response: { transcription: string }
 *
 * Usa Claude para transcribir y resumir el audio como una novedad de nómina.
 * Requiere autenticación JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    verifyJWT(token, env.auth.jwtSecret);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // ── Receive audio ────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const audioFile = formData.get("audio") as File | null;
  if (!audioFile || audioFile.size === 0) {
    return NextResponse.json({ error: "No se recibió audio" }, { status: 400 });
  }

  // ── Convert to base64 ────────────────────────────────────────────────────
  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const base64Audio = buffer.toString("base64");

  // Determine media type — default to audio/webm from MediaRecorder
  const mediaType = (audioFile.type || "audio/webm") as
    | "audio/webm"
    | "audio/mp4"
    | "audio/ogg"
    | "audio/mpeg"
    | "audio/wav";

  // ── Transcribe with Claude ───────────────────────────────────────────────
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [
            {
              type: "audio",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Audio,
              },
            },
            {
              type: "text",
              text: "Transcribe el audio anterior al español con precisión. Presenta únicamente el texto transcrito, sin encabezados, etiquetas ni comentarios adicionales.",
            },
          ] as any,
        },
      ],
    });

    const transcription =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    return NextResponse.json({ transcription });
  } catch (err) {
    console.error("[transcribe] Error Anthropic:", err);
    return NextResponse.json(
      { error: "Error al transcribir el audio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
