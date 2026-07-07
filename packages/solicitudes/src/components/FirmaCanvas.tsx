"use client";

import { useRef, useState, useEffect, MouseEvent, TouchEvent } from "react";

interface Props {
  onFirmaCapturada: (blob: Blob) => void;
  onLimpiar?: () => void;
}

export function FirmaCanvas({ onFirmaCapturada, onLimpiar }: Props) {
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
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={iniciarDibujo}
          onMouseMove={dibujar}
          onMouseUp={detenerDibujo}
          onMouseLeave={detenerDibujo}
          onTouchStart={iniciarDibujo}
          onTouchMove={dibujar}
          onTouchEnd={detenerDibujo}
          className="w-full h-40 touch-none cursor-crosshair"
          style={{ touchAction: "none" }}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          disabled={!hayFirma}
          className="flex-1 px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={capturarFirma}
          disabled={!hayFirma}
          className="flex-1 px-4 py-2 rounded-xl text-sm text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#1a51a8" }}
        >
          Confirmar firma
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Dibuja tu firma con el mouse o con el dedo en dispositivos táctiles
      </p>
    </div>
  );
}
