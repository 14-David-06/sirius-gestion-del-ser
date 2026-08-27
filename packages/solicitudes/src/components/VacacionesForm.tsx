"use client";

import { useState, useEffect, FormEvent } from "react";
import { VoiceNoteButton } from "./VoiceNoteButton";
import { FirmaSection } from "./FirmaSection";
import { CalendarioPermiso } from "./CalendarioPermiso";
import { SelectorFecha } from "./SelectorFecha";
import {
  DatosEmpleado,
  ErrorMsg,
  Field,
  FormHeader,
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

const COLOR = MODULOS.vacaciones.color;
const CLS = inputCls("vacaciones");

// Tope legal de compensación en dinero: el trabajador puede pedir en plata
// hasta la mitad de sus 15 días hábiles de vacaciones (art. 20, Ley 1429 de
// 2010). En Sirius se maneja como máximo 7 días.
const MAX_DIAS_DINERO = 7;
const OPCIONES_DIAS_DINERO = Array.from({ length: MAX_DIAS_DINERO + 1 }, (_, i) => i);

/** Fila del resumen de días: etiqueta a la izquierda, cantidad a la derecha. */
function FilaResumen({
  label,
  valor,
  destacado = false,
}: {
  label: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={destacado ? "font-semibold text-white" : "text-white/70"}>{label}</dt>
      <dd
        className="flex-shrink-0 font-semibold tabular-nums"
        style={{ color: destacado ? COLOR : "rgba(255,255,255,0.85)" }}
      >
        {valor} {valor === 1 ? "día" : "días"}
      </dd>
    </div>
  );
}

export function VacacionesForm({ apiBasePath = "", basePath = "/dashboard/solicitudes" }: Props) {
  const [me, setMe] = useState<Me | null>(null);
  // El calendario en modo rango devuelve todos los días del período, no solo los extremos.
  const [fechas, setFechas] = useState<string[]>([]);
  const [fechaReintegro, setFechaReintegro] = useState("");
  const [diasDinero, setDiasDinero] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);
  const [firmaConfirmada, setFirmaConfirmada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBasePath}/api/me`).then((r) => r.json()).then(setMe);
  }, [apiBasePath]);

  const fechaInicio = fechas[0] ?? "";
  const fechaFin = fechas[fechas.length - 1] ?? "";
  const dias = fechas.length;
  // Lo que se radica son los días a disfrutar; los remunerados en dinero suman
  // al período causado, no al calendario de descanso.
  const totalVacaciones = dias + diasDinero;

  function resetForm() {
    setSuccess(false);
    setFechas([]);
    setFechaReintegro("");
    setDiasDinero(0);
    setMotivo("");
    setFirmaBlob(null);
    setFirmaConfirmada(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dias === 0) { setError("Selecciona en el calendario los días de vacaciones."); return; }

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
          diasRemunerados: diasDinero,
          totalVacaciones,
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
        className="glass-solid anim-entrada overflow-hidden rounded-2xl"
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
          <div className="flex flex-col gap-4 border-t border-white/10 pt-5">
            <SectionTitle color={COLOR} paso={2}>
              Período de vacaciones
            </SectionTitle>

            <Field label="Días de vacaciones *" hint="selecciona el primer y último día">
              <CalendarioPermiso
                modo="rango"
                color={COLOR}
                fechasSeleccionadas={fechas}
                onChange={setFechas}
                excluirDomingos
                excluirFestivos
              />
            </Field>

            <Field label="Fecha de reintegro" hint="opcional">
              <SelectorFecha
                valor={fechaReintegro}
                onChange={setFechaReintegro}
                placeholder="Elegir el día de reintegro"
                ariaLabel="Fecha de reintegro"
                color={COLOR}
                // No se puede volver antes de terminar las vacaciones.
                minimo={fechaFin}
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

          {/* ── 3. Días remunerados en dinero ─────────────────────────────── */}
          <div className="flex flex-col gap-4 border-t border-white/10 pt-5">
            <SectionTitle color={COLOR} paso={3}>
              Días remunerados en dinero
            </SectionTitle>

            <Field
              label="¿Cuántos días quieres recibir en dinero?"
              hint={`máximo ${MAX_DIAS_DINERO} días`}
            >
              <div className="flex flex-wrap gap-2">
                {OPCIONES_DIAS_DINERO.map((n) => {
                  const activo = n === diasDinero;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDiasDinero(n)}
                      aria-pressed={activo}
                      className="h-10 w-10 rounded-xl text-sm font-semibold ring-1 ring-inset ring-white/10 transition"
                      style={
                        activo
                          ? { background: COLOR, color: "#fff", boxShadow: `0 10px 24px -14px ${COLOR}` }
                          : { background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.8)" }
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </Field>

            <dl className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <FilaResumen label="Vacaciones a disfrutar" valor={dias} />
              <FilaResumen label="Remunerados en dinero" valor={diasDinero} />
              <div className="border-t border-white/10 pt-2">
                <FilaResumen label="Total de vacaciones" valor={totalVacaciones} destacado />
              </div>
            </dl>
          </div>

          {/* ── 4. Firma ─────────────────────────────────────────────────── */}
          <FirmaSection
            color={COLOR}
            paso={4}
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
