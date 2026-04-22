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

type SolicitudesModalTipo = "nueva" | "detalle" | null;
type TabNueva = "vacaciones" | "permiso" | "novedad_nomina";

const TIPOS_PERMISO_FALLBACK: TipoCatalogo[] = [
  {
    id: "fallback-permiso-cita-medica",
    nombre: "Cita médica",
    tipoPadre: "permiso",
    requiereSoporte: true,
    afectaNomina: false,
  },
  {
    id: "fallback-permiso-cal-amidad-domestica",
    nombre: "Calamidad doméstica",
    tipoPadre: "permiso",
    requiereSoporte: true,
    afectaNomina: false,
  },
  {
    id: "fallback-permiso-diligencia-personal",
    nombre: "Diligencia personal",
    tipoPadre: "permiso",
    requiereSoporte: false,
    afectaNomina: false,
  },
  {
    id: "fallback-permiso-estudio-capacitacion",
    nombre: "Estudio o capacitación",
    tipoPadre: "permiso",
    requiereSoporte: true,
    afectaNomina: false,
  },
  {
    id: "fallback-permiso-licencia-luto",
    nombre: "Licencia por luto",
    tipoPadre: "permiso",
    requiereSoporte: true,
    afectaNomina: false,
  },
  {
    id: "fallback-permiso-citacion-oficial",
    nombre: "Citación oficial",
    tipoPadre: "permiso",
    requiereSoporte: true,
    afectaNomina: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularDiasHabiles(
  fechaInicio: string,
  fechaFin: string,
  diasSemanaEmpleado: string[],
  festivosSet: Set<string>
): number {
  const NOMBRE_A_INDICE: Record<string, number> = {
    Domingo: 0, Lunes: 1, Martes: 2, "Miércoles": 3, Miercoles: 3,
    Jueves: 4, Viernes: 5, "Sábado": 6, Sabado: 6,
  };
  const indicesTrabajo = new Set<number>();
  for (const dia of diasSemanaEmpleado) {
    const idx = NOMBRE_A_INDICE[dia];
    if (idx !== undefined) indicesTrabajo.add(idx);
  }
  if (indicesTrabajo.size === 0) [1, 2, 3, 4, 5].forEach((i) => indicesTrabajo.add(i));

  const [sy, sm, sd] = fechaInicio.split("-").map(Number);
  const [ey, em, ed] = fechaFin.split("-").map(Number);
  const inicio = new Date(Date.UTC(sy, sm - 1, sd));
  const fin = new Date(Date.UTC(ey, em - 1, ed));
  if (inicio > fin) return 0;
  let count = 0;
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    if (
      indicesTrabajo.has(cursor.getUTCDay()) &&
      !festivosSet.has(cursor.toISOString().split("T")[0])
    )
      count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

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

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function formatearNombreTipo(nombre: string): string {
  // "calamidad_domestica" → "Calamidad domestica"; "Cita médica" → "Cita médica"
  const limpio = nombre.replace(/[_\-]+/g, " ").trim().replace(/\s+/g, " ");
  if (!limpio) return nombre;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
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

export default function SolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [balance, setBalance] = useState<BalanceVacaciones | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modales
  const [modal, setModal] = useState<SolicitudesModalTipo>(null);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);

  // Modal nueva — tabs y datos auxiliares
  const [tabNueva, setTabNueva] = useState<TabNueva>("vacaciones");
  const [permisosTipos, setPermisosTipos] = useState<TipoCatalogo[]>([]);
  const [novedadesTipos, setNovedadesTipos] = useState<TipoCatalogo[]>([]);
  const [festivosSet, setFestivosSet] = useState<Set<string>>(new Set());
  const [diasSemanaEmpleado, setDiasSemanaEmpleado] = useState<string[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Formularios
  const [formVac, setFormVac] = useState({ fechaInicio: "", fechaFin: "", descripcion: "" });
  const [diasCalculados, setDiasCalculados] = useState<number>(0);

  const [formPermiso, setFormPermiso] = useState({
    subtipo: "",
    subtipoOtro: "",
    fechaInicio: "",
    duracionTipo: "dia" as "dia" | "horas",
    fechaFin: "",
    duracionHoras: "",
    descripcion: "",
    soporteUrl: "",
  });

  const [formNovedad, setFormNovedad] = useState({
    subtipo: "",
    fechaInicio: "",
    fechaFin: "",
    descripcion: "",
    soporteUrl: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Carga inicial ───────────────────────────────────────────────────────────

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSol, resBal] = await Promise.all([
        fetch("/api/requests"),
        fetch("/api/requests/balance"),
      ]);
      if (!resSol.ok) throw new Error("Error al cargar solicitudes");
      const dataSol = await resSol.json();
      setSolicitudes(dataSol.solicitudes || []);
      if (resBal.ok) {
        const dataBal = await resBal.json();
        setBalance(dataBal.balance || null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  // ─── Datos del modal nueva solicitud ────────────────────────────────────────

  useEffect(() => {
    if (modal !== "nueva") return;
    if (permisosTipos.length > 0 && novedadesTipos.length > 0) return;
    setLoadingModalData(true);
    const anioActual = new Date().getFullYear();
    const anioSiguiente = anioActual + 1;
    Promise.all([
      fetch("/api/requests/tipos?tipo_padre=permiso").then((r) =>
        r.ok ? r.json() : { tipos: [] }
      ),
      fetch("/api/requests/tipos?tipo_padre=novedad_nomina").then((r) =>
        r.ok ? r.json() : { tipos: [] }
      ),
      fetch(`/api/requests/festivos?anio=${anioActual}`).then((r) =>
        r.ok ? r.json() : { festivos: [] }
      ),
      fetch(`/api/requests/festivos?anio=${anioSiguiente}`).then((r) =>
        r.ok ? r.json() : { festivos: [] }
      ),
      fetch("/api/schedules/assignments").then((r) =>
        r.ok ? r.json() : { asignacion: null }
      ),
    ])
      .then(([pt, nt, f1, f2, asig]) => {
        setPermisosTipos((pt as { tipos: TipoCatalogo[] }).tipos || []);
        setNovedadesTipos((nt as { tipos: TipoCatalogo[] }).tipos || []);
        const allFestivos = [
          ...((f1 as { festivos: string[] }).festivos || []),
          ...((f2 as { festivos: string[] }).festivos || []),
        ];
        setFestivosSet(new Set(allFestivos));
        const asigData = asig as { asignacion: { horarios: { diasLaborales: string[] }[] } | null };
        const dias: string[] = asigData.asignacion?.horarios?.[0]?.diasLaborales || [];
        setDiasSemanaEmpleado(dias);
      })
      .catch(() => {})
      .finally(() => setLoadingModalData(false));
  }, [modal, permisosTipos.length, novedadesTipos.length]);

  // ─── Cálculo en tiempo real de días hábiles ──────────────────────────────────

  useEffect(() => {
    if (formVac.fechaInicio && formVac.fechaFin) {
      setDiasCalculados(
        calcularDiasHabiles(formVac.fechaInicio, formVac.fechaFin, diasSemanaEmpleado, festivosSet)
      );
    } else {
      setDiasCalculados(0);
    }
  }, [formVac.fechaInicio, formVac.fechaFin, diasSemanaEmpleado, festivosSet]);

  // ─── Filtrado ────────────────────────────────────────────────────────────────

  const filtradas = solicitudes.filter((s) => {
    if (filtroTipo && s.tipo !== filtroTipo) return false;
    if (filtroEstado && s.estado !== filtroEstado) return false;
    return true;
  });

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;
  const aprobadas = solicitudes.filter((s) => s.estado === "aprobado").length;

  // ─── Acciones ────────────────────────────────────────────────────────────────

  async function handleCancelar(id: string) {
    if (!confirm("¿Deseas cancelar esta solicitud?")) return;
    try {
      const res = await fetch(`/api/requests/${id}/cancel`, { method: "PATCH" });
      if (!res.ok) throw new Error("Error al cancelar la solicitud");
      await cargarSolicitudes();
      if (modal === "detalle") setModal(null);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleSubmitVacaciones(e: React.FormEvent) {
    e.preventDefault();
    if (formVac.fechaFin < formVac.fechaInicio) {
      setSaveError("La fecha fin debe ser igual o posterior a la fecha de inicio.");
      return;
    }
    if (balance !== null && diasCalculados > balance.diasDisponibles) {
      setSaveError(
        `Saldo insuficiente. Tienes ${balance.diasDisponibles} días disponibles y solicitas ${diasCalculados}.`
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "vacaciones",
          fechaInicio: formVac.fechaInicio,
          fechaFin: formVac.fechaFin,
          diasHabilesCalculados: diasCalculados,
          descripcion: formVac.descripcion || undefined,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al crear solicitud");
      setModal(null);
      setFormVac({ fechaInicio: "", fechaFin: "", descripcion: "" });
      await cargarSolicitudes();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitPermiso(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      // Si selecciona "Otro", usar el texto libre como subtipo final
      const subtipoFinal =
        formPermiso.subtipo === "__otro__"
          ? formPermiso.subtipoOtro.trim()
          : formPermiso.subtipo;

      if (formPermiso.subtipo === "__otro__" && !subtipoFinal) {
        setSaveError("Especifica el tipo de permiso.");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        tipo: "permiso",
        subtipo: subtipoFinal,
        fechaInicio: formPermiso.fechaInicio,
        descripcion: formPermiso.descripcion,
      };
      if (formPermiso.duracionTipo === "dia") {
        body.fechaFin = formPermiso.fechaFin || formPermiso.fechaInicio;
      } else {
        body.duracionHoras = Number(formPermiso.duracionHoras);
      }
      const subtipoObj = permisosTipos.find((t) => t.nombre === formPermiso.subtipo);
      if (subtipoObj?.requiereSoporte && formPermiso.soporteUrl) {
        body.soporteUrl = formPermiso.soporteUrl;
      }
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al crear solicitud");
      setModal(null);
      setFormPermiso({
        subtipo: "", subtipoOtro: "", fechaInicio: "", duracionTipo: "dia",
        fechaFin: "", duracionHoras: "", descripcion: "", soporteUrl: "",
      });
      await cargarSolicitudes();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitNovedad(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        tipo: "novedad_nomina",
        subtipo: formNovedad.subtipo,
        fechaInicio: formNovedad.fechaInicio,
        fechaFin: formNovedad.fechaFin,
        descripcion: formNovedad.descripcion,
      };
      const subtipoObj = novedadesTipos.find((t) => t.nombre === formNovedad.subtipo);
      if (subtipoObj?.requiereSoporte && formNovedad.soporteUrl) {
        body.soporteUrl = formNovedad.soporteUrl;
      }
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Error al crear solicitud");
      setModal(null);
      setFormNovedad({ subtipo: "", fechaInicio: "", fechaFin: "", descripcion: "", soporteUrl: "" });
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

  const balanceColor =
    !balance ? "blue"
    : balance.diasDisponibles >= 5 ? "green"
    : balance.diasDisponibles >= 2 ? "orange"
    : "red";

  const etiquetasNoValidasPermiso = new Set([
    "remunerado",
    "no remunerado",
    "permiso remunerado",
    "permiso no remunerado",
    "otro",
    "otros",
    "n a",
    "ninguno",
  ]);

  const permisosTiposMostrables = permisosTipos.filter(
    (t) => !etiquetasNoValidasPermiso.has(normalizarTexto(t.nombre))
  );

  const permisosTiposDisponibles =
    permisosTiposMostrables.length > 0 ? permisosTiposMostrables : TIPOS_PERMISO_FALLBACK;

  const permisoSubtipoActual = permisosTiposDisponibles.find(
    (t) => t.nombre === formPermiso.subtipo
  );
  const novedadSubtipoActual = novedadesTipos.find((t) => t.nombre === formNovedad.subtipo);

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Días disponibles"
          value={balance?.diasDisponibles ?? "—"}
          icon="🏖️"
          color={balanceColor}
        />
        <StatCard
          title="Días usados"
          value={balance?.diasUsados ?? "—"}
          icon="📅"
          color="purple"
        />
        <StatCard title="Pendientes" value={pendientes} icon="⏳" color="orange" />
        <StatCard title="Aprobadas" value={aprobadas} icon="✅" color="green" />
      </div>

      {/* Alerta saldo bajo */}
      {balance && balance.diasDisponibles < 5 && (
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
          <span className="text-lg">⚠️</span>
          <span>
            Tienes pocos días de vacaciones disponibles.{" "}
            <span className="font-semibold">
              {balance.diasDisponibles} día{balance.diasDisponibles !== 1 ? "s" : ""}
            </span>{" "}
            restantes.
          </span>
        </div>
      )}

      {/* Filtros + botón nueva solicitud */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
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
        <button
          onClick={() => {
            setSaveError(null);
            setTabNueva("vacaciones");
            setModal("nueva");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <span>+</span> Nueva Solicitud
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl bg-black/20 border border-white/[0.08] overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">
            Mis solicitudes
            <span className="ml-2 text-white/30 font-normal">({filtradas.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Código", "Tipo", "Subtipo", "Fecha inicio", "Fecha fin", "Días", "Estado", "Acciones"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-white/30 text-sm">
                    {filtroTipo || filtroEstado
                      ? "Sin resultados para los filtros seleccionados"
                      : "No hay solicitudes registradas"}
                  </td>
                </tr>
              ) : (
                filtradas.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-sm font-mono font-medium text-white/80 whitespace-nowrap">
                      {s.idSolicitud || "—"}
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
                    <td className="px-5 py-4 text-sm text-white/50 whitespace-nowrap">
                      {formatFecha(s.fechaFin)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50 text-center whitespace-nowrap">
                      {s.diasHabilesCalculados !== null
                        ? `${s.diasHabilesCalculados}d`
                        : s.duracionHoras !== null
                        ? `${s.duracionHoras}h`
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <BadgeEstado estado={s.estado} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSolicitudSeleccionada(s);
                            setModal("detalle");
                          }}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                        >
                          Ver
                        </button>
                        {s.estado === "pendiente" && (
                          <button
                            onClick={() => handleCancelar(s.id)}
                            className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs transition-colors"
                          >
                            Cancelar
                          </button>
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

      {/* ── Modal Nueva Solicitud ──────────────────────────────────────────────── */}
      {modal === "nueva" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Nueva solicitud</h3>
              <button
                onClick={() => setModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.08] px-6 gap-1">
              {(["vacaciones", "permiso", "novedad_nomina"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setTabNueva(tab);
                    setSaveError(null);
                  }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    tabNueva === tab
                      ? "border-indigo-400 text-white"
                      : "border-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  {tab === "vacaciones"
                    ? "Vacaciones"
                    : tab === "permiso"
                    ? "Permiso"
                    : "Novedad de Nómina"}
                </button>
              ))}
            </div>

            {/* Contenido */}
            {loadingModalData ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-6 max-h-[60vh] overflow-y-auto">

                {/* TAB: Vacaciones */}
                {tabNueva === "vacaciones" && (
                  <form onSubmit={handleSubmitVacaciones} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Fecha inicio <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formVac.fechaInicio}
                          onChange={(e) => setFormVac((p) => ({ ...p, fechaInicio: e.target.value }))}
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
                          value={formVac.fechaFin}
                          onChange={(e) => setFormVac((p) => ({ ...p, fechaFin: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                        />
                      </div>
                    </div>

                    {formVac.fechaInicio && formVac.fechaFin && (
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm">
                        <span className="text-white/60">Días hábiles calculados:</span>
                        <span className="text-indigo-300 font-semibold">
                          {diasCalculados} día{diasCalculados !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {balance && (
                      <div
                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm border ${
                          balance.diasDisponibles >= diasCalculados
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-red-500/10 border-red-500/20"
                        }`}
                      >
                        <span className="text-white/60">Saldo disponible:</span>
                        <span
                          className={`font-semibold ${
                            balance.diasDisponibles >= diasCalculados
                              ? "text-green-300"
                              : "text-red-300"
                          }`}
                        >
                          {balance.diasDisponibles} días
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Descripción (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={formVac.descripcion}
                        onChange={(e) => setFormVac((p) => ({ ...p, descripcion: e.target.value }))}
                        placeholder="Motivo o descripción..."
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
                        {saving ? "Enviando..." : "Solicitar vacaciones"}
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB: Permiso */}
                {tabNueva === "permiso" && (
                  <form onSubmit={handleSubmitPermiso} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Tipo de permiso <span className="text-red-400">*</span>
                      </label>
                      <select
                        required
                        value={formPermiso.subtipo}
                        onChange={(e) => setFormPermiso((p) => ({ ...p, subtipo: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                      >
                        <option value="">Selecciona un tipo</option>
                        {permisosTiposDisponibles.map((t) => (
                          <option key={t.id} value={t.nombre}>
                            {formatearNombreTipo(t.nombre)}
                          </option>
                        ))}
                        <option value="__otro__">Otro (especificar)</option>
                      </select>
                    </div>

                    {formPermiso.subtipo === "__otro__" && (
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Especifica el tipo de permiso <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={120}
                          value={formPermiso.subtipoOtro}
                          onChange={(e) =>
                            setFormPermiso((p) => ({ ...p, subtipoOtro: e.target.value }))
                          }
                          placeholder="Describe brevemente el tipo de permiso..."
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Fecha inicio <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formPermiso.fechaInicio}
                        onChange={(e) => setFormPermiso((p) => ({ ...p, fechaInicio: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">Duración</label>
                      <div className="flex gap-5">
                        {(["dia", "horas"] as const).map((tipo) => (
                          <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="duracionTipo"
                              value={tipo}
                              checked={formPermiso.duracionTipo === tipo}
                              onChange={() =>
                                setFormPermiso((p) => ({ ...p, duracionTipo: tipo }))
                              }
                              className="accent-indigo-400"
                            />
                            <span className="text-sm text-white/70">
                              {tipo === "dia" ? "Día completo" : "Por horas"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {formPermiso.duracionTipo === "dia" && (
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Fecha fin (opcional)
                        </label>
                        <input
                          type="date"
                          value={formPermiso.fechaFin}
                          onChange={(e) => setFormPermiso((p) => ({ ...p, fechaFin: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                        />
                      </div>
                    )}

                    {formPermiso.duracionTipo === "horas" && (
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Horas <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          step="0.5"
                          min="0.5"
                          max="8"
                          value={formPermiso.duracionHoras}
                          onChange={(e) =>
                            setFormPermiso((p) => ({ ...p, duracionHoras: e.target.value }))
                          }
                          placeholder="Ej: 2"
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Descripción <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={formPermiso.descripcion}
                        onChange={(e) =>
                          setFormPermiso((p) => ({ ...p, descripcion: e.target.value }))
                        }
                        placeholder="Motivo del permiso..."
                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none placeholder:text-white/20"
                      />
                    </div>

                    {permisoSubtipoActual?.requiereSoporte && (
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          URL del soporte <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="url"
                          required
                          value={formPermiso.soporteUrl}
                          onChange={(e) =>
                            setFormPermiso((p) => ({ ...p, soporteUrl: e.target.value }))
                          }
                          placeholder="https://..."
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                        />
                      </div>
                    )}

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
                        {saving ? "Enviando..." : "Solicitar permiso"}
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB: Novedad de Nómina */}
                {tabNueva === "novedad_nomina" && (
                  <form onSubmit={handleSubmitNovedad} className="space-y-4">
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
                          onChange={(e) =>
                            setFormNovedad((p) => ({ ...p, fechaInicio: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setFormNovedad((p) => ({ ...p, fechaFin: e.target.value }))
                          }
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Descripción <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={formNovedad.descripcion}
                        onChange={(e) =>
                          setFormNovedad((p) => ({ ...p, descripcion: e.target.value }))
                        }
                        placeholder="Describe la novedad..."
                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 resize-none placeholder:text-white/20"
                      />
                    </div>

                    {novedadSubtipoActual?.requiereSoporte && (
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          URL del soporte <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="url"
                          required
                          value={formNovedad.soporteUrl}
                          onChange={(e) =>
                            setFormNovedad((p) => ({ ...p, soporteUrl: e.target.value }))
                          }
                          placeholder="https://..."
                          className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 placeholder:text-white/20"
                        />
                      </div>
                    )}

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
                        {saving ? "Enviando..." : "Registrar novedad"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Detalle de Solicitud ─────────────────────────────────────────── */}
      {modal === "detalle" && solicitudSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/[0.12] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {solicitudSeleccionada.idSolicitud || "Detalle de solicitud"}
                </h3>
                <p className="text-xs text-white/40">{labelTipo(solicitudSeleccionada.tipo)}</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Estado + subtipo */}
              <div className="flex items-center gap-3">
                <BadgeEstado estado={solicitudSeleccionada.estado} />
                {solicitudSeleccionada.subtipo && (
                  <span className="text-xs text-white/40 px-3 py-1 bg-white/[0.04] rounded-full border border-white/[0.08]">
                    {solicitudSeleccionada.subtipo}
                  </span>
                )}
              </div>

              {/* Fechas y duración */}
              <div className="grid grid-cols-2 gap-4 text-sm">
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
                      {solicitudSeleccionada.duracionHoras} hora
                      {solicitudSeleccionada.duracionHoras !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>

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

              {/* Aprobada */}
              {solicitudSeleccionada.estado === "aprobado" && (
                <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
                  <p className="text-green-300 font-medium">Aprobada</p>
                  {solicitudSeleccionada.revisadoPor && (
                    <p className="text-white/40 text-xs mt-0.5">
                      Por: {solicitudSeleccionada.revisadoPor}
                    </p>
                  )}
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

              {/* Cancelar si está pendiente */}
              {solicitudSeleccionada.estado === "pendiente" && (
                <button
                  onClick={() => handleCancelar(solicitudSeleccionada.id)}
                  className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-sm font-medium transition-colors border border-red-500/20"
                >
                  Cancelar solicitud
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
