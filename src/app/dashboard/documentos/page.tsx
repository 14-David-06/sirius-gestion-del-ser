"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import StatusBadge from "@/components/StatusBadge";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface DocRecord {
  id: string;
  fields: {
    "ID Registro": string;
    "ID_Empleado": string;
    "Nombre_Empleado": string;
    "Código_Documento": string;
    "Nombre_Documento": string;
    "Capítulo": string;
    "Periodicidad": string;
    "Estado": string;
    "Período": string;
    "Fecha de Cumplimiento": string;
    "Fecha de Carga": string;
    "Ruta_Carpeta": string;
    "URL_OneDrive": string;
    "Observaciones": string;
    "Tipo_Documento_ID": string;
  };
}

type TabKey = "todos" | "pendiente" | "cumplido" | "proceso";

const CHAPTER_LABELS: Record<string, string> = {
  VLC: "Vinculación Laboral",
  SPS: "Salarios y Prestaciones",
  SSP: "Seguridad Social",
  SST: "Seguridad y Salud",
  JYD: "Jornadas y Descansos",
  OGE: "Obligaciones Generales",
  DVL: "Desvinculación",
};

const ESTADOS = ["Pendiente", "En proceso", "Cumplido", "No aplica"];

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function DocumentosPage() {
  const [records, setRecords] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [tab, setTab] = useState<TabKey>("todos");
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterChapter, setFilterChapter] = useState("");

  // Detail modal
  const [selectedRecord, setSelectedRecord] = useState<DocRecord | null>(null);
  const [editState, setEditState] = useState<string>("");
  const [editObs, setEditObs] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Fetch data ─────────────────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/documentos");
      if (!res.ok) throw new Error("Error al cargar datos");
      const data = await res.json();
      setRecords(data.registros);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived data ───────────────────────────────────────────────────────── */

  const employees = useMemo(() => {
    const names = new Set<string>();
    records.forEach((r) => {
      if (r.fields.Nombre_Empleado && r.fields.Nombre_Empleado !== "Documento General / Corporativo") {
        names.add(r.fields.Nombre_Empleado);
      }
    });
    return Array.from(names).sort();
  }, [records]);

  const chapters = useMemo(() => {
    const caps = new Set<string>();
    records.forEach((r) => {
      const code = r.fields["Código_Documento"]?.split("-")[0];
      if (code) caps.add(code);
    });
    return Array.from(caps).sort();
  }, [records]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const pendiente = records.filter((r) => r.fields.Estado === "Pendiente").length;
    const cumplido = records.filter((r) => r.fields.Estado === "Cumplido").length;
    const enProceso = records.filter((r) => r.fields.Estado === "En proceso").length;
    const noAplica = records.filter((r) => r.fields.Estado === "No aplica").length;
    const pct = total > 0 ? Math.round((cumplido / (total - noAplica || 1)) * 100) : 0;
    return { total, pendiente, cumplido, enProceso, noAplica, pct };
  }, [records]);

  // Per-employee summary
  const employeeSummary = useMemo(() => {
    const map = new Map<string, { total: number; pendiente: number; cumplido: number; enProceso: number }>();
    records.forEach((r) => {
      const name = r.fields.Nombre_Empleado;
      if (!name || name === "Documento General / Corporativo") return;
      if (!map.has(name)) map.set(name, { total: 0, pendiente: 0, cumplido: 0, enProceso: 0 });
      const s = map.get(name)!;
      s.total++;
      if (r.fields.Estado === "Pendiente") s.pendiente++;
      else if (r.fields.Estado === "Cumplido") s.cumplido++;
      else if (r.fields.Estado === "En proceso") s.enProceso++;
    });
    return map;
  }, [records]);

  /* ── Filtering ──────────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = records;

    // Tab filter
    if (tab === "pendiente") list = list.filter((r) => r.fields.Estado === "Pendiente");
    else if (tab === "cumplido") list = list.filter((r) => r.fields.Estado === "Cumplido");
    else if (tab === "proceso") list = list.filter((r) => r.fields.Estado === "En proceso");

    // Employee filter
    if (filterEmployee) list = list.filter((r) => r.fields.Nombre_Empleado === filterEmployee);

    // Chapter filter
    if (filterChapter) list = list.filter((r) => r.fields["Código_Documento"]?.startsWith(filterChapter + "-"));

    // Search
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.fields.Nombre_Empleado?.toLowerCase().includes(s) ||
          r.fields["Nombre_Documento"]?.toLowerCase().includes(s) ||
          r.fields["Código_Documento"]?.toLowerCase().includes(s) ||
          r.fields.ID_Empleado?.toLowerCase().includes(s)
      );
    }

    return list;
  }, [records, tab, filterEmployee, filterChapter, search]);

  /* ── Update handler ─────────────────────────────────────────────────────── */

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    setSaving(true);

    try {
      const body: Record<string, string> = { id: selectedRecord.id };
      if (editState !== selectedRecord.fields.Estado) body["Estado"] = editState;
      if (editObs !== (selectedRecord.fields.Observaciones || "")) body["Observaciones"] = editObs;
      if (editUrl !== (selectedRecord.fields.URL_OneDrive || "")) body["URL_OneDrive"] = editUrl;

      if (editState === "Cumplido" && !selectedRecord.fields["Fecha de Cumplimiento"]) {
        body["Fecha de Cumplimiento"] = new Date().toISOString().split("T")[0];
      }

      if (Object.keys(body).length <= 1) {
        setSelectedRecord(null);
        return;
      }

      const res = await fetch("/api/documentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }

      showToast("Registro actualizado exitosamente");
      setSelectedRecord(null);
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al actualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = (r: DocRecord) => {
    setSelectedRecord(r);
    setEditState(r.fields.Estado);
    setEditObs(r.fields.Observaciones || "");
    setEditUrl(r.fields.URL_OneDrive || "");
  };

  /* ── Loading / Error ────────────────────────────────────────────────────── */

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando gestión documental...</p>
        </div>
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-white">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={fetchData} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Registros", count: stats.total, icon: "📋" },
            { label: "Pendientes", count: stats.pendiente, icon: "⏳" },
            { label: "Cumplidos", count: stats.cumplido, icon: "✅" },
            { label: "Cumplimiento", count: `${stats.pct}%`, icon: "📊" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] p-5 shadow-2xl shadow-black/20 hover:bg-white/[0.1] transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-extrabold text-white mt-1">{stat.count}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xl backdrop-blur-sm">
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Employee overview cards */}
        <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
          <div className="px-6 py-4 border-b border-white/[0.08] bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg">👥</div>
              <div>
                <h3 className="text-base font-bold text-white">Cumplimiento por Empleado</h3>
                <p className="text-xs text-white/40">{employees.length} empleados activos</p>
              </div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
            {Array.from(employeeSummary.entries())
              .sort((a, b) => b[1].pendiente - a[1].pendiente)
              .map(([name, s]) => {
                const pct = s.total > 0 ? Math.round((s.cumplido / s.total) * 100) : 0;
                return (
                  <button
                    key={name}
                    onClick={() => { setFilterEmployee(name); setTab("todos"); }}
                    className={`text-left rounded-xl p-4 border transition-all hover:bg-white/[0.08] ${
                      filterEmployee === name
                        ? "bg-white/[0.1] border-white/[0.2]"
                        : "bg-white/[0.03] border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white truncate pr-2">{name}</p>
                      <span className="text-xs text-white/50 font-mono">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/40 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                      <span>✅ {s.cumplido}</span>
                      <span>⏳ {s.pendiente}</span>
                      <span>🔄 {s.enProceso}</span>
                      <span className="ml-auto text-white/30">{s.total} docs</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Toolbar: Tabs + Filters + Search */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "todos" as TabKey, label: "Todos", count: stats.total },
                { key: "pendiente" as TabKey, label: "Pendientes", count: stats.pendiente },
                { key: "proceso" as TabKey, label: "En Proceso", count: stats.enProceso },
                { key: "cumplido" as TabKey, label: "Cumplidos", count: stats.cumplido },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    tab === t.key
                      ? "bg-white/[0.08] text-white border border-white/[0.1]"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar documento o empleado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] backdrop-blur-sm"
              />
            </div>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] backdrop-blur-sm appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">Todos los empleados</option>
              {employees.map((e) => (
                <option key={e} value={e} className="bg-gray-900">{e}</option>
              ))}
            </select>

            <select
              value={filterChapter}
              onChange={(e) => setFilterChapter(e.target.value)}
              className="px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/[0.25] backdrop-blur-sm appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">Todos los capítulos</option>
              {chapters.map((ch) => (
                <option key={ch} value={ch} className="bg-gray-900">{ch} - {CHAPTER_LABELS[ch] || ch}</option>
              ))}
            </select>

            {(filterEmployee || filterChapter) && (
              <button
                onClick={() => { setFilterEmployee(""); setFilterChapter(""); }}
                className="px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
              >
                ✕ Limpiar filtros
              </button>
            )}

            <span className="ml-auto text-xs text-white/30">{filtered.length} registros</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-xl shadow-2xl shadow-black/20">
          <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-lg backdrop-blur-sm">
                  📄
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Registro de Cumplimiento Documental</h3>
                  <p className="text-sm text-white/40 mt-0.5">{filtered.length} documentos</p>
                </div>
              </div>
              {loading && (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-black/20">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Documento</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden lg:table-cell">Empleado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden md:table-cell">Capítulo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider hidden sm:table-cell">Periodicidad</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-white/30 text-sm">
                      No se encontraron registros con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, 100).map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                      onClick={() => openDetail(r)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-white/60 bg-white/[0.06] px-2 py-0.5 rounded">
                          {r.fields["Código_Documento"]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white/80 text-sm line-clamp-1 max-w-[300px]">{r.fields["Nombre_Documento"]}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-white/60 text-sm truncate max-w-[180px]">
                          {r.fields.Nombre_Empleado === "Documento General / Corporativo" ? (
                            <span className="italic text-white/30">General</span>
                          ) : (
                            r.fields.Nombre_Empleado
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-white/40">
                          {r.fields["Código_Documento"]?.split("-")[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.fields.Estado} />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-white/40">{r.fields.Periodicidad}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(r); }}
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-all"
                          title="Ver detalle"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <div className="px-6 py-3 border-t border-white/[0.06] text-center">
                <p className="text-xs text-white/30">Mostrando 100 de {filtered.length} registros. Use los filtros para reducir resultados.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail / Edit Modal ────────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/[0.15] shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.1] bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-white/60 bg-white/[0.08] px-2.5 py-1 rounded-lg">
                    {selectedRecord.fields["Código_Documento"]}
                  </span>
                  <StatusBadge status={selectedRecord.fields.Estado} />
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Documento</p>
                <p className="text-white font-medium text-sm">{selectedRecord.fields["Nombre_Documento"]}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Empleado</p>
                  <p className="text-white/70 text-sm">{selectedRecord.fields.Nombre_Empleado}</p>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">ID Empleado</p>
                  <p className="text-white/70 text-sm font-mono">{selectedRecord.fields.ID_Empleado}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Capítulo</p>
                  <p className="text-white/70 text-sm">
                    {selectedRecord.fields["Código_Documento"]?.split("-")[0]} — {CHAPTER_LABELS[selectedRecord.fields["Código_Documento"]?.split("-")[0]] || ""}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Periodicidad</p>
                  <p className="text-white/70 text-sm">{selectedRecord.fields.Periodicidad}</p>
                </div>
              </div>

              {selectedRecord.fields.Ruta_Carpeta && (
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Carpeta OneDrive</p>
                  <p className="text-white/50 text-xs font-mono bg-white/[0.04] p-2 rounded-lg break-all">
                    {selectedRecord.fields.Ruta_Carpeta}
                  </p>
                </div>
              )}

              <hr className="border-white/[0.08]" />

              {/* Editable fields */}
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {ESTADOS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEditState(e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        editState === e
                          ? "bg-white/[0.12] text-white border-white/[0.2]"
                          : "bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.06]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">URL OneDrive</label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15]"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Observaciones</label>
                <textarea
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  rows={3}
                  placeholder="Agregar observaciones..."
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/[0.12] rounded-xl text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.1] bg-white/[0.03] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-5 py-2.5 bg-white/[0.12] hover:bg-white/[0.18] backdrop-blur-sm border border-white/[0.15] text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-black/10 disabled:opacity-40"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Guardando...
                  </span>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl shadow-black/30 backdrop-blur-2xl border transition-all ${
          toast.type === "success" ? "bg-black/60 border-white/[0.15] text-white" : "bg-red-900/60 border-red-400/20 text-red-200"
        }`}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.message}
        </div>
      )}
    </>
  );
}
