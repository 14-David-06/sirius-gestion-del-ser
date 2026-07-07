"use client";

import { useState } from "react";

interface Props {
  fechasSeleccionadas: string[];
  onChange: (fechas: string[]) => void;
  maxDias?: number; // Límite máximo de días seleccionables
}

export function CalendarioPermiso({ fechasSeleccionadas, onChange, maxDias }: Props) {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [anioActual, setAnioActual] = useState(hoy.getFullYear());

  const nombresMeses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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
    const fecha = new Date(anioActual, mesActual, dia);
    const fechaStr = fecha.toISOString().split("T")[0];

    if (fechasSeleccionadas.includes(fechaStr)) {
      // Deseleccionar
      onChange(fechasSeleccionadas.filter((f) => f !== fechaStr));
    } else {
      // Seleccionar solo si no se alcanzó el máximo
      if (maxDias && fechasSeleccionadas.length >= maxDias) {
        return; // No permitir más selecciones
      }
      onChange([...fechasSeleccionadas, fechaStr].sort());
    }
  }

  function esFechaSeleccionada(dia: number): boolean {
    const fecha = new Date(anioActual, mesActual, dia);
    const fechaStr = fecha.toISOString().split("T")[0];
    return fechasSeleccionadas.includes(fechaStr);
  }

  function esFechaPasada(dia: number): boolean {
    const fecha = new Date(anioActual, mesActual, dia);
    fecha.setHours(0, 0, 0, 0);
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    return fecha < hoyInicio;
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

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => cambiarMes(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="text-sm font-semibold text-gray-800">
          {nombresMeses[mesActual]} {anioActual}
        </div>

        <button
          type="button"
          onClick={() => cambiarMes(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Nombres de días */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {nombresDias.map((nombre) => (
          <div key={nombre} className="text-center text-xs font-medium text-gray-400 py-1">
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

          return (
            <button
              key={dia}
              type="button"
              onClick={() => !pasado && toggleFecha(dia)}
              disabled={pasado}
              className={`
                aspect-square rounded-lg text-sm font-medium transition-all
                ${seleccionado
                  ? "bg-[#1a51a8] text-white shadow-sm"
                  : pasado
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-100"
                }
              `}
            >
              {dia}
            </button>
          );
        })}
      </div>

      {/* Contador de días */}
      {(fechasSeleccionadas.length > 0 || maxDias) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            <span className="font-semibold text-[#1a51a8]">{fechasSeleccionadas.length}</span>
            {maxDias ? ` de ${maxDias}` : ""}{" "}
            {fechasSeleccionadas.length === 1 ? "día seleccionado" : "días seleccionados"}
          </p>
        </div>
      )}
    </div>
  );
}
