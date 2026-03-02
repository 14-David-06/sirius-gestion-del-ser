"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  {
    label: "Resumen",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Contratos",
    href: "/dashboard/contratos",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    label: "Solicitudes",
    href: "/dashboard/solicitudes",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    label: "Cronogramas",
    href: "/dashboard/cronogramas",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Asistencia",
    href: "/dashboard/asistencia",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Vinculación",
    href: "/dashboard/vinculacion",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

const mensajesInspiradores = [
  { icon: "🔥", cat: "Motivación", msg: "Cada día es una nueva oportunidad para ser la mejor versión de ti mismo. ¡Hoy es tu día!" },
  { icon: "🔥", cat: "Motivación", msg: "El éxito no se mide por la posición que alcanzas, sino por los obstáculos que superas." },
  { icon: "🔥", cat: "Motivación", msg: "La disciplina es el puente entre tus metas y tus logros. Sigue adelante." },
  { icon: "🔥", cat: "Motivación", msg: "Tu actitud determina tu dirección. Elige avanzar con entusiasmo." },
  { icon: "🔥", cat: "Motivación", msg: "Grandes cosas nunca vinieron de zonas de confort. Atrévete a dar el paso." },
  { icon: "🚀", cat: "Liderazgo", msg: "Un líder es aquel que conoce el camino, recorre el camino y muestra el camino." },
  { icon: "🚀", cat: "Liderazgo", msg: "El liderazgo no se trata de ser el mejor. Se trata de hacer mejores a los demás." },
  { icon: "🚀", cat: "Liderazgo", msg: "Los grandes líderes no crean seguidores, crean más líderes." },
  { icon: "🧘", cat: "Bienestar", msg: "Tu bienestar es la base de todo logro. Cuídate para poder cuidar a los demás." },
  { icon: "🧘", cat: "Bienestar", msg: "El equilibrio entre trabajo y vida personal es la clave del éxito sostenible." },
  { icon: "🧘", cat: "Bienestar", msg: "Tu salud mental es prioridad. Está bien hacer pausas y pedir ayuda." },
  { icon: "🤝", cat: "Equipo", msg: "Solos podemos hacer poco, juntos podemos hacer mucho. ¡Somos un gran equipo!" },
  { icon: "🤝", cat: "Equipo", msg: "El talento gana partidos, pero el trabajo en equipo gana campeonatos." },
  { icon: "🤝", cat: "Equipo", msg: "Cada miembro del equipo es una pieza esencial. Tu contribución importa." },
  { icon: "💛", cat: "Gratitud", msg: "Gracias por tu dedicación y compromiso. Tu trabajo marca la diferencia cada día." },
  { icon: "💛", cat: "Gratitud", msg: "Tu presencia y energía hacen de este un mejor lugar para trabajar. ¡Gracias!" },
  { icon: "💪", cat: "Resiliencia", msg: "Los momentos difíciles son temporales. Tu fortaleza es permanente." },
  { icon: "💪", cat: "Resiliencia", msg: "Cada desafío es una oportunidad disfrazada. Confía en tu capacidad." },
  { icon: "💪", cat: "Resiliencia", msg: "Las tormentas forjan los mejores marineros. Estos tiempos te están preparando para algo grande." },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<{ icon: string; cat: string; msg: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    // Show inspirational message on first load (login)
    const shown = sessionStorage.getItem("sirius_toast_shown");
    if (shown) return;
    sessionStorage.setItem("sirius_toast_shown", "1");

    const m = mensajesInspiradores[Math.floor(Math.random() * mensajesInspiradores.length)];
    const timer1 = setTimeout(() => {
      setToast(m);
      setToastVisible(true);
    }, 800);
    const timer2 = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(null), 500);
    }, 10000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-gray-950 border-r border-white/[0.06] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-6 h-[72px] border-b border-white/[0.06]">
          <Link href="/" className="flex items-center">
            <Image
              src="/Logo-Sirius.png"
              alt="Sirius Gestión del Ser"
              width={140}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive(item.href)
                  ? "bg-indigo-500/15 text-white border border-indigo-500/20 shadow-lg shadow-indigo-500/5"
                  : "text-white/50 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`transition-colors ${
                  isActive(item.href)
                    ? "text-indigo-400"
                    : "text-white/30 group-hover:text-white/60"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Sistema Conectado</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            {loggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile hamburger + date) */}
        <header className="sticky top-0 z-20 bg-gray-950/70 backdrop-blur-2xl border-b border-white/[0.06] lg:border-0">
          <div className="flex items-center justify-between px-4 sm:px-6 h-[56px] lg:h-[72px]">
            <button
              className="lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <span className="text-xs text-white/30 font-medium hidden sm:block">
                {new Date().toLocaleString("es-CO", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Inspirational toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-md transition-all duration-500 ${
            toastVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/15 border border-indigo-500/25 backdrop-blur-xl p-6 shadow-2xl shadow-indigo-500/10">
            <div className="flex items-start gap-4">
              <div className="text-3xl flex-shrink-0 mt-0.5">{toast.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                    ✨ {toast.cat}
                  </span>
                  <button
                    onClick={() => { setToastVisible(false); setTimeout(() => setToast(null), 500); }}
                    className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-white/90 leading-relaxed font-medium">
                  &ldquo;{toast.msg}&rdquo;
                </p>
                <p className="text-[10px] text-white/30 mt-3 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Mensaje generado por IA — Sirius Gestión del Ser
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
