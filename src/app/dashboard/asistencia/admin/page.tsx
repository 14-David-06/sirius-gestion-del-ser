"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Novedad {
  id: string;
  empleado_id: string;
  tipo_novedad: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  descripcion?: string;
}

interface Empleado {
  id: string;
  nombre: string;
}

interface ResultadoHoras {
  empleado_id: string;
  nombre_empleado?: string;
  periodo: string;
  horas_ordinarias_diurnas: number;
  horas_extras_diurnas: number;
  horas_extras_nocturnas: number;
  horas_nocturnas_recargo: number;
  horas_dominicales: number;
  horas_festivos: number;
  horas_faltantes: number;
  dias_analizados: number;
}

type TabKey = "novedades" | "registrar" | "resumen";

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "novedades", label: "Novedades Pendientes" },
  { key: "registrar", label: "Registrar Novedad" },
  { key: "resumen", label: "Resumen de Período" },
];

const TIPOS_NOVEDAD = [
  { value: "Incapacidad", label: "Incapacidad" },
  { value: "Licencia con goce", label: "Licencia con goce" },
  { value: "Licencia sin goce", label: "Licencia sin goce" },
  { value: "Permiso", label: "Permiso" },
  { value: "Falta Injustificada", label: "Falta Injustificada" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all placeholder:text-white/20 disabled:opacity-40 backdrop-blur-sm";

const selectClass =
  "w-full px-4 py-3 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all [&>option]:bg-gray-950 backdrop-blur-sm";

const labelClass = "block text-sm font-medium text-white/60 mb-2";

// ═════════════════════════════════════════════════════════════════════════════
// Sub-component: Tab Novedades Pendientes
// ═════════════════════════════════════════════════════════════════════════════

function TabNovedadesPendientes() {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargarNovedades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/asistencia/novedades?estado=Pendiente");
      if (!res.ok) throw new Error("Error al cargar novedades");
      const data = await res.json();
      setNovedades(data.novedades ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarNovedades();
  }, [cargarNovedades]);

  async function actualizarEstado(id: string, estado: "Aprobado" | "Rechazado") {
    setProcesando(id);
    try {
      const res = await fetch("/api/asistencia/novedades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar novedad");
      }
      await cargarNovedades();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setProcesando(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-white/40 text-sm">Cargando novedades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

      {novedades.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <p className="text-sm text-white/40">No hay novedades pendientes</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {["Empleado", "Tipo", "Fecha Inicio", "Fecha Fin", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="px-5 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {novedades.map((nov) => (
                  <tr key={nov.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-sm text-white font-medium">{nov.empleado_id}</td>
                    <td className="px-5 py-4 text-sm text-white/70">{nov.tipo_novedad}</td>
                    <td className="px-5 py-4 text-sm text-white/50 font-mono">{nov.fecha_inicio}</td>
                    <td className="px-5 py-4 text-sm text-white/50 font-mono">{nov.fecha_fin}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-300 uppercase tracking-wide">
                        {nov.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => actualizarEstado(nov.id, "Aprobado")}
                          disabled={procesando === nov.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {procesando === nov.id ? "..." : "Aprobar"}
                        </button>
                        <button
                          onClick={() => actualizarEstado(nov.id, "Rechazado")}
                          disabled={procesando === nov.id}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {procesando === nov.id ? "..." : "Rechazar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-component: Tab Registrar Novedad
// ═════════════════════════════════════════════════════════════════════════════

function TabRegistrarNovedad() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [errorEmpleados, setErrorEmpleados] = useState<string | null>(null);

  const [empleadoId, setEmpleadoId] = useState("");
  const [tipoNovedad, setTipoNovedad] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vinculacion")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar empleados");
        return res.json();
      })
      .then((data: { personal: Array<{ id: string; fields: Record<string, unknown> }> }) => {
        const activos: Empleado[] = (data.personal ?? [])
          .filter((p) => p.fields["Estado de actividad"] === "Activo")
          .map((p) => ({
            id: p.id,
            nombre: (p.fields["Nombre completo"] as string) || p.id,
          }));
        setEmpleados(activos);
      })
      .catch((err: unknown) => {
        setErrorEmpleados(err instanceof Error ? err.message : "Error de conexión al cargar empleados");
      })
      .finally(() => setLoadingEmpleados(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorFecha(null);

    if (!empleadoId || !tipoNovedad || !fechaInicio || !fechaFin) {
      setResultado({ ok: false, msg: "Completa todos los campos obligatorios." });
      return;
    }

    if (fechaFin < fechaInicio) {
      setErrorFecha("La fecha de fin debe ser igual o posterior a la fecha de inicio");
      return;
    }

    setSubmitting(true);
    setResultado(null);
    try {
      const res = await fetch("/api/asistencia/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleado_id: empleadoId,
          tipo_novedad: tipoNovedad,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          descripcion: descripcion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar novedad");
      setResultado({ ok: true, msg: "Novedad registrada correctamente." });
      setEmpleadoId("");
      setTipoNovedad("");
      setFechaInicio("");
      setFechaFin("");
      setDescripcion("");
    } catch (err) {
      setResultado({ ok: false, msg: err instanceof Error ? err.message : "Error de conexión." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {resultado && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium border ${
            resultado.ok
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          {resultado.msg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Empleado *</label>
          {loadingEmpleados ? (
            <div className={`${inputClass} flex items-center gap-2 text-white/40`}>
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/50 rounded-full animate-spin flex-shrink-0" />
              Cargando empleados...
            </div>
          ) : errorEmpleados ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {errorEmpleados}
            </div>
          ) : (
            <select
              value={empleadoId}
              onChange={(e) => setEmpleadoId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="" className="bg-gray-950">-- Seleccione un empleado --</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-gray-950">
                  {emp.nombre}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Tipo de Novedad *</label>
          <select
            value={tipoNovedad}
            onChange={(e) => setTipoNovedad(e.target.value)}
            className={selectClass}
            required
          >
            <option value="" className="bg-gray-950">-- Seleccione --</option>
            {TIPOS_NOVEDAD.map((t) => (
              <option key={t.value} value={t.value} className="bg-gray-950">
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fecha Inicio *</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value);
              setErrorFecha(null);
            }}
            className={`${inputClass} [color-scheme:dark]`}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Fecha Fin *</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value);
              setErrorFecha(null);
            }}
            className={`${inputClass} [color-scheme:dark]`}
            required
          />
          {errorFecha && (
            <p className="mt-1.5 text-xs text-red-400">{errorFecha}</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Describe el detalle de la novedad..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="pt-2 border-t border-white/[0.06]">
        <button
          type="submit"
          disabled={submitting || loadingEmpleados}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Registrando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Registrar Novedad
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-component: Tab Resumen de Período
// ═════════════════════════════════════════════════════════════════════════════

function TabResumenPeriodo() {
  const [empleadoId, setEmpleadoId] = useState("");
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoHoras | null>(null);

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (!empleadoId.trim() || !mes) {
      setError("Ingresa el ID del empleado y el período a consultar.");
      return;
    }
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const params = new URLSearchParams({ empleado_id: empleadoId.trim(), periodo: mes });
      const res = await fetch(`/api/asistencia/summary?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al consultar resumen");
      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  const filasResumen: { label: string; key: keyof ResultadoHoras; suffix?: string }[] = [
    { label: "Horas Ordinarias Diurnas", key: "horas_ordinarias_diurnas", suffix: "h" },
    { label: "Horas Extras Diurnas", key: "horas_extras_diurnas", suffix: "h" },
    { label: "Horas Extras Nocturnas", key: "horas_extras_nocturnas", suffix: "h" },
    { label: "Horas Nocturnas (recargo 35%)", key: "horas_nocturnas_recargo", suffix: "h" },
    { label: "Horas Dominicales", key: "horas_dominicales", suffix: "h" },
    { label: "Horas en Festivos", key: "horas_festivos", suffix: "h" },
    { label: "Horas Faltantes", key: "horas_faltantes", suffix: "h" },
    { label: "Días Analizados", key: "dias_analizados", suffix: " días" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <form onSubmit={handleConsultar} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label className={labelClass}>ID del Empleado</label>
          <input
            type="text"
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            placeholder="Ej: EMP-001"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Período (mes)</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Consultar
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
          {/* Header del resultado */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-base font-bold text-white">
                  {resultado.nombre_empleado ?? resultado.empleado_id}
                </p>
                <p className="text-xs text-white/40 mt-0.5">ID: {resultado.empleado_id}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-xs text-indigo-300 font-semibold">{resultado.periodo}</span>
              </div>
            </div>
          </div>

          {/* Tabla de horas */}
          <div className="divide-y divide-white/[0.04]">
            {filasResumen.map(({ label, key, suffix }) => {
              const valor = resultado[key];
              const esHoraFaltante = key === "horas_faltantes";
              return (
                <div
                  key={key}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <p className="text-sm text-white/60">{label}</p>
                  <p
                    className={`text-sm font-bold font-mono ${
                      esHoraFaltante && typeof valor === "number" && valor > 0
                        ? "text-red-400"
                        : "text-white"
                    }`}
                  >
                    {typeof valor === "number" ? valor.toFixed(key === "dias_analizados" ? 0 : 1) : "—"}
                    {suffix}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminAsistenciaPage() {
  const [tabActivo, setTabActivo] = useState<TabKey>("novedades");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Administración de Asistencia</h2>
          <p className="text-sm text-white/40">Gestión de novedades y resúmenes de período</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap p-1 rounded-xl bg-black/20 border border-white/[0.06] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActivo(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tabActivo === tab.key
                ? "bg-white/[0.12] text-white border border-white/[0.18] shadow-lg shadow-black/10"
                : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-6">
        {tabActivo === "novedades" && <TabNovedadesPendientes />}
        {tabActivo === "registrar" && <TabRegistrarNovedad />}
        {tabActivo === "resumen" && <TabResumenPeriodo />}
      </div>
    </div>
  );
}
