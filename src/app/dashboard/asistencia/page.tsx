"use client";

import { useState, useEffect } from "react";

interface RegistroAsistencia {
  id: string;
  tipo: "entrada" | "salida";
  hora: string;
  fecha: string;
  ubicacion?: string;
}

export default function AsistenciaPage() {
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([
    { id: "1", tipo: "entrada", hora: "07:58", fecha: "2026-03-01", ubicacion: "Oficina principal" },
    { id: "2", tipo: "salida", hora: "17:05", fecha: "2026-03-01", ubicacion: "Oficina principal" },
    { id: "3", tipo: "entrada", hora: "08:02", fecha: "2026-02-28", ubicacion: "Oficina principal" },
    { id: "4", tipo: "salida", hora: "16:55", fecha: "2026-02-28", ubicacion: "Oficina principal" },
  ]);
  const [marcando, setMarcando] = useState(false);
  const [marcaExitosa, setMarcaExitosa] = useState<string | null>(null);

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

  const hoyRegistros = registros.filter(
    (r) => r.fecha === new Date().toISOString().split("T")[0]
  );
  const ultimoRegistro = hoyRegistros[0];
  const siguienteTipo: "entrada" | "salida" =
    !ultimoRegistro || ultimoRegistro.tipo === "salida" ? "entrada" : "salida";

  async function marcarAsistencia() {
    setMarcando(true);
    // Simulate async call
    await new Promise((r) => setTimeout(r, 1500));

    const now = new Date();
    const nuevo: RegistroAsistencia = {
      id: `${Date.now()}`,
      tipo: siguienteTipo,
      hora: now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }),
      fecha: now.toISOString().split("T")[0],
      ubicacion: "Oficina principal",
    };
    setRegistros([nuevo, ...registros]);
    setMarcaExitosa(siguienteTipo === "entrada" ? "¡Entrada registrada!" : "¡Salida registrada!");
    setMarcando(false);
    setTimeout(() => setMarcaExitosa(null), 3000);
  }

  // Stats
  const totalHoy = hoyRegistros.length;
  const entradas = registros.filter((r) => r.tipo === "entrada").length;
  const salidas = registros.filter((r) => r.tipo === "salida").length;

  return (
    <div className="space-y-8">
      {/* Clock + Mark button */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.08] p-8 text-center backdrop-blur-sm shadow-xl shadow-black/20 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative">
        <p className="text-6xl sm:text-7xl font-extrabold text-white font-mono tracking-wider drop-shadow-lg">
          {hora}
        </p>
        <p className="text-sm text-white/40 mt-3 capitalize">{fecha}</p>

        <div className="mt-8">
          <button
            onClick={marcarAsistencia}
            disabled={marcando}
            className={`relative px-12 py-5 rounded-2xl text-lg font-bold transition-all duration-300 disabled:opacity-60 ${
              siguienteTipo === "entrada"
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"
            }`}
          >
            {marcando ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Registrando...
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {siguienteTipo === "entrada" ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                )}
                Marcar {siguienteTipo === "entrada" ? "Entrada" : "Salida"}
              </div>
            )}
          </button>
        </div>

        {/* Success message */}
        {marcaExitosa && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-in fade-in">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {marcaExitosa}
          </div>
        )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.08] ring-1 ring-white/[0.04] p-5 text-center shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Marcas Hoy</p>
          <p className="text-2xl font-extrabold text-white mt-1">{totalHoy}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/20 ring-1 ring-emerald-500/10 p-5 text-center shadow-lg shadow-emerald-500/5">
          <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Entradas</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{entradas}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-500/15 to-red-600/5 border border-red-500/20 ring-1 ring-red-500/10 p-5 text-center shadow-lg shadow-red-500/5">
          <p className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">Salidas</p>
          <p className="text-2xl font-extrabold text-red-400 mt-1">{salidas}</p>
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
        <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-base font-bold text-white tracking-tight">Historial Reciente</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {registros.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    r.tipo === "entrada"
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  {r.tipo === "entrada" ? (
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
                  <p className="text-sm font-medium text-white capitalize">{r.tipo}</p>
                  <p className="text-xs text-white/30">{r.ubicacion}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-white">{r.hora}</p>
                <p className="text-xs text-white/30">{r.fecha}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
