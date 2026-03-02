"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import DataTable from "@/components/DataTable";
import CumplimientoChart from "@/components/CumplimientoChart";

type TabKey =
  | "resumen"
  | "contratos"
  | "checklist"
  | "cumplimiento"
  | "documentos"
  | "personal";

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
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("resumen");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
            className="mt-6 px-5 py-2.5 bg-white text-white rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "resumen", label: "Resumen", icon: "📊" },
    { key: "contratos", label: "Contratos", icon: "📄" },
    { key: "checklist", label: "Lista de Chequeo", icon: "✅" },
    { key: "cumplimiento", label: "Cumplimiento", icon: "📋" },
    { key: "documentos", label: "Tipos de Documento", icon: "📁" },
    { key: "personal", label: "Personal", icon: "👥" },
  ];

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 bg-white/[0.06] backdrop-blur-md border border-white/[0.1] rounded-xl flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">
                    Sirius Gestión del Ser
                  </h1>
                  <p className="text-[11px] text-white/40">Panel de Control</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Conectado</span>
              </div>
              <span className="text-xs text-white/30">
                {new Date().toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all text-xs font-medium disabled:opacity-40"
                title="Cerrar sesión"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] bg-gray-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-lg shadow-white/[0.02]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* RESUMEN */}
        {activeTab === "resumen" && (
          <div className="space-y-8">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CumplimientoChart
                cumplidos={data.stats.cumplidos}
                pendientes={data.stats.pendientes}
                enProceso={data.stats.enProceso}
              />
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                    ✅
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Estado Lista de Chequeo</h3>
                    <p className="text-sm text-white/40">{data.stats.totalChecklist} items totales</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden flex mb-8">
                  {checklistStats.cumplido > 0 && (
                    <div
                      className="bg-emerald-400 h-full transition-all duration-700"
                      style={{
                        width: `${(checklistStats.cumplido / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                  {checklistStats.enProceso > 0 && (
                    <div
                      className="bg-amber-400 h-full transition-all duration-700"
                      style={{
                        width: `${(checklistStats.enProceso / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                  {checklistStats.pendiente > 0 && (
                    <div
                      className="bg-red-400 h-full transition-all duration-700"
                      style={{
                        width: `${(checklistStats.pendiente / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-2.5 h-8 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-xs text-white/40">Cumplido</p>
                      <p className="text-lg font-bold text-white">{checklistStats.cumplido}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-2.5 h-8 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-xs text-white/40">En proceso</p>
                      <p className="text-lg font-bold text-white">{checklistStats.enProceso}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-2.5 h-8 rounded-full bg-red-400" />
                    <div>
                      <p className="text-xs text-white/40">Pendiente</p>
                      <p className="text-lg font-bold text-white">{checklistStats.pendiente}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-2.5 h-8 rounded-full bg-gray-500" />
                    <div>
                      <p className="text-xs text-white/40">No aplica</p>
                      <p className="text-lg font-bold text-white">{checklistStats.noAplica}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
        )}

        {/* CONTRATOS */}
        {activeTab === "contratos" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="Total Contratos"
                value={data.stats.totalContratos}
                icon="📄"
                color="purple"
              />
              <StatCard
                title="Vigentes"
                value={data.stats.contratosVigentes}
                icon="✅"
                color="green"
              />
              <StatCard
                title="Otros Estados"
                value={data.stats.totalContratos - data.stats.contratosVigentes}
                icon="📌"
                color="orange"
              />
            </div>
            <DataTable
              title="Todos los Contratos"
              subtitle="Contratos vinculados con Personal de Nómina Core"
              icon="📄"
              headers={[
                "ID Contrato",
                "Empleado",
                "ID Empleado",
                "Tipo",
                "Fecha Inicio",
                "Fecha Fin",
                "Estado",
                "Observaciones",
              ]}
            >
              {data.contratos.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.03]">
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {(c.fields["ID Contrato"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-white">
                      {(c.fields["_nombreEmpleado"] as string) || "—"}
                    </p>
                    <p className="text-xs text-white/30">
                      {(c.fields["_estadoEmpleado"] as string) || ""}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/40 font-mono">
                    {(c.fields["ID_Empleado"] as string) || "—"}
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
        )}

        {/* LISTA DE CHEQUEO */}
        {activeTab === "checklist" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatCard
                title="Total Items"
                value={data.stats.totalChecklist}
                icon="✅"
                color="indigo"
              />
              <StatCard
                title="Cumplidos"
                value={checklistStats.cumplido}
                icon="✓"
                color="green"
              />
              <StatCard
                title="Pendientes"
                value={checklistStats.pendiente}
                icon="⏳"
                color="red"
              />
              <StatCard
                title="En Proceso"
                value={checklistStats.enProceso}
                icon="🔄"
                color="orange"
              />
            </div>
            <DataTable
              title="Lista de Chequeo - Sirianos"
              subtitle="Documentos requeridos por capítulo legal"
              icon="✅"
              headers={[
                "Documento",
                "Capítulo",
                "Periodicidad",
                "Área",
                "Responsable",
                "Custodio",
                "Estado",
                "Fecha Cumplimiento",
              ]}
            >
              {data.listaChequeo.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.03]">
                  <td className="px-6 py-4 text-sm font-medium text-white max-w-xs">
                    {(item.fields["Documento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50 max-w-[200px] truncate">
                    {(item.fields["Capítulo"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(item.fields["Periodicidad"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(item.fields["Área Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-white">
                        {(item.fields["_nombreResponsable"] as string) || "—"}
                      </p>
                      <p className="text-xs text-white/30 font-mono">
                        {(item.fields[
                          "ID_Colaborador_Responsable"
                        ] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-white">
                        {(item.fields["_nombreCustodio"] as string) || "—"}
                      </p>
                      <p className="text-xs text-white/30 font-mono">
                        {(item.fields["ID_Custodio"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.fields["Estado"] as string} />
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(item.fields["Fecha de cumplimiento"] as string) || "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}

        {/* CUMPLIMIENTO */}
        {activeTab === "cumplimiento" && (
          <div className="space-y-6">
            <CumplimientoChart
              cumplidos={data.stats.cumplidos}
              pendientes={data.stats.pendientes}
              enProceso={data.stats.enProceso}
            />
            <DataTable
              title="Registros de Cumplimiento"
              subtitle="Trazabilidad documental por empleado"
              icon="📋"
              headers={[
                "ID Registro",
                "Empleado",
                "Tipo Documento",
                "Período",
                "Estado",
                "Fecha Cumplimiento",
                "Responsable",
                "Fecha Carga",
              ]}
            >
              {data.registroCumplimiento.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-6 py-4 text-sm font-medium text-white font-mono">
                    {(r.fields["ID Registro"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {(r.fields["_nombreEmpleado"] as string) || "—"}
                      </p>
                      <p className="text-xs text-white/30 font-mono">
                        {(r.fields["ID_Empleado"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {Array.isArray(r.fields["Tipo Documento"])
                      ? `${(r.fields["Tipo Documento"] as string[]).length} doc(s)`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(r.fields["Período"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={r.fields["Estado"] as string} />
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(r.fields["Fecha de Cumplimiento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-white">
                        {(r.fields["_nombreResponsable"] as string) || "—"}
                      </p>
                      <p className="text-xs text-white/30 font-mono">
                        {(r.fields["ID_Responsable"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(r.fields["Fecha de Carga"] as string) || "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}

        {/* TIPOS DE DOCUMENTO */}
        {activeTab === "documentos" && (
          <div className="space-y-6">
            <StatCard
              title="Tipos de Documento"
              value={data.stats.totalDocumentos}
              icon="📁"
              color="cyan"
              subtitle="Catálogo maestro de documentos legales"
            />
            <DataTable
              title="Catálogo de Tipos de Documento"
              subtitle="Clasificación documental por capítulo legal"
              icon="📁"
              headers={[
                "Código",
                "Nombre del Documento",
                "Capítulo",
                "Periodicidad",
                "Área Responsable",
                "Aplica por Trabajador",
                "Responsable",
                "Custodio",
              ]}
            >
              {data.tipoDocumento.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.03]">
                  <td className="px-6 py-4 text-sm font-medium text-white font-mono">
                    {(d.fields["Código"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white max-w-xs">
                    {(d.fields["Nombre del Documento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50 max-w-[200px] truncate">
                    {(d.fields["Capítulo"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(d.fields["Periodicidad"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/50">
                    {(d.fields["Área Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    {d.fields["Aplica por Trabajador"] ? (
                      <span className="text-emerald-400 font-bold">✓</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/40 font-mono">
                    {(d.fields["ID_Colaborador_Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/40 font-mono">
                    {(d.fields["ID_Custodio"] as string) || "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}

        {/* PERSONAL */}
        {activeTab === "personal" && (
          <div className="space-y-6">
            <StatCard
              title="Total Personal"
              value={data.stats.totalEmpleados}
              icon="👥"
              color="blue"
              subtitle="Empleados registrados en Nomina Core"
            />
            <DataTable
              title="Personal — Sirius Nomina Core"
              subtitle="Empleados vinculados al sistema de gestión"
              icon="👥"
              headers={[
                "ID Empleado",
                "Nombre Completo",
                "Tipo",
                "Estado",
                "Correo",
                "Teléfono",
              ]}
            >
              {data.personal.map((p) => (
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
                    <StatusBadge
                      status={p.fields["Estado de actividad"] as string}
                    />
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
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-gray-950 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Volver al inicio
            </Link>
            <p className="text-xs text-white/20">Powered by Next.js · Airtable · Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
