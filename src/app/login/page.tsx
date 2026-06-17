"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Credenciales incorrectas. Intenta de nuevo.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Error de conexión. Verifica tu red e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Image
        src="/DSC_2854.jpg"
        alt=""
        fill
        className="object-cover object-center"
        priority
        quality={90}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-[#0a1628]/60 to-black/70" />

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-xl px-5 py-3 shadow-lg">
              <Image
                src="/Logo-Sirius.png"
                alt="Sirius"
                width={148}
                height={51}
                priority
              />
            </div>
          </div>

          <h2 className="text-white text-xl font-semibold text-center mb-1">
            Bienvenido
          </h2>
          <p className="text-center text-sm mb-7" style={{ color: "rgba(255,255,255,0.55)" }}>
            Ingresa tus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cedula"
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                Número de cédula
              </label>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ingresa tu cédula"
                required
                autoComplete="username"
                className="rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid #29b6e8";
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.20)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.20)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid #29b6e8";
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.20)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                }}
              />
            </div>

            {error && (
              <div
                className="text-sm rounded-xl px-4 py-3"
                style={{
                  background: "rgba(239,68,68,0.18)",
                  border: "1px solid rgba(239,68,68,0.30)",
                  color: "#fca5a5",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#1a51a8" }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "#1a4494";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#1a51a8";
              }}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
