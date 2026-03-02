"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmpleadoInfo {
  nombre: string;
  cedula: string;
  cargo: string;
  area: string;
}

type TipoSolicitud = "vacaciones" | "permiso" | "novedad_nomina";

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { key: TipoSolicitud; label: string; icon: string }[] = [
  { key: "vacaciones", label: "Vacaciones", icon: "🏖️" },
  { key: "permiso", label: "Permiso", icon: "📋" },
  { key: "novedad_nomina", label: "Novedad Nómina", icon: "💰" },
];

const TIPOS_PERMISO = [
  { value: "personal", label: "Personal" },
  { value: "medico", label: "Médico" },
  { value: "calamidad", label: "Calamidad" },
  { value: "otro", label: "Otro" },
];

const TIPOS_NOVEDAD = [
  "Permiso",
  "Cambio de Horario",
  "Fallo en la Máquina de Pirolisis",
  "Horas Extra",
  "Incapacidad Médica",
  "Accidente",
  "Licencia",
  "Vacaciones",
  "Facial Incompleto",
  "Teletrabajo",
  "Otra",
];

const today = () => new Date().toISOString().split("T")[0];

function calcDiasHabiles(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const start = new Date(inicio + "T12:00:00");
  const end = new Date(fin + "T12:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let dias = 0;
  const temp = new Date(start);
  while (temp <= end) {
    const d = temp.getDay();
    if (d !== 0 && d !== 6) dias++;
    temp.setDate(temp.getDate() + 1);
  }
  return dias;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-white/20 disabled:opacity-40";

const selectClass =
  "w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all [&>option]:bg-gray-900";

const labelClass = "block text-sm font-medium text-white/60 mb-2";

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════

export default function SolicitudesPage() {
  // ── Employee data ──────────────────────────────────────────────────────
  const [empleado, setEmpleado] = useState<EmpleadoInfo | null>(null);
  const [loadingEmpleado, setLoadingEmpleado] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<TipoSolicitud>("vacaciones");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  // Vacaciones
  const [vacFechaSolicitud, setVacFechaSolicitud] = useState(today());
  const [vacFechaInicio, setVacFechaInicio] = useState("");
  const [vacFechaFin, setVacFechaFin] = useState("");
  const [vacFechaReintegro, setVacFechaReintegro] = useState("");
  const [vacMotivo, setVacMotivo] = useState("");

  // Permiso
  const [perFechaSolicitud, setPerFechaSolicitud] = useState(today());
  const [perFechaPermiso, setPerFechaPermiso] = useState("");
  const [perHoras, setPerHoras] = useState("");
  const [perHorasCustom, setPerHorasCustom] = useState("");
  const [perTipo, setPerTipo] = useState("");
  const [perOtroTipo, setPerOtroTipo] = useState("");
  const [perMotivo, setPerMotivo] = useState("");

  // Novedad
  const [novTipo, setNovTipo] = useState("");
  const [novOtroTipo, setNovOtroTipo] = useState("");
  const [novArchivo, setNovArchivo] = useState<File | null>(null);

  // ── Signature canvas ───────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  // ── Voice recording ────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Business days calculation ──────────────────────────────────────────
  const vacDias = calcDiasHabiles(vacFechaInicio, vacFechaFin);

  // ══════════════════════════════════════════════════════════════════════
  // Effects
  // ══════════════════════════════════════════════════════════════════════

  // Fetch employee data from Airtable via our API
  useEffect(() => {
    fetch("/api/solicitudes")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setEmpleado(d);
      })
      .catch((err) => console.error("Error cargando datos:", err))
      .finally(() => setLoadingEmpleado(false));
  }, []);

  // Set up canvas for signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
  }, [tipo]);

  // ══════════════════════════════════════════════════════════════════════
  // Canvas drawing
  // ══════════════════════════════════════════════════════════════════════

  const getCanvasPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX =
        "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY =
        "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    []
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getCanvasPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [getCanvasPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getCanvasPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [getCanvasPos]
  );

  const endDraw = useCallback(() => {
    drawingRef.current = false;
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function getSignatureDataUrl(): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isEmpty = !data.data.some((v) => v !== 0);
    if (isEmpty) return null;
    return canvas.toDataURL("image/png");
  }

  // ══════════════════════════════════════════════════════════════════════
  // Voice recording
  // ══════════════════════════════════════════════════════════════════════

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert(
        "No se pudo acceder al micrófono. Verifica los permisos del navegador."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    setIsRecording(false);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Submit handlers
  // ══════════════════════════════════════════════════════════════════════

  async function handleSubmitVacaciones() {
    if (!empleado) return;
    if (!vacFechaInicio || !vacFechaFin || !vacFechaReintegro || !vacMotivo) {
      setResult({ ok: false, msg: "Completa todos los campos obligatorios." });
      return;
    }
    const firma = getSignatureDataUrl();
    if (!firma) {
      setResult({
        ok: false,
        msg: "Por favor firma el formulario antes de enviarlo.",
      });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoSolicitud: "vacaciones",
          nombre: empleado.nombre,
          cedula: empleado.cedula,
          cargo: empleado.cargo,
          area: empleado.area,
          fechaSolicitud: vacFechaSolicitud,
          fechavacaciones: vacFechaInicio,
          fechaFinal: vacFechaFin,
          fechaReintegro: vacFechaReintegro,
          diasvacaciones: vacDias.toString(),
          motivo: vacMotivo,
          firma,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          ok: true,
          msg: "¡Solicitud de vacaciones enviada correctamente! 🎉",
        });
        setVacFechaInicio("");
        setVacFechaFin("");
        setVacFechaReintegro("");
        setVacMotivo("");
        clearCanvas();
      } else {
        setResult({
          ok: false,
          msg: data.error || "Error al enviar la solicitud.",
        });
      }
    } catch {
      setResult({ ok: false, msg: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPermiso() {
    if (!empleado) return;
    if (!perFechaPermiso || !perHoras || !perTipo || !perMotivo) {
      setResult({ ok: false, msg: "Completa todos los campos obligatorios." });
      return;
    }
    if (perTipo === "otro" && !perOtroTipo.trim()) {
      setResult({ ok: false, msg: "Especifica el tipo de permiso." });
      return;
    }
    if (
      perHoras === "mas8" &&
      (!perHorasCustom || parseFloat(perHorasCustom) <= 8)
    ) {
      setResult({
        ok: false,
        msg: "Especifica una cantidad de horas mayor a 8.",
      });
      return;
    }
    const firma = getSignatureDataUrl();
    if (!firma) {
      setResult({
        ok: false,
        msg: "Por favor firma el formulario antes de enviarlo.",
      });
      return;
    }

    const horasFinales =
      perHoras === "mas8" ? `${perHorasCustom} horas` : perHoras;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoSolicitud: "permiso",
          nombre: empleado.nombre,
          cedula: empleado.cedula,
          cargo: empleado.cargo,
          area: empleado.area,
          fechaSolicitud: perFechaSolicitud,
          fechaPermiso: perFechaPermiso,
          tipo: perTipo === "otro" ? perOtroTipo : perTipo,
          motivo: perMotivo,
          firma,
          horas: horasFinales,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          ok: true,
          msg: "¡Solicitud de permiso enviada correctamente! 🎉",
        });
        setPerFechaPermiso("");
        setPerHoras("");
        setPerHorasCustom("");
        setPerTipo("");
        setPerOtroTipo("");
        setPerMotivo("");
        clearCanvas();
      } else {
        setResult({
          ok: false,
          msg: data.error || "Error al enviar la solicitud.",
        });
      }
    } catch {
      setResult({ ok: false, msg: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitNovedad() {
    if (!empleado) return;
    if (!novTipo) {
      setResult({ ok: false, msg: "Selecciona el tipo de novedad." });
      return;
    }
    if (novTipo === "Otra" && !novOtroTipo.trim()) {
      setResult({ ok: false, msg: "Especifica el tipo de novedad." });
      return;
    }
    if (!audioBlob) {
      setResult({
        ok: false,
        msg: "Graba una nota de voz con la descripción de la novedad.",
      });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("empleado", empleado.nombre);
      formData.append("cedula", empleado.cedula);
      formData.append("cargo", empleado.cargo);
      formData.append("area", empleado.area);
      formData.append("tipoNovedad", novTipo);
      formData.append("otroTipo", novTipo === "Otra" ? novOtroTipo : "");
      formData.append("notaVoz", audioBlob, "nota-voz.webm");
      if (novArchivo) {
        formData.append("documento", novArchivo);
      }

      const res = await fetch("/api/solicitudes", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          ok: true,
          msg: "¡Reporte de novedad enviado correctamente! 🎉",
        });
        setNovTipo("");
        setNovOtroTipo("");
        setNovArchivo(null);
        setAudioBlob(null);
        setAudioUrl(null);
      } else {
        setResult({
          ok: false,
          msg: data.error || "Error al enviar el reporte.",
        });
      }
    } catch {
      setResult({ ok: false, msg: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (tipo === "vacaciones") handleSubmitVacaciones();
    else if (tipo === "permiso") handleSubmitPermiso();
    else handleSubmitNovedad();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Employee info card */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          Tus datos (desde Nomina Core)
        </h3>
        {loadingEmpleado ? (
          <div className="flex items-center gap-3 text-white/30">
            <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
            Cargando datos del empleado...
          </div>
        ) : empleado ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">
                Nombre
              </p>
              <p className="text-sm text-white font-medium mt-0.5">
                {empleado.nombre || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">
                Cédula
              </p>
              <p className="text-sm text-white font-medium mt-0.5">
                {empleado.cedula || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">
                Cargo
              </p>
              <p className="text-sm text-white font-medium mt-0.5">
                {empleado.cargo || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">
                Área
              </p>
              <p className="text-sm text-white font-medium mt-0.5">
                {empleado.area || "—"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">
            No se pudieron cargar los datos. Intenta recargar la página.
          </p>
        )}
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setTipo(tab.key);
              setResult(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tipo === tab.key
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Result message */}
      {result && (
        <div
          className={`rounded-xl p-4 text-sm font-medium ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {result.msg}
        </div>
      )}

      {/* ═══ FORM ═══ */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-6">
        {/* ─── Vacaciones ─────────────────────────────────────────────── */}
        {tipo === "vacaciones" && (
          <>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              🏖️ Solicitud de Vacaciones
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Fecha de Solicitud *</label>
                <input
                  type="date"
                  value={vacFechaSolicitud}
                  onChange={(e) => setVacFechaSolicitud(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>
                  Fecha Inicio Vacaciones *
                </label>
                <input
                  type="date"
                  value={vacFechaInicio}
                  onChange={(e) => setVacFechaInicio(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Fecha Fin Vacaciones *</label>
                <input
                  type="date"
                  value={vacFechaFin}
                  onChange={(e) => setVacFechaFin(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Días hábiles</label>
                <input
                  type="text"
                  value={
                    vacDias > 0
                      ? `${vacDias} día${vacDias !== 1 ? "s" : ""} hábiles`
                      : "—"
                  }
                  disabled
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fecha de Reintegro *</label>
                <input
                  type="date"
                  value={vacFechaReintegro}
                  onChange={(e) => setVacFechaReintegro(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Motivo / Justificación *</label>
              <textarea
                value={vacMotivo}
                onChange={(e) => setVacMotivo(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de tu solicitud de vacaciones..."
                className={`${inputClass} resize-none`}
                required
              />
            </div>

            {/* Signature */}
            <div>
              <label className={labelClass}>Firma Digital *</label>
              <canvas
                ref={canvasRef}
                className="w-full h-[150px] rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <button
                type="button"
                onClick={clearCanvas}
                className="mt-2 px-4 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] rounded-lg transition-all"
              >
                Borrar Firma
              </button>
            </div>
          </>
        )}

        {/* ─── Permiso ────────────────────────────────────────────────── */}
        {tipo === "permiso" && (
          <>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              📋 Solicitud de Permiso
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Fecha de Solicitud *</label>
                <input
                  type="date"
                  value={perFechaSolicitud}
                  onChange={(e) => setPerFechaSolicitud(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Fecha del Permiso *</label>
                <input
                  type="date"
                  value={perFechaPermiso}
                  onChange={(e) => setPerFechaPermiso(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Horas Requeridas *</label>
                <select
                  value={perHoras}
                  onChange={(e) => setPerHoras(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-gray-900">
                    -- Seleccione --
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                    <option
                      key={h}
                      value={h.toString()}
                      className="bg-gray-900"
                    >
                      {h} hora{h > 1 ? "s" : ""}
                    </option>
                  ))}
                  <option value="mas8" className="bg-gray-900">
                    Más de 8 horas
                  </option>
                </select>
              </div>
              {perHoras === "mas8" && (
                <div>
                  <label className={labelClass}>
                    Cantidad de horas (mayor a 8) *
                  </label>
                  <input
                    type="number"
                    value={perHorasCustom}
                    onChange={(e) => setPerHorasCustom(e.target.value)}
                    min="8.1"
                    step="0.5"
                    placeholder="Ej: 9.5"
                    className={inputClass}
                    required
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Tipo de Permiso *</label>
                <select
                  value={perTipo}
                  onChange={(e) => setPerTipo(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-gray-900">
                    -- Seleccione --
                  </option>
                  {TIPOS_PERMISO.map((t) => (
                    <option
                      key={t.value}
                      value={t.value}
                      className="bg-gray-900"
                    >
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {perTipo === "otro" && (
                <div>
                  <label className={labelClass}>Especifique el tipo *</label>
                  <input
                    type="text"
                    value={perOtroTipo}
                    onChange={(e) => setPerOtroTipo(e.target.value)}
                    placeholder="Tipo de permiso..."
                    className={inputClass}
                    required
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Motivo / Justificación *</label>
              <textarea
                value={perMotivo}
                onChange={(e) => setPerMotivo(e.target.value)}
                rows={3}
                placeholder="Describe el motivo de tu solicitud de permiso..."
                className={`${inputClass} resize-none`}
                required
              />
            </div>

            {/* Signature */}
            <div>
              <label className={labelClass}>Firma Digital *</label>
              <canvas
                ref={canvasRef}
                className="w-full h-[150px] rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <button
                type="button"
                onClick={clearCanvas}
                className="mt-2 px-4 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] rounded-lg transition-all"
              >
                Borrar Firma
              </button>
            </div>
          </>
        )}

        {/* ─── Novedad Nómina ─────────────────────────────────────────── */}
        {tipo === "novedad_nomina" && (
          <>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              💰 Reporte de Novedad de Nómina
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className={labelClass}>Tipo de Novedad *</label>
                <select
                  value={novTipo}
                  onChange={(e) => setNovTipo(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="" className="bg-gray-900">
                    -- Seleccione --
                  </option>
                  {TIPOS_NOVEDAD.map((t) => (
                    <option key={t} value={t} className="bg-gray-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {novTipo === "Otra" && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Especifique el tipo de novedad *
                  </label>
                  <input
                    type="text"
                    value={novOtroTipo}
                    onChange={(e) => setNovOtroTipo(e.target.value)}
                    placeholder="Escriba el tipo de novedad..."
                    className={inputClass}
                    required
                  />
                </div>
              )}
            </div>

            {/* Voice recording */}
            <div>
              <label className={labelClass}>
                Descripción de la Novedad (nota de voz) *
              </label>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRecording}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isRecording
                      ? "bg-white/[0.02] text-white/20 cursor-not-allowed"
                      : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                  }`}
                >
                  🎙️ Grabar
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!isRecording}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    !isRecording
                      ? "bg-white/[0.02] text-white/20 cursor-not-allowed"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                  }`}
                >
                  ⏹️ Detener
                </button>
              </div>

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center justify-center gap-1.5 mt-4 py-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-5 bg-red-400 rounded-full animate-pulse"
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: "0.8s",
                      }}
                    />
                  ))}
                  <span className="ml-3 text-xs text-red-400 animate-pulse">
                    Grabando...
                  </span>
                </div>
              )}

              {/* Audio preview */}
              {audioUrl && !isRecording && (
                <div className="mt-4">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full rounded-lg" />
                  <button
                    type="button"
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl(null);
                    }}
                    className="mt-2 px-4 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.04] rounded-lg transition-all"
                  >
                    Eliminar grabación
                  </button>
                </div>
              )}
            </div>

            {/* File upload */}
            <div>
              <label className={labelClass}>
                Documentación Adicional (opcional)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setNovArchivo(e.target.files?.[0] || null)}
                className="w-full text-sm text-white/60 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-white/[0.06] file:text-white/70 hover:file:bg-white/[0.1] file:cursor-pointer file:transition-all"
              />
              {novArchivo && (
                <p className="text-xs text-white/30 mt-2">
                  📎 {novArchivo.name} (
                  {(novArchivo.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </>
        )}

        {/* Submit button */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={handleSubmit}
            disabled={submitting || !empleado}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
                Enviar Solicitud
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
