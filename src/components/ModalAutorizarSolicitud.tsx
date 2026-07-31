"use client";

import { useState } from "react";
import { FirmaCanvas } from "@sirius/solicitudes";

/** Valores tal como los devuelve la API de Airtable. */
export type CampoAirtable = string | number | boolean | string[] | undefined | null;

interface Solicitud {
  id: string;
  fields: Record<string, CampoAirtable>;
}

interface Props {
  tipo: "permiso" | "vacaciones" | "novedades";
  solicitud: Solicitud;
  onClose: () => void;
  onSuccess: () => void;
}

interface DiaCompensacion {
  fecha: string;
  horas: number;
  descripcion: string;
}

export function ModalAutorizarSolicitud({ tipo, solicitud, onClose, onSuccess }: Props) {
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados específicos para permisos
  const [remunerado, setRemunerado] = useState(Boolean(solicitud.fields['Remunerado']));
  const [compensado, setCompensado] = useState(Boolean(solicitud.fields['Compensado']));
  const [diasCompensacion, setDiasCompensacion] = useState<DiaCompensacion[]>([
    { fecha: "", horas: 0, descripcion: "" }
  ]);

  // Firma digital
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);

  const f = solicitud.fields;

  function agregarDiaCompensacion() {
    setDiasCompensacion([...diasCompensacion, { fecha: "", horas: 0, descripcion: "" }]);
  }

  function eliminarDiaCompensacion(index: number) {
    setDiasCompensacion(diasCompensacion.filter((_, i) => i !== index));
  }

  function actualizarDiaCompensacion(index: number, campo: keyof DiaCompensacion, valor: string | number) {
    const nuevos = [...diasCompensacion];
    nuevos[index] = { ...nuevos[index], [campo]: valor };
    setDiasCompensacion(nuevos);
  }

  async function handleSubmit() {
    if (!accion) {
      setError("Debe seleccionar aprobar o rechazar");
      return;
    }

    if (!firmaBlob) {
      setError("Debe firmar digitalmente antes de enviar");
      return;
    }

    // Validar campos específicos de permiso
    if (tipo === "permiso" && accion === "aprobar" && compensado) {
      const diasValidos = diasCompensacion.filter(d => d.fecha && d.horas > 0);
      if (diasValidos.length === 0) {
        setError("Debe agregar al menos un día de compensación con fecha y horas");
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Convertir firma a base64
      const firmaBase64 = await blobToBase64(firmaBlob);

      // Preparar body
      const body: Record<string, unknown> = {
        tabla: tipo,
        recordId: solicitud.id,
        accion,
        comentario: comentario.trim() || undefined,
        firmaBase64
      };

      // Agregar campos específicos de permiso
      if (tipo === "permiso" && accion === "aprobar") {
        body.remunerado = remunerado;
        body.compensado = compensado;

        if (compensado) {
          body.diasCompensacion = diasCompensacion.filter(d => d.fecha && d.horas > 0);
        }
      }

      const res = await fetch("/api/solicitudes/autorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al autorizar solicitud");
      }

      // Éxito
      onSuccess();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Autorizar {tipo === "permiso" ? "Permiso" : tipo === "vacaciones" ? "Vacaciones" : "Novedad"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Revise la información y firme para completar la autorización
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Información del solicitante */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Información del Solicitante</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Nombre:</span>
                <p className="font-medium text-gray-900 mt-1">{f['Nombre']}</p>
              </div>
              <div>
                <span className="text-gray-600">Cédula:</span>
                <p className="font-medium text-gray-900 mt-1">{f['Cedula'] || f['Numero Documento']}</p>
              </div>
              <div>
                <span className="text-gray-600">Cargo:</span>
                <p className="font-medium text-gray-900 mt-1">{f['Cargo'] || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-600">ID Empleado:</span>
                <p className="font-medium text-gray-900 mt-1">{f['ID Personal Core']}</p>
              </div>
            </div>
          </div>

          {/* Detalles de la solicitud */}
          <DetallesSolicitud tipo={tipo} fields={f} />

          {/* Firma del trabajador (si existe) */}
          {f['Firma_S3_Key'] && (
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Firma del Trabajador</h3>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Firmado digitalmente</p>
                  <p className="text-xs text-gray-500">
                    {f['Fecha_Firma_Trabajador'] ? `Fecha: ${f['Fecha_Firma_Trabajador']}` : 'Firma registrada'}
                  </p>
                </div>
                <a
                  href={`/api/firmas/${solicitud.id}?tipo=${tipo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Ver firma
                </a>
              </div>
            </div>
          )}

          {/* Decisión */}
          {!accion && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Decisión</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setAccion("aprobar")}
                  className="p-6 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all text-center group"
                >
                  <svg className="w-12 h-12 text-green-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-semibold text-gray-900 group-hover:text-green-700">Aprobar</p>
                </button>

                <button
                  onClick={() => setAccion("rechazar")}
                  className="p-6 border-2 border-red-200 rounded-xl hover:border-red-400 hover:bg-red-50 transition-all text-center group"
                >
                  <svg className="w-12 h-12 text-red-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-semibold text-gray-900 group-hover:text-red-700">Rechazar</p>
                </button>
              </div>
            </div>
          )}

          {/* Formulario de autorización */}
          {accion && (
            <>
              <div className={`border-l-4 ${accion === "aprobar" ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"} rounded-r-xl p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <svg
                    className={`w-6 h-6 ${accion === "aprobar" ? "text-green-600" : "text-red-600"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {accion === "aprobar" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                  <h3 className={`font-semibold ${accion === "aprobar" ? "text-green-900" : "text-red-900"}`}>
                    {accion === "aprobar" ? "Aprobar Solicitud" : "Rechazar Solicitud"}
                  </h3>
                  <button
                    onClick={() => setAccion(null)}
                    className="ml-auto text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cambiar
                  </button>
                </div>

                {/* Campos específicos para permisos */}
                {tipo === "permiso" && accion === "aprobar" && (
                  <CamposPermiso
                    remunerado={remunerado}
                    setRemunerado={setRemunerado}
                    compensado={compensado}
                    setCompensado={setCompensado}
                    diasCompensacion={diasCompensacion}
                    agregarDia={agregarDiaCompensacion}
                    eliminarDia={eliminarDiaCompensacion}
                    actualizarDia={actualizarDiaCompensacion}
                  />
                )}

                {/* Comentario */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comentario {accion === "rechazar" && "(obligatorio)"}
                  </label>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Agregue observaciones sobre esta autorización..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Firma digital */}
              <div className="border border-gray-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Firma Digital del Autorizador</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Su firma será registrada en el documento oficial de autorización
                </p>
                <FirmaCanvas
                  onFirmaCapturada={setFirmaBlob}
                  onLimpiar={() => setFirmaBlob(null)}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-6 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
          >
            Cancelar
          </button>

          {accion && (
            <button
              onClick={handleSubmit}
              disabled={loading || !firmaBlob}
              className={`px-8 py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                accion === "aprobar"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Procesando..." : accion === "aprobar" ? "Aprobar y Firmar" : "Rechazar y Firmar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Componentes auxiliares
function DetallesSolicitud({ tipo, fields }: { tipo: string; fields: Record<string, CampoAirtable> }) {
  if (tipo === "permiso") {
    return (
      <div className="border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Detalles del Permiso</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Tipo de permiso:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Tipo_Permiso']}</p>
          </div>
          <div>
            <span className="text-gray-600">Fecha del permiso:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Fecha de permiso']}</p>
          </div>
          {fields['Fecha fin de permiso'] && (
            <div>
              <span className="text-gray-600">Fecha fin:</span>
              <p className="font-medium text-gray-900 mt-1">{fields['Fecha fin de permiso']}</p>
            </div>
          )}
          <div>
            <span className="text-gray-600">Horas:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Horas Permiso'] || 'N/A'}</p>
          </div>
        </div>
        {fields['Motivo_Permiso'] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-600 text-sm font-medium">Motivo:</span>
            <p className="mt-2 text-gray-900">{fields['Motivo_Permiso']}</p>
          </div>
        )}
      </div>
    );
  }

  if (tipo === "vacaciones") {
    return (
      <div className="border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Detalles de Vacaciones</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Fecha de inicio:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Fecha Inicio']}</p>
          </div>
          <div>
            <span className="text-gray-600">Fecha de fin:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Fecha Fin']}</p>
          </div>
          <div>
            <span className="text-gray-600">Fecha de reintegro:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Fecha Reintegro'] || 'N/A'}</p>
          </div>
          <div>
            <span className="text-gray-600">Días de vacaciones:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Dias Vacaciones'] || 0}</p>
          </div>
        </div>
        {fields['Motivo'] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-600 text-sm font-medium">Motivo:</span>
            <p className="mt-2 text-gray-900">{fields['Motivo']}</p>
          </div>
        )}
      </div>
    );
  }

  // Novedades
  return (
    <div className="border border-gray-200 rounded-xl p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Detalles de Novedad</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Tipo de novedad:</span>
          <p className="font-medium text-gray-900 mt-1">{fields['Tipo de Novedad']}</p>
        </div>
        {fields['Número Horas Extras'] && (
          <div>
            <span className="text-gray-600">Horas extra:</span>
            <p className="font-medium text-gray-900 mt-1">{fields['Número Horas Extras']}</p>
          </div>
        )}
      </div>
      {fields['Descripción de la Novedad'] && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <span className="text-gray-600 text-sm font-medium">Descripción:</span>
          <p className="mt-2 text-gray-900">{fields['Descripción de la Novedad']}</p>
        </div>
      )}
    </div>
  );
}

function CamposPermiso({
  remunerado,
  setRemunerado,
  compensado,
  setCompensado,
  diasCompensacion,
  agregarDia,
  eliminarDia,
  actualizarDia
}: {
  remunerado: boolean;
  setRemunerado: (v: boolean) => void;
  compensado: boolean;
  setCompensado: (v: boolean) => void;
  diasCompensacion: DiaCompensacion[];
  agregarDia: () => void;
  eliminarDia: (i: number) => void;
  actualizarDia: (i: number, c: keyof DiaCompensacion, v: string | number) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Detalles de Autorización</h4>

      {/* Remunerado */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={remunerado}
          onChange={(e) => setRemunerado(e.target.checked)}
          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <div>
          <span className="font-medium text-gray-900">Permiso remunerado</span>
          <p className="text-sm text-gray-600">El tiempo será pagado normalmente</p>
        </div>
      </label>

      {/* Compensado */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={compensado}
          onChange={(e) => setCompensado(e.target.checked)}
          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <div>
          <span className="font-medium text-gray-900">Permiso compensatorio</span>
          <p className="text-sm text-gray-600">El trabajador compensará el tiempo</p>
        </div>
      </label>

      {/* Días de compensación */}
      {compensado && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-gray-900">Días de Compensación</h5>
            <button
              onClick={agregarDia}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Agregar día
            </button>
          </div>

          <div className="space-y-3">
            {diasCompensacion.map((dia, index) => (
              <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={dia.fecha}
                      onChange={(e) => actualizarDia(index, "fecha", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Horas</label>
                    <input
                      type="number"
                      value={dia.horas}
                      onChange={(e) => actualizarDia(index, "horas", parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.5"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={dia.descripcion}
                      onChange={(e) => actualizarDia(index, "descripcion", e.target.value)}
                      placeholder="Ej: Trabajará sábado en turno extra"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                {diasCompensacion.length > 1 && (
                  <button
                    onClick={() => eliminarDia(index)}
                    className="mt-6 text-red-600 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
