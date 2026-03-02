"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";
import CumplimientoChart from "@/components/CumplimientoChart";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface DashboardData {
  contratos: AirtableRecord[];
  listaChequeo: AirtableRecord[];
  registroCumplimiento: AirtableRecord[];
  tipoDocumento: AirtableRecord[];
  personal: AirtableRecord[];
  stats: {
    totalContratos: number;
    contratosVigentes: number;
    totalRegistros: number;
    cumplidos: number;
    pendientes: number;
    enProceso: number;
    totalChecklist: number;
    totalDocumentos: number;
    totalEmpleados: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar datos");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">
            Cargando datos del dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-white/[0.03] border border-red-500/20 p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mt-4">
            Error al cargar
          </h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const checklistStats = {
    cumplido: data.listaChequeo.filter(
      (r) => r.fields["Estado"] === "Cumplido"
    ).length,
    pendiente: data.listaChequeo.filter(
      (r) => r.fields["Estado"] === "Pendiente"
    ).length,
    enProceso: data.listaChequeo.filter(
      (r) => r.fields["Estado"] === "En proceso"
    ).length,
    noAplica: data.listaChequeo.filter(
      (r) => r.fields["Estado"] === "No aplica"
    ).length,
  };

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Empleados"
          value={data.stats.totalEmpleados}
          icon="👥"
          color="blue"
          subtitle="Nómina Core"
        />
        <StatCard
          title="Contratos"
          value={data.stats.totalContratos}
          icon="📄"
          color="purple"
          subtitle={`${data.stats.contratosVigentes} vigentes`}
        />
        <StatCard
          title="Registros de Cumplimiento"
          value={data.stats.totalRegistros}
          icon="📋"
          color="green"
          subtitle={`${data.stats.cumplidos} cumplidos`}
        />
        <StatCard
          title="Lista de Chequeo"
          value={data.stats.totalChecklist}
          icon="✅"
          color="orange"
          subtitle={`${checklistStats.cumplido} cumplidos`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CumplimientoChart
          cumplidos={data.stats.cumplidos}
          pendientes={data.stats.pendientes}
          enProceso={data.stats.enProceso}
        />
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/5">
              ✅
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Estado Lista de Chequeo</h3>
              <p className="text-sm text-white/40">{data.stats.totalChecklist} items totales</p>
            </div>
          </div>
          <div className="w-full h-4 bg-white/[0.06] rounded-full overflow-hidden flex mb-8 ring-1 ring-white/[0.04]">
            {checklistStats.cumplido > 0 && (
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-700 shadow-lg shadow-emerald-500/20"
                style={{
                  width: `${(checklistStats.cumplido / data.stats.totalChecklist) * 100}%`,
                }}
              />
            )}
            {checklistStats.enProceso > 0 && (
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-700 shadow-lg shadow-amber-500/20"
                style={{
                  width: `${(checklistStats.enProceso / data.stats.totalChecklist) * 100}%`,
                }}
              />
            )}
            {checklistStats.pendiente > 0 && (
              <div
                className="bg-gradient-to-r from-red-500 to-red-400 h-full transition-all duration-700 shadow-lg shadow-red-500/20"
                style={{
                  width: `${(checklistStats.pendiente / data.stats.totalChecklist) * 100}%`,
                }}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-white/[0.06] ring-1 ring-emerald-400/20">
              <div className="w-2.5 h-10 rounded-full bg-emerald-400 shadow-lg" />
              <div>
                <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Cumplido</p>
                <p className="text-2xl font-extrabold text-white">{checklistStats.cumplido}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-transparent border border-white/[0.06] ring-1 ring-amber-400/20">
              <div className="w-2.5 h-10 rounded-full bg-amber-400 shadow-lg" />
              <div>
                <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">En proceso</p>
                <p className="text-2xl font-extrabold text-white">{checklistStats.enProceso}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-red-500/15 to-transparent border border-white/[0.06] ring-1 ring-red-400/20">
              <div className="w-2.5 h-10 rounded-full bg-red-400 shadow-lg" />
              <div>
                <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Pendiente</p>
                <p className="text-2xl font-extrabold text-white">{checklistStats.pendiente}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-500/15 to-transparent border border-white/[0.06] ring-1 ring-gray-400/20">
              <div className="w-2.5 h-10 rounded-full bg-gray-500 shadow-lg" />
              <div>
                <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">No aplica</p>
                <p className="text-2xl font-extrabold text-white">{checklistStats.noAplica}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent contracts table */}
      <DataTable
        title="Contratos Recientes"
        subtitle="Últimos contratos registrados con datos del empleado"
        icon="📄"
        headers={[
          "ID Contrato",
          "Empleado",
          "Tipo",
          "Inicio",
          "Fin",
          "Estado",
        ]}
      >
        {data.contratos.slice(0, 5).map((c) => (
          <tr key={c.id} className="hover:bg-white/[0.03]">
            <td className="px-6 py-4 text-sm font-medium text-white">
              {(c.fields["ID Contrato"] as string) || "—"}
            </td>
            <td className="px-6 py-4">
              <div>
                <p className="text-sm font-medium text-white">
                  {(c.fields["_nombreEmpleado"] as string) || "—"}
                </p>
                <p className="text-xs text-white/30">
                  {(c.fields["ID_Empleado"] as string) || ""}
                </p>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(c.fields["Tipo de Contrato"] as string) || "—"}
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(c.fields["Fecha Inicio"] as string) || "—"}
            </td>
            <td className="px-6 py-4 text-sm text-white/50">
              {(c.fields["Fecha Fin"] as string) || "—"}
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={c.fields["Estado"] as string} />
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
