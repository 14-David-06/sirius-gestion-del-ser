import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { verifyJWT } from "@/lib/auth";
import { DiasPactoWidget } from "@/components/DiasPactoWidget";

const MODULES = [
  {
    label: "Asistencia",
    desc: "Registros de entrada y salida, novedades y ausentismo.",
    href: "/dashboard/asistencia",
    color: "#1a51a8",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    ready: false,
  },
  {
    label: "Solicitudes",
    desc: "Vacaciones, permisos y novedades de nómina.",
    href: "/dashboard/solicitudes",
    color: "#6bb543",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    ),
    ready: false,
  },
  {
    label: "Contratos",
    desc: "Gestión de contratos, renovaciones y alertas de vencimiento.",
    href: "/dashboard/contratos",
    color: "#e07b39",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    ),
    ready: false,
  },
  {
    label: "Documentos",
    desc: "Cumplimiento documental y carga de archivos.",
    href: "/dashboard/documentos",
    color: "#8b5cf6",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    ),
    ready: false,
  },
  {
    label: "Horarios",
    desc: "Turnos, cronogramas y configuración de jornadas.",
    href: "/dashboard/horarios",
    color: "#0891b2",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    ),
    ready: false,
  },
  {
    label: "Asistente IA",
    desc: "Consulta datos de RRHH con lenguaje natural.",
    href: "/dashboard/asistente",
    color: "#29b6e8",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    ),
    ready: false,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function ModuleCard({ mod }: { mod: (typeof MODULES)[0] }) {
  const card = (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-sm border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer h-full"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${mod.color}18` }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={mod.color} strokeWidth={1.5}>
            {mod.icon}
          </svg>
        </div>
        {!mod.ready && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#f1f5f9", color: "#94a3b8" }}>
            Próximamente
          </span>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{mod.label}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{mod.desc}</p>
      </div>
    </div>
  );

  return mod.ready ? (
    <Link href={mod.href} className="h-full">{card}</Link>
  ) : (
    <div className="h-full opacity-75">{card}</div>
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sirius-auth")?.value;
  const payload = token ? await verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
  if (!payload) redirect("/login");

  const firstName = payload.nombre.split(" ")[0];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-gray-400 text-sm mb-1">{greeting()},</p>
        <h1 className="text-2xl font-bold text-gray-800">{firstName}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium text-white"
            style={{ background: "#1a51a8" }}
          >
            {payload.rol}
          </span>
          <span className="text-xs text-gray-400">{payload.idCore}</span>
        </div>
      </div>

      {/* ── Tarjeta de bienvenida ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 mb-8 flex items-center gap-6"
        style={{ background: "linear-gradient(135deg, #1a51a8 0%, #0f172a 100%)" }}
      >
        <div className="flex-1">
          <h2 className="text-white font-semibold text-lg mb-1">
            Bienvenido a Sirius Gestión del Ser
          </h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Plataforma integral de talento humano. Los módulos se irán habilitando progresivamente.
          </p>
        </div>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
      </div>

      {/* ── Widget Días de Pacto ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <Suspense fallback={<div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-24"></div>}>
          <DiasPactoWidget />
        </Suspense>
      </div>

      {/* ── Módulos ─────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h2 className="text-gray-600 text-sm font-medium uppercase tracking-wider">Módulos</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.href} mod={mod} />
        ))}
      </div>
    </div>
  );
}
