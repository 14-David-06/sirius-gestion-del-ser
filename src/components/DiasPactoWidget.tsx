"use client";

import { useEffect, useState } from "react";

type DiasPactoData = {
  saldo_disponible: number;
  saldo_usado: number;
  periodo: string;
  fecha_ultimo_uso: string | null;
};

export function DiasPactoWidget() {
  const [data, setData] = useState<DiasPactoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dias-pacto/saldo")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar días de pacto");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[DiasPactoWidget]", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return null; // No mostrar si hay error (no bloquear dashboard)
  }

  if (!data) {
    return null;
  }

  const { saldo_disponible, fecha_ultimo_uso } = data;

  let mensaje: string;
  let colorBg: string;
  let colorText: string;
  let colorIcon: string;

  if (saldo_disponible === 2) {
    mensaje = "Tienes 2 días de pacto disponibles";
    colorBg = "#dcfce7";
    colorText = "#15803d";
    colorIcon = "#22c55e";
  } else if (saldo_disponible === 1) {
    mensaje = "Te queda 1 día de pacto disponible";
    colorBg = "#fef9c3";
    colorText = "#a16207";
    colorIcon = "#eab308";
  } else {
    mensaje = "Ya usaste tus días de pacto. Cualquier permiso adicional debe negociarse con tu jefe.";
    colorBg = "#fee2e2";
    colorText = "#b91c1c";
    colorIcon = "#ef4444";
  }

  return (
    <div
      className="rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4"
      style={{ backgroundColor: colorBg }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${colorIcon}18` }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={colorIcon} strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-1" style={{ color: colorText }}>
          📅 Días de Pacto 2026-S2
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: colorText }}>
          {mensaje}
        </p>
        {fecha_ultimo_uso && (
          <p className="text-xs mt-2 opacity-75" style={{ color: colorText }}>
            Último usado: {new Date(fecha_ultimo_uso).toLocaleDateString("es-CO")}
          </p>
        )}
      </div>
    </div>
  );
}
