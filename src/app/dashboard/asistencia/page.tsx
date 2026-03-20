"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Web Speech API — types para navegadores compatibles (Chrome, Edge)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface RegistroAsistencia {
  id: string;
  tipo: "Entrada" | "Salida";
  hora: string;
  fecha: string;
  fechaHora: string;
  ubicacion: string;
  notas: string;
}

interface EmpleadoInfo {
  recordId: string;
  nombre: string;
  cedula: string;
}

interface HorarioActivo {
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  dias_laborales: string[];
  total_horas_dia: number;
}

interface TurnoVigente {
  tiene_turno: boolean;
  empleado_id: string;
  fecha: string;
  dia_laboral: boolean;
  horario: HorarioActivo | null;
}

export default function AsistenciaPage() {
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");
  const [empleado, setEmpleado] = useState<EmpleadoInfo | null>(null);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [registrosHoy, setRegistrosHoy] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(false);
  const [marcaExitosa, setMarcaExitosa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiereMotivo, setRequiereMotivo] = useState(false);
  const [motivoTexto, setMotivoTexto] = useState("");
  const [contextoFueraHorario, setContextoFueraHorario] = useState<string | null>(null);
  const [turnoVigente, setTurnoVigente] = useState<TurnoVigente | null>(null);

  // ── Reconocimiento de voz para justificación ──────────────────────────
  const [grabando, setGrabando] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Real-time clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setHora(
        now.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setFecha(
        now.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch attendance data + turno vigente en paralelo
  const fetchData = useCallback(async () => {
    try {
      const fechaHoy = new Date().toISOString().split("T")[0];
      const [resAsistencia, resTurno] = await Promise.all([
        fetch("/api/asistencia"),
        fetch(`/api/schedules/active-shift?fecha=${fechaHoy}`).catch(() => null),
      ]);

      if (!resAsistencia.ok)
        throw new Error("Error al cargar datos de asistencia");
      const data = await resAsistencia.json();
      setEmpleado(data.empleado);
      setRegistros(data.registros);
      setRegistrosHoy(data.registrosHoy);

      // Turno vigente: silenciosamente ignorar errores para no bloquear marcación
      if (resTurno && resTurno.ok) {
        const dataTurno: TurnoVigente = await resTurno.json();
        setTurnoVigente(dataTurno);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine next action based on today's records
  const ultimoRegistroHoy = registrosHoy.length > 0 ? registrosHoy[0] : null;
  const siguienteTipo: "Entrada" | "Salida" =
    !ultimoRegistroHoy || ultimoRegistroHoy.tipo === "Salida" ? "Entrada" : "Salida";

  // ── Funciones de reconocimiento de voz (Web Speech API) ────────────────
  function iniciarGrabacion() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = motivoTexto;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      setMotivoTexto(finalTranscript + (interim ? " " + interim : ""));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        setError("Error de reconocimiento de voz: " + event.error);
      }
      setGrabando(false);
    };

    recognition.onend = () => {
      setGrabando(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setGrabando(true);
  }

  function detenerGrabacion() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setGrabando(false);
    }
  }

  async function marcarAsistencia(motivo?: string) {
    setMarcando(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        tipo: siguienteTipo,
        ubicacion: "Plataforma Web",
      };
      if (motivo) {
        body.motivo = motivo;
      }

      const res = await fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      // El servidor indica que se requiere motivo por marcación fuera de horario
      if (res.status === 428 || data.requiereMotivo === true) {
        setRequiereMotivo(true);
        setContextoFueraHorario(data.contexto ?? null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Error al registrar asistencia");
      }

      // Éxito — limpiar estado de motivo si venía de flujo fuera de horario
      setRequiereMotivo(false);
      setMotivoTexto("");
      setContextoFueraHorario(null);

      setMarcaExitosa(
        siguienteTipo === "Entrada"
          ? `¡Entrada registrada a las ${data.registro.hora}!`
          : `¡Salida registrada a las ${data.registro.hora}!`
      );

      // Refresh data from server
      await fetchData();

      setTimeout(() => setMarcaExitosa(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setMarcando(false);
    }
  }

  // Stats
  const totalHoy = registrosHoy.length;
  const entradasHoy = registrosHoy.filter((r) => r.tipo === "Entrada").length;
  const salidasHoy = registrosHoy.filter((r) => r.tipo === "Salida").length;

  // Group history by date
  const registrosPorFecha = registros.reduce<Record<string, RegistroAsistencia[]>>(
    (acc, r) => {
      const key = r.fecha || "Sin fecha";
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    },
    {}
  );
  const fechasOrdenadas = Object.keys(registrosPorFecha).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">
            Cargando registro de asistencia...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Employee info bar */}
      {empleado && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/20 border border-white/[0.08]">
          <div className="w-10 h-10 rounded-full bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-sm font-bold text-white/70">
            {empleado.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{empleado.nombre}</p>
            <p className="text-xs text-white/40">CC {empleado.cedula}</p>
          </div>
        </div>
      )}

      {/* Clock + Mark button */}
      <div className="rounded-2xl bg-black/30 border border-white/[0.08] p-8 text-center backdrop-blur-sm shadow-xl shadow-black/20 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-white/[0.03] rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-6xl sm:text-7xl font-extrabold text-white font-mono tracking-wider drop-shadow-lg">
            {hora}
          </p>
          <p className="text-sm text-white/40 mt-3 capitalize">{fecha}</p>

          {/* Tarjeta de turno vigente */}
          {turnoVigente && (
            <div className="mt-6 inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] backdrop-blur-sm">
              {!turnoVigente.tiene_turno ? (
                <p className="text-xs text-white/40 font-medium">
                  Sin horario asignado — contacta a RRHH
                </p>
              ) : !turnoVigente.dia_laboral ? (
                <p className="text-xs text-white/40 font-medium">
                  Hoy no es día laboral según tu horario
                </p>
              ) : turnoVigente.horario ? (
                <>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs font-semibold text-white/70">
                      {turnoVigente.horario.nombre}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 font-mono">
                    {turnoVigente.horario.hora_inicio} –{" "}
                    {turnoVigente.horario.hora_fin}
                  </p>
                </>
              ) : null}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => marcarAsistencia()}
              disabled={marcando}
              className={`relative px-12 py-5 rounded-2xl text-lg font-bold transition-all duration-300 disabled:opacity-60 cursor-pointer ${
                siguienteTipo === "Entrada"
                  ? "bg-white/[0.12] hover:bg-white/[0.18] text-white shadow-lg shadow-black/15"
                  : "bg-white/[0.08] hover:bg-white/[0.12] text-white shadow-lg shadow-black/15"
              }`}
            >
              {marcando ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Registrando...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {siguienteTipo === "Entrada" ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                  )}
                  Marcar {siguienteTipo === "Entrada" ? "Entrada" : "Salida"}
                </div>
              )}
            </button>
          </div>

          {/* Success message */}
          {marcaExitosa && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/70 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {marcaExitosa}
            </div>
          )}
        </div>
      </div>

      {/* Modal justificación fuera de horario */}
      {requiereMotivo && (
        <div className="rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white">Marcación fuera de horario</h3>
              <p className="text-sm text-white/60 mt-1">
                Tu marcación está fuera del horario establecido. Por favor justifica el motivo.
              </p>
            </div>
          </div>

          {contextoFueraHorario && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15]">
              <svg className="w-4 h-4 text-amber-400/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span className="text-xs text-amber-300/80 font-medium">{contextoFueraHorario}</span>
            </div>
          )}

          <div className="space-y-3">
            {/* Botón de grabación de voz */}
            <div className="flex items-center gap-3">
              <button
                onClick={grabando ? detenerGrabacion : iniciarGrabacion}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  grabando
                    ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                    : "bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.10] hover:text-white"
                }`}
              >
                {grabando ? (
                  <>
                    <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                    Detener grabación
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    Grabar justificación
                  </>
                )}
              </button>
              {grabando && (
                <span className="text-xs text-red-400/70 font-medium animate-pulse">
                  Grabando…
                </span>
              )}
            </div>

            {/* Transcripción resultante (editable) */}
            <div className="relative">
              <textarea
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                rows={3}
                placeholder={grabando ? "Escuchando…" : "Graba una nota de voz o escribe aquí…"}
                className={`w-full px-4 py-3 bg-white/[0.06] border rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all placeholder:text-white/20 resize-none backdrop-blur-sm ${
                  grabando ? "border-red-500/30" : "border-white/[0.12]"
                }`}
              />
              {motivoTexto && (
                <span className="absolute top-2 right-3 text-[10px] text-white/30 font-medium">
                  Puedes editar el texto
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => marcarAsistencia(motivoTexto)}
              disabled={marcando || grabando || motivoTexto.trim().length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
            >
              {marcando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Confirmar con justificación
                </>
              )}
            </button>
            <button
              onClick={() => {
                detenerGrabacion();
                setRequiereMotivo(false);
                setMotivoTexto("");
                setContextoFueraHorario(null);
              }}
              disabled={marcando}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.10] text-white/60 hover:text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] ring-1 ring-white/[0.04] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Marcas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{totalHoy}</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Entradas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{entradasHoy}</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Salidas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{salidasHoy}</p>
        </div>
      </div>

      {/* Today's timeline */}
      {registrosHoy.length > 0 && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center">
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Registros de Hoy</h3>
              <p className="text-xs text-white/40">{registrosHoy.length} marca{registrosHoy.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {registrosHoy.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      r.tipo === "Entrada"
                        ? "bg-white/[0.08] ring-1 ring-white/[0.12]"
                        : "bg-white/[0.04] ring-1 ring-white/[0.08]"
                    }`}
                  >
                    {r.tipo === "Entrada" ? (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.tipo}</p>
                    <p className="text-xs text-white/30">{r.ubicacion || "Plataforma Web"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-mono font-bold text-white">{r.hora}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full history grouped by date */}
      <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Historial Completo</h3>
            <p className="text-xs text-white/40">{registros.length} registro{registros.length !== 1 ? "s" : ""} recientes</p>
          </div>
        </div>

        {fechasOrdenadas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/40">No hay registros de asistencia aún</p>
            <p className="text-xs text-white/25 mt-1">Marca tu primera entrada para comenzar</p>
          </div>
        ) : (
          <div>
            {fechasOrdenadas.map((fechaKey) => {
              const regs = registrosPorFecha[fechaKey];
              const fechaDisplay = new Date(fechaKey + "T12:00:00").toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const entradasDia = regs.filter((r) => r.tipo === "Entrada").length;
              const salidasDia = regs.filter((r) => r.tipo === "Salida").length;

              return (
                <div key={fechaKey}>
                  {/* Date header */}
                  <div className="px-6 py-3 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/50 capitalize">{fechaDisplay}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-emerald-400/70 font-medium">{entradasDia} entrada{entradasDia !== 1 ? "s" : ""}</span>
                      <span className="text-[10px] text-red-400/70 font-medium">{salidasDia} salida{salidasDia !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {/* Records for this date */}
                  <div className="divide-y divide-white/[0.03]">
                    {regs.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              r.tipo === "Entrada"
                                ? "bg-white/[0.06] ring-1 ring-white/[0.1]"
                                : "bg-white/[0.03] ring-1 ring-white/[0.06]"
                            }`}
                          >
                            {r.tipo === "Entrada" ? (
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${r.tipo === "Entrada" ? "text-emerald-400" : "text-red-400"}`}>
                              {r.tipo}
                            </span>
                            {r.ubicacion && (
                              <p className="text-[11px] text-white/25">{r.ubicacion}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-mono font-semibold text-white/70">{r.hora}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
