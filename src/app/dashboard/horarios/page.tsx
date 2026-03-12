"use client";

import { useEffect, useState } from "react";

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  tipoPersonal: string;
}

interface Horario {
  id: string;
  nombre: string;
  dias: string[];
  horaEntrada: number;
  horaSalida: number;
  totalHoras: number;
  tipoJornada: string;
}

interface HorarioResuelto {
  id: string;
  nombre: string;
  dias: string[];
  totalHoras: number;
}

interface Asignacion {
  id: string;
  idAsignacion: string;
  idCoreUsuario: string;
  cedula: string;
  nombre: string;
  horarioIds: string[];
  horarios: HorarioResuelto[];
  horarioNombres: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  notas: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeToSeconds(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 3600 + m * 60;
}

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIPOS_JORNADA = ["Completa", "Media Jornada", "Flexible", "Nocturna", "Rotativa"];

export default function HorariosPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const [selectedHorarios, setSelectedHorarios] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  // Crear Horario modal state
  const [showCrearHorario, setShowCrearHorario] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoHoraEntrada, setNuevoHoraEntrada] = useState("");
  const [nuevoHoraSalida, setNuevoHoraSalida] = useState("");
  const [nuevoHoraInicioAlmuerzo, setNuevoHoraInicioAlmuerzo] = useState("");
  const [nuevoHoraFinAlmuerzo, setNuevoHoraFinAlmuerzo] = useState("");
  const [nuevoDias, setNuevoDias] = useState<string[]>([]);
  const [nuevoTipoJornada, setNuevoTipoJornada] = useState("Completa");
  const [nuevoEstado, setNuevoEstado] = useState("Activo");
  const [nuevoDescripcion, setNuevoDescripcion] = useState("");
  const [savingHorario, setSavingHorario] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  // Tab
  const [tab, setTab] = useState<"asignar" | "historial">("asignar");

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/horarios");
      if (!res.ok) throw new Error("Error al cargar datos");
      const data = await res.json();
      setEmpleados(data.empleados || []);
      setHorarios(data.horarios || []);
      setAsignaciones(data.asignaciones || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Build lookup: cedula → active assignment
  const activeMap = new Map<string, Asignacion>();
  for (const a of asignaciones) {
    if (a.estado === "Activo") {
      activeMap.set(a.cedula, a);
    }
  }

  // Filter empleados by search
  const filtered = empleados.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.nombre.toLowerCase().includes(q) ||
      e.cedula.includes(q) ||
      e.cargo.toLowerCase().includes(q)
    );
  });

  // Detect if any selected horario is rotative
  const hasRotativo = selectedHorarios.some((hId) => {
    const h = horarios.find((x) => x.id === hId);
    return h?.tipoJornada === "Rotativa" || h?.tipoJornada === "Nocturna";
  });

  function openAssignModal(emp: Empleado) {
    setSelectedEmpleado(emp);
    const current = activeMap.get(emp.cedula);
    setSelectedHorarios(current?.horarioIds || []);
    setFechaInicio(new Date().toISOString().split("T")[0]);
    setFechaFin("");
    setNotas("");
    setShowModal(true);
  }

  function toggleHorario(id: string) {
    setSelectedHorarios((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  }

  async function handleAssign() {
    if (!selectedEmpleado || selectedHorarios.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleadoRecordId: selectedEmpleado.id,
          cedula: selectedEmpleado.cedula,
          nombre: selectedEmpleado.nombre,
          horarioIds: selectedHorarios,
          fechaInicio,
          fechaFin: fechaFin || undefined,
          notas,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al asignar");
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al asignar horario");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("¿Desactivar esta asignación de horario?")) return;
    try {
      const res = await fetch("/api/horarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Error al desactivar");
      await fetchData();
    } catch {
      alert("Error al desactivar la asignación");
    }
  }

  const nuevoTotalHoras =
    nuevoHoraEntrada && nuevoHoraSalida
      ? Math.round(((timeToSeconds(nuevoHoraSalida) - timeToSeconds(nuevoHoraEntrada)) / 3600) * 10) / 10
      : 0;

  function toggleDia(dia: string) {
    setNuevoDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }

  async function handleCrearHorario() {
    if (!nuevoNombre || !nuevoHoraEntrada || !nuevoHoraSalida || nuevoDias.length === 0) return;
    setSavingHorario(true);
    try {
      const res = await fetch("/api/configuracion-horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoNombre,
          horaEntrada: timeToSeconds(nuevoHoraEntrada),
          horaSalida: timeToSeconds(nuevoHoraSalida),
          horaInicioAlmuerzo: nuevoHoraInicioAlmuerzo || undefined,
          horaFinAlmuerzo: nuevoHoraFinAlmuerzo || undefined,
          diasLaborales: nuevoDias,
          totalHoras: nuevoTotalHoras,
          tipoJornada: nuevoTipoJornada,
          estado: nuevoEstado,
          descripcion: nuevoDescripcion || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear horario");
      }
      setShowCrearHorario(false);
      setNuevoNombre("");
      setNuevoHoraEntrada("");
      setNuevoHoraSalida("");
      setNuevoHoraInicioAlmuerzo("");
      setNuevoHoraFinAlmuerzo("");
      setNuevoDias([]);
      setNuevoTipoJornada("Completa");
      setNuevoEstado("Activo");
      setNuevoDescripcion("");
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear horario");
    } finally {
      setSavingHorario(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando datos de horarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mt-4">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalAsignados = activeMap.size;
  const sinAsignar = empleados.length - totalAsignados;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Total Empleados</p>
          <p className="text-2xl font-extrabold text-white mt-1">{empleados.length}</p>
          <p className="text-xs text-white/20 mt-0.5">activos en el sistema</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Horarios Disponibles</p>
          <p className="text-2xl font-extrabold text-white mt-1">{horarios.length}</p>
          <p className="text-xs text-white/20 mt-0.5">tipos de jornada</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-emerald-500/20 ring-1 ring-emerald-500/10 p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-emerald-400/60 font-semibold uppercase tracking-wider">Con Horario</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{totalAsignados}</p>
          <p className="text-xs text-white/20 mt-0.5">asignaciones activas</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-amber-500/20 ring-1 ring-amber-500/10 p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-amber-400/60 font-semibold uppercase tracking-wider">Sin Horario</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">{sinAsignar}</p>
          <p className="text-xs text-white/20 mt-0.5">pendientes de asignar</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("asignar")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "asignar"
              ? "bg-white/[0.15] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
          }`}
        >
          Asignar Horarios
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "historial"
              ? "bg-white/[0.15] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm"
              : "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
          }`}
        >
          Historial de Asignaciones
        </button>
      </div>

      {tab === "asignar" && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar empleado por nombre, cédula o cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/[0.25] focus:bg-white/[0.06] transition-all"
            />
          </div>

          {/* Employees table */}
          <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Empleado</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Cédula</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Cargo</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Horarios Asignados</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const asig = activeMap.get(emp.cedula);
                    return (
                      <tr key={emp.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-white">{emp.nombre}</p>
                          <p className="text-xs text-white/30">{emp.tipoPersonal}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-white/60 font-mono">{emp.cedula}</td>
                        <td className="px-6 py-4 text-sm text-white/60">{emp.cargo || "—"}</td>
                        <td className="px-6 py-4">
                          {asig ? (
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {asig.horarios.map((h) => (
                                  <span key={h.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.06] text-xs font-medium text-white/70 border border-white/[0.08]">
                                    {h.nombre}
                                    <span className="text-white/30">{h.totalHoras}h</span>
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-white/30 mt-1">Desde {asig.fechaInicio}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-400/70 font-medium">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {asig ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/[0.04] text-white/30 border border-white/[0.06]">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openAssignModal(emp)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] text-white/70 hover:bg-white/[0.15] hover:text-white border border-white/[0.1] transition-all"
                            >
                              {asig ? "Cambiar" : "Asignar"}
                            </button>
                            {asig && (
                              <button
                                onClick={() => handleDeactivate(asig.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400/70 hover:bg-red-500/20 hover:text-red-400 border border-red-500/20 transition-all"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-white/30">
                        No se encontraron empleados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "historial" && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Empleado</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Cédula</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Horarios</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Desde</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Hasta</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones
                  .sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""))
                  .map((a) => (
                    <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{a.nombre}</td>
                      <td className="px-6 py-4 text-sm text-white/60 font-mono">{a.cedula}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {a.horarios.length > 0 ? a.horarios.map((h) => (
                            <span key={h.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.06] text-xs font-medium text-white/70 border border-white/[0.08]">
                              {h.nombre}
                            </span>
                          )) : <span className="text-white/30 text-sm">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/50">{a.fechaInicio || "—"}</td>
                      <td className="px-6 py-4 text-sm text-white/50">{a.fechaFin || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          a.estado === "Activo"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-white/[0.04] text-white/30 border border-white/[0.06]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.estado === "Activo" ? "bg-emerald-400" : "bg-white/30"}`} />
                          {a.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                {asignaciones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-white/30">
                      No hay asignaciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Horarios reference panel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Horarios Disponibles</h3>
          <button
            onClick={() => setShowCrearHorario(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 transition-all shadow-lg shadow-black/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo Horario
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {horarios.map((h) => (
            <div key={h.id} className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.1] p-5 shadow-lg shadow-black/10">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">{h.nombre}</h4>
                  <p className="text-xs text-white/30 mt-0.5">{h.tipoJornada}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/[0.06] text-xs font-bold text-white/60">
                  {h.totalHoras}h
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(h.horaEntrada)} — {formatDuration(h.horaSalida)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {h.dias.map((d) => (
                  <span key={d} className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-medium text-white/50">
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-white/20 mt-2">
                {asignaciones.filter((a) => a.horarioIds.includes(h.id) && a.estado === "Activo").length} empleados asignados
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment Modal — Multi-horario */}
      {showModal && selectedEmpleado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/[0.15] p-8 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-bold text-white">Asignar Horarios</h2>
            <p className="text-sm text-white/40 mt-1">
              {selectedEmpleado.nombre} — CC {selectedEmpleado.cedula}
            </p>
            <p className="text-xs text-white/25 mt-0.5">
              Selecciona uno o varios horarios (ej: L-J + Viernes)
            </p>

            <div className="mt-6 space-y-5">
              {/* Multi-horario checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Horarios
                </label>
                <div className="space-y-2">
                  {horarios.map((h) => {
                    const isSelected = selectedHorarios.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => toggleHorario(h.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-white/[0.1] border-white/[0.25] ring-1 ring-white/[0.15]"
                            : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected
                              ? "bg-white border-white"
                              : "border-white/30"
                          }`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-white/70"}`}>
                                {h.nombre}
                              </span>
                              <span className="text-xs text-white/40 font-mono">
                                {formatDuration(h.horaEntrada)}–{formatDuration(h.horaSalida)} ({h.totalHoras}h)
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {h.dias.map((d) => (
                                <span key={d} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  isSelected ? "bg-white/[0.12] text-white/60" : "bg-white/[0.04] text-white/30"
                                }`}>
                                  {d.slice(0, 3)}
                                </span>
                              ))}
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isSelected ? "text-white/40" : "text-white/20"}`}>
                                {h.tipoJornada}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary of selected */}
              {selectedHorarios.length > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">
                    Resumen — {selectedHorarios.length} horario{selectedHorarios.length > 1 ? "s" : ""} seleccionado{selectedHorarios.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1">
                    {selectedHorarios.map((hId) => {
                      const h = horarios.find((x) => x.id === hId);
                      if (!h) return null;
                      return (
                        <div key={hId} className="flex items-center justify-between text-xs">
                          <span className="text-white/70 font-medium">{h.nombre}</span>
                          <span className="text-white/40">
                            {h.dias.map((d) => d.slice(0, 3)).join(", ")} · {h.totalHoras}h/día
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/[0.06] flex justify-between text-xs">
                    <span className="text-white/40">Total horas/semana (aprox.)</span>
                    <span className="text-white/70 font-semibold">
                      {selectedHorarios.reduce((sum, hId) => {
                        const h = horarios.find((x) => x.id === hId);
                        if (!h) return sum;
                        return sum + h.totalHoras * h.dias.length;
                      }, 0)}h
                    </span>
                  </div>
                </div>
              )}

              {/* Tipo de asignación indicator */}
              <div className={`p-3 rounded-xl border text-xs ${hasRotativo ? "bg-amber-500/5 border-amber-500/15 text-amber-400/70" : "bg-emerald-500/5 border-emerald-500/15 text-emerald-400/70"}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${hasRotativo ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <span className="font-semibold">{hasRotativo ? "Horario Rotativo" : "Horario Fijo"}</span>
                </div>
                <p className="mt-1 text-white/30">
                  {hasRotativo
                    ? "Los turnos rotativos requieren fecha de inicio y fin del ciclo."
                    : "Los horarios fijos aplican de forma permanente. Fecha fin es opcional."}
                </p>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Fecha de Fin {!hasRotativo && <span className="text-white/20 normal-case">(opcional)</span>}
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={fechaInicio}
                    className={`w-full px-4 py-3 rounded-xl bg-white/[0.04] border text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all ${
                      hasRotativo && !fechaFin ? "border-amber-500/30" : "border-white/[0.1]"
                    }`}
                    placeholder="Sin fecha fin"
                  />
                  {!fechaFin && !hasRotativo && (
                    <p className="text-[10px] text-white/20 mt-1">Vacío = vigente indefinidamente</p>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Observaciones sobre la asignación..."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.25] transition-all resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedHorarios.length === 0 || saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? "Guardando..." : `Asignar ${selectedHorarios.length > 1 ? selectedHorarios.length + " Horarios" : "Horario"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crear Horario Modal */}
      {showCrearHorario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCrearHorario(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/[0.15] p-8 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-bold text-white">Nuevo Horario</h2>
            <p className="text-sm text-white/40 mt-1">Crear una nueva configuración de horario laboral</p>

            <div className="mt-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Nombre del Horario *
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Turno Mañana L-V"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.25] transition-all"
                />
              </div>

              {/* Horas entrada / salida */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Hora Entrada *
                  </label>
                  <input
                    type="time"
                    value={nuevoHoraEntrada}
                    onChange={(e) => setNuevoHoraEntrada(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Hora Salida *
                  </label>
                  <input
                    type="time"
                    value={nuevoHoraSalida}
                    onChange={(e) => setNuevoHoraSalida(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all"
                  />
                </div>
              </div>

              {/* Total horas calculado */}
              {nuevoTotalHoras > 0 && (
                <div className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 flex items-center justify-between">
                  <span>Total horas/día</span>
                  <span className="font-bold text-white/80">{nuevoTotalHoras}h</span>
                </div>
              )}

              {/* Almuerzo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Inicio Almuerzo
                  </label>
                  <input
                    type="time"
                    value={nuevoHoraInicioAlmuerzo}
                    onChange={(e) => setNuevoHoraInicioAlmuerzo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Fin Almuerzo
                  </label>
                  <input
                    type="time"
                    value={nuevoHoraFinAlmuerzo}
                    onChange={(e) => setNuevoHoraFinAlmuerzo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all"
                  />
                </div>
              </div>

              {/* Días laborales */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                  Días Laborales *
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia) => {
                    const selected = nuevoDias.includes(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDia(dia)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          selected
                            ? "bg-white/[0.15] text-white border-white/[0.3]"
                            : "bg-white/[0.03] text-white/40 border-white/[0.08] hover:bg-white/[0.07] hover:text-white/60"
                        }`}
                      >
                        {dia.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tipo de jornada */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Tipo de Jornada
                </label>
                <select
                  value={nuevoTipoJornada}
                  onChange={(e) => setNuevoTipoJornada(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:outline-none focus:border-white/[0.25] transition-all appearance-none"
                >
                  {TIPOS_JORNADA.map((t) => (
                    <option key={t} value={t} className="bg-gray-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Estado
                </label>
                <div className="flex gap-3">
                  {["Activo", "Inactivo"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNuevoEstado(e)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        nuevoEstado === e
                          ? e === "Activo"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-white/[0.08] text-white/60 border-white/[0.2]"
                          : "bg-white/[0.02] text-white/25 border-white/[0.06] hover:text-white/40"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={nuevoDescripcion}
                  onChange={(e) => setNuevoDescripcion(e.target.value)}
                  rows={2}
                  placeholder="Descripción del horario..."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.25] transition-all resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCrearHorario(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearHorario}
                disabled={!nuevoNombre || !nuevoHoraEntrada || !nuevoHoraSalida || nuevoDias.length === 0 || savingHorario}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {savingHorario ? "Creando..." : "Crear Horario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
