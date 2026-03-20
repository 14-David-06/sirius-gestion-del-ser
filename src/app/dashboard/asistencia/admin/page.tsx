"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Novedad {
  id: string;
  empleadoId: string;
  nombre: string;
  cedula: string;
  tipoNovedad: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  descripcion?: string;
}

interface Empleado {
  id: string;
  nombre: string;
  cedula?: string;
}

interface ResumenEmpleado {
  cedula: string;
  nombre: string;
  horas_ordinarias_diurnas: number;
  horas_extras_diurnas: number;
  horas_extras_nocturnas: number;
  horas_nocturnas: number;
  horas_dominicales: number;
  horas_festivos: number;
  horas_faltantes: number;
  dias_analizados: number;
}

interface DetalleIndividual {
  modo: "individual";
  empleado_id: string;
  nombre: string;
  periodo: string;
  inicio: string;
  fin: string;
  horas_ordinarias_diurnas: number;
  horas_extras_diurnas: number;
  horas_extras_nocturnas: number;
  horas_nocturnas: number;
  horas_dominicales: number;
  horas_festivos: number;
  horas_faltantes: number;
  dias_analizados: number;
  detalle_diario: Record<string, { entradas: string[]; salidas: string[] }>;
  novedades: Array<{ tipo: string; fecha: string; estado: string; descripcion: string }>;
}

type TabKey = "monitoreo" | "novedades" | "registrar";

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "monitoreo",
    label: "Monitoreo de Horas",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    key: "novedades",
    label: "Novedades",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    key: "registrar",
    label: "Registrar Novedad",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatHoras(h: number): string {
  return h.toFixed(1);
}

function totalHorasTrabajadas(r: ResumenEmpleado): number {
  return (
    r.horas_ordinarias_diurnas +
    r.horas_extras_diurnas +
    r.horas_extras_nocturnas +
    r.horas_dominicales +
    r.horas_festivos
  );
}

function generarCSV(resultados: ResumenEmpleado[], periodo: string): string {
  const headers = [
    "Nombre",
    "Cédula",
    "Horas Ordinarias",
    "Extras Diurnas",
    "Extras Nocturnas",
    "Nocturnas (Recargo)",
    "Dominicales",
    "Festivos",
    "Total Trabajadas",
    "Faltas",
    "Días Analizados",
  ];

  const rows = resultados.map((r) => [
    `"${r.nombre}"`,
    r.cedula,
    formatHoras(r.horas_ordinarias_diurnas),
    formatHoras(r.horas_extras_diurnas),
    formatHoras(r.horas_extras_nocturnas),
    formatHoras(r.horas_nocturnas),
    formatHoras(r.horas_dominicales),
    formatHoras(r.horas_festivos),
    formatHoras(totalHorasTrabajadas(r)),
    r.horas_faltantes,
    r.dias_analizados,
  ]);

  return [
    `Reporte de Horas — Periodo ${periodo}`,
    "",
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");
}

function descargarArchivo(contenido: string, nombre: string, tipo: string) {
  const blob = new Blob(["\uFEFF" + contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-component: Monitoreo de Horas
// ═════════════════════════════════════════════════════════════════════════════

function TabMonitoreoHoras() {
  const [periodo, setPeriodo] = useState(mesActual());
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [resultados, setResultados] = useState<ResumenEmpleado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalleEmpleado, setDetalleEmpleado] = useState<DetalleIndividual | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const tablaRef = useRef<HTMLDivElement>(null);

  // Cargar lista de empleados para el selector
  useEffect(() => {
    fetch("/api/vinculacion")
      .then((res) => res.ok ? res.json() : Promise.reject("Error"))
      .then((data: { personal: Array<{ id: string; fields: Record<string, unknown> }> }) => {
        setEmpleados(
          (data.personal ?? [])
            .filter((p) => p.fields["Estado de actividad"] === "Activo")
            .map((p) => ({
              id: p.id,
              nombre: (p.fields["Nombre completo"] as string) || p.id,
              cedula: (p.fields["Numero Documento"] as string) || "",
            }))
        );
      })
      .catch(() => { /* silencioso */ });
  }, []);

  const cargarEquipo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDetalleEmpleado(null);
    try {
      const res = await fetch(`/api/asistencia/summary?equipo=true&periodo=${periodo}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al consultar resumen");
      }
      const data = await res.json();
      setResultados(data.resultados ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargarEquipo();
  }, [cargarEquipo]);

  async function verDetalle(empleadoId: string) {
    setLoadingDetalle(true);
    try {
      const res = await fetch(`/api/asistencia/summary?empleado_id=${empleadoId}&periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar detalle");
      const data: DetalleIndividual = await res.json();
      setDetalleEmpleado(data);
    } catch {
      setError("Error al cargar detalle del empleado");
    } finally {
      setLoadingDetalle(false);
    }
  }

  function exportarCSV() {
    const csv = generarCSV(datosFiltrados, periodo);
    descargarArchivo(csv, `horas-equipo-${periodo}.csv`, "text/csv;charset=utf-8");
  }

  function imprimirReporte() {
    window.print();
  }

  // Filtrar resultados
  const datosFiltrados = resultados.filter((r) => {
    if (!filtroEmpleado) return true;
    return (
      r.nombre.toLowerCase().includes(filtroEmpleado.toLowerCase()) ||
      r.cedula.includes(filtroEmpleado)
    );
  });

  // Totales del equipo
  const totales = datosFiltrados.reduce(
    (acc, r) => ({
      ordinarias: acc.ordinarias + r.horas_ordinarias_diurnas,
      extras_diurnas: acc.extras_diurnas + r.horas_extras_diurnas,
      extras_nocturnas: acc.extras_nocturnas + r.horas_extras_nocturnas,
      nocturnas: acc.nocturnas + r.horas_nocturnas,
      dominicales: acc.dominicales + r.horas_dominicales,
      festivos: acc.festivos + r.horas_festivos,
      faltantes: acc.faltantes + r.horas_faltantes,
      total: acc.total + totalHorasTrabajadas(r),
    }),
    { ordinarias: 0, extras_diurnas: 0, extras_nocturnas: 0, nocturnas: 0, dominicales: 0, festivos: 0, faltantes: 0, total: 0 }
  );

  // Fechas ordenadas para detalle diario
  const fechasDetalle = detalleEmpleado
    ? Object.keys(detalleEmpleado.detalle_diario).sort()
    : [];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 min-w-0">
          <label className={labelClass}>Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div className="flex-[2] min-w-0">
          <label className={labelClass}>Buscar empleado</label>
          <input
            type="text"
            value={filtroEmpleado}
            onChange={(e) => setFiltroEmpleado(e.target.value)}
            placeholder="Nombre o cédula..."
            className={inputClass}
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={exportarCSV}
            disabled={datosFiltrados.length === 0}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar a Excel (CSV)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            CSV
          </button>
          <button
            onClick={imprimirReporte}
            disabled={datosFiltrados.length === 0}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Imprimir / Guardar como PDF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.159 48.159 0 013.478-.372m-3.478.372V6.75A2.25 2.25 0 019.5 4.5h5.25a2.25 2.25 0 012.25 2.25v.894m-7.253-.894h7.253" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* KPIs del equipo */}
      {!loading && datosFiltrados.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          {[
            { label: "Total Horas", valor: formatHoras(totales.total), color: "text-white" },
            { label: "Extras Diurnas", valor: formatHoras(totales.extras_diurnas), color: "text-amber-400" },
            { label: "Extras Nocturnas", valor: formatHoras(totales.extras_nocturnas), color: "text-purple-400" },
            { label: "Faltas", valor: String(totales.faltantes), color: "text-red-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-black/30 border border-white/[0.08] p-4 text-center">
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-2xl font-extrabold mt-1 ${kpi.color}`}>{kpi.valor}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{datosFiltrados.length} empleados</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla principal del equipo */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-10 h-10 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-white/40 text-sm">Consultando horas del equipo...</p>
          </div>
        </div>
      ) : datosFiltrados.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] py-16 text-center">
          <p className="text-sm text-white/40">No se encontraron registros para este período</p>
        </div>
      ) : (
        <div ref={tablaRef} className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm print:border-gray-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left print:text-black">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] print:bg-gray-100 print:border-gray-300">
                  {[
                    "Empleado",
                    "Ordinarias",
                    "Ext. Diurnas",
                    "Ext. Nocturnas",
                    "Nocturnas",
                    "Dominicales",
                    "Festivos",
                    "Total",
                    "Faltas",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider whitespace-nowrap print:text-gray-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] print:divide-gray-200">
                {datosFiltrados.map((r) => {
                  const total = totalHorasTrabajadas(r);
                  const empMatch = empleados.find((e) => e.cedula === r.cedula);
                  return (
                    <tr key={r.cedula} className="hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-white print:text-black">{r.nombre}</p>
                        <p className="text-[11px] text-white/30 print:text-gray-500">CC {r.cedula}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-white/70 print:text-black">{formatHoras(r.horas_ordinarias_diurnas)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-amber-400/80 print:text-black">{formatHoras(r.horas_extras_diurnas)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-purple-400/80 print:text-black">{formatHoras(r.horas_extras_nocturnas)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-indigo-400/80 print:text-black">{formatHoras(r.horas_nocturnas)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-400/80 print:text-black">{formatHoras(r.horas_dominicales)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-cyan-400/80 print:text-black">{formatHoras(r.horas_festivos)}</td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-white print:text-black">{formatHoras(total)}</td>
                      <td className="px-4 py-3">
                        {r.horas_faltantes > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-bold text-red-400 print:text-red-600 print:border-red-300">
                            {r.horas_faltantes}
                          </span>
                        ) : (
                          <span className="text-sm text-white/20 print:text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <button
                          onClick={() => empMatch ? verDetalle(empMatch.id) : undefined}
                          disabled={!empMatch || loadingDetalle}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-white/60 hover:text-white text-xs font-medium transition-all disabled:opacity-30"
                          title="Ver detalle diario"
                        >
                          Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totales */}
              <tfoot>
                <tr className="border-t-2 border-white/[0.12] bg-white/[0.03] print:bg-gray-50 print:border-gray-400">
                  <td className="px-4 py-3 text-sm font-bold text-white print:text-black">Totales ({datosFiltrados.length})</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-white/70 print:text-black">{formatHoras(totales.ordinarias)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-amber-400 print:text-black">{formatHoras(totales.extras_diurnas)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-purple-400 print:text-black">{formatHoras(totales.extras_nocturnas)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-indigo-400 print:text-black">{formatHoras(totales.nocturnas)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-blue-400 print:text-black">{formatHoras(totales.dominicales)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-cyan-400 print:text-black">{formatHoras(totales.festivos)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-extrabold text-white print:text-black">{formatHoras(totales.total)}</td>
                  <td className="px-4 py-3 text-sm font-mono font-bold text-red-400 print:text-red-600">{totales.faltantes}</td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Panel de detalle individual */}
      {loadingDetalle && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
          <div className="w-8 h-8 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-white/40 text-sm">Cargando detalle...</p>
        </div>
      )}

      {detalleEmpleado && !loadingDetalle && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300">
                {detalleEmpleado.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-base font-bold text-white">{detalleEmpleado.nombre}</p>
                <p className="text-xs text-white/40">Período: {detalleEmpleado.periodo}</p>
              </div>
            </div>
            <button onClick={() => setDetalleEmpleado(null)} className="text-white/40 hover:text-white/70 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* KPIs individuales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            {[
              { label: "Ordinarias", valor: formatHoras(detalleEmpleado.horas_ordinarias_diurnas) + "h" },
              { label: "Ext. Diurnas", valor: formatHoras(detalleEmpleado.horas_extras_diurnas) + "h" },
              { label: "Ext. Nocturnas", valor: formatHoras(detalleEmpleado.horas_extras_nocturnas) + "h" },
              { label: "Faltas", valor: String(detalleEmpleado.horas_faltantes) },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-center">
                <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">{k.label}</p>
                <p className="text-lg font-bold text-white mt-0.5">{k.valor}</p>
              </div>
            ))}
          </div>

          {/* Detalle diario */}
          {fechasDetalle.length > 0 && (
            <div className="border-t border-white/[0.06]">
              <div className="px-6 py-3 bg-white/[0.02]">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Detalle Diario</p>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
                {fechasDetalle.map((fecha) => {
                  const dia = detalleEmpleado.detalle_diario[fecha];
                  const fechaObj = new Date(fecha + "T12:00:00");
                  const diaSemana = fechaObj.toLocaleDateString("es-CO", { weekday: "short" });
                  const diaNum = fechaObj.getDate();
                  const pares = Math.min(dia.entradas.length, dia.salidas.length);
                  let horasEstimadas = 0;
                  for (let i = 0; i < pares; i++) {
                    const [eh, em] = dia.entradas[i].split(":").map(Number);
                    const [sh, sm] = dia.salidas[i].split(":").map(Number);
                    horasEstimadas += (sh * 60 + sm - (eh * 60 + em)) / 60;
                  }

                  return (
                    <div key={fecha} className="flex items-center gap-4 px-6 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="w-10 text-center flex-shrink-0">
                        <p className="text-[10px] text-white/40 uppercase">{diaSemana}</p>
                        <p className="text-lg font-bold text-white">{diaNum}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2">
                          {dia.entradas.sort().map((h, i) => (
                            <span key={`e-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                              {h}
                            </span>
                          ))}
                          {dia.salidas.sort().map((h, i) => (
                            <span key={`s-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] font-mono text-red-400">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-mono font-bold text-white">{horasEstimadas > 0 ? formatHoras(horasEstimadas) + "h" : "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Novedades del empleado */}
          {detalleEmpleado.novedades.length > 0 && (
            <div className="border-t border-white/[0.06]">
              <div className="px-6 py-3 bg-white/[0.02]">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Novedades / Permisos</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {detalleEmpleado.novedades.map((nov, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${
                      nov.estado === "Aprobado"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        : nov.estado === "Rechazado"
                        ? "bg-red-500/10 border-red-500/20 text-red-300"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    }`}>
                      {nov.estado}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{nov.tipo}</p>
                      {nov.descripcion && (
                        <p className="text-xs text-white/40 truncate">{nov.descripcion}</p>
                      )}
                    </div>
                    <p className="text-xs text-white/40 font-mono flex-shrink-0">{nov.fecha}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {novedades.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-sm text-white/40">No hay novedades pendientes</p>
          <p className="text-xs text-white/25 mt-1">Todo al día</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              {novedades.length} novedad{novedades.length !== 1 ? "es" : ""} pendiente{novedades.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {novedades.map((nov) => (
              <div key={nov.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{nov.nombre || nov.cedula || nov.empleadoId}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-semibold text-white/50 uppercase">
                      {nov.tipoNovedad}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-white/40 font-mono">{nov.fechaInicio}{nov.fechaFin && nov.fechaFin !== nov.fechaInicio ? ` → ${nov.fechaFin}` : ""}</p>
                    {nov.descripcion && (
                      <p className="text-xs text-white/30 truncate max-w-60">{nov.descripcion}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
              </div>
            ))}
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
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${
          resultado.ok
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            : "bg-red-500/10 border-red-500/20 text-red-300"
        }`}>
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
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className={selectClass} required>
              <option value="" className="bg-gray-950">-- Seleccione un empleado --</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-gray-950">{emp.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Tipo de Novedad *</label>
          <select value={tipoNovedad} onChange={(e) => setTipoNovedad(e.target.value)} className={selectClass} required>
            <option value="" className="bg-gray-950">-- Seleccione --</option>
            {TIPOS_NOVEDAD.map((t) => (
              <option key={t.value} value={t.value} className="bg-gray-950">{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fecha Inicio *</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => { setFechaInicio(e.target.value); setErrorFecha(null); }}
            className={`${inputClass} [color-scheme:dark]`}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Fecha Fin *</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => { setFechaFin(e.target.value); setErrorFecha(null); }}
            className={`${inputClass} [color-scheme:dark]`}
            required
          />
          {errorFecha && <p className="mt-1.5 text-xs text-red-400">{errorFecha}</p>}
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
// Main Page
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminAsistenciaPage() {
  const [tabActivo, setTabActivo] = useState<TabKey>("monitoreo");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Control de Asistencia</h2>
          <p className="text-sm text-white/40">Monitoreo de horas, novedades y reportes del equipo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap p-1 rounded-xl bg-black/20 border border-white/[0.06] w-fit print:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabActivo(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tabActivo === tab.key
                ? "bg-white/[0.12] text-white border border-white/[0.18] shadow-lg shadow-black/10"
                : "text-white/50 hover:text-white/80 hover:bg-white/[0.05] border border-transparent"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      <div className={tabActivo !== "monitoreo" ? "rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-6 print:hidden" : ""}>
        {tabActivo === "monitoreo" && <TabMonitoreoHoras />}
        {tabActivo === "novedades" && <TabNovedadesPendientes />}
        {tabActivo === "registrar" && <TabRegistrarNovedad />}
      </div>
    </div>
  );
}
