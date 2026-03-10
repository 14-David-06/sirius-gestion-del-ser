"use client";

import { useState, useEffect, useCallback } from "react";

interface RegistroAsistencia {
  id: string;
  tipo: "Entrada" | "Salida";
  hora: string;
  fecha: string;
  fechaHora: string;
  ubicacion: string;
  notas: string;
}

interface EmpleadoInfo {
  recordId: string;
  nombre: string;
  cedula: string;
}

export default function AsistenciaPage() {
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");
  const [empleado, setEmpleado] = useState<EmpleadoInfo | null>(null);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [registrosHoy, setRegistrosHoy] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(false);
  const [marcaExitosa, setMarcaExitosa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Real-time clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setHora(
        now.toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setFecha(
        now.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch attendance data from API
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/asistencia");
      if (!res.ok) throw new Error("Error al cargar datos de asistencia");
      const data = await res.json();
      setEmpleado(data.empleado);
      setRegistros(data.registros);
      setRegistrosHoy(data.registrosHoy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine next action based on today's records
  const ultimoRegistroHoy = registrosHoy.length > 0 ? registrosHoy[0] : null;
  const siguienteTipo: "Entrada" | "Salida" =
    !ultimoRegistroHoy || ultimoRegistroHoy.tipo === "Salida" ? "Entrada" : "Salida";

  async function marcarAsistencia() {
    setMarcando(true);
    setError(null);
    try {
      const res = await fetch("/api/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: siguienteTipo,
          ubicacion: "Plataforma Web",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar asistencia");
      }

      const data = await res.json();
      setMarcaExitosa(
        siguienteTipo === "Entrada"
          ? `¡Entrada registrada a las ${data.registro.hora}!`
          : `¡Salida registrada a las ${data.registro.hora}!`
      );

      // Refresh data from server
      await fetchData();

      setTimeout(() => setMarcaExitosa(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setMarcando(false);
    }
  }

  // Stats
  const totalHoy = registrosHoy.length;
  const entradasHoy = registrosHoy.filter((r) => r.tipo === "Entrada").length;
  const salidasHoy = registrosHoy.filter((r) => r.tipo === "Salida").length;

  // Group history by date
  const registrosPorFecha = registros.reduce<Record<string, RegistroAsistencia[]>>(
    (acc, r) => {
      const key = r.fecha || "Sin fecha";
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    },
    {}
  );
  const fechasOrdenadas = Object.keys(registrosPorFecha).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-white/40 font-medium text-sm">
            Cargando registro de asistencia...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Employee info bar */}
      {empleado && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/20 border border-white/[0.08]">
          <div className="w-10 h-10 rounded-full bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center text-sm font-bold text-white/70">
            {empleado.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{empleado.nombre}</p>
            <p className="text-xs text-white/40">CC {empleado.cedula}</p>
          </div>
        </div>
      )}

      {/* Clock + Mark button */}
      <div className="rounded-2xl bg-black/30 border border-white/[0.08] p-8 text-center backdrop-blur-sm shadow-xl shadow-black/20 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-white/[0.03] rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-6xl sm:text-7xl font-extrabold text-white font-mono tracking-wider drop-shadow-lg">
            {hora}
          </p>
          <p className="text-sm text-white/40 mt-3 capitalize">{fecha}</p>

          <div className="mt-8">
            <button
              onClick={marcarAsistencia}
              disabled={marcando}
              className={`relative px-12 py-5 rounded-2xl text-lg font-bold transition-all duration-300 disabled:opacity-60 cursor-pointer ${
                siguienteTipo === "Entrada"
                  ? "bg-white/[0.12] hover:bg-white/[0.18] text-white shadow-lg shadow-black/15"
                  : "bg-white/[0.08] hover:bg-white/[0.12] text-white shadow-lg shadow-black/15"
              }`}
            >
              {marcando ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Registrando...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {siguienteTipo === "Entrada" ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                  )}
                  Marcar {siguienteTipo === "Entrada" ? "Entrada" : "Salida"}
                </div>
              )}
            </button>
          </div>

          {/* Success message */}
          {marcaExitosa && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/70 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {marcaExitosa}
            </div>
          )}
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] ring-1 ring-white/[0.04] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Marcas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{totalHoy}</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Entradas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{entradasHoy}</p>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.12] ring-1 ring-white/[0.06] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Salidas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{salidasHoy}</p>
        </div>
      </div>

      {/* Today's timeline */}
      {registrosHoy.length > 0 && (
        <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center">
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Registros de Hoy</h3>
              <p className="text-xs text-white/40">{registrosHoy.length} marca{registrosHoy.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {registrosHoy.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      r.tipo === "Entrada"
                        ? "bg-white/[0.08] ring-1 ring-white/[0.12]"
                        : "bg-white/[0.04] ring-1 ring-white/[0.08]"
                    }`}
                  >
                    {r.tipo === "Entrada" ? (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.tipo}</p>
                    <p className="text-xs text-white/30">{r.ubicacion || "Plataforma Web"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-mono font-bold text-white">{r.hora}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full history grouped by date */}
      <div className="rounded-2xl bg-black/30 border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.08] ring-1 ring-white/[0.12] flex items-center justify-center">
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Historial Completo</h3>
            <p className="text-xs text-white/40">{registros.length} registro{registros.length !== 1 ? "s" : ""} recientes</p>
          </div>
        </div>

        {fechasOrdenadas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/40">No hay registros de asistencia aún</p>
            <p className="text-xs text-white/25 mt-1">Marca tu primera entrada para comenzar</p>
          </div>
        ) : (
          <div>
            {fechasOrdenadas.map((fechaKey) => {
              const regs = registrosPorFecha[fechaKey];
              const fechaDisplay = new Date(fechaKey + "T12:00:00").toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const entradasDia = regs.filter((r) => r.tipo === "Entrada").length;
              const salidasDia = regs.filter((r) => r.tipo === "Salida").length;

              return (
                <div key={fechaKey}>
                  {/* Date header */}
                  <div className="px-6 py-3 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between">
                    <p className="text-xs font-semibold text-white/50 capitalize">{fechaDisplay}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-emerald-400/70 font-medium">{entradasDia} entrada{entradasDia !== 1 ? "s" : ""}</span>
                      <span className="text-[10px] text-red-400/70 font-medium">{salidasDia} salida{salidasDia !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {/* Records for this date */}
                  <div className="divide-y divide-white/[0.03]">
                    {regs.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              r.tipo === "Entrada"
                                ? "bg-white/[0.06] ring-1 ring-white/[0.1]"
                                : "bg-white/[0.03] ring-1 ring-white/[0.06]"
                            }`}
                          >
                            {r.tipo === "Entrada" ? (
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${r.tipo === "Entrada" ? "text-emerald-400" : "text-red-400"}`}>
                              {r.tipo}
                            </span>
                            {r.ubicacion && (
                              <p className="text-[11px] text-white/25">{r.ubicacion}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-mono font-semibold text-white/70">{r.hora}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
