"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("resumen");

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 font-medium">
            Cargando datos del dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-lg font-semibold text-gray-900 mt-4">
            Error al cargar
          </h2>
          <p className="text-gray-500 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    Sirius Gestión del Ser
                  </h1>
                  <p className="text-xs text-gray-500">Panel de Control</p>
                </div>
              </Link>
            </div>
            <div className="text-sm text-gray-400">
              Última actualización:{" "}
              {new Date().toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto py-2" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{tab.icon}</span>
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ✅ Estado Lista de Chequeo
                </h3>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-6">
                  {checklistStats.cumplido > 0 && (
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(checklistStats.cumplido / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                  {checklistStats.enProceso > 0 && (
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${(checklistStats.enProceso / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                  {checklistStats.pendiente > 0 && (
                    <div
                      className="bg-red-400 h-full"
                      style={{
                        width: `${(checklistStats.pendiente / data.stats.totalChecklist) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-600">
                      Cumplido: <strong>{checklistStats.cumplido}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-gray-600">
                      En proceso: <strong>{checklistStats.enProceso}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-sm text-gray-600">
                      Pendiente: <strong>{checklistStats.pendiente}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <span className="text-sm text-gray-600">
                      No aplica: <strong>{checklistStats.noAplica}</strong>
                    </span>
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
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {(c.fields["ID Contrato"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(c.fields["_nombreEmpleado"] as string) || "—"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(c.fields["ID_Empleado"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(c.fields["Tipo de Contrato"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(c.fields["Fecha Inicio"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
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
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {(c.fields["ID Contrato"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {(c.fields["_nombreEmpleado"] as string) || "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(c.fields["_estadoEmpleado"] as string) || ""}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {(c.fields["ID_Empleado"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(c.fields["Tipo de Contrato"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(c.fields["Fecha Inicio"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(c.fields["Fecha Fin"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.fields["Estado"] as string} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
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
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs">
                    {(item.fields["Documento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                    {(item.fields["Capítulo"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(item.fields["Periodicidad"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(item.fields["Área Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900">
                        {(item.fields["_nombreResponsable"] as string) || "—"}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {(item.fields[
                          "ID_Colaborador_Responsable"
                        ] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900">
                        {(item.fields["_nombreCustodio"] as string) || "—"}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {(item.fields["ID_Custodio"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.fields["Estado"] as string} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
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
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">
                    {(r.fields["ID Registro"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(r.fields["_nombreEmpleado"] as string) || "—"}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {(r.fields["ID_Empleado"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {Array.isArray(r.fields["Tipo Documento"])
                      ? `${(r.fields["Tipo Documento"] as string[]).length} doc(s)`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(r.fields["Período"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={r.fields["Estado"] as string} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(r.fields["Fecha de Cumplimiento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900">
                        {(r.fields["_nombreResponsable"] as string) || "—"}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {(r.fields["ID_Responsable"] as string) || ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
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
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">
                    {(d.fields["Código"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    {(d.fields["Nombre del Documento"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                    {(d.fields["Capítulo"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(d.fields["Periodicidad"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(d.fields["Área Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    {d.fields["Aplica por Trabajador"] ? (
                      <span className="text-emerald-500 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {(d.fields["ID_Colaborador_Responsable"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
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
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">
                    {(p.fields["ID Empleado"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {(p.fields["Nombre completo"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(p.fields["Tipo Personal"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={p.fields["Estado de actividad"] as string}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(p.fields["Correo electrónico"] as string) || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(p.fields["Teléfono"] as string) || "—"}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <Link href="/" className="hover:text-gray-600 transition-colors">
              ← Volver al inicio
            </Link>
            <p>Datos: Airtable · Gestión del Ser + Nómina Core</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
