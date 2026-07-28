"use client";

import { useState, useEffect, FormEvent } from "react";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { FirmaSection } from "./FirmaSection";
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
  formatFecha,
  inputCls,
} from "./ui";

interface Props {
  apiBasePath?: string;
  basePath?: string;
}

type Me = { nombre: string; cedula: string; idCore: string; cargo: string };

const COLOR = MODULOS.vacaciones.color;
const CLS = inputCls("vacaciones");

function calcDias(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const d1 = new Date(inicio + "T12:00:00");
  const d2 = new Date(fin + "T12:00:00");
  if (d2 < d1) return 0;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

export function VacacionesForm({ apiBasePath = "", basePath = "/dashboard/solicitudes" }: Props) {
  const [me, setMe] = useState<Me | null>(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [fechaReintegro, setFechaReintegro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);
  const [firmaConfirmada, setFirmaConfirmada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBasePath}/api/me`).then((r) => r.json()).then(setMe);
  }, [apiBasePath]);

  const dias = calcDias(fechaInicio, fechaFin);

  function resetForm() {
    setSuccess(false);
    setFechaInicio("");
    setFechaFin("");
    setFechaReintegro("");
    setMotivo("");
    setFirmaBlob(null);
    setFirmaConfirmada(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) { setError("Selecciona las fechas de inicio y fin."); return; }
    if (dias <= 0) { setError("La fecha de fin debe ser posterior a la de inicio."); return; }

    if (!firmaConfirmada || !firmaBlob) {
      setError("Debes firmar la solicitud antes de enviar.");
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
          resolve(result.split(",")[1]); // Extraer solo el base64 sin el prefijo
        };
        reader.onerror = reject;
        reader.readAsDataURL(firmaBlob);
      });

      const res = await fetch(`${apiBasePath}/api/solicitudes/vacaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaInicio,
          fechaFin,
          fechaReintegro: fechaReintegro || undefined,
          dias,
          motivo,
          cargo: me?.cargo,
          firmaBase64
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setSuccess(true);
    } catch { setError("Error de conexión. Intenta de nuevo."); }
    finally { setLoading(false); }
  }

  if (success)
    return (
      <SuccessCard
        color={COLOR}
        titulo="Solicitud enviada"
        mensaje="Tu solicitud de vacaciones fue registrada. RRHH la revisará y te notificará."
        onReset={resetForm}
        resetLabel="Nueva solicitud"
        basePath={basePath}
      />
    );

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <FormHeader
        modulo="vacaciones"
        titulo="Solicitud de Vacaciones"
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

          {/* ── 2. Período ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 border-t border-gray-100 pt-5">
            <SectionTitle color={COLOR} paso={2}>
              Período de vacaciones
            </SectionTitle>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Fecha de inicio *">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                  className={CLS}
                />
              </Field>
              <Field label="Fecha de fin *">
                <input
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                  className={CLS}
                />
              </Field>
            </div>

            {dias > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "#f0fdf4", color: "#15803d" }}
              >
                <Icon path={MODULOS.vacaciones.icon} className="h-4 w-4" strokeWidth={1.8} />
                {dias} día{dias !== 1 ? "s" : ""} calendario
                <span className="font-normal opacity-70">
                  · {formatFecha(fechaInicio)} → {formatFecha(fechaFin)}
                </span>
              </div>
            )}

            <Field label="Fecha de reintegro" hint="opcional">
              <input
                type="date"
                value={fechaReintegro}
                min={fechaFin}
                onChange={(e) => setFechaReintegro(e.target.value)}
                className={CLS}
              />
            </Field>

            <Field label="Motivo o comentario" hint="opcional">
              <div className="flex flex-col gap-2.5">
                <VoiceNoteButton
                  onTranscript={(transcript) => {
                    setMotivo((prev) => (prev ? `${prev} ${transcript}` : transcript));
                  }}
                  disabled={loading}
                  color={COLOR}
                />
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Agrega contexto si lo consideras necesario."
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
            disabled={loading || !me || !firmaConfirmada}
          >
            {loading ? "Enviando..." : "Enviar solicitud"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
