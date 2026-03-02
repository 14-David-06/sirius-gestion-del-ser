"use client";

import { useState } from "react";

interface Turno {
  id: string;
  empleado: string;
  cargo: string;
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
  domingo: string;
}

const turnos: Record<string, { label: string; color: string; hours: string }> = {
  M: { label: "Mañana", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", hours: "6:00 - 14:00" },
  T: { label: "Tarde", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", hours: "14:00 - 22:00" },
  N: { label: "Noche", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", hours: "22:00 - 6:00" },
  D: { label: "Descanso", color: "bg-white/[0.04] text-white/20 border-white/[0.06]", hours: "Libre" },
};

const diasSemana = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
const diasLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Mock data
const mockCronograma: Turno[] = [
  { id: "1", empleado: "Carlos Pérez", cargo: "Operador", lunes: "M", martes: "M", miercoles: "M", jueves: "T", viernes: "T", sabado: "D", domingo: "D" },
  { id: "2", empleado: "Ana Gómez", cargo: "Supervisora", lunes: "T", martes: "T", miercoles: "T", jueves: "M", viernes: "M", sabado: "M", domingo: "D" },
  { id: "3", empleado: "Luis Rodríguez", cargo: "Técnico", lunes: "N", martes: "N", miercoles: "N", jueves: "N", viernes: "D", sabado: "D", domingo: "M" },
  { id: "4", empleado: "María López", cargo: "Administrativa", lunes: "M", martes: "M", miercoles: "M", jueves: "M", viernes: "M", sabado: "D", domingo: "D" },
  { id: "5", empleado: "Pedro Sánchez", cargo: "Operador", lunes: "T", martes: "T", miercoles: "N", jueves: "N", viernes: "D", sabado: "M", domingo: "M" },
];

export default function CronogramasPage() {
  const [cronograma] = useState<Turno[]>(mockCronograma);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);

  const weekDates = diasSemana.map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(turnos).map(([key, t]) => (
          <div key={key} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium backdrop-blur-sm shadow-lg ${t.color}`}>
            <span className="text-sm font-extrabold">{key}</span>
            <span className="font-semibold">{t.label}</span>
            <span className="text-[10px] opacity-60">{t.hours}</span>
          </div>
        ))}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Anterior
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">
            {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
          </p>
          {weekOffset === 0 && (
            <p className="text-xs text-indigo-400 mt-0.5">Semana actual</p>
          )}
        </div>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
        >
          Siguiente
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Schedule grid */}
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] overflow-hidden backdrop-blur-sm shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider min-w-[180px]">
                  Empleado
                </th>
                {diasLabels.map((dia, i) => (
                  <th key={dia} className="text-center px-3 py-4 text-xs font-semibold text-white/50 uppercase tracking-wider min-w-[100px]">
                    <div>{dia}</div>
                    <div className="text-[10px] text-white/30 font-normal mt-0.5 normal-case">
                      {formatDate(weekDates[i])}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cronograma.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-white">{row.empleado}</p>
                    <p className="text-xs text-white/30">{row.cargo}</p>
                  </td>
                  {diasSemana.map((dia) => {
                    const turno = row[dia] as keyof typeof turnos;
                    const t = turnos[turno];
                    return (
                      <td key={dia} className="px-3 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border text-sm font-bold ${t?.color || "bg-white/[0.04] text-white/20"}`}>
                          {turno}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-blue-500/20 ring-1 ring-blue-500/10 p-5 shadow-lg shadow-blue-500/5">
          <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">Turno Mañana</p>
          <p className="text-2xl font-extrabold text-blue-400 mt-1">
            {cronograma.reduce((acc, r) => acc + diasSemana.filter((d) => r[d] === "M").length, 0)}
          </p>
          <p className="text-xs text-white/20 mt-0.5">turnos esta semana</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/20 ring-1 ring-amber-500/10 p-5 shadow-lg shadow-amber-500/5">
          <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Turno Tarde</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">
            {cronograma.reduce((acc, r) => acc + diasSemana.filter((d) => r[d] === "T").length, 0)}
          </p>
          <p className="text-xs text-white/20 mt-0.5">turnos esta semana</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-purple-500/20 ring-1 ring-purple-500/10 p-5 shadow-lg shadow-purple-500/5">
          <p className="text-[11px] text-purple-400 font-semibold uppercase tracking-wider">Turno Noche</p>
          <p className="text-2xl font-extrabold text-purple-400 mt-1">
            {cronograma.reduce((acc, r) => acc + diasSemana.filter((d) => r[d] === "N").length, 0)}
          </p>
          <p className="text-xs text-white/20 mt-0.5">turnos esta semana</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.08] ring-1 ring-white/[0.04] p-5 shadow-lg shadow-black/10">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Descansos</p>
          <p className="text-2xl font-extrabold text-white mt-1">
            {cronograma.reduce((acc, r) => acc + diasSemana.filter((d) => r[d] === "D").length, 0)}
          </p>
          <p className="text-xs text-white/20 mt-0.5">días esta semana</p>
        </div>
      </div>
    </div>
  );
}
