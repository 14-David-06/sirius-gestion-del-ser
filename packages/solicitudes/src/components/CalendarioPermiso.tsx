"use client";

import { useState } from "react";
import { Icon, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, MODULOS } from "./ui";

interface Props {
  fechasSeleccionadas: string[];
  onChange: (fechas: string[]) => void;
  maxDias?: number; // Límite máximo de días seleccionables
  color?: string;
}

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const NOMBRES_DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Convierte a "YYYY-MM-DD" en zona local — toISOString() desfasa el día. */
function toISODate(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CalendarioPermiso({
  fechasSeleccionadas,
  onChange,
  maxDias,
  color = MODULOS.permiso.color,
}: Props) {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [anioActual, setAnioActual] = useState(hoy.getFullYear());

  const limiteAlcanzado = maxDias !== undefined && fechasSeleccionadas.length >= maxDias;

  function obtenerDiasDelMes(mes: number, anio: number): (number | null)[] {
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    const dias: (number | null)[] = [];

    // Espacios vacíos al inicio (para alinear el primer día)
    for (let i = 0; i < primerDia.getDay(); i++) {
      dias.push(null);
    }

    // Días del mes
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      dias.push(dia);
    }

    return dias;
  }

  function toggleFecha(dia: number) {
    const fechaStr = toISODate(anioActual, mesActual, dia);

    if (fechasSeleccionadas.includes(fechaStr)) {
      onChange(fechasSeleccionadas.filter((f) => f !== fechaStr));
    } else {
      // Seleccionar solo si no se alcanzó el máximo
      if (limiteAlcanzado) return;
      onChange([...fechasSeleccionadas, fechaStr].sort());
    }
  }

  function esFechaSeleccionada(dia: number): boolean {
    return fechasSeleccionadas.includes(toISODate(anioActual, mesActual, dia));
  }

  function esFechaPasada(dia: number): boolean {
    const fecha = new Date(anioActual, mesActual, dia);
    fecha.setHours(0, 0, 0, 0);
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    return fecha < hoyInicio;
  }

  function esHoy(dia: number): boolean {
    return (
      dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear()
    );
  }

  function cambiarMes(delta: number) {
    let nuevoMes = mesActual + delta;
    let nuevoAnio = anioActual;

    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio--;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio++;
    }

    setMesActual(nuevoMes);
    setAnioActual(nuevoAnio);
  }

  const dias = obtenerDiasDelMes(mesActual, anioActual);
  const navBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header del calendario */}
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className={navBtn}>
          <Icon path={ICON_CHEVRON_LEFT} className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <div className="text-sm font-semibold text-gray-800">
          {NOMBRES_MESES[mesActual]} <span className="font-normal text-gray-400">{anioActual}</span>
        </div>

        <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className={navBtn}>
          <Icon path={ICON_CHEVRON_RIGHT} className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Nombres de días */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {NOMBRES_DIAS.map((nombre, i) => (
          <div
            key={nombre}
            className={`py-1 text-center text-[11px] font-medium uppercase tracking-wide ${
              i === 0 || i === 6 ? "text-gray-300" : "text-gray-400"
            }`}
          >
            {nombre}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia, idx) => {
          if (dia === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const seleccionado = esFechaSeleccionada(dia);
          const pasado = esFechaPasada(dia);
          const bloqueado = pasado || (limiteAlcanzado && !seleccionado);

          return (
            <button
              key={dia}
              type="button"
              onClick={() => !bloqueado && toggleFecha(dia)}
              disabled={bloqueado}
              aria-pressed={seleccionado}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-all ${
                seleccionado
                  ? "text-white shadow-sm"
                  : pasado
                    ? "cursor-not-allowed text-gray-300"
                    : limiteAlcanzado
                      ? "cursor-not-allowed text-gray-300"
                      : "text-gray-700 hover:bg-gray-100 active:scale-95"
              }`}
              style={seleccionado ? { background: color } : undefined}
            >
              {dia}
              {esHoy(dia) && !seleccionado && (
                <span
                  className="absolute bottom-1 h-1 w-1 rounded-full"
                  style={{ background: color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contador de días */}
      {(fechasSeleccionadas.length > 0 || maxDias) && (
        <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-600">
          <span className="font-semibold" style={{ color }}>
            {fechasSeleccionadas.length}
          </span>
          {maxDias ? <span className="text-gray-400">de {maxDias}</span> : null}
          <span>{fechasSeleccionadas.length === 1 ? "día seleccionado" : "días seleccionados"}</span>
        </div>
      )}
    </div>
  );
}
