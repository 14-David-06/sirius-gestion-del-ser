"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface ContratosData {
  contratos: AirtableRecord[];
  stats: {
    totalContratos: number;
    contratosVigentes: number;
  };
}

export default function ContratosPage() {
  const [data, setData] = useState<ContratosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar datos");
        return res.json();
      })
      .then((d) =>
        setData({
          contratos: d.contratos,
          stats: {
            totalContratos: d.stats.totalContratos,
            contratosVigentes: d.stats.contratosVigentes,
          },
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando contratos...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-black/30 border border-white/[0.1] p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-white mt-4">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const filtered = data.contratos.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      ((c.fields["ID Contrato"] as string) || "").toLowerCase().includes(s) ||
      ((c.fields["_nombreEmpleado"] as string) || "").toLowerCase().includes(s) ||
      ((c.fields["Tipo de Contrato"] as string) || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Contratos" value={data.stats.totalContratos} icon="📄" color="purple" />
        <StatCard title="Vigentes" value={data.stats.contratosVigentes} icon="✅" color="green" />
        <StatCard
          title="Otros Estados"
          value={data.stats.totalContratos - data.stats.contratosVigentes}
          icon="📌"
          color="orange"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por ID, empleado o tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-black/20 border border-white/[0.12] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.25] focus:ring-1 focus:ring-white/[0.15] transition-all text-sm backdrop-blur-sm"
        />
      </div>

      <DataTable
        title="Todos los Contratos"
        subtitle={`${filtered.length} contratos encontrados`}
        icon="📄"
        headers={["ID Contrato", "Empleado", "Tipo", "Fecha Inicio", "Fecha Fin", "Estado", "Observaciones"]}
      >
        {filtered.map((c) => (
          <tr key={c.id} className="hover:bg-black/20">
            <td className="px-6 py-4 text-sm font-medium text-white">
              {(c.fields["ID Contrato"] as string) || "—"}
            </td>
            <td className="px-6 py-4">
              <p className="text-sm font-medium text-white">{(c.fields["_nombreEmpleado"] as string) || "—"}</p>
              <p className="text-xs text-white/30">{(c.fields["ID_Empleado"] as string) || ""}</p>
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
            <td className="px-6 py-4 text-sm text-white/40 max-w-xs truncate">
              {(c.fields["Observaciones"] as string) || "—"}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
