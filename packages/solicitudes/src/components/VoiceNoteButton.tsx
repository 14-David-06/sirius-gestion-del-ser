"use client";

import { useState, useRef, useEffect } from "react";
import { MODULOS } from "./ui";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  color?: string;
}

export function VoiceNoteButton({
  onTranscript,
  disabled = false,
  color = MODULOS.permiso.color,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Verificar soporte de Web Speech API
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition() as SpeechRecognitionInstance;
        recognitionRef.current.lang = "es-CO"; // Español colombiano
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event: SpeechRecognitionEventType) => {
          const transcript = event.results[0][0].transcript;
          onTranscript(transcript);
          setIsRecording(false);
          setIsProcessing(false);
        };

        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventType) => {
          console.error("Speech recognition error:", event.error);
          setError(
            event.error === "no-speech"
              ? "No se detectó voz. Intenta de nuevo."
              : event.error === "not-allowed"
              ? "Permiso de micrófono denegado."
              : "Error al procesar el audio. Intenta de nuevo."
          );
          setIsRecording(false);
          setIsProcessing(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
          setIsProcessing(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript]);

  function toggleRecording() {
    if (!recognitionRef.current) {
      setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setError("");
      setIsProcessing(true);
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }

  const isActive = isRecording || isProcessing;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
        className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isActive
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
        }`}
        title={isRecording ? "Haz clic para detener" : "Haz clic y habla"}
      >
        {isRecording ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span>Detener grabación</span>
          </>
        ) : isProcessing ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span>Procesando...</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke={color}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span>Dictar por voz</span>
          </>
        )}
      </button>

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {isRecording && (
        <p className="text-xs italic text-gray-500">
          Habla ahora... Se detendrá automáticamente al terminar.
        </p>
      )}
    </div>
  );
}

// Tipos para Web Speech API
interface SpeechRecognitionEventType {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventType {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventType) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventType) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
