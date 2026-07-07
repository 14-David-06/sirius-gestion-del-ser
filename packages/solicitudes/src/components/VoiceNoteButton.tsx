"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceNoteButton({ onTranscript, disabled = false }: Props) {
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
        className={`
          flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isActive
              ? "bg-red-50 text-red-600 border-2 border-red-300 animate-pulse"
              : "bg-[#1a51a8] text-white hover:bg-[#153f8a] border-2 border-transparent"
          }
        `}
        title={isRecording ? "Haz clic para detener" : "Haz clic y habla"}
      >
        {isRecording ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h12v16H6z" />
            </svg>
            <span>Detener grabación</span>
          </>
        ) : isProcessing ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Procesando...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span>Grabar nota de voz</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {isRecording && (
        <p className="text-xs text-gray-500 italic">Habla ahora... Se detendrá automáticamente al terminar.</p>
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
