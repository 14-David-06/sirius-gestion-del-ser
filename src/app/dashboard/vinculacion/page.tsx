"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

type VinculacionTab = "activos" | "inactivos" | "proceso";

export default function VinculacionPage() {
  const [personal, setPersonal] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<VinculacionTab>("activos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar datos");
        return res.json();
      })
      .then((d) => setPersonal(d.personal))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando personal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-white">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const activos = personal.filter((p) => p.fields["Estado de actividad"] === "Activo");
  const inactivos = personal.filter((p) => p.fields["Estado de actividad"] === "Inactivo" || p.fields["Estado de actividad"] === "Retirado");
  const enProceso = personal.filter((p) => p.fields["Estado de actividad"] === "En proceso" || p.fields["Estado de actividad"] === "Pendiente");

  const currentList = tab === "activos" ? activos : tab === "inactivos" ? inactivos : enProceso;

  const filtered = currentList.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      ((p.fields["Nombre completo"] as string) || "").toLowerCase().includes(s) ||
      ((p.fields["ID Empleado"] as string) || "").toLowerCase().includes(s) ||
      ((p.fields["Correo electrónico"] as string) || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400 font-medium">Vinculados (Activos)</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{activos.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-400 font-medium">Desvinculados</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{inactivos.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-400 font-medium">En Proceso</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{enProceso.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          {([
            { key: "activos" as VinculacionTab, label: "Activos", count: activos.length },
            { key: "inactivos" as VinculacionTab, label: "Desvinculados", count: inactivos.length },
            { key: "proceso" as VinculacionTab, label: "En Proceso", count: enProceso.length },
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
            placeholder="Buscar empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        title={tab === "activos" ? "Personal Vinculado" : tab === "inactivos" ? "Personal Desvinculado" : "En Proceso de Vinculación"}
        subtitle={`${filtered.length} empleados`}
        icon="👥"
        headers={["ID Empleado", "Nombre Completo", "Tipo", "Estado", "Correo", "Teléfono"]}
      >
        {filtered.map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.03]">
            <td className="px-6 py-4 text-sm font-medium text-white font-mono">
              {(p.fields["ID Empleado"] as string) || "—"}
            </td>
            <td className="px-6 py-4 text-sm font-medium text-white">
              {(p.fields["Nombre completo"] as string) || "—"}
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(p.fields["Tipo Personal"] as string) || "—"}
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={p.fields["Estado de actividad"] as string} />
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(p.fields["Correo electrónico"] as string) || "—"}
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(p.fields["Teléfono"] as string) || "—"}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
