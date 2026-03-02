"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.75;
    }
  }, []);

  return (
    <div className="bg-gray-950 text-white">
      {/* ═══════ HERO + VIDEO ═══════ */}
      <section className="relative h-screen overflow-hidden">
        {/* Video Background */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: `scale(${1 + scrollY * 0.0003}) translateY(${scrollY * 0.15}px)`,
          }}
        >
          <source src="https://sirius-multimedia.s3.us-east-1.amazonaws.com/DSC_2849.MOV" type="video/mp4" />
        </video>

        {/* Overlay gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/70 via-gray-950/40 to-gray-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/50 via-transparent to-gray-950/50" />

        {/* Navbar */}
        <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 lg:px-20 py-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/Logo-Sirius.png"
              alt="Sirius Gestión del Ser"
              width={180}
              height={60}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
          <div className="hidden sm:flex items-center gap-8 text-sm text-white/60">
            <Link
              href="/login"
              className="px-5 py-2.5 bg-white text-gray-900 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Iniciar Sesión
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-[calc(100vh-88px)] text-center px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-sm text-white/80 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistema Activo — Datos en Tiempo Real
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl">
            Gestión del Ser{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Inteligente
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl leading-relaxed">
            Plataforma integral de cumplimiento laboral, documental y humano.
            Conectamos personas, contratos y normatividad en un solo lugar.
          </p>

          <div className="mt-10">
            <Link
              href="/login"
              className="group px-8 py-4 bg-white text-gray-900 rounded-full font-semibold text-base hover:bg-white/90 transition-all hover:shadow-lg hover:shadow-white/20 inline-flex items-center gap-2"
            >
              Iniciar Sesión
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Todo en un solo lugar</h2>
            <p className="text-white/40 mt-4 max-w-2xl mx-auto">
              Centraliza la gestión laboral, documental y humana de tu organización
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "📄",
                title: "Manejo de Contratos",
                desc: "Gestión integral de contratos laborales con seguimiento de estados, fechas y empleados vinculados.",
              },
              {
                icon: "📋",
                title: "Solicitudes Centralizadas",
                desc: "Vacaciones, permisos y novedades de nómina en un solo módulo unificado.",
              },
              {
                icon: "📅",
                title: "Cronogramas de Trabajo",
                desc: "Planificación visual de turnos y horarios del equipo por semana.",
              },
              {
                icon: "⏰",
                title: "Marcación de Asistencia",
                desc: "Registro de entrada y salida en tiempo real con historial completo.",
              },
              {
                icon: "👥",
                title: "Vinculación Laboral",
                desc: "Control del ciclo completo: vinculación, seguimiento y desvinculación de personal.",
              },
              {
                icon: "✨",
                title: "Mensajes Inspiradores con IA",
                desc: "Genera mensajes motivacionales personalizados para tu equipo con inteligencia artificial.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/[0.06] bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/Logo-Sirius.png"
                alt="Sirius"
                width={100}
                height={32}
                className="h-8 w-auto object-contain"
              />
              <span className="text-sm text-white/40">
                © {new Date().getFullYear()}
              </span>
            </div>
            <p className="text-xs text-white/25">
              Powered by Next.js · Airtable · Tailwind CSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
