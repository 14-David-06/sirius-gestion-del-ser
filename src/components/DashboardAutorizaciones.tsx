"use client";

import { useState, useEffect, useMemo } from "react";
import { ModalAutorizarSolicitud, type CampoAirtable } from "./ModalAutorizarSolicitud";
import { FIELDS, FK_ID_CORE } from "@/lib/airtable-schema";

interface Permiso {
  tipo: string;
  ambito: string;
  notas?: string;
}

interface Solicitud {
  id: string;
  fields: Record<string, CampoAirtable>;
}

/**
 * Las novedades de nómina no aparecen aquí: son un registro informativo del
 * colaborador, no un trámite que se apruebe o rechace.
 */
type Categoria = "permisos" | "vacaciones";
type Tab = "todas" | Categoria;

interface DatosAutorizacion {
  permisos: Permiso[];
  solicitudes: Record<Categoria, Solicitud[]>;
  ambito: string;
}

/** Cuántas tarjetas se muestran antes de pedir "Mostrar más". */
const PAGINA = 15;

const ESTILO_CATEGORIA: Record<Categoria, { etiqueta: string; chip: string; activo: string }> = {
  permisos: {
    etiqueta: "Permiso",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    activo: "border-blue-500 text-blue-600",
  },
  vacaciones: {
    etiqueta: "Vacaciones",
    chip: "bg-green-50 text-green-700 border-green-200",
    activo: "border-green-500 text-green-600",
  },
};

export default function DashboardAutorizaciones() {
  const [datos, setDatos] = useState<DatosAutorizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState(PAGINA);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<{
    tipo: "permiso" | "vacaciones";
    solicitud: Solicitud;
  } | null>(null);

  useEffect(() => {
    fetchDatos();
  }, []);

  async function fetchDatos() {
    try {
      setLoading(true);
      const res = await fetch("/api/solicitudes/pendientes");

      if (!res.ok) {
        throw new Error("Error al cargar solicitudes pendientes");
      }

      setDatos(await res.json());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  // Lista unificada y ordenada por fecha de solicitud (más reciente primero)
  const todas = useMemo(() => {
    if (!datos) return [];
    const items = (Object.keys(ESTILO_CATEGORIA) as Categoria[]).flatMap((categoria) =>
      (datos.solicitudes[categoria] ?? []).map((solicitud) => ({ categoria, solicitud })),
    );
    return items.sort(
      (a, b) => fechaOrden(b.categoria, b.solicitud) - fechaOrden(a.categoria, a.solicitud),
    );
  }, [datos]);

  const filtradas = useMemo(() => {
    const porTab = tab === "todas" ? todas : todas.filter((i) => i.categoria === tab);
    const q = busqueda.trim().toLowerCase();
    if (!q) return porTab;
    return porTab.filter(({ categoria, solicitud }) =>
      textoBuscable(categoria, solicitud).includes(q),
    );
  }, [todas, tab, busqueda]);

  // Al cambiar de pestaña o búsqueda se reinicia la paginación
  useEffect(() => setVisibles(PAGINA), [tab, busqueda]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3 mt-6">
            <div className="h-24 bg-gray-200 rounded-xl"></div>
            <div className="h-24 bg-gray-200 rounded-xl"></div>
            <div className="h-24 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200 flex items-center justify-between gap-4">
        <p className="text-red-800 font-medium">Error: {error}</p>
        <button
          onClick={fetchDatos}
          className="px-4 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!datos || datos.permisos.length === 0) {
    return null; // No mostrar nada si no tiene permisos de autorización
  }

  const conteos: Record<Tab, number> = {
    todas: todas.length,
    permisos: datos.solicitudes.permisos?.length ?? 0,
    vacaciones: datos.solicitudes.vacaciones?.length ?? 0,
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                    Panel de Autorizaciones
                  </h2>
                  <p className="text-sm text-gray-600">
                    {conteos.todas === 0
                      ? "No hay solicitudes pendientes de su aprobación"
                      : `${conteos.todas} solicitud${conteos.todas !== 1 ? "es" : ""} pendiente${
                          conteos.todas !== 1 ? "s" : ""
                        } de su aprobación`}
                  </p>
                </div>
              </div>

              {/* Permisos de autorización del usuario */}
              <div className="mt-4 flex flex-wrap gap-2">
                {datos.permisos.map((p, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200"
                    title={p.notas}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Autoriza: {p.tipo} · {p.ambito}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={fetchDatos}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 5.3M4 15a8 8 0 0013.7 3.7"
                />
              </svg>
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabs + búsqueda */}
        <div className="px-6 sm:px-8 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-5 overflow-x-auto">
            {(["todas", "permisos", "vacaciones"] as Tab[]).map((t) => {
              const activo = tab === t;
              const estiloActivo =
                t === "todas" ? "border-gray-900 text-gray-900" : ESTILO_CATEGORIA[t].activo;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activo
                      ? estiloActivo
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "todas" ? "Todas" : ESTILO_CATEGORIA[t].etiqueta + "s"} ({conteos[t]})
                </button>
              );
            })}
          </div>

          {conteos.todas > 0 && (
            <div className="relative py-3 w-full sm:w-64">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                />
              </svg>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, cédula o tipo"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
            </div>
          )}
        </div>

        {/* Lista de solicitudes */}
        <div className="p-6 sm:p-8 bg-gray-50/50">
          {filtradas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 font-medium">
                {conteos.todas === 0
                  ? "✓ No hay solicitudes pendientes de autorización"
                  : "Ninguna solicitud coincide con el filtro"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filtradas.slice(0, visibles).map(({ categoria, solicitud }) => (
                  <TarjetaSolicitud
                    key={`${categoria}-${solicitud.id}`}
                    solicitud={solicitud}
                    categoria={categoria}
                    onAutorizar={() =>
                      setSolicitudSeleccionada({
                        tipo: categoria === "permisos" ? "permiso" : categoria,
                        solicitud,
                      })
                    }
                  />
                ))}
              </div>

              {filtradas.length > visibles && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setVisibles((v) => v + PAGINA)}
                    className="px-5 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Mostrar más ({filtradas.length - visibles} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de autorización */}
      {solicitudSeleccionada && (
        <ModalAutorizarSolicitud
          tipo={solicitudSeleccionada.tipo}
          solicitud={solicitudSeleccionada.solicitud}
          onClose={() => setSolicitudSeleccionada(null)}
          onSuccess={() => {
            setSolicitudSeleccionada(null);
            fetchDatos(); // Recargar datos
          }}
        />
      )}
    </>
  );
}

function TarjetaSolicitud({
  solicitud,
  categoria,
  onAutorizar,
}: {
  solicitud: Solicitud;
  categoria: Categoria;
  onAutorizar: () => void;
}) {
  const f = solicitud.fields;
  const estilo = ESTILO_CATEGORIA[categoria];
  const nombre = (f[FIELDS.PERMISO.NOMBRE] as string) || "Sin nombre";
  const cedula = (f[FIELDS.PERMISO.CEDULA] as string) || "";
  const cargo = f[FIELDS.PERMISO.CARGO] as string | undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Encabezado: categoría + persona */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${estilo.chip}`}
            >
              {estilo.etiqueta}
            </span>
            <h3 className="font-semibold text-gray-900 truncate">{nombre}</h3>
            {cedula && <span className="text-xs text-gray-500">CC {cedula}</span>}
          </div>

          {cargo && <p className="mt-1 text-xs text-gray-500">{cargo}</p>}

          {/* Datos de la solicitud */}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {datosSolicitud(categoria, solicitud).map(({ etiqueta, valor }) => (
              <div key={etiqueta} className="min-w-0">
                <dt className="text-xs text-gray-500">{etiqueta}</dt>
                <dd className="font-medium text-gray-900 truncate" title={valor}>
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          {/* Motivo / descripción */}
          {motivo(categoria, solicitud) && (
            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Motivo
              </p>
              <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-line">
                {motivo(categoria, solicitud)}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onAutorizar}
          className="shrink-0 self-start px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          Revisar
        </button>
      </div>
    </div>
  );
}

// ── Helpers de presentación ───────────────────────────────────────────────────

function formatearFecha(valor: unknown): string {
  if (typeof valor !== "string" || !valor) return "—";
  const fecha = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  if (isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  return String(valor).trim();
}

/** Fecha usada para ordenar la lista unificada. */
function fechaOrden(categoria: Categoria, s: Solicitud): number {
  const campo =
    categoria === "permisos"
      ? FIELDS.PERMISO.FECHA_SOLICITUD
      : FIELDS.VACACIONES.FECHA_PRESENTACION;
  const valor = s.fields[campo];
  const ts = typeof valor === "string" ? new Date(valor).getTime() : NaN;
  return isNaN(ts) ? 0 : ts;
}

function datosSolicitud(categoria: Categoria, s: Solicitud): { etiqueta: string; valor: string }[] {
  const f = s.fields;

  if (categoria === "permisos") {
    return [
      { etiqueta: "Tipo", valor: texto(f[FIELDS.PERMISO.TIPO]) },
      { etiqueta: "Desde", valor: formatearFecha(f[FIELDS.PERMISO.FECHA_INICIO]) },
      ...(f[FIELDS.PERMISO.FECHA_FIN]
        ? [{ etiqueta: "Hasta", valor: formatearFecha(f[FIELDS.PERMISO.FECHA_FIN]) }]
        : []),
      { etiqueta: "Horas", valor: texto(f[FIELDS.PERMISO.HORAS]) },
      { etiqueta: "Solicitado", valor: formatearFecha(f[FIELDS.PERMISO.FECHA_SOLICITUD]) },
    ];
  }

  return [
    { etiqueta: "Inicio", valor: formatearFecha(f[FIELDS.VACACIONES.FECHA_INICIO]) },
    { etiqueta: "Fin", valor: formatearFecha(f[FIELDS.VACACIONES.FECHA_FIN]) },
    { etiqueta: "Días", valor: texto(f[FIELDS.VACACIONES.DIAS]) },
    { etiqueta: "Reintegro", valor: formatearFecha(f[FIELDS.VACACIONES.FECHA_REINTEGRO]) },
    { etiqueta: "Presentada", valor: formatearFecha(f[FIELDS.VACACIONES.FECHA_PRESENTACION]) },
  ];
}

function motivo(categoria: Categoria, s: Solicitud): string {
  const campo =
    categoria === "permisos" ? FIELDS.PERMISO.MOTIVO : FIELDS.VACACIONES.MOTIVO;
  const valor = s.fields[campo];
  return typeof valor === "string" ? valor.trim() : "";
}

function textoBuscable(categoria: Categoria, s: Solicitud): string {
  return [
    ESTILO_CATEGORIA[categoria].etiqueta,
    s.fields[FIELDS.PERMISO.NOMBRE],
    s.fields[FIELDS.PERMISO.CEDULA],
    s.fields[FIELDS.PERMISO.CARGO],
    s.fields[FIELDS.PERMISO.TIPO],
    s.fields[FK_ID_CORE],
    motivo(categoria, s),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
