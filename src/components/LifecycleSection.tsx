"use client";

import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface OnboardOptions {
  tiposContrato: string[];
  periodicidadesPago: string[];
  tiposTurno: { id: string; nombre: string; descripcion: string }[];
  areas: string[];
}

interface LifecycleEvent {
  id: string;
  empleadoId: string;
  empleadoNombre?: string;
  tipoEvento: "vinculacion" | "desvinculacion";
  subtipo: string;
  fechaEfectiva: string;
  documentoUrl?: string;
  registradoPor: string;
  notas?: string;
  datosCascada?: {
    empleadoCreado?: string;
    contratoId?: string;
    turnoId?: string;
  };
  creadoEn: string;
}

interface PendingOffboard {
  empleadoId: string;
  nombre: string;
  cedula: string;
  area?: string;
  contratoId: string;
  fechaFinContrato: string;
  diasVencido: number;
}

type LifecycleTab = "vincular" | "desvincular" | "historial";
type OnboardStep = 1 | 2;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LifecycleSection() {
  /* ─────────────────────────────────────────────────────────────────────────
     STATE
     ───────────────────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState<LifecycleTab>("vincular");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Options
  const [options, setOptions] = useState<OnboardOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // Onboard stepper
  const [onboardStep, setOnboardStep] = useState<OnboardStep>(1);
  const [onboardForm, setOnboardForm] = useState({
    // Paso 1: Datos personales
    nombre: "",
    cedula: "",
    correo: "",
    telefono: "",
    direccion: "",
    fechaNacimiento: "",
    // Paso 2: Datos laborales
    cargo: "",
    area: "",
    tipoContrato: "",
    fechaInicio: "",
    fechaFin: "",
    salario: "",
    periodicidadPago: "",
    turnoId: "",
    notas: "",
  });

  // Offboard
  const [pendingOffboard, setPendingOffboard] = useState<PendingOffboard[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [offboardForm, setOffboardForm] = useState({
    tipoRetiro: "renuncia" as "renuncia" | "terminacion_contrato" | "despido" | "abandono" | "pension" | "fallecimiento",
    fechaEfectiva: "",
    notas: "",
  });

  // History
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [filterTipo, setFilterTipo] = useState<"" | "vinculacion" | "desvinculacion">("");

  /* ─────────────────────────────────────────────────────────────────────────
     FETCH OPTIONS
     ───────────────────────────────────────────────────────────────────────── */
  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res = await fetch("/api/lifecycle/onboard-options", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando opciones");
      const data = await res.json();
      setOptions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     FETCH PENDING OFFBOARD
     ───────────────────────────────────────────────────────────────────────── */
  const fetchPendingOffboard = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await fetch("/api/lifecycle/pending-offboard", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando pendientes");
      const data = await res.json();
      setPendingOffboard(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     FETCH EVENTS
     ───────────────────────────────────────────────────────────────────────── */
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const url = filterTipo
        ? `/api/lifecycle/events?tipo=${filterTipo}`
        : "/api/lifecycle/events";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando historial");
      const data = await res.json();
      setEvents(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  }, [filterTipo]);

  /* ─────────────────────────────────────────────────────────────────────────
     EFFECTS
     ───────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    if (tab === "desvincular") fetchPendingOffboard();
  }, [tab, fetchPendingOffboard]);

  useEffect(() => {
    if (tab === "historial") fetchEvents();
  }, [tab, fetchEvents, filterTipo]);

  /* ─────────────────────────────────────────────────────────────────────────
     HANDLERS
     ───────────────────────────────────────────────────────────────────────── */
  const handleOnboard = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/lifecycle/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          empleado: {
            nombre: onboardForm.nombre,
            cedula: onboardForm.cedula,
            correo: onboardForm.correo,
            telefono: onboardForm.telefono,
            direccion: onboardForm.direccion,
            fechaNacimiento: onboardForm.fechaNacimiento,
          },
          contrato: {
            cargo: onboardForm.cargo,
            area: onboardForm.area,
            tipoContrato: onboardForm.tipoContrato,
            fechaInicio: onboardForm.fechaInicio,
            fechaFin: onboardForm.fechaFin || undefined,
            salario: onboardForm.salario ? parseFloat(onboardForm.salario) : undefined,
            periodicidadPago: onboardForm.periodicidadPago,
          },
          turnoId: onboardForm.turnoId || undefined,
          notas: onboardForm.notas || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al vincular empleado");
      }

      setSuccess(`Empleado ${data.data.empleadoNombre} vinculado exitosamente (${data.data.empleadoId})`);
      setOnboardForm({
        nombre: "",
        cedula: "",
        correo: "",
        telefono: "",
        direccion: "",
        fechaNacimiento: "",
        cargo: "",
        area: "",
        tipoContrato: "",
        fechaInicio: "",
        fechaFin: "",
        salario: "",
        periodicidadPago: "",
        turnoId: "",
        notas: "",
      });
      setOnboardStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleOffboard = async () => {
    if (!selectedEmployee) {
      setError("Selecciona un empleado");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/lifecycle/offboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          empleadoId: selectedEmployee,
          tipoRetiro: offboardForm.tipoRetiro,
          fechaEfectiva: offboardForm.fechaEfectiva,
          notas: offboardForm.notas || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al desvincular empleado");
      }

      setSuccess(`Empleado desvinculado exitosamente`);
      setSelectedEmployee("");
      setOffboardForm({
        tipoRetiro: "renuncia",
        fechaEfectiva: "",
        notas: "",
      });
      fetchPendingOffboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const validateStep1 = () => {
    return (
      onboardForm.nombre.trim() &&
      onboardForm.cedula.trim() &&
      onboardForm.correo.trim()
    );
  };

  const validateStep2 = () => {
    return (
      onboardForm.cargo.trim() &&
      onboardForm.tipoContrato &&
      onboardForm.fechaInicio
    );
  };

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* ── Pending Offboard Banner ────────────────────────────────────────── */}
      {pendingOffboard.length > 0 && tab !== "desvincular" && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-200">
                {pendingOffboard.length} empleado(s) con contrato vencido pendiente de desvinculación
              </p>
              <p className="text-xs text-amber-200/60 mt-0.5">
                Revisa la pestaña &quot;Desvincular&quot; para procesar estas desvinculaciones
              </p>
            </div>
            <button
              onClick={() => setTab("desvincular")}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-sm font-medium text-amber-200 transition-colors"
            >
              Ver pendientes
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "vincular" as LifecycleTab, label: "Vincular Empleado", icon: "➕", badge: 0 },
          { key: "desvincular" as LifecycleTab, label: "Desvincular Empleado", icon: "➖", badge: pendingOffboard.length },
          { key: "historial" as LifecycleTab, label: "Historial", icon: "📜", badge: 0 },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setError("");
              setSuccess("");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white/[0.12] text-white border border-white/[0.15]"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.badge > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-500/30 text-amber-200 text-xs rounded-full font-semibold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
          <span className="text-red-400">❌</span>
          <p className="text-sm text-red-200">{error}</p>
          <button onClick={() => setError("")} className="ml-auto text-red-200/60 hover:text-red-200">✕</button>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <span className="text-emerald-400">✅</span>
          <p className="text-sm text-emerald-200">{success}</p>
          <button onClick={() => setSuccess("")} className="ml-auto text-emerald-200/60 hover:text-emerald-200">✕</button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
         TAB: VINCULAR (Onboarding)
         ════════════════════════════════════════════════════════════════ */}
      {tab === "vincular" && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
          <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                👤
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Vincular Nuevo Empleado
                </h3>
                <p className="text-sm text-white/40 mt-0.5">
                  Registra empleado, contrato y turno en un solo proceso
                </p>
              </div>
            </div>
          </div>

          {/* Stepper Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-4">
              {[
                { step: 1 as OnboardStep, label: "Datos Personales" },
                { step: 2 as OnboardStep, label: "Datos Laborales" },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-2">
                  {i > 0 && <div className="w-12 h-px bg-white/[0.1]" />}
                  <button
                    onClick={() => {
                      if (s.step === 1 || validateStep1()) setOnboardStep(s.step);
                    }}
                    disabled={s.step === 2 && !validateStep1()}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      onboardStep === s.step
                        ? "bg-white/[0.12] text-white"
                        : onboardStep > s.step
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-white/30"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        onboardStep === s.step
                          ? "bg-white text-gray-900"
                          : onboardStep > s.step
                          ? "bg-emerald-500 text-white"
                          : "bg-white/[0.08] text-white/30"
                      }`}
                    >
                      {onboardStep > s.step ? "✓" : s.step}
                    </span>
                    {s.label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {optionsLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-6">
              {/* Step 1: Datos Personales */}
              {onboardStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        value={onboardForm.nombre}
                        onChange={(e) => setOnboardForm({ ...onboardForm, nombre: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: Juan Carlos Pérez González"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Número de Cédula *
                      </label>
                      <input
                        type="text"
                        value={onboardForm.cedula}
                        onChange={(e) => setOnboardForm({ ...onboardForm, cedula: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: 1234567890"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Correo Electrónico *
                      </label>
                      <input
                        type="email"
                        value={onboardForm.correo}
                        onChange={(e) => setOnboardForm({ ...onboardForm, correo: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={onboardForm.telefono}
                        onChange={(e) => setOnboardForm({ ...onboardForm, telefono: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: 3001234567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Dirección
                      </label>
                      <input
                        type="text"
                        value={onboardForm.direccion}
                        onChange={(e) => setOnboardForm({ ...onboardForm, direccion: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: Calle 123 # 45-67"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Fecha de Nacimiento
                      </label>
                      <input
                        type="date"
                        value={onboardForm.fechaNacimiento}
                        onChange={(e) => setOnboardForm({ ...onboardForm, fechaNacimiento: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setOnboardStep(2)}
                      disabled={!validateStep1()}
                      className="flex items-center gap-2 px-6 py-3 bg-white/[0.12] hover:bg-white/[0.18] disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all"
                    >
                      Continuar
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Datos Laborales */}
              {onboardStep === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Cargo *
                      </label>
                      <input
                        type="text"
                        value={onboardForm.cargo}
                        onChange={(e) => setOnboardForm({ ...onboardForm, cargo: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: Desarrollador Senior"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Área
                      </label>
                      <select
                        value={onboardForm.area}
                        onChange={(e) => setOnboardForm({ ...onboardForm, area: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [&>option]:bg-gray-900"
                      >
                        <option value="">Selecciona un área</option>
                        {options?.areas.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Tipo de Contrato *
                      </label>
                      <select
                        value={onboardForm.tipoContrato}
                        onChange={(e) => setOnboardForm({ ...onboardForm, tipoContrato: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [&>option]:bg-gray-900"
                      >
                        <option value="">Selecciona tipo</option>
                        {options?.tiposContrato.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Periodicidad de Pago
                      </label>
                      <select
                        value={onboardForm.periodicidadPago}
                        onChange={(e) => setOnboardForm({ ...onboardForm, periodicidadPago: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [&>option]:bg-gray-900"
                      >
                        <option value="">Selecciona periodicidad</option>
                        {options?.periodicidadesPago.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Fecha de Inicio *
                      </label>
                      <input
                        type="date"
                        value={onboardForm.fechaInicio}
                        onChange={(e) => setOnboardForm({ ...onboardForm, fechaInicio: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Fecha de Fin
                        <span className="ml-1 text-white/30 font-normal">(opcional para indefinido)</span>
                      </label>
                      <input
                        type="date"
                        value={onboardForm.fechaFin}
                        onChange={(e) => setOnboardForm({ ...onboardForm, fechaFin: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Salario
                      </label>
                      <input
                        type="number"
                        value={onboardForm.salario}
                        onChange={(e) => setOnboardForm({ ...onboardForm, salario: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                        placeholder="Ej: 3000000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Turno Asignado
                      </label>
                      <select
                        value={onboardForm.turnoId}
                        onChange={(e) => setOnboardForm({ ...onboardForm, turnoId: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [&>option]:bg-gray-900"
                      >
                        <option value="">Sin turno asignado</option>
                        {options?.tiposTurno.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} {t.descripcion && `(${t.descripcion})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                      Notas
                    </label>
                    <textarea
                      value={onboardForm.notas}
                      onChange={(e) => setOnboardForm({ ...onboardForm, notas: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] resize-none"
                      placeholder="Observaciones adicionales..."
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setOnboardStep(1)}
                      className="flex items-center gap-2 px-6 py-3 text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl text-sm font-medium transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                      Volver
                    </button>
                    <button
                      onClick={handleOnboard}
                      disabled={loading || !validateStep2()}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Vincular Empleado
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
         TAB: DESVINCULAR (Offboarding)
         ════════════════════════════════════════════════════════════════ */}
      {tab === "desvincular" && (
        <div className="space-y-6">
          {/* Pending offboard list */}
          {pendingOffboard.length > 0 && (
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-500/10 bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-200">Contratos Vencidos Pendientes</h4>
                    <p className="text-xs text-amber-200/60 mt-0.5">{pendingOffboard.length} empleado(s) requieren desvinculación</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-amber-500/10">
                {pendingLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  pendingOffboard.map((p) => (
                    <div
                      key={p.empleadoId}
                      className={`px-5 py-3 flex items-center justify-between hover:bg-amber-500/5 transition-colors cursor-pointer ${
                        selectedEmployee === p.empleadoId ? "bg-amber-500/10" : ""
                      }`}
                      onClick={() => setSelectedEmployee(p.empleadoId)}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="radio"
                          name="pendingEmployee"
                          checked={selectedEmployee === p.empleadoId}
                          onChange={() => setSelectedEmployee(p.empleadoId)}
                          className="w-4 h-4 accent-amber-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{p.nombre}</p>
                          <p className="text-xs text-white/40">CC {p.cedula} · {p.area || "Sin área"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-200 font-medium">Vencido hace {p.diasVencido} días</p>
                        <p className="text-xs text-white/40">Fin: {p.fechaFinContrato}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Offboard form */}
          <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
            <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                  👋
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Procesar Desvinculación
                  </h3>
                  <p className="text-sm text-white/40 mt-0.5">
                    Termina contrato, desactiva turno y marca empleado como inactivo
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!selectedEmployee && pendingOffboard.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <p className="text-white/40 text-sm">No hay empleados pendientes de desvinculación</p>
                  <p className="text-white/30 text-xs mt-1">Los empleados con contrato vencido aparecerán aquí</p>
                </div>
              )}

              {(selectedEmployee || pendingOffboard.length === 0) && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Empleado a Desvincular *
                      </label>
                      <input
                        type="text"
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        placeholder="SIRIUS-PER-XXXX o selecciona arriba"
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Tipo de Retiro *
                      </label>
                      <select
                        value={offboardForm.tipoRetiro}
                        onChange={(e) => setOffboardForm({ ...offboardForm, tipoRetiro: e.target.value as typeof offboardForm.tipoRetiro })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [&>option]:bg-gray-900"
                      >
                        <option value="renuncia">Renuncia voluntaria</option>
                        <option value="terminacion_contrato">Terminación de contrato</option>
                        <option value="despido">Despido</option>
                        <option value="abandono">Abandono de cargo</option>
                        <option value="pension">Pensión</option>
                        <option value="fallecimiento">Fallecimiento</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Fecha Efectiva *
                      </label>
                      <input
                        type="date"
                        value={offboardForm.fechaEfectiva}
                        onChange={(e) => setOffboardForm({ ...offboardForm, fechaEfectiva: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                      Notas / Observaciones
                    </label>
                    <textarea
                      value={offboardForm.notas}
                      onChange={(e) => setOffboardForm({ ...offboardForm, notas: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] resize-none"
                      placeholder="Motivo de la desvinculación, observaciones..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleOffboard}
                      disabled={loading || !selectedEmployee || !offboardForm.fechaEfectiva}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-600/20"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
                          </svg>
                          Procesar Desvinculación
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
         TAB: HISTORIAL
         ════════════════════════════════════════════════════════════════ */}
      {tab === "historial" && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
          <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                  📜
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Historial de Eventos
                  </h3>
                  <p className="text-sm text-white/40 mt-0.5">{events.length} eventos registrados</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(["", "vinculacion", "desvinculacion"] as const).map((f) => (
                  <button
                    key={f || "all"}
                    onClick={() => setFilterTipo(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterTipo === f
                        ? "bg-white/[0.12] text-white"
                        : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    {f === "" ? "Todos" : f === "vinculacion" ? "Vinculaciones" : "Desvinculaciones"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {eventsLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📭</span>
              </div>
              <p className="text-white/40 text-sm">No hay eventos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                    {["Fecha", "Tipo", "Empleado", "Subtipo", "Registrado Por", "Notas"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4 text-sm text-white/60 font-mono">
                        {new Date(e.fechaEfectiva).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            e.tipoEvento === "vinculacion"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {e.tipoEvento === "vinculacion" ? "➕" : "➖"}
                          {e.tipoEvento === "vinculacion" ? "Vinculación" : "Desvinculación"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-white">{e.empleadoNombre || e.empleadoId}</p>
                        <p className="text-xs text-white/40">{e.empleadoId}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50 capitalize">
                        {e.subtipo.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">{e.registradoPor}</td>
                      <td className="px-5 py-4 text-sm text-white/40 max-w-[200px] truncate">
                        {e.notas || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
