"use client";

import { useState, useEffect } from "react";
import { ModalAutorizarSolicitud } from "./ModalAutorizarSolicitud";

interface Permiso {
  tipo: string;
  ambito: string;
  notas?: string;
}

interface Solicitud {
  id: string;
  fields: Record<string, any>;
}

interface DatosAutorizacion {
  permisos: Permiso[];
  solicitudes: {
    permisos: Solicitud[];
    vacaciones: Solicitud[];
    novedades: Solicitud[];
  };
  ambito: string;
}

export default function DashboardAutorizaciones() {
  const [datos, setDatos] = useState<DatosAutorizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"permisos" | "vacaciones" | "novedades">("permisos");
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<{
    tipo: "permiso" | "vacaciones" | "novedades";
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

      const data = await res.json();
      setDatos(data);

      // Seleccionar tab por defecto según lo que tenga disponible
      if (data.solicitudes.permisos.length > 0) {
        setTab("permisos");
      } else if (data.solicitudes.vacaciones.length > 0) {
        setTab("vacaciones");
      } else if (data.solicitudes.novedades.length > 0) {
        setTab("novedades");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3 mt-6">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
        <p className="text-red-800 font-medium">Error: {error}</p>
      </div>
    );
  }

  if (!datos || datos.permisos.length === 0) {
    return null; // No mostrar nada si no tiene permisos
  }

  const totalPendientes =
    datos.solicitudes.permisos.length +
    datos.solicitudes.vacaciones.length +
    datos.solicitudes.novedades.length;

  if (totalPendientes === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Panel de Autorizaciones
        </h2>
        <div className="bg-green-50 rounded-xl p-6 border border-green-200 text-center">
          <p className="text-green-800 font-medium">
            ✓ No hay solicitudes pendientes de autorización
          </p>
        </div>

        {/* Mostrar permisos del usuario */}
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Sus permisos de autorización:</h3>
          {datos.permisos.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="font-medium">{p.tipo}</span>
              <span className="text-gray-400">—</span>
              <span className="text-gray-500">{p.ambito}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const solicitudesActuales =
    tab === "permisos" ? datos.solicitudes.permisos :
    tab === "vacaciones" ? datos.solicitudes.vacaciones :
    datos.solicitudes.novedades;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900">
              Panel de Autorizaciones
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {totalPendientes} solicitud{totalPendientes !== 1 ? 'es' : ''} pendiente{totalPendientes !== 1 ? 's' : ''} de su aprobación
          </p>

          {/* Permisos del usuario */}
          <div className="mt-4 flex flex-wrap gap-2">
            {datos.permisos.map((p, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {p.tipo} ({p.ambito})
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-gray-100">
          <div className="flex gap-6">
            {datos.solicitudes.permisos.length > 0 && (
              <button
                onClick={() => setTab("permisos")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  tab === "permisos"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Permisos ({datos.solicitudes.permisos.length})
              </button>
            )}

            {datos.solicitudes.vacaciones.length > 0 && (
              <button
                onClick={() => setTab("vacaciones")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  tab === "vacaciones"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Vacaciones ({datos.solicitudes.vacaciones.length})
              </button>
            )}

            {datos.solicitudes.novedades.length > 0 && (
              <button
                onClick={() => setTab("novedades")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  tab === "novedades"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Novedades ({datos.solicitudes.novedades.length})
              </button>
            )}
          </div>
        </div>

        {/* Lista de solicitudes */}
        <div className="p-8">
          {solicitudesActuales.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay solicitudes pendientes en esta categoría
            </div>
          ) : (
            <div className="space-y-4">
              {solicitudesActuales.map((solicitud) => (
                <TarjetaSolicitud
                  key={solicitud.id}
                  solicitud={solicitud}
                  tipo={tab}
                  onAutorizar={() => setSolicitudSeleccionada({
                    tipo: tab === "permisos" ? "permiso" : tab === "vacaciones" ? "vacaciones" : "novedades",
                    solicitud
                  })}
                />
              ))}
            </div>
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
  tipo,
  onAutorizar
}: {
  solicitud: Solicitud;
  tipo: "permisos" | "vacaciones" | "novedades";
  onAutorizar: () => void;
}) {
  const f = solicitud.fields;

  return (
    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="font-semibold text-gray-900 text-lg">
              {f['Nombre'] || 'Sin nombre'}
            </h3>
            <span className="text-sm text-gray-500">
              Cédula: {f['Cedula'] || f['Numero Documento'] || 'N/A'}
            </span>
          </div>

          {tipo === "permisos" && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <span className="ml-2 font-medium">{f['Tipo_Permiso']}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha:</span>
                  <span className="ml-2 font-medium">{f['Fecha de permiso']}</span>
                </div>
                <div>
                  <span className="text-gray-600">Horas:</span>
                  <span className="ml-2 font-medium">{f['Horas Permiso'] || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cargo:</span>
                  <span className="ml-2 font-medium">{f['Cargo'] || 'N/A'}</span>
                </div>
              </div>
              {f['Motivo_Permiso'] && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 text-xs font-medium">Motivo:</span>
                  <p className="mt-1 text-gray-700">{f['Motivo_Permiso']}</p>
                </div>
              )}
            </div>
          )}

          {tipo === "vacaciones" && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Fecha Inicio:</span>
                  <span className="ml-2 font-medium">{f['Fecha Inicio']}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha Fin:</span>
                  <span className="ml-2 font-medium">{f['Fecha Fin']}</span>
                </div>
                <div>
                  <span className="text-gray-600">Días:</span>
                  <span className="ml-2 font-medium">{f['Dias Vacaciones'] || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cargo:</span>
                  <span className="ml-2 font-medium">{f['Cargo'] || 'N/A'}</span>
                </div>
              </div>
              {f['Motivo'] && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 text-xs font-medium">Motivo:</span>
                  <p className="mt-1 text-gray-700">{f['Motivo']}</p>
                </div>
              )}
            </div>
          )}

          {tipo === "novedades" && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <span className="ml-2 font-medium">{f['Tipo de Novedad']}</span>
                </div>
                {f['Número Horas Extras'] && (
                  <div>
                    <span className="text-gray-600">Horas Extra:</span>
                    <span className="ml-2 font-medium">{f['Número Horas Extras']}</span>
                  </div>
                )}
              </div>
              {f['Descripción de la Novedad'] && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 text-xs font-medium">Descripción:</span>
                  <p className="mt-1 text-gray-700">{f['Descripción de la Novedad']}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onAutorizar}
          className="ml-6 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          Revisar
        </button>
      </div>
    </div>
  );
}
