"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Step = "cedula" | "password" | "create-password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("cedula");
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [recordId, setRecordId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const cedulaRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "cedula") cedulaRef.current?.focus();
    if (step === "password" || step === "create-password") passwordRef.current?.focus();
  }, [step]);

  // Step 1: Check cédula
  async function handleCheckCedula(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cedula.trim() }),
      });

      const data = await res.json();

      if (!data.exists) {
        setError("No se encontró un usuario con ese número de cédula.");
        return;
      }

      setNombre(data.nombre || "");
      setRecordId(data.recordId || "");

      if (data.hasPassword) {
        setStep("password");
      } else {
        setStep("create-password");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2a: Login with password
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cedula.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2b: Create password
  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cedula: cedula.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear la contraseña");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("cedula");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setShowPassword(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>

        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Image
            src="/Logo-Sirius.png"
            alt="Sirius Gestión del Ser"
            width={160}
            height={160}
            className="mx-auto mb-4"
            priority
          />
          <p className="text-sm text-white/40 mt-1">
            Acceso al sistema
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300 ${
              step === "cedula"
                ? "bg-indigo-500 text-white"
                : "bg-indigo-500/20 text-indigo-400"
            }`}>
              1
            </div>
            <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
              step !== "cedula" ? "bg-indigo-500" : "bg-white/[0.08]"
            }`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all duration-300 ${
              step !== "cedula"
                ? "bg-indigo-500 text-white"
                : "bg-white/[0.06] text-white/30"
            }`}>
              2
            </div>
          </div>

          {/* Welcome message when we know the name */}
          {step !== "cedula" && nombre && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-sm text-indigo-300">
                Hola, <strong className="text-white">{nombre}</strong>
              </p>
              <p className="text-xs text-indigo-400/60 mt-0.5">
                {step === "password"
                  ? "Ingresa tu contraseña para continuar"
                  : "Crea una contraseña para acceder al sistema"}
              </p>
            </div>
          )}

          {/* ─── Step: Cédula ─── */}
          {step === "cedula" && (
            <form onSubmit={handleCheckCedula} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Número de cédula
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    ref={cedulaRef}
                    type="text"
                    inputMode="numeric"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej: 1234567890"
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-base"
                    autoComplete="username"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !cedula.trim()}
                className="w-full py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                ) : (
                  <>
                    Continuar
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ─── Step: Password (login) ─── */}
          {step === "password" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-base"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/60 font-medium text-sm hover:bg-white/[0.08] transition-all"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-1 py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      Iniciar sesión
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ─── Step: Create Password ─── */}
          {step === "create-password" && (
            <form onSubmit={handleCreatePassword} className="space-y-5">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                <p className="text-xs text-amber-300/80">
                  <strong>Primera vez:</strong> Crea una contraseña segura de al menos 8 caracteres.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all text-base"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          password.length >= i * 3
                            ? password.length >= 12
                              ? "bg-emerald-400"
                              : password.length >= 8
                                ? "bg-amber-400"
                                : "bg-red-400"
                            : "bg-white/[0.06]"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.04] border rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-1 transition-all text-base ${
                      confirmPassword && confirmPassword !== password
                        ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                        : confirmPassword && confirmPassword === password
                          ? "border-emerald-500/50 focus:border-emerald-500/50 focus:ring-emerald-500/30"
                          : "border-white/[0.08] focus:border-indigo-500/50 focus:ring-indigo-500/30"
                    }`}
                    autoComplete="new-password"
                  />
                  {confirmPassword && confirmPassword === password && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/60 font-medium text-sm hover:bg-white/[0.08] transition-all"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword || password !== confirmPassword || password.length < 8}
                  className="flex-1 py-3.5 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      Crear contraseña y entrar
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          Sirius Gestión del Ser © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
