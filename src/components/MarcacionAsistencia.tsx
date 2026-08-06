"use client";

/**
 * Pantalla de asistencia del colaborador: un botón para marcar y el historial
 * del mes. El botón es uno solo — el servidor decide si la marcación es entrada
 * o salida, así que la única decisión del usuario es pulsarlo.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ZONA_BOGOTA,
  formatearDuracion,
  formatearFechaLarga,
  type DiaAsistencia,
  type Marcacion,
} from "@/lib/asistencia";
import { TIPOS_ASISTENCIA, type TipoAsistencia } from "@/lib/constants";

const COLOR_ENTRADA = "#6bb543";
const COLOR_SALIDA = "#1a51a8";

interface EstadoHoy {
  fecha: string;
  siguienteTipo: TipoAsistencia;
  jornadaAbierta: boolean;
  primeraEntrada: string | null;
  ultimaSalida: string | null;
  minutosTrabajados: number;
  marcaciones: Marcacion[];
}

interface RespuestaAsistencia {
  mes: string;
  hoy: EstadoHoy;
  dias: DiaAsistencia[];
  minutosMes: number;
}

/** YYYY-MM del mes en curso, desplazado por `offset` meses. */
function mesConDesplazamiento(offset: number): string {
  const hoy = new Date();
  const base = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + offset, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nombreMes(mes: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    month: "long",
    year: "numeric",
  }).format(new Date(`${mes}-15T12:00:00Z`));
}

export default function MarcacionAsistencia() {
  const [datos, setDatos] = useState<RespuestaAsistencia | null>(null);
  const [offsetMes, setOffsetMes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [marcando, setMarcando] = useState(false);
  const [error, setError] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [reloj, setReloj] = useState("");

  const mes = mesConDesplazamiento(offsetMes);
  const esMesActual = offsetMes === 0;

  // Reloj en hora de Colombia. Arranca vacío para no romper la hidratación:
  // el servidor no puede saber la hora del primer render del cliente.
  useEffect(() => {
    function actualizar() {
      setReloj(
        new Intl.DateTimeFormat("es-CO", {
          timeZone: ZONA_BOGOTA,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date()),
      );
    }
    actualizar();
    const id = setInterval(actualizar, 1000);
    return () => clearInterval(id);
  }, []);

  const cargar = useCallback(async (mesConsultado: string) => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/asistencia?mes=${mesConsultado}`, { cache: "no-store" });
      if (!res.ok) throw new Error("consulta fallida");
      setDatos(await res.json());
    } catch {
      setError("No pudimos cargar tu asistencia. Revisa tu conexión y vuelve a intentar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
  }, [cargar, mes]);

  async function marcar() {
    setMarcando(true);
    setError("");
    setConfirmacion("");
    try {
      const res = await fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const cuerpo = await res.json();

      if (!res.ok) {
        setError(cuerpo?.error ?? "No se pudo registrar la marcación.");
        return;
      }

      setConfirmacion(
        `${cuerpo.tipo} registrada a las ${cuerpo.hora}. ${
          cuerpo.tipo === TIPOS_ASISTENCIA.ENTRADA ? "¡Que tengas buen día!" : "¡Buen descanso!"
        }`,
      );
      // Se recarga para que el historial del mes incluya la marcación nueva.
      await cargar(mes);
    } catch {
      setError("No se pudo registrar la marcación. Revisa tu conexión y vuelve a intentar.");
    } finally {
      setMarcando(false);
    }
  }

  const hoy = datos?.hoy;
  const esEntrada = hoy?.siguienteTipo !== TIPOS_ASISTENCIA.SALIDA;
  const color = esEntrada ? COLOR_ENTRADA : COLOR_SALIDA;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Asistencia</h1>
        <p className="mt-1 text-sm text-gray-500">
          Marca tu entrada al empezar y tu salida al terminar. Nada más.
        </p>
      </div>

      {/* ── Tarjeta de marcación ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <p className="text-sm capitalize text-gray-500">
              {formatearFechaLarga(hoy?.fecha ?? new Date().toISOString().slice(0, 10))}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-gray-800">
              {reloj || "--:--:--"}
            </p>
          </div>

          <button
            type="button"
            onClick={marcar}
            disabled={marcando || cargando || !datos}
            className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:h-44 sm:w-44"
            style={{ background: color, boxShadow: `0 12px 28px ${color}45` }}
          >
            {marcando ? (
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {esEntrada ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15"
                    />
                  )}
                </svg>
                <span className="text-xs font-medium uppercase tracking-wider opacity-90">
                  Registrar
                </span>
                <span className="text-xl font-bold">
                  {esEntrada ? TIPOS_ASISTENCIA.ENTRADA : TIPOS_ASISTENCIA.SALIDA}
                </span>
              </>
            )}
          </button>

          {/* Resumen de hoy */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Chip etiqueta="Entrada" valor={hoy?.primeraEntrada ?? "—"} />
            <Chip etiqueta="Salida" valor={hoy?.ultimaSalida ?? "—"} />
            <Chip
              etiqueta="Trabajado hoy"
              valor={formatearDuracion(hoy?.minutosTrabajados ?? 0)}
              destacado
            />
            {hoy?.jornadaAbierta && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Jornada en curso
              </span>
            )}
          </div>

          {confirmacion && (
            <p className="rounded-lg border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">
              {confirmacion}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Marcaciones del día, por si marcó varias veces */}
          {hoy && hoy.marcaciones.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-gray-100 pt-4">
              {hoy.marcaciones.map((marcacion) => (
                <span
                  key={marcacion.id}
                  className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                >
                  <span
                    className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    style={{
                      background:
                        marcacion.tipo === TIPOS_ASISTENCIA.ENTRADA ? COLOR_ENTRADA : COLOR_SALIDA,
                    }}
                  />
                  {marcacion.tipo} {marcacion.hora}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Historial del mes ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800">Mi mes</h2>
            <p className="text-sm capitalize text-gray-500">{nombreMes(mes)}</p>
          </div>
          <div className="flex items-center gap-2">
            <BotonMes
              etiqueta="Mes anterior"
              onClick={() => setOffsetMes((v) => v - 1)}
              direccion="izquierda"
              deshabilitado={cargando}
            />
            <BotonMes
              etiqueta="Mes siguiente"
              onClick={() => setOffsetMes((v) => v + 1)}
              direccion="derecha"
              deshabilitado={cargando || esMesActual}
            />
          </div>
        </div>

        {cargando ? (
          <p className="py-8 text-center text-sm text-gray-400">Cargando…</p>
        ) : !datos || datos.dias.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Sin marcaciones registradas en este mes.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="pb-2 font-medium">Día</th>
                    <th className="pb-2 font-medium">Entrada</th>
                    <th className="pb-2 font-medium">Salida</th>
                    <th className="pb-2 text-right font-medium">Trabajado</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.dias.map((dia) => (
                    <tr key={dia.fecha} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 capitalize text-gray-700">
                        {formatearFechaLarga(dia.fecha)}
                      </td>
                      <td className="py-2.5 tabular-nums text-gray-600">
                        {dia.primeraEntrada ?? "—"}
                      </td>
                      <td className="py-2.5 tabular-nums text-gray-600">
                        {dia.jornadaAbierta && !dia.ultimaSalida ? (
                          <span className="text-amber-600">Sin salida</span>
                        ) : (
                          dia.ultimaSalida ?? "—"
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums text-gray-700">
                        {formatearDuracion(dia.minutosTrabajados)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
              <span className="text-gray-500">
                {datos.dias.length} {datos.dias.length === 1 ? "día" : "días"} con registro
              </span>
              <span className="font-semibold text-gray-800">
                Total: {formatearDuracion(datos.minutosMes)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs ${
        destacado ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-600"
      }`}
    >
      {etiqueta}: <strong className="font-semibold tabular-nums">{valor}</strong>
    </span>
  );
}

function BotonMes({
  etiqueta,
  onClick,
  direccion,
  deshabilitado,
}: {
  etiqueta: string;
  onClick: () => void;
  direccion: "izquierda" | "derecha";
  deshabilitado: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={etiqueta}
      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direccion === "izquierda" ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"}
        />
      </svg>
    </button>
  );
}
