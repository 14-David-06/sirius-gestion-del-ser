"use client";

import { useState } from "react";

type SolicitudTipo = "vacaciones" | "permiso" | "novedad_nomina";

interface Solicitud {
  id: string;
  tipo: SolicitudTipo;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  fechaCreacion: string;
}

const tipoLabels: Record<SolicitudTipo, { label: string; icon: string; color: string }> = {
  vacaciones: { label: "Vacaciones", icon: "🏖️", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  permiso: { label: "Permiso", icon: "📋", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  novedad_nomina: { label: "Novedad de Nómina", icon: "💰", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
};

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  aprobada: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rechazada: "bg-red-500/15 text-red-400 border-red-500/20",
};

// Mock data — en producción se conectaría a Airtable
const mockSolicitudes: Solicitud[] = [
  {
    id: "SOL-001",
    tipo: "vacaciones",
    titulo: "Vacaciones de fin de año",
    descripcion: "Solicito vacaciones del 20 al 31 de diciembre",
    fechaInicio: "2026-12-20",
    fechaFin: "2026-12-31",
    estado: "pendiente",
    fechaCreacion: "2026-03-01",
  },
  {
    id: "SOL-002",
    tipo: "permiso",
    titulo: "Cita médica",
    descripcion: "Permiso para asistir a cita médica programada",
    fechaInicio: "2026-03-10",
    fechaFin: "2026-03-10",
    estado: "aprobada",
    fechaCreacion: "2026-02-28",
  },
  {
    id: "SOL-003",
    tipo: "novedad_nomina",
    titulo: "Cambio de cuenta bancaria",
    descripcion: "Actualización de datos bancarios para nómina",
    fechaInicio: "2026-03-01",
    fechaFin: "2026-03-01",
    estado: "aprobada",
    fechaCreacion: "2026-02-25",
  },
];

export default function SolicitudesPage() {
  const [solicitudes] = useState<Solicitud[]>(mockSolicitudes);
  const [showForm, setShowForm] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<SolicitudTipo | "todas">("todas");
  const [formData, setFormData] = useState({
    tipo: "vacaciones" as SolicitudTipo,
    titulo: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
  });

  const filtered = solicitudes.filter(
    (s) => tipoFilter === "todas" || s.tipo === tipoFilter
  );

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.estado === "pendiente").length,
    aprobadas: solicitudes.filter((s) => s.estado === "aprobada").length,
    rechazadas: solicitudes.filter((s) => s.estado === "rechazada").length,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: Enviar a Airtable
    setShowForm(false);
    setFormData({ tipo: "vacaciones", titulo: "", descripcion: "", fechaInicio: "", fechaFin: "" });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Solicitudes</h1>
          <p className="text-sm text-white/40 mt-1">
            Vacaciones, permisos y novedades de nómina centralizados
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva Solicitud
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
          <p className="text-xs text-white/40 font-medium">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-5">
          <p className="text-xs text-amber-400 font-medium">Pendientes</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.pendientes}</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-5">
          <p className="text-xs text-emerald-400 font-medium">Aprobadas</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.aprobadas}</p>
        </div>
        <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-5">
          <p className="text-xs text-red-400 font-medium">Rechazadas</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.rechazadas}</p>
        </div>
      </div>

      {/* New solicitud form */}
      {showForm && (
        <div className="rounded-2xl bg-white/[0.03] border border-indigo-500/20 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-lg font-semibold text-white mb-6">Nueva Solicitud</h3>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as SolicitudTipo })}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                >
                  <option value="vacaciones" className="bg-gray-900">Vacaciones</option>
                  <option value="permiso" className="bg-gray-900">Permiso</option>
                  <option value="novedad_nomina" className="bg-gray-900">Novedad de Nómina</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Título</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ej: Vacaciones de marzo"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.fechaInicio}
                  onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 [color-scheme:dark]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Fecha Fin</label>
                <input
                  type="date"
                  value={formData.fechaFin}
                  onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 [color-scheme:dark]"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Descripción</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={3}
                placeholder="Detalla tu solicitud..."
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/60 text-sm font-medium hover:bg-white/[0.08] transition-all">
                Cancelar
              </button>
              <button type="submit" className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors">
                Enviar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["todas", "vacaciones", "permiso", "novedad_nomina"] as const).map((tipo) => (
          <button
            key={tipo}
            onClick={() => setTipoFilter(tipo)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tipoFilter === tipo
                ? "bg-white/[0.08] text-white border border-white/[0.1]"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            {tipo === "todas" ? "📋 Todas" : `${tipoLabels[tipo].icon} ${tipoLabels[tipo].label}`}
          </button>
        ))}
      </div>

      {/* Solicitudes list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-12 text-center">
            <p className="text-white/30 text-sm">No hay solicitudes registradas</p>
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${tipoLabels[s.tipo].color}`}>
                      {tipoLabels[s.tipo].icon} {tipoLabels[s.tipo].label}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${estadoColors[s.estado]}`}>
                      {s.estado.charAt(0).toUpperCase() + s.estado.slice(1)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{s.titulo}</h3>
                  <p className="text-sm text-white/40 mt-1">{s.descripcion}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                    <span>📅 {s.fechaInicio} → {s.fechaFin}</span>
                    <span>Creada: {s.fechaCreacion}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-white/20">{s.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
