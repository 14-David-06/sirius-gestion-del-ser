"use client";

import { useRef, useState, useEffect, MouseEvent, TouchEvent } from "react";
import { Icon, ICON_CHECK, MODULOS } from "./ui";

interface Props {
  onFirmaCapturada: (blob: Blob) => void;
  onLimpiar?: () => void;
  color?: string;
}

export function FirmaCanvas({
  onFirmaCapturada,
  onLimpiar,
  color = MODULOS.permiso.color,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [estaDibujando, setEstaDibujando] = useState(false);
  const [hayFirma, setHayFirma] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar canvas
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Ajustar tamaño del canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function obtenerCoordenadas(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function iniciarDibujo(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setEstaDibujando(true);
    setHayFirma(true);

    const { x, y } = obtenerCoordenadas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function dibujar(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    if (!estaDibujando) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = obtenerCoordenadas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function detenerDibujo() {
    setEstaDibujando(false);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHayFirma(false);
    onLimpiar?.();
  }

  async function capturarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onFirmaCapturada(blob);
      }
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white transition-colors hover:border-gray-300">
        {/* Guía de firma — encima del canvas (que se rellena de blanco), sin capturar eventos */}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 z-10 border-b border-dashed border-gray-200" />
        {!hayFirma && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-[11px] text-gray-300">
            Firma aquí
          </p>
        )}

        <canvas
          ref={canvasRef}
          onMouseDown={iniciarDibujo}
          onMouseMove={dibujar}
          onMouseUp={detenerDibujo}
          onMouseLeave={detenerDibujo}
          onTouchStart={iniciarDibujo}
          onTouchMove={dibujar}
          onTouchEnd={detenerDibujo}
          className="relative h-40 w-full cursor-crosshair touch-none bg-transparent"
          style={{ touchAction: "none" }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          disabled={!hayFirma}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={capturarFirma}
          disabled={!hayFirma}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100"
          style={{ background: color }}
        >
          <Icon path={ICON_CHECK} className="h-4 w-4" strokeWidth={2.5} />
          Confirmar firma
        </button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Dibuja tu firma con el mouse o con el dedo en dispositivos táctiles
      </p>
    </div>
  );
}
