"use client";

import { useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ActivityStep {
  type: "agent_status" | "tool_call" | "tool_result";
  agent?: string;
  tool?: string;
  label: string;
  detail?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  activity?: ActivityStep[];
}

// ─── Sugerencias orientadas a datos en tiempo real ────────────────────────────

const SUGERENCIAS = [
  "¿Cuántos empleados activos tenemos en total?",
  "¿Qué empleados tienen contrato a término fijo?",
  "¿Cuál es el estado de documentación de los sirianos?",
  "Muéstrame un resumen de los horarios asignados",
  "¿Cómo proceso una novedad de nómina por incapacidad?",
];

export default function AsistentePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  async function send(text: string) {
    const userMsg = text.trim();
    if (!userMsg || streaming) return;

    const userHistory = messages.filter((m) => m.role === "user" || m.role === "assistant");
    const next: Message[] = [...userHistory, { role: "user", content: userMsg }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    // Placeholder para la respuesta del agente
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", activity: [] },
    ]);

    try {
      const apiMessages = next.map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok || !res.body) throw new Error(`Error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (!block.startsWith("data: ")) continue;
          const raw = block.slice(6).trim();

          try {
            const event = JSON.parse(raw) as {
              type: string;
              agent?: string;
              tool?: string;
              message?: string;
              preview?: string;
              text?: string;
            };

            if (event.type === "done") break;

            if (event.type === "error") {
              throw new Error(event.text ?? "Error del agente");
            }

            if (event.type === "delta" && event.text) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + event.text,
                  };
                }
                return copy;
              });
            }

            if (
              event.type === "agent_status" ||
              event.type === "tool_call" ||
              event.type === "tool_result"
            ) {
              const step: ActivityStep = {
                type: event.type as ActivityStep["type"],
                agent: event.agent,
                tool: event.tool,
                label:
                  event.type === "agent_status"
                    ? `${event.agent}: ${event.message}`
                    : event.type === "tool_call"
                    ? `${event.agent} → ${event.tool}`
                    : `Resultado: ${event.tool}`,
                detail: event.preview,
              };
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last.role === "assistant") {
                  copy[copy.length - 1] = {
                    ...last,
                    activity: [...(last.activity ?? []), step],
                  };
                }
                return copy;
              });
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al conectar con el agente";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `⚠️ ${msg}`,
          activity: copy[copy.length - 1].activity,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1 scrollbar-thin">
        {isEmpty ? (
          /* Estado vacío — bienvenida */
          <div className="flex flex-col items-center justify-center h-full gap-8 py-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 border border-white/[0.12] flex items-center justify-center mx-auto shadow-xl shadow-black/20">
                <svg className="w-8 h-8 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Sirius AI</h2>
              <p className="text-sm text-white/40 max-w-sm">
                Tu asistente de talento humano. Pregúntame sobre nómina, contratos, normativa laboral colombiana y más.
              </p>
            </div>

            {/* Sugerencias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-sky-500/30 border border-white/[0.1] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-white/[0.12] border border-white/[0.15] text-white rounded-tr-sm px-4 py-3"
                    : "bg-black/30 border border-white/[0.08] text-white/90 rounded-tl-sm backdrop-blur-sm overflow-hidden"
                }`}
              >
                {/* Activity log — solo en mensajes del asistente */}
                {msg.role === "assistant" && msg.activity && msg.activity.length > 0 && (
                  <div className="border-b border-white/[0.06] px-4 py-2.5 space-y-1.5">
                    {msg.activity.map((step, si) => (
                      <div key={si} className="flex items-start gap-2">
                        {/* Icono por tipo */}
                        {step.type === "agent_status" && (
                          <span className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-violet-400/70">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" />
                            </svg>
                          </span>
                        )}
                        {step.type === "tool_call" && (
                          <span className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-sky-400/70">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                          </span>
                        )}
                        {step.type === "tool_result" && (
                          <span className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-emerald-400/70">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                        <span className="text-[10px] text-white/35 leading-tight">{step.label}</span>
                      </div>
                    ))}
                    {/* Spinner si aún está en proceso */}
                    {streaming && i === messages.length - 1 && msg.content === "" && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <svg className="w-3.5 h-3.5 text-white/30 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-[10px] text-white/30">Trabajando…</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contenido del mensaje */}
                <div className="px-4 py-3">
                  {msg.content === "" && streaming && i === messages.length - 1 ? (
                    msg.activity && msg.activity.length > 0 ? null : (
                      <span className="inline-flex gap-1 items-center text-white/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                      </span>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-white/[0.08]">
        {!isEmpty && (
          <button
            onClick={() => setMessages([])}
            className="mb-3 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            + Nueva conversación
          </button>
        )}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
              className="w-full resize-none bg-black/30 backdrop-blur-sm border border-white/[0.12] rounded-2xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.1] transition-all disabled:opacity-50 pr-12"
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="w-11 h-11 rounded-xl bg-white/[0.12] border border-white/[0.15] hover:bg-white/[0.2] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0"
          >
            {streaming ? (
              <svg className="w-4 h-4 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/20 text-center">
          Sirius AI puede cometer errores. Verifica información crítica.
        </p>
      </div>
    </div>
  );
}
