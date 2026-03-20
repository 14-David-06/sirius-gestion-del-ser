"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TurnoDia {
  trabaja: boolean;
  horario_nombre: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
}

interface EmpleadoCalendario {
  id: string;
  nombre: string;
  turno_por_dia: Record<string, TurnoDia>;
}

interface CalendarResponse {
  fecha_inicio: string;
  fecha_fin: string;
  empleados: EmpleadoCalendario[];
  total_empleados: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Obtiene las siglas de un nombre de horario (máx 2 letras). */
function obtenerSiglas(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length === 1) return nombre.substring(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

/** Formatea una fecha Date como YYYY-MM-DD en zona local. */
function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calcula el lunes de la semana que contiene `base`, desplazado por `offsetSemanas`. */
function lunesDeSemana(base: Date, offsetSemanas: number): Date {
  const d = new Date(base);
  // getDay() → 0 = Dom, 1 = Lun, …, 6 = Sáb
  const diaSemana = d.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diffLunes + offsetSemanas * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DIAS_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CronogramasPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [datos, setDatos] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);

  // Calcular rango de la semana
  const hoy = new Date();
  const lunes = lunesDeSemana(hoy, weekOffset);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  // Generar las 7 fechas de la semana (ISO string)
  const fechasSemana: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return formatISO(d);
  });

  const fechaInicio = fechasSemana[0];
  const fechaFin = fechasSemana[6];

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
    });
  };

  const cargarCalendario = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSinAcceso(false);
    try {
      const params = new URLSearchParams({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
      const res = await fetch(`/api/schedules/calendar?${params.toString()}`);

      if (res.status === 403) {
        setSinAcceso(true);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ||
            `Error ${res.status} al cargar el cronograma`
        );
      }

      const data: CalendarResponse = await res.json();
      setDatos(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar el cronograma"
      );
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    cargarCalendario();
  }, [cargarCalendario]);

  // ─── Calcular estadísticas desde datos reales ────────────────────────────
  const statsHorarios = (() => {
    if (!datos) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const emp of datos.empleados) {
      for (const iso of fechasSemana) {
        const turno = emp.turno_por_dia[iso];
        if (!turno) continue;
        if (turno.trabaja && turno.horario_nombre) {
          counts.set(
            turno.horario_nombre,
            (counts.get(turno.horario_nombre) ?? 0) + 1
          );
        }
      }
    }
    return counts;
  })();

  const totalDescansos = (() => {
    if (!datos) return 0;
    let count = 0;
    for (const emp of datos.empleados) {
      for (const iso of fechasSemana) {
        const turno = emp.turno_por_dia[iso];
        if (turno && !turno.trabaja) count++;
      }
    }
    return count;
  })();

  // ─── Sin acceso ───────────────────────────────────────────────────────────
  if (sinAcceso) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Acceso restringido</h2>
        <p className="text-sm text-white/50 max-w-sm">
          Solo disponible para administradores. Contacta a tu jefe de área si
          necesitas acceso a los cronogramas.
        </p>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Navegación semanas — siempre visible */}
        <NavSemana
          weekOffset={weekOffset}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          formatDate={formatDate}
          onChange={setWeekOffset}
        />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-14 h-14 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
            <p className="mt-5 text-white/40 text-sm font-medium">
              Cargando cronograma...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-8">
        <NavSemana
          weekOffset={weekOffset}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          formatDate={formatDate}
          onChange={setWeekOffset}
        />
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-red-300 mb-1">
            No se pudo cargar el cronograma
          </p>
          <p className="text-xs text-red-400/70 mb-5">{error}</p>
          <button
            onClick={cargarCalendario}
            className="px-5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-300 text-sm font-medium transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const empleados = datos?.empleados ?? [];

  // ─── Render principal ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Leyenda dinámica de horarios */}
      {statsHorarios.size > 0 && (
        <div className="flex flex-wrap gap-3">
          {Array.from(statsHorarios.entries()).map(([nombre]) => (
            <div
              key={nombre}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium backdrop-blur-sm shadow-lg bg-white/[0.08] text-white/70 border-white/[0.15]"
            >
              <span className="text-sm font-extrabold">
                {obtenerSiglas(nombre)}
              </span>
              <span className="font-semibold">{nombre}</span>
            </div>
          ))}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium backdrop-blur-sm shadow-lg bg-white/[0.04] text-white/20 border-white/[0.06]">
            <span className="text-sm font-extrabold">D</span>
            <span className="font-semibold">Descanso</span>
          </div>
        </div>
      )}

      {/* Navegación semanal */}
      <NavSemana
        weekOffset={weekOffset}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        formatDate={formatDate}
        onChange={setWeekOffset}
      />

      {/* Tabla del cronograma */}
      <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
        {empleados.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-white/20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-white/40">
              No hay empleados con horario asignado para esta semana
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider min-w-[180px]">
                    Empleado
                  </th>
                  {DIAS_LABELS.map((dia, i) => (
                    <th
                      key={dia}
                      className="text-center px-3 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider min-w-[100px]"
                    >
                      <div>{dia}</div>
                      <div className="text-[10px] text-white/30 font-normal mt-0.5 normal-case">
                        {formatDate(fechasSemana[i])}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-white">
                        {emp.nombre}
                      </p>
                    </td>
                    {fechasSemana.map((iso) => {
                      const turno = emp.turno_por_dia[iso];
                      if (!turno) {
                        return (
                          <td key={iso} className="px-3 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border bg-white/[0.02] border-white/[0.04] text-xs text-white/20">
                              —
                            </span>
                          </td>
                        );
                      }

                      if (!turno.trabaja) {
                        return (
                          <td key={iso} className="px-3 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border bg-white/[0.04] border-white/[0.06] text-sm font-bold text-white/20">
                              D
                            </span>
                          </td>
                        );
                      }

                      const siglas = turno.horario_nombre
                        ? obtenerSiglas(turno.horario_nombre)
                        : "?";
                      const tooltip =
                        turno.horario_nombre
                          ? `${turno.horario_nombre}${turno.hora_inicio && turno.hora_fin ? ` · ${turno.hora_inicio} – ${turno.hora_fin}` : ""}`
                          : "";

                      return (
                        <td key={iso} className="px-3 py-4 text-center">
                          <span
                            title={tooltip}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border bg-white/[0.08] border-white/[0.15] text-sm font-bold text-white/70 cursor-default"
                          >
                            {siglas}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Estadísticas calculadas desde datos reales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from(statsHorarios.entries())
          .slice(0, 3)
          .map(([nombre, count]) => (
            <div
              key={nombre}
              className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 shadow-lg shadow-black/10"
            >
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider truncate">
                {nombre}
              </p>
              <p className="text-2xl font-extrabold text-white mt-1">{count}</p>
              <p className="text-xs text-white/20 mt-0.5">turnos esta semana</p>
            </div>
          ))}
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] ring-1 ring-white/[0.04] p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">
            Descansos
          </p>
          <p className="text-2xl font-extrabold text-white mt-1">
            {totalDescansos}
          </p>
          <p className="text-xs text-white/20 mt-0.5">días esta semana</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: navegación semanal ───────────────────────────────────────

interface NavSemanaProps {
  weekOffset: number;
  fechaInicio: string;
  fechaFin: string;
  formatDate: (iso: string) => string;
  onChange: (offset: number) => void;
}

function NavSemana({
  weekOffset,
  fechaInicio,
  fechaFin,
  formatDate,
  onChange,
}: NavSemanaProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onChange(weekOffset - 1)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Anterior
      </button>
      <div className="text-center">
        <p className="text-sm font-semibold text-white">
          {formatDate(fechaInicio)} — {formatDate(fechaFin)}
        </p>
        {weekOffset === 0 && (
          <p className="text-xs text-white/50 mt-0.5">Semana actual</p>
        )}
      </div>
      <button
        onClick={() => onChange(weekOffset + 1)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
      >
        Siguiente
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </button>
    </div>
  );
}
