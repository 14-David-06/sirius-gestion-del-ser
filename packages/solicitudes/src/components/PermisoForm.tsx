"use client";

import { useState, useEffect, FormEvent } from "react";
import { TIPOS_PERMISO, TIPO_DIA_PACTO } from "../lib/constants";
import { CalendarioPermiso } from "./CalendarioPermiso";
import { FirmaSection } from "./FirmaSection";
import { VoiceNoteButton } from "./VoiceNoteButton";
import {
  DatosEmpleado,
  ErrorMsg,
  Field,
  FormHeader,
  Icon,
  MODULOS,
  SectionTitle,
  SubmitButton,
  SuccessCard,
  inputCls,
} from "./ui";

interface Props {
  apiBasePath?: string;
  basePath?: string;
}

type Me = { nombre: string; cedula: string; idCore: string; cargo: string };
type DiasPactoData = { saldo_disponible: number };

const COLOR = MODULOS.permiso.color;
const CLS = inputCls("permiso");

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
      .then(setMe)
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

  function resetForm() {
    setSuccess(false);
    setTipo("");
    setModalidad("dias");
    setFechasSeleccionadas([]);
    setHoras("");
    setMotivo("");
    setFirmaBlob(null);
    setFirmaConfirmada(false);
  }

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
      <SuccessCard
        color={COLOR}
        titulo="Solicitud enviada"
        mensaje="Tu solicitud de permiso fue registrada exitosamente. RRHH la revisará pronto."
        onReset={resetForm}
        resetLabel="Nueva solicitud"
        basePath={basePath}
      />
    );

  const sinSaldo = esDiaPacto && diasPacto !== null && diasPacto.saldo_disponible === 0;

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <FormHeader
        modulo="permiso"
        titulo="Solicitud de Permiso"
        subtitulo="Los campos con * son obligatorios"
        backHref={basePath}
      />

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      >
        <div className="h-1" style={{ background: COLOR }} />

        <div className="flex flex-col gap-6 p-5 sm:p-6">
          {/* ── 1. Datos del solicitante ─────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <SectionTitle color={COLOR} paso={1}>
              Tus datos
            </SectionTitle>
            <DatosEmpleado me={me} color={COLOR} />
          </div>

          {/* ── 2. Detalle del permiso ───────────────────────────────────── */}
          <div className="flex flex-col gap-4 border-t border-gray-100 pt-5">
            <SectionTitle color={COLOR} paso={2}>
              Detalle del permiso
            </SectionTitle>

            <Field label="Tipo de permiso *">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                required
                className={CLS}
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
                className="rounded-xl border p-4"
                style={{
                  background: sinSaldo ? "#fef2f2" : "#f0f9ff",
                  borderColor: sinSaldo ? "#fecaca" : "#bae6fd",
                }}
              >
                <p
                  className="mb-2 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: sinSaldo ? "#b91c1c" : "#0369a1" }}
                >
                  <Icon
                    path={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                      />
                    }
                    className="h-4 w-4"
                    strokeWidth={1.8}
                  />
                  Políticas de Días de Pacto
                </p>
                <ul className="space-y-1 text-xs" style={{ color: sinSaldo ? "#991b1b" : "#075985" }}>
                  <li>• Consulta previamente con tu jefe de área</li>
                  <li>• No puedes tomar días de pacto consecutivos</li>
                  <li>• Evita fechas importantes para la empresa</li>
                </ul>
                {diasPacto && (
                  <div
                    className="mt-3 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2"
                    style={{ color: sinSaldo ? "#b91c1c" : "#0369a1" }}
                  >
                    <span className="text-xs font-medium">Saldo disponible</span>
                    <span className="text-sm font-bold">{diasPacto.saldo_disponible} / 2 días</span>
                  </div>
                )}
              </div>
            )}

            {/* Día de Pacto: siempre usa calendario */}
            {esDiaPacto && diasPacto && (
              <Field
                label="Selecciona tus días de pacto *"
                hint={`máx. ${diasPacto.saldo_disponible}`}
              >
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
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { v: "dias", label: "Por días", desc: "Uno o varios días" },
                      { v: "horas", label: "Por horas", desc: "Máximo 4 horas" },
                    ] as const
                  ).map((o) => {
                    const activo = modalidad === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setModalidad(o.v)}
                        aria-pressed={activo}
                        className="rounded-xl border px-4 py-3 text-left transition-all"
                        style={{
                          borderColor: activo ? COLOR : "#e5e7eb",
                          background: activo ? `${COLOR}0d` : "white",
                          boxShadow: activo ? `0 0 0 1px ${COLOR}` : undefined,
                        }}
                      >
                        <p
                          className="text-sm font-medium"
                          style={{ color: activo ? COLOR : "#374151" }}
                        >
                          {o.label}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{o.desc}</p>
                      </button>
                    );
                  })}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Fecha del permiso *">
                  <input
                    type="date"
                    value={fechasSeleccionadas[0] || ""}
                    onChange={(e) => setFechasSeleccionadas([e.target.value])}
                    required
                    className={CLS}
                  />
                </Field>
                <Field label="Horas de permiso *" hint="máx. 4">
                  <input
                    type="number"
                    min="0.5"
                    max="4"
                    step="0.5"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    placeholder="Ej: 2"
                    required={modalidad === "horas"}
                    className={CLS}
                  />
                </Field>
              </div>
            )}

            <Field label="Motivo *">
              <div className="flex flex-col gap-2.5">
                <VoiceNoteButton
                  onTranscript={(transcript) => {
                    // Agregar transcripción al final del texto actual
                    setMotivo((prev) => (prev ? `${prev} ${transcript}` : transcript));
                  }}
                  disabled={loading}
                  color={COLOR}
                />
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe brevemente el motivo del permiso..."
                  className={CLS + " resize-none"}
                />
              </div>
            </Field>
          </div>

          {/* ── 3. Firma ─────────────────────────────────────────────────── */}
          <FirmaSection
            color={COLOR}
            paso={3}
            firmaConfirmada={firmaConfirmada}
            onFirmar={(blob) => {
              setFirmaBlob(blob);
              setFirmaConfirmada(true);
            }}
            onLimpiar={() => {
              setFirmaBlob(null);
              setFirmaConfirmada(false);
            }}
          />

          <ErrorMsg>{error}</ErrorMsg>

          <SubmitButton
            color={COLOR}
            loading={loading}
            disabled={loading || !me || sinSaldo || !firmaConfirmada}
          >
            {loading ? "Enviando..." : sinSaldo ? "Sin días de pacto disponibles" : "Enviar solicitud"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
