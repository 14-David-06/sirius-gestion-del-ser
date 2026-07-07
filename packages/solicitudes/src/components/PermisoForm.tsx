"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { TIPOS_PERMISO, TIPO_DIA_PACTO } from "../lib/constants";
import { CalendarioPermiso } from "./CalendarioPermiso";
import { FirmaCanvas } from "./FirmaCanvas";

interface Props {
  apiBasePath?: string;
  basePath?: string;
}

type Me = { nombre: string; cedula: string; idCore: string; cargo: string };
type DiasPactoData = { saldo_disponible: number };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#1a51a8] focus:ring-1 focus:ring-[#1a51a8] transition-all";
const readonlyCls = "w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-500 bg-gray-50 cursor-default";

export function PermisoForm({ apiBasePath = "", basePath = "/dashboard/solicitudes" }: Props) {
  const [me, setMe] = useState<Me | null>(null);
  const [diasPacto, setDiasPacto] = useState<DiasPactoData | null>(null);
  const [tipo, setTipo] = useState("");
  const [modalidad, setModalidad] = useState<"dias" | "horas">("dias");
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([]);
  const [horas, setHoras] = useState("");
  const [motivo, setMotivo] = useState("");
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);
  const [firmaConfirmada, setFirmaConfirmada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const esDiaPacto = tipo === TIPO_DIA_PACTO;

  useEffect(() => {
    fetch(`${apiBasePath}/api/me`)
      .then((r) => r.json())
      .then((data) => {
        console.log("[PermisoForm] Me data:", data);
        setMe(data);
      })
      .catch((err) => console.error("[PermisoForm] Error fetching /api/me:", err));
  }, [apiBasePath]);

  useEffect(() => {
    if (esDiaPacto) {
      fetch(`${apiBasePath}/api/dias-pacto/saldo`)
        .then((r) => r.json())
        .then(setDiasPacto)
        .catch((err) => console.error("[PermisoForm] Error fetching dias-pacto:", err));
    }
  }, [esDiaPacto, apiBasePath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tipo || !motivo) {
      setError("Completa los campos obligatorios.");
      return;
    }

    if (!firmaConfirmada || !firmaBlob) {
      setError("Debes firmar la solicitud antes de enviar.");
      return;
    }

    if (modalidad === "dias" && fechasSeleccionadas.length === 0) {
      setError("Debes seleccionar al menos un día de permiso.");
      return;
    }

    if (modalidad === "horas" && !horas) {
      setError("Debes especificar las horas de permiso.");
      return;
    }

    if (modalidad === "horas" && Number(horas) > 4) {
      setError("Las horas de permiso no pueden ser mayores a 4.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Convertir blob a base64
      const reader = new FileReader();
      const firmaBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Extraer solo el base64 sin el prefijo data:image/png;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(firmaBlob);
      });

      const body: Record<string, unknown> = {
        tipo,
        motivo,
        cargo: me?.cargo || "",
        firmaBase64,
      };

      if (modalidad === "dias") {
        body.fechaInicio = fechasSeleccionadas[0];
        if (fechasSeleccionadas.length > 1) {
          body.fechaFin = fechasSeleccionadas[fechasSeleccionadas.length - 1];
        }
      } else {
        body.fechaInicio = fechasSeleccionadas[0];
        body.horas = horas;
      }

      const res = await fetch(`${apiBasePath}/api/solicitudes/permiso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error);
        return;
      }

      setSuccess(true);

      if (esDiaPacto) {
        setTimeout(() => (window.location.href = basePath), 1500);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success)
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center text-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#dcfce7" }}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Solicitud enviada</h2>
          <p className="text-gray-500 text-sm">
            Tu solicitud de permiso fue registrada exitosamente. RRHH la revisará pronto.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => {
                setSuccess(false);
                setTipo("");
                setModalidad("dias");
                setFechasSeleccionadas([]);
                setHoras("");
                setMotivo("");
              }}
              className="px-5 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Nueva solicitud
            </button>
            <Link
              href={basePath}
              className="px-5 py-2 rounded-xl text-sm text-white font-medium transition-colors"
              style={{ background: "#1a51a8" }}
            >
              Ver mis solicitudes
            </Link>
          </div>
        </div>
      </div>
    );

  const sinSaldo = esDiaPacto && diasPacto !== null && diasPacto.saldo_disponible === 0;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={basePath}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Solicitud de Permiso</h1>
          <p className="text-sm text-gray-500">Los campos con * son obligatorios</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5"
      >
        <div className="pb-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tus datos</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre completo">
              <div className={readonlyCls}>{me?.nombre ?? "Cargando..."}</div>
            </Field>
            <Field label="Cédula">
              <div className={readonlyCls}>{me?.cedula ?? "—"}</div>
            </Field>
            <Field label="Cargo">
              <div className={readonlyCls}>{me?.cargo || "Sin cargo asignado"}</div>
            </Field>
            <Field label="ID empleado">
              <div className={readonlyCls}>{me?.idCore ?? "—"}</div>
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle del permiso</p>

          <Field label="Tipo de permiso *">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              required
              className={inputCls}
              style={{ background: "white" }}
            >
              <option value="">Selecciona un tipo...</option>
              {TIPOS_PERMISO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {esDiaPacto && (
            <div
              className="rounded-xl p-4 border"
              style={{
                background: sinSaldo ? "#fee2e2" : "#f0f9ff",
                borderColor: sinSaldo ? "#fecaca" : "#bae6fd",
              }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: sinSaldo ? "#b91c1c" : "#0369a1" }}>
                📋 Políticas de Días de Pacto
              </p>
              <ul className="text-xs space-y-1" style={{ color: sinSaldo ? "#991b1b" : "#075985" }}>
                <li>• Consulta previamente con tu jefe de área</li>
                <li>• No puedes tomar días de pacto consecutivos</li>
                <li>• Evita fechas importantes para la empresa</li>
              </ul>
              {diasPacto && (
                <p className="text-xs font-semibold mt-3" style={{ color: sinSaldo ? "#b91c1c" : "#0369a1" }}>
                  Saldo disponible: {diasPacto.saldo_disponible} de 2 días
                </p>
              )}
            </div>
          )}

          {/* Día de Pacto: siempre usa calendario */}
          {esDiaPacto && diasPacto && (
            <Field label={`Selecciona tus días de pacto (máx. ${diasPacto.saldo_disponible}) *`}>
              <CalendarioPermiso
                fechasSeleccionadas={fechasSeleccionadas}
                onChange={(fechas) => {
                  if (fechas.length <= diasPacto.saldo_disponible) {
                    setFechasSeleccionadas(fechas);
                  }
                }}
                maxDias={diasPacto.saldo_disponible}
              />
            </Field>
          )}

          {/* Otros permisos: selector de modalidad */}
          {tipo && !esDiaPacto && (
            <Field label="Modalidad del permiso *">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="modalidad"
                    value="dias"
                    checked={modalidad === "dias"}
                    onChange={() => setModalidad("dias")}
                    className="w-4 h-4"
                  />
                  Por días
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="modalidad"
                    value="horas"
                    checked={modalidad === "horas"}
                    onChange={() => setModalidad("horas")}
                    className="w-4 h-4"
                  />
                  Por horas (máx. 4)
                </label>
              </div>
            </Field>
          )}

          {/* Calendario para permisos por días (NO día de pacto) */}
          {tipo && !esDiaPacto && modalidad === "dias" && (
            <Field label="Selecciona los días de permiso *">
              <CalendarioPermiso
                fechasSeleccionadas={fechasSeleccionadas}
                onChange={setFechasSeleccionadas}
              />
            </Field>
          )}

          {/* Permiso por horas */}
          {tipo && !esDiaPacto && modalidad === "horas" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha del permiso *">
                <input
                  type="date"
                  value={fechasSeleccionadas[0] || ""}
                  onChange={(e) => setFechasSeleccionadas([e.target.value])}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Horas de permiso *">
                <input
                  type="number"
                  min="0.5"
                  max="4"
                  step="0.5"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="Ej: 2"
                  required={modalidad === "horas"}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          <Field label="Motivo *">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              rows={3}
              placeholder="Describe brevemente el motivo del permiso..."
              className={inputCls + " resize-none"}
            />
          </Field>

          {/* Firma del trabajador */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Firma del trabajador *
            </p>
            {!firmaConfirmada ? (
              <FirmaCanvas
                onFirmaCapturada={(blob) => {
                  setFirmaBlob(blob);
                  setFirmaConfirmada(true);
                }}
                onLimpiar={() => {
                  setFirmaBlob(null);
                  setFirmaConfirmada(false);
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-800 font-medium">Firma capturada correctamente</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFirmaBlob(null);
                    setFirmaConfirmada(false);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Volver a firmar
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !me || sinSaldo || !firmaConfirmada}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "#1a51a8" }}
        >
          {loading ? "Enviando..." : sinSaldo ? "Sin días de pacto disponibles" : "Enviar solicitud"}
        </button>
      </form>
    </div>
  );
}
