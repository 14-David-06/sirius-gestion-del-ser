"use client";

import { useEffect, useState, useCallback } from "react";
import StatusBadge from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface Contrato {
  id: string;
  idContrato: string;
  idEmpleado: string;
  nombreEmpleado: string;
  tipoContrato: string;
  fechaInicio: string;
  fechaFin: string | null;
  salarioBase: number;
  periodicidadPago: string;
  estado: string;
  version: number;
  motivoTerminacion: string | null;
  fechaTerminacion: string | null;
  observaciones: string | null;
  documentoUrl: string | null;
  creadoPor: string;
}

interface HistorialEntry {
  id: string;
  accion: string;
  campoModificado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  modificadoPor: string;
  timestamp: string;
}

interface Empleado {
  id: string;
  fields: Record<string, unknown>;
}

interface Alerta {
  id: string;
  idAlerta: string;
  idContrato: string;
  idEmpleado: string;
  nombreEmpleado: string;
  tipoAlerta: string;
  fechaVencimiento: string;
  fechaAlerta: string;
  leida: boolean;
}

type ModalTipo = "crear" | "detalle" | "terminar" | "editar" | null;

const TIPO_LABELS: Record<string, string> = {
  fijo: "A término fijo",
  indefinido: "Indefinido",
  obra_labor: "Obra o labor",
  aprendizaje: "Aprendizaje",
  prestacion_servicios: "Prestación de servicios",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [year, month, day] = fecha.split("-");
  return `${day}/${month}/${year}`;
}

function diasRestantes(fechaFin: string | null): number | null {
  if (!fechaFin) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal state
  const [modal, setModal] = useState<ModalTipo>(null);
  const [contratoSeleccionado, setContratoSeleccionado] = useState<Contrato | null>(null);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Empleados para el dropdown
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  // Form crear contrato
  const [formCrear, setFormCrear] = useState({
    id_empleado: "",
    tipo_contrato: "indefinido",
    fecha_inicio: "",
    fecha_fin: "",
    salario_base: "",
    periodicidad_pago: "mensual",
    observaciones: "",
  });

  // Form terminar contrato
  const [formTerminar, setFormTerminar] = useState({
    motivo: "",
    fecha_terminacion: new Date().toISOString().split("T")[0],
    estado: "terminado",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // PDF upload/download
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfMensaje, setPdfMensaje] = useState<string | null>(null);

  // Alertas de vencimiento (solo para admin)
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [alertasExpandidas, setAlertasExpandidas] = useState(false);

  // ─── Cargar datos ──────────────────────────────────────────────────────────

  const cargarContratos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contratos");
      if (!res.ok) throw new Error("Error al cargar contratos");
      const data = await res.json();
      setContratos(data.contratos || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarAlertas = useCallback(async () => {
    try {
      const res = await fetch("/api/contratos/alertas");
      if (!res.ok) return;
      const data = await res.json();
      setAlertas(data.alertas || []);
      setAlertasNoLeidas(data.noLeidas || 0);
    } catch {
      // Silenciosamente fallar si no hay permisos
    }
  }, []);

  const marcarAlertaLeida = async (alertaId: string) => {
    try {
      const res = await fetch(`/api/contratos/alertas/${alertaId}/read`, { method: "PATCH" });
      if (res.ok) {
        setAlertas((prev) => prev.map((a) => a.id === alertaId ? { ...a, leida: true } : a));
        setAlertasNoLeidas((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Silenciosamente fallar
    }
  };

  useEffect(() => {
    cargarContratos();

    // Detectar si es admin leyendo el rol del JWT (lo inferimos desde la respuesta de la API)
    fetch("/api/auth/check-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.rol) {
          const roles = ["Admin Depto", "Super Admin", "Avanzado"];
          const esAdmin = roles.some((r) => d.rol === r || d.rol?.includes(r));
          setIsAdmin(esAdmin);
          // Cargar alertas solo si es admin
          if (esAdmin) {
            cargarAlertas();
          }
        }
      })
      .catch(() => {});
  }, [cargarContratos, cargarAlertas]);

  // Cargar empleados al abrir modal crear
  useEffect(() => {
    if (modal === "crear" && empleados.length === 0) {
      fetch("/api/vinculacion")
        .then((r) => r.ok ? r.json() : { personal: [] })
        .then((d) => setEmpleados(d.personal || []))
        .catch(() => {});
    }
  }, [modal, empleados.length]);

  // ─── PDF Upload / Download ────────────────────────────────────────────────

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    if (!contratoSeleccionado || !e.target.files?.length) return;
    const archivo = e.target.files[0];
    setUploadingPdf(true);
    setPdfMensaje(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const res = await fetch(`/api/contratos/${contratoSeleccionado.id}/upload-pdf`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir PDF");
      setPdfMensaje("PDF subido correctamente");
      // Actualizar contrato en la lista local
      setContratos((prev) =>
        prev.map((c) =>
          c.id === contratoSeleccionado.id ? { ...c, documentoUrl: data.s3Key } : c
        )
      );
      setContratoSeleccionado((prev) => prev ? { ...prev, documentoUrl: data.s3Key } : prev);
    } catch (err) {
      setPdfMensaje(`Error: ${(err as Error).message}`);
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function handleDownloadPdf() {
    if (!contratoSeleccionado) return;
    try {
      const res = await fetch(`/api/contratos/${contratoSeleccionado.id}/upload-pdf`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar URL");
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      setPdfMensaje(`Error: ${(err as Error).message}`);
    }
  }

  // ─── Historial ────────────────────────────────────────────────────────────

  async function abrirDetalle(contrato: Contrato) {
    setContratoSeleccionado(contrato);
    setPdfMensaje(null);
    setModal("detalle");
    setLoadingHistorial(true);
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistorial(data.historial || []);
      }
    } catch {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }

  // ─── Crear contrato ───────────────────────────────────────────────────────

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        id_empleado: formCrear.id_empleado,
        tipo_contrato: formCrear.tipo_contrato,
        fecha_inicio: formCrear.fecha_inicio,
        salario_base: Number(formCrear.salario_base),
        periodicidad_pago: formCrear.periodicidad_pago,
      };
      if (formCrear.fecha_fin) body.fecha_fin = formCrear.fecha_fin;
      if (formCrear.observaciones) body.observaciones = formCrear.observaciones;

      const res = await fetch("/api/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear contrato");

      setModal(null);
      setFormCrear({ id_empleado: "", tipo_contrato: "indefinido", fecha_inicio: "", fecha_fin: "", salario_base: "", periodicidad_pago: "mensual", observaciones: "" });
      await cargarContratos();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Terminar contrato ────────────────────────────────────────────────────

  async function handleTerminar(e: React.FormEvent) {
    e.preventDefault();
    if (!contratoSeleccionado) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/contratos/${contratoSeleccionado.id}/terminate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formTerminar),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al terminar contrato");

      setModal(null);
      await cargarContratos();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Filtro ───────────────────────────────────────────────────────────────

  const filtrados = contratos.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.idContrato.toLowerCase().includes(s) ||
      c.nombreEmpleado.toLowerCase().includes(s) ||
      c.idEmpleado.toLowerCase().includes(s) ||
      (TIPO_LABELS[c.tipoContrato] || c.tipoContrato).toLowerCase().includes(s)
    );
  });

  const activos = contratos.filter((c) => c.estado === "activo").length;
  const porVencer = contratos.filter((c) => {
    if (c.estado !== "activo" || !c.fechaFin) return false;
    const dias = diasRestantes(c.fechaFin);
    return dias !== null && dias <= 30 && dias >= 0;
  }).length;
  const terminados = contratos.filter((c) => c.estado === "terminado" || c.estado === "vencido").length;

  // ─── Render ───────────────────────────────────────────────────────────────

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

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="rounded-2xl bg-black/30 border border-white/[0.1] p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-white">Error al cargar</h2>
          <p className="text-white/40 mt-2 text-sm">{error}</p>
          <button onClick={cargarContratos} className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total" value={contratos.length} icon="📄" color="purple" />
        <StatCard title="Activos" value={activos} icon="✅" color="green" />
        <StatCard title="Vencen pronto" value={porVencer} icon="⚠️" color="orange" />
        <StatCard title="Terminados" value={terminados} icon="🔒" color="red" />
      </div>

      {/* Banner de alertas de vencimiento (solo admin) */}
      {isAdmin && alertas.length > 0 && (
        <div className="rounded-xl bg-black/30 border border-white/[0.12] overflow-hidden backdrop-blur-sm">
          {/* Cabecera clickeable */}
          <button
            onClick={() => setAlertasExpandidas(!alertasExpandidas)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔔</span>
              <span className="text-sm text-white/80">
                <span className="font-semibold">Alertas de vencimiento</span>
                {alertasNoLeidas > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {alertasNoLeidas} nueva{alertasNoLeidas > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-white/40 transition-transform ${alertasExpandidas ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Lista de alertas expandida */}
          {alertasExpandidas && (
            <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
              {alertas.map((alerta) => {
                // Colores según tipo de alerta
                const esUrgente = alerta.tipoAlerta === "7_dias";
                const esMedia = alerta.tipoAlerta === "15_dias";
                const colorBg = esUrgente ? "bg-red-500/10" : esMedia ? "bg-yellow-500/10" : "bg-green-500/10";
                const colorBorder = esUrgente ? "border-red-500/30" : esMedia ? "border-yellow-500/30" : "border-green-500/30";
                const colorText = esUrgente ? "text-red-400" : esMedia ? "text-yellow-400" : "text-green-400";
                const emoji = esUrgente ? "🔴" : esMedia ? "🟡" : "🟢";
                const diasLabel = alerta.tipoAlerta === "7_dias" ? "7 días" : alerta.tipoAlerta === "15_dias" ? "15 días" : "30 días";

                // Buscar el contrato correspondiente para poder abrirlo
                const contratoRelacionado = contratos.find((c) => c.idContrato === alerta.idContrato);

                return (
                  <div
                    key={alerta.id}
                    className={`flex items-center justify-between px-5 py-3 ${alerta.leida ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-medium ${colorBg} ${colorText} border ${colorBorder}`}>
                        {emoji} {diasLabel}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">
                          <span className="font-medium">{alerta.nombreEmpleado}</span>
                          <span className="text-white/40 ml-2">({alerta.idContrato})</span>
                        </p>
                        <p className="text-xs text-white/40">
                          Vence: {formatFecha(alerta.fechaVencimiento)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {contratoRelacionado && (
                        <button
                          onClick={() => abrirDetalle(contratoRelacionado)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                        >
                          Ver
                        </button>
                      )}
                      {!alerta.leida && (
                        <button
                          onClick={() => marcarAlertaLeida(alerta.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs transition-colors"
                          title="Marcar como leída"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {alertas.length === 0 && (
                <p className="px-5 py-4 text-sm text-white/30 text-center">No hay alertas pendientes</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerta simple contratos por vencer (cuando no hay alertas del cron pero sí hay contratos próximos) */}
      {(!isAdmin || alertas.length === 0) && porVencer > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm">
          <span className="text-lg">⚠️</span>
          <span>
            <span className="font-semibold">{porVencer} contrato{porVencer > 1 ? "s" : ""}</span> vence{porVencer > 1 ? "n" : ""} en los próximos 30 días.
          </span>
        </div>
      )}

      {/* Header + acciones */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por empleado, ID o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/[0.12] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 text-sm backdrop-blur-sm"
          />
        </div>

        {isAdmin && (
          <button
            onClick={() => { setSaveError(null); setModal("crear"); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <span>+</span> Nuevo contrato
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-2xl bg-black/20 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">
            Contratos laborales
            <span className="ml-2 text-white/30 font-normal">({filtrados.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["ID Contrato", "Empleado", "Tipo", "Vigencia", "Salario", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-white/30 text-sm">
                    {search ? "Sin resultados para la búsqueda" : "No hay contratos registrados"}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => {
                  const dias = diasRestantes(c.fechaFin);
                  const porVencerProximo = dias !== null && dias <= 30 && dias >= 0 && c.estado === "activo";
                  return (
                    <tr key={c.id} className={`hover:bg-white/[0.02] ${porVencerProximo ? "bg-orange-500/5" : ""}`}>
                      <td className="px-5 py-4 text-sm font-mono font-medium text-white/80 whitespace-nowrap">
                        {c.idContrato || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-white">{c.nombreEmpleado || "—"}</p>
                        <p className="text-xs text-white/30">{c.idEmpleado}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-white/60 whitespace-nowrap">
                        {TIPO_LABELS[c.tipoContrato] || c.tipoContrato}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/50">
                        <p>{formatFecha(c.fechaInicio)}</p>
                        {c.fechaFin ? (
                          <p className={`text-xs ${porVencerProximo ? "text-orange-400 font-medium" : "text-white/30"}`}>
                            hasta {formatFecha(c.fechaFin)}
                            {porVencerProximo && dias !== null && ` (${dias}d)`}
                          </p>
                        ) : (
                          <p className="text-xs text-white/20">Indefinido</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-white/60 whitespace-nowrap">
                        {formatCOP(c.salarioBase)}
                        <p className="text-xs text-white/30">{c.periodicidadPago}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={c.estado} />
                        {c.version > 1 && (
                          <span className="ml-2 text-xs text-white/20">v{c.version}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirDetalle(c)}
                            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                          >
                            Ver
                          </button>
                          {isAdmin && c.estado === "activo" && (
                            <button
                              onClick={() => { setContratoSeleccionado(c); setSaveError(null); setFormTerminar({ motivo: "", fecha_terminacion: new Date().toISOString().split("T")[0], estado: "terminado" }); setModal("terminar"); }}
                              className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs transition-colors"
                            >
                              Terminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Crear Contrato ───────────────────────────────────────────── */}
      {modal === "crear" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Nuevo contrato laboral</h3>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleCrear} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Empleado */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Empleado</label>
                <select
                  required
                  value={formCrear.id_empleado}
                  onChange={(e) => setFormCrear((p) => ({ ...p, id_empleado: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                >
                  <option value="">Selecciona un empleado</option>
                  {empleados.map((emp) => {
                    const nombre = emp.fields["Nombre completo"] as string || "";
                    const idEmp = emp.fields["ID Empleado"] as string || "";
                    return (
                      <option key={emp.id} value={idEmp}>{nombre} ({idEmp})</option>
                    );
                  })}
                </select>
              </div>

              {/* Tipo contrato */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Tipo de contrato</label>
                <select
                  value={formCrear.tipo_contrato}
                  onChange={(e) => setFormCrear((p) => ({ ...p, tipo_contrato: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                >
                  {Object.entries(TIPO_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Fecha de inicio</label>
                  <input
                    type="date"
                    required
                    value={formCrear.fecha_inicio}
                    onChange={(e) => setFormCrear((p) => ({ ...p, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Fecha fin
                    {(formCrear.tipo_contrato === "fijo" || formCrear.tipo_contrato === "obra_labor") && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </label>
                  <input
                    type="date"
                    required={formCrear.tipo_contrato === "fijo" || formCrear.tipo_contrato === "obra_labor"}
                    value={formCrear.fecha_fin}
                    onChange={(e) => setFormCrear((p) => ({ ...p, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                  />
                </div>
              </div>

              {/* Salario y periodicidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Salario base (COP)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formCrear.salario_base}
                    onChange={(e) => setFormCrear((p) => ({ ...p, salario_base: e.target.value }))}
                    placeholder="1300000"
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Periodicidad</label>
                  <select
                    value={formCrear.periodicidad_pago}
                    onChange={(e) => setFormCrear((p) => ({ ...p, periodicidad_pago: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Observaciones (opcional)</label>
                <textarea
                  rows={2}
                  value={formCrear.observaciones}
                  onChange={(e) => setFormCrear((p) => ({ ...p, observaciones: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {saving ? "Creando..." : "Crear contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Detalle + Historial ──────────────────────────────────────── */}
      {modal === "detalle" && contratoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{contratoSeleccionado.idContrato || "Contrato"}</h3>
                <p className="text-xs text-white/40">{contratoSeleccionado.nombreEmpleado}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Info del contrato */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Tipo", TIPO_LABELS[contratoSeleccionado.tipoContrato] || contratoSeleccionado.tipoContrato],
                  ["Estado", ""],
                  ["Inicio", formatFecha(contratoSeleccionado.fechaInicio)],
                  ["Fin", formatFecha(contratoSeleccionado.fechaFin)],
                  ["Salario base", formatCOP(contratoSeleccionado.salarioBase)],
                  ["Periodicidad", contratoSeleccionado.periodicidadPago],
                  ["Versión", `v${contratoSeleccionado.version}`],
                  ["Creado por", contratoSeleccionado.creadoPor],
                ].map(([label, val]) => (
                  <div key={label} className="space-y-0.5">
                    <p className="text-xs text-white/30">{label}</p>
                    {label === "Estado" ? (
                      <StatusBadge status={contratoSeleccionado.estado} />
                    ) : (
                      <p className="text-white/80">{val || "—"}</p>
                    )}
                  </div>
                ))}
              </div>

              {contratoSeleccionado.motivoTerminacion && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                  <p className="text-xs text-red-400 mb-1">Motivo de terminación</p>
                  <p className="text-white/70">{contratoSeleccionado.motivoTerminacion}</p>
                </div>
              )}

              {contratoSeleccionado.observaciones && (
                <div className="px-4 py-3 rounded-xl bg-white/[0.04] text-sm">
                  <p className="text-xs text-white/30 mb-1">Observaciones</p>
                  <p className="text-white/60">{contratoSeleccionado.observaciones}</p>
                </div>
              )}

              {/* PDF */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {contratoSeleccionado.documentoUrl && (
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-medium transition-colors"
                  >
                    <span>⬇</span> Descargar PDF
                  </button>
                )}
                {isAdmin && (
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white text-xs font-medium transition-colors cursor-pointer ${uploadingPdf ? "opacity-50 pointer-events-none" : ""}`}>
                    <span>📎</span>
                    {uploadingPdf ? "Subiendo..." : contratoSeleccionado.documentoUrl ? "Reemplazar PDF" : "Subir PDF firmado"}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUploadPdf} disabled={uploadingPdf} />
                  </label>
                )}
                {pdfMensaje && (
                  <p className={`text-xs px-3 py-1 rounded-lg ${pdfMensaje.startsWith("Error") ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                    {pdfMensaje}
                  </p>
                )}
              </div>

              {/* Historial */}
              <div>
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Historial de cambios</h4>
                {loadingHistorial ? (
                  <p className="text-white/30 text-sm">Cargando historial...</p>
                ) : historial.length === 0 ? (
                  <p className="text-white/20 text-sm">Sin registros de cambios</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map((h) => (
                      <div key={h.id} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center pt-0.5">
                          <div className="w-2 h-2 rounded-full bg-indigo-500/60 shrink-0" />
                          <div className="w-px flex-1 bg-white/[0.05] mt-1" />
                        </div>
                        <div className="pb-2">
                          <p className="text-white/60">
                            <span className="font-medium text-white/80">{h.modificadoPor}</span>
                            {" "}—{" "}
                            <span className="text-indigo-400">{h.accion}</span>
                            {h.campoModificado && ` campo "${h.campoModificado}"`}
                          </p>
                          {h.valorAnterior && h.valorNuevo && (
                            <p className="text-white/30 mt-0.5">
                              {h.valorAnterior} → <span className="text-white/50">{h.valorNuevo}</span>
                            </p>
                          )}
                          <p className="text-white/20 mt-0.5">
                            {h.timestamp ? new Date(h.timestamp).toLocaleString("es-CO") : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Terminar Contrato ────────────────────────────────────────── */}
      {modal === "terminar" && contratoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Terminar contrato</h3>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleTerminar} className="p-6 space-y-4">
              <p className="text-sm text-white/50">
                Contrato <span className="text-white/80 font-mono">{contratoSeleccionado.idContrato}</span> de{" "}
                <span className="text-white/80">{contratoSeleccionado.nombreEmpleado}</span>
              </p>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Acción</label>
                <select
                  value={formTerminar.estado}
                  onChange={(e) => setFormTerminar((p) => ({ ...p, estado: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none"
                >
                  <option value="terminado">Terminar definitivamente</option>
                  <option value="suspendido">Suspender temporalmente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Fecha efectiva</label>
                <input
                  type="date"
                  required
                  value={formTerminar.fecha_terminacion}
                  onChange={(e) => setFormTerminar((p) => ({ ...p, fecha_terminacion: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Motivo <span className="text-red-400">*</span></label>
                <textarea
                  rows={3}
                  required
                  value={formTerminar.motivo}
                  onChange={(e) => setFormTerminar((p) => ({ ...p, motivo: e.target.value }))}
                  placeholder="Describe el motivo..."
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none resize-none placeholder:text-white/20"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">{saveError}</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {saving ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
