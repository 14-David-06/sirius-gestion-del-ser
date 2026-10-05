"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

const BORDE = "1px solid rgba(255,255,255,0.06)";

/**
 * Sidebar del dashboard. En escritorio (md+) es la columna fija de siempre; en
 * móvil se esconde tras una barra superior y se abre como cajón, porque 240 px
 * fijos le dejan al contenido menos de la mitad de un teléfono.
 *
 * El contenido (nav + usuario) lo arma el layout, que es server component: aquí
 * solo vive el estado de abierto/cerrado.
 */
export default function SidebarResponsive({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Se guarda la ruta en la que se abrió y no un booleano: al navegar desde el
  // menú la ruta cambia y el cajón queda cerrado sin un efecto que lo cierre.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const cerrar = () => setAbiertoEn(null);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbiertoEn(null);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <>
      {/* ── Barra superior (solo móvil) ─────────────────────────────────────── */}
      <header
        className="flex h-14 flex-shrink-0 items-center justify-between px-4 md:hidden print:hidden"
        style={{ background: "#0f172a", borderBottom: BORDE }}
      >
        <div className="rounded-lg bg-white px-3 py-1.5">
          <Image src="/Logo-Sirius.png" alt="Sirius" width={80} height={28} priority />
        </div>
        <button
          type="button"
          onClick={() => setAbiertoEn(pathname)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="menu-lateral"
          className="-mr-2 rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
      </header>

      {/* ── Velo detrás del cajón (solo móvil) ──────────────────────────────── */}
      {abierto && (
        <div
          aria-hidden="true"
          onClick={cerrar}
          className="fixed inset-0 z-40 bg-[#040711]/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/*
        Cerrado en móvil queda `invisible` además de desplazado: fuera de pantalla
        sus enlaces seguirían recibiendo el foco del teclado.
      */}
      <aside
        id="menu-lateral"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col transition-[transform,visibility] duration-300 md:static md:z-auto md:h-full md:w-60 md:translate-x-0 md:visible print:hidden ${
          abierto ? "translate-x-0" : "invisible -translate-x-full"
        }`}
        style={{ background: "#0f172a", borderRight: BORDE }}
      >
        {/* Logo */}
        <div className="relative flex items-center justify-center px-6 py-5" style={{ borderBottom: BORDE }}>
          <div className="rounded-xl bg-white px-4 py-2">
            <Image src="/Logo-Sirius.png" alt="Sirius" width={110} height={38} priority />
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/65 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </aside>
    </>
  );
}
