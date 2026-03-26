"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/StatCard";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Solicitud {
  id: string;
  idSolicitud: string;
  empleadoId: string;
  nombreEmpleado: string;
  tipo: "vacaciones" | "permiso" | "novedad_nomina";
  subtipo: string;
  fechaInicio: string;
  fechaFin: string | null;
  duracionHoras: number | null;
  diasHabilesCalculados: number | null;
  descripcion: string;
  soporteUrl: string | null;
  estado: "pendiente" | "aprobado" | "rechazado" | "cancelado";
  comentarioAdmin: string | null;
  revisadoPor: string | null;
  procesadoNomina: boolean;
  fechaProcesadoNomina: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TipoCatalogo {
  id: string;
  nombre: string;
  tipoPadre: string;
  requiereSoporte: boolean;
  afectaNomina: boolean;
}

interface BalanceVacaciones {
  empleadoId: string;
  nombreEmpleado: string;
  diasTotales: number;
  diasUsados: number;
  diasDisponibles: number;
  ultimoCalculo: string;
}

type AdminModalTipo = "detalle" | "rechazar" | "crear-novedad" | null;
type TabActivo = "pendientes" | "todas";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [year, month, day] = fecha.split("-");
  return `${day}/${month}/${year}`;
}

function labelTipo(tipo: string): string {
  const m: Record<string, string> = {
    vacaciones: "🏖️ Vacaciones",
    permiso: "📋 Permiso",
    novedad_nomina: "📄 Novedad nómina",
  };
  return m[tipo] || tipo;
}

/**
 * Determina si una solicitud aprobada afecta nómina.
 * - novedad_nomina siempre afecta
 * - vacaciones siempre afecta
 * - permisos: solo no_remunerado afecta (descuenta salario)
 */
function afectaNomina(s: Solicitud): boolean {
  if (s.estado !== "aprobado") return false;
  if (s.tipo === "novedad_nomina") return true;
  if (s.tipo === "vacaciones") return true;
  if (s.tipo === "permiso" && s.subtipo === "no_remunerado") return true;
  return false;
}

// ─── Badge de estado nómina ───────────────────────────────────────────────────

function BadgeNomina({ solicitud }: { solicitud: Solicitud }) {
  if (!afectaNomina(solicitud)) return null;

  const procesado = solicitud.procesadoNomina;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
        procesado
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
      }`}
      title={procesado
        ? `Procesado: ${solicitud.fechaProcesadoNomina ? new Date(solicitud.fechaProcesadoNomina).toLocaleDateString("es-CO") : "Sí"}`
        : "Pendiente de procesar en nómina"
      }
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {procesado ? "Procesado" : "Pend. nómina"}
    </span>
  );
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function BadgeEstado({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    pendiente: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    aprobado: "bg-green-500/15 text-green-300 border-green-500/30",
    rechazado: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelado: "bg-white/[0.06] text-white/40 border-white/[0.1]",
  };
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    cancelado: "Cancelado",
  };
  const cls = styles[estado] || "bg-white/[0.06] text-white/40 border-white/[0.1]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {labels[estado] || estado}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [tabActivo, setTabActivo] = useState<TabActivo>("pendientes");

  // Filtros (solo en tab "todas")
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modales
  const [modal, setModal] = useState<AdminModalTipo>(null);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);

  // Datos auxiliares
  const [novedadesTipos, setNovedadesTipos] = useState<TipoCatalogo[]>([]);
  const [balanceEmpleado, setBalanceEmpleado] = useState<BalanceVacaciones | null>(null);

  // Formulario rechazo
  const [formRechazo, setFormRechazo] = useState({ comentario: "" });

  // Formulario rechazo inline en detalle
  const [mostrarRechazoInline, setMostrarRechazoInline] = useState(false);
  const [comentarioInline, setComentarioInline] = useState("");

  // Formulario crear novedad directa
  const [formNovedad, setFormNovedad] = useState({
    empleadoId: "",
    nombreEmpleado: "",
    subtipo: "",
    fechaInicio: "",
    fechaFin: "",
    descripcion: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Carga de solicitudes ────────────────────────────────────────────────────

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("Error al cargar solicitudes");
      const data = await res.json() as { solicitudes?: Solicitud[] };
      setSolicitudes(data.solicitudes || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  // ─── Cargar novedadesTipos cuando se abre modal crear-novedad ────────────────

  useEffect(() => {
    if (modal !== "crear-novedad") return;
    if (novedadesTipos.length > 0) return;
    fetch("/api/requests/tipos?tipo_padre=novedad_nomina")
      .then((r) => (r.ok ? r.json() : { tipos: [] }))
      .then((d: { tipos: TipoCatalogo[] }) => setNovedadesTipos(d.tipos || []))
      .catch(() => {});
  }, [modal, novedadesTipos.length]);

  // ─── Derivados ────────────────────────────────────────────────────────────────

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const aprobadas = solicitudes.filter((s) => s.estado === "aprobado");
  const rechazadas = solicitudes.filter((s) => s.estado === "rechazado");
  const novedadesNominaP = solicitudes.filter(
    (s) => s.tipo === "novedad_nomina" && s.estado === "pendiente"
  );

  const listaMostrada = (() => {
    let lista = tabActivo === "pendientes" ? pendientes : solicitudes;
    if (tabActivo === "todas") {
      if (filtroTipo) lista = lista.filter((s) => s.tipo === filtroTipo);
      if (filtroEstado) lista = lista.filter((s) => s.estado === filtroEstado);
    }
    return lista;
  })();

  // ─── Abrir detalle ────────────────────────────────────────────────────────────

  async function abrirDetalle(s: Solicitud) {
    setSolicitudSeleccionada(s);
    setMostrarRechazoInline(false);
    setComentarioInline("");
    setBalanceEmpleado(null);
    setModal("detalle");
    if (s.tipo === "vacaciones") {
      try {
        const res = await fetch(`/api/requests/balance?empleado_id=${s.empleadoId}`);
        if (res.ok) {
          const data = await res.json() as { balance?: BalanceVacaciones };
          setBalanceEmpleado(data.balance || null);
        }
      } catch {
        // sin bloqueo
      }
    }
  }

  // ─── Aprobar ─────────────────────────────────────────────────────────────────

  async function handleAprobar(id: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/requests/${id}/approve`, { method: "PATCH" });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al aprobar solicitud");
      await cargarSolicitudes();
      if (modal === "detalle") setModal(null);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Rechazar (modal independiente) ─────────────────────────────────────────

  async function handleRechazarSubmit(solicitudId: string, comentario: string) {
    if (!comentario.trim() || comentario.trim().length < 10) {
      setSaveError("El motivo del rechazo debe tener al menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/requests/${solicitudId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentario }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al rechazar solicitud");
      await cargarSolicitudes();
      setModal(null);
      setFormRechazo({ comentario: "" });
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRechazarDesdeDetalle() {
    if (!solicitudSeleccionada) return;
    await handleRechazarSubmit(solicitudSeleccionada.id, comentarioInline);
  }

  // ─── Crear novedad directa ────────────────────────────────────────────────────

  async function handleCrearNovedad(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "novedad_nomina",
          empleadoId: formNovedad.empleadoId,
          nombreEmpleado: formNovedad.nombreEmpleado,
          subtipo: formNovedad.subtipo,
          fechaInicio: formNovedad.fechaInicio,
          fechaFin: formNovedad.fechaFin,
          descripcion: formNovedad.descripcion,
          adminDirecta: true,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al crear novedad");
      setModal(null);
      setFormNovedad({
        empleadoId: "", nombreEmpleado: "", subtipo: "",
        fechaInicio: "", fechaFin: "", descripcion: "",
      });
      await cargarSolicitudes();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Estados de carga y error ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">Cargando solicitudes...</p>
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
          <button
            onClick={cargarSolicitudes}
            className="mt-6 px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
          >
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
        <StatCard title="Pendientes" value={pendientes.length} icon="⏳" color="orange" />
        <StatCard title="Aprobadas" value={aprobadas.length} icon="✅" color="green" />
        <StatCard title="Rechazadas" value={rechazadas.length} icon="🚫" color="red" />
        <StatCard
          title="Novedades nómina"
          value={novedadesNominaP.length}
          icon="📄"
          color="purple"
          subtitle="pendientes"
        />
      </div>

      {/* Header con tabs + botón crear */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-black/20 border border-white/[0.08]">
          {(["pendientes", "todas"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTabActivo(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tabActivo === tab
                  ? "bg-indigo-500 text-white shadow"
                  : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              {tab === "pendientes" ? "Pendientes" : "Todas"}
              {tab === "pendientes" && pendientes.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs">
                  {pendientes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setSaveError(null);
            setFormNovedad({
              empleadoId: "", nombreEmpleado: "", subtipo: "",
              fechaInicio: "", fechaFin: "", descripcion: "",
            });
            setModal("crear-novedad");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <span>+</span> Crear Novedad Directa
        </button>
      </div>

      {/* Filtros (solo en "todas") */}
      {tabActivo === "todas" && (
        <div className="flex flex-wrap gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2 bg-black/20 border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/25 backdrop-blur-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="permiso">Permiso</option>
            <option value="novedad_nomina">Novedad de nómina</option>
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-2 bg-black/20 border border-white/[0.12] rounded-xl text-white text-sm focus:outline-none focus:border-white/25 backdrop-blur-sm"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl bg-black/20 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">
            {tabActivo === "pendientes" ? "Solicitudes pendientes" : "Todas las solicitudes"}
            <span className="ml-2 text-white/30 font-normal">({listaMostrada.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {tabActivo === "pendientes"
                  ? ["Empleado", "Tipo", "Subtipo", "Fecha inicio", "Días", "F.Solicitud", "Acciones"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))
                  : ["Empleado", "Tipo", "Subtipo", "Fecha inicio", "Días", "F.Solicitud", "Estado", "Acciones"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {listaMostrada.length === 0 ? (
                <tr>
                  <td
                    colSpan={tabActivo === "pendientes" ? 7 : 8}
                    className="px-5 py-12 text-center text-white/30 text-sm"
                  >
                    {tabActivo === "pendientes"
                      ? "No hay solicitudes pendientes"
                      : "No hay solicitudes registradas"}
                  </td>
                </tr>
              ) : (
                listaMostrada.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{s.nombreEmpleado || "—"}</p>
                      <p className="text-xs text-white/30 font-mono">{s.empleadoId}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70 whitespace-nowrap">
                      {labelTipo(s.tipo)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {s.subtipo || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50 whitespace-nowrap">
                      {formatFecha(s.fechaInicio)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50 text-center whitespace-nowrap">
                      {s.diasHabilesCalculados !== null
                        ? `${s.diasHabilesCalculados}d`
                        : s.duracionHoras !== null
                        ? `${s.duracionHoras}h`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-white/30 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString("es-CO")}
                    </td>
                    {tabActivo === "todas" && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BadgeEstado estado={s.estado} />
                          <BadgeNomina solicitud={s} />
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirDetalle(s)}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                        >
                          Ver
                        </button>
                        {s.estado === "pendiente" && (
                          <>
                            <button
                              onClick={() => handleAprobar(s.id)}
                              disabled={saving}
                              className="px-3 py-1 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-300 hover:text-green-200 text-xs transition-colors disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => {
                                setSolicitudSeleccionada(s);
                                setFormRechazo({ comentario: "" });
                                setSaveError(null);
                                setModal("rechazar");
                              }}
                              className="px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-xs transition-colors"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Rechazar solicitud ───────────────────────────────────────────── */}
      {modal === "rechazar" && solicitudSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Rechazar solicitud</h3>
              <button
                onClick={() => setModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-white/50">
                Solicitud{" "}
                <span className="text-white/80 font-mono">
                  {solicitudSeleccionada.idSolicitud}
                </span>{" "}
                de <span className="text-white/80">{solicitudSeleccionada.nombreEmpleado}</span>
              </p>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Motivo del rechazo <span className="text-red-400">*</span>
                  <span className="text-white/25 font-normal ml-1">(mínimo 10 caracteres)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formRechazo.comentario}
                  onChange={(e) => setFormRechazo({ comentario: e.target.value })}
                  placeholder="Explica por qué se rechaza esta solicitud..."
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none placeholder:text-white/20"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || formRechazo.comentario.trim().length < 10}
                  onClick={() =>
                    handleRechazarSubmit(solicitudSeleccionada.id, formRechazo.comentario)
                  }
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {saving ? "Procesando..." : "Rechazar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalle + Aprobar/Rechazar ──────────────────────────────────── */}
      {modal === "detalle" && solicitudSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {solicitudSeleccionada.idSolicitud || "Detalle"}
                </h3>
                <p className="text-xs text-white/40">{solicitudSeleccionada.nombreEmpleado}</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Tipo + estado */}
              <div className="flex items-center gap-3">
                <BadgeEstado estado={solicitudSeleccionada.estado} />
                <span className="text-sm text-white/70">{labelTipo(solicitudSeleccionada.tipo)}</span>
                {solicitudSeleccionada.subtipo && (
                  <span className="text-xs text-white/40 px-3 py-1 bg-white/[0.04] rounded-full border border-white/[0.08]">
                    {solicitudSeleccionada.subtipo}
                  </span>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-white/30">Empleado ID</p>
                  <p className="text-white/80 font-mono text-xs">{solicitudSeleccionada.empleadoId}</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Fecha inicio</p>
                  <p className="text-white/80">{formatFecha(solicitudSeleccionada.fechaInicio)}</p>
                </div>
                {solicitudSeleccionada.fechaFin && (
                  <div>
                    <p className="text-xs text-white/30">Fecha fin</p>
                    <p className="text-white/80">{formatFecha(solicitudSeleccionada.fechaFin)}</p>
                  </div>
                )}
                {solicitudSeleccionada.diasHabilesCalculados !== null && (
                  <div>
                    <p className="text-xs text-white/30">Días hábiles</p>
                    <p className="text-white/80">{solicitudSeleccionada.diasHabilesCalculados}</p>
                  </div>
                )}
                {solicitudSeleccionada.duracionHoras !== null && (
                  <div>
                    <p className="text-xs text-white/30">Duración</p>
                    <p className="text-white/80">
                      {solicitudSeleccionada.duracionHoras} h
                    </p>
                  </div>
                )}
              </div>

              {/* Saldo vacaciones */}
              {solicitudSeleccionada.tipo === "vacaciones" && (
                <div className="px-4 py-3 rounded-xl bg-white/[0.04] text-sm">
                  <p className="text-xs text-white/30 mb-1">Saldo disponible del empleado</p>
                  {balanceEmpleado ? (
                    <p className="text-indigo-300 font-semibold">
                      {balanceEmpleado.diasDisponibles} días
                    </p>
                  ) : (
                    <p className="text-white/25 text-xs">Cargando saldo...</p>
                  )}
                </div>
              )}

              {/* Procesado nómina - para todas las solicitudes aprobadas que afectan nómina */}
              {afectaNomina(solicitudSeleccionada) && (
                <div
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                    solicitudSeleccionada.procesadoNomina
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    solicitudSeleccionada.procesadoNomina ? "bg-emerald-400" : "bg-amber-400"
                  }`} />
                  <span>
                    {solicitudSeleccionada.procesadoNomina
                      ? `Procesado en nómina${solicitudSeleccionada.fechaProcesadoNomina
                          ? ` el ${new Date(solicitudSeleccionada.fechaProcesadoNomina).toLocaleDateString("es-CO")}`
                          : ""}`
                      : "Pendiente de procesar en nómina"}
                  </span>
                </div>
              )}

              {/* Descripción */}
              {solicitudSeleccionada.descripcion && (
                <div className="px-4 py-3 rounded-xl bg-white/[0.04] text-sm">
                  <p className="text-xs text-white/30 mb-1">Descripción</p>
                  <p className="text-white/60">{solicitudSeleccionada.descripcion}</p>
                </div>
              )}

              {/* Motivo rechazo */}
              {solicitudSeleccionada.estado === "rechazado" &&
                solicitudSeleccionada.comentarioAdmin && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
                    <p className="text-xs text-red-400 mb-1">Motivo del rechazo</p>
                    <p className="text-white/70">{solicitudSeleccionada.comentarioAdmin}</p>
                  </div>
                )}

              {/* Soporte */}
              {solicitudSeleccionada.soporteUrl && (
                <div className="text-sm">
                  <p className="text-xs text-white/30 mb-1">Soporte adjunto</p>
                  <a
                    href={solicitudSeleccionada.soporteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 underline"
                  >
                    Ver documento
                  </a>
                </div>
              )}

              <p className="text-xs text-white/20">
                Creado el:{" "}
                {new Date(solicitudSeleccionada.createdAt).toLocaleString("es-CO")}
              </p>

              {/* Acciones admin si pendiente */}
              {solicitudSeleccionada.estado === "pendiente" && (
                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  {!mostrarRechazoInline ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAprobar(solicitudSeleccionada.id)}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 hover:text-green-200 text-sm font-semibold transition-colors disabled:opacity-50 border border-green-500/20"
                      >
                        {saving ? "Procesando..." : "Aprobar"}
                      </button>
                      <button
                        onClick={() => {
                          setMostrarRechazoInline(true);
                          setSaveError(null);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-sm font-semibold transition-colors border border-red-500/20"
                      >
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Motivo del rechazo <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={comentarioInline}
                          onChange={(e) => setComentarioInline(e.target.value)}
                          placeholder="Explica por qué se rechaza esta solicitud..."
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none placeholder:text-white/20"
                        />
                      </div>

                      {saveError && (
                        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
                          {saveError}
                        </p>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setMostrarRechazoInline(false);
                            setComentarioInline("");
                            setSaveError(null);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white text-sm font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleRechazarDesdeDetalle}
                          disabled={saving || comentarioInline.trim().length < 10}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                        >
                          {saving ? "Procesando..." : "Confirmar rechazo"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear Novedad Directa ────────────────────────────────────────── */}
      {modal === "crear-novedad" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Crear novedad directa</h3>
              <button
                onClick={() => setModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCrearNovedad} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  ID del empleado <span className="text-red-400">*</span>
                  <span className="text-white/25 font-normal ml-1">(formato SIRIUS-PER-XXXX)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNovedad.empleadoId}
                  onChange={(e) => setFormNovedad((p) => ({ ...p, empleadoId: e.target.value }))}
                  placeholder="SIRIUS-PER-0001"
                  pattern="SIRIUS-PER-\d{4}"
                  title="Formato: SIRIUS-PER-XXXX"
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Nombre del empleado <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNovedad.nombreEmpleado}
                  onChange={(e) => setFormNovedad((p) => ({ ...p, nombreEmpleado: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Tipo de novedad <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formNovedad.subtipo}
                  onChange={(e) => setFormNovedad((p) => ({ ...p, subtipo: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                >
                  <option value="">Selecciona un tipo</option>
                  {novedadesTipos.map((t) => (
                    <option key={t.id} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Fecha inicio <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formNovedad.fechaInicio}
                    onChange={(e) => setFormNovedad((p) => ({ ...p, fechaInicio: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Fecha fin <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formNovedad.fechaFin}
                    onChange={(e) => setFormNovedad((p) => ({ ...p, fechaFin: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Descripción <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formNovedad.descripcion}
                  onChange={(e) => setFormNovedad((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Describe la novedad..."
                  className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none placeholder:text-white/20"
                />
              </div>

              {saveError && (
                <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {saving ? "Creando..." : "Crear novedad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
