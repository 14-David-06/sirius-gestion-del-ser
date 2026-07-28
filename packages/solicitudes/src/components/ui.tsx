import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────────────────
   Sistema de diseño del módulo de Solicitudes
   Primitivas compartidas por los 3 formularios y el overview.
   ────────────────────────────────────────────────────────────────────────── */

export type ModuloKey = "permiso" | "vacaciones" | "novedades";

export const MODULOS: Record<
  ModuloKey,
  { label: string; desc: string; color: string; dark: string; icon: React.ReactNode }
> = {
  permiso: {
    label: "Permiso",
    desc: "Médico, personal, calamidad y más",
    color: "#1a51a8",
    dark: "#123a7a",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  vacaciones: {
    label: "Vacaciones",
    desc: "Registra tu período de descanso",
    color: "#6bb543",
    dark: "#4d8430",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    ),
  },
  novedades: {
    label: "Novedad",
    desc: "Horas extra, incapacidad, cambios de horario",
    color: "#e07b39",
    dark: "#b45f26",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    ),
  },
};

/* ── Iconografía compartida ─────────────────────────────────────────────── */

export function Icon({
  path,
  className = "w-5 h-5",
  stroke = "currentColor",
  strokeWidth = 1.5,
}: {
  path: React.ReactNode;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={strokeWidth}>
      {path}
    </svg>
  );
}

export const ICON_CHEVRON_LEFT = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
);
export const ICON_CHEVRON_RIGHT = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
);
export const ICON_CHECK = (
  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
);
export const ICON_CHECK_CIRCLE = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  />
);

/* ── Clases de campos ───────────────────────────────────────────────────── */

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all placeholder:text-gray-400 hover:border-gray-300 focus:ring-2";

// Clases literales — Tailwind escanea el código fuente, no acepta interpolación en runtime.
const FOCUS_RING: Record<ModuloKey, string> = {
  permiso:    "focus:border-[#1a51a8] focus:ring-[#1a51a8]/20",
  vacaciones: "focus:border-[#6bb543] focus:ring-[#6bb543]/20",
  novedades:  "focus:border-[#e07b39] focus:ring-[#e07b39]/20",
};

/** Input estándar con el focus ring del módulo. */
export function inputCls(modulo: ModuloKey) {
  return `${INPUT_BASE} ${FOCUS_RING[modulo]}`;
}

export const readonlyCls =
  "w-full rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-2.5 text-sm text-gray-600 cursor-default truncate";

/* ── Campo con etiqueta ─────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const obligatorio = label.trim().endsWith("*");
  const texto = obligatorio ? label.trim().slice(0, -1).trim() : label;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-baseline gap-1.5 text-sm font-medium text-gray-700">
        <span>{texto}</span>
        {obligatorio && <span className="text-red-400">*</span>}
        {hint && <span className="text-xs font-normal text-gray-400">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Encabezado del formulario ──────────────────────────────────────────── */

export function FormHeader({
  modulo,
  titulo,
  subtitulo,
  backHref,
}: {
  modulo: ModuloKey;
  titulo: string;
  subtitulo: string;
  backHref: string;
}) {
  const m = MODULOS[modulo];

  return (
    <div className="mb-6 flex items-center gap-4">
      <Link
        href={backHref}
        aria-label="Volver a solicitudes"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-all hover:-translate-x-0.5 hover:border-gray-300 hover:text-gray-700"
      >
        <Icon path={ICON_CHEVRON_LEFT} className="h-4 w-4" strokeWidth={2} />
      </Link>

      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{ background: `${m.color}15` }}
      >
        <Icon path={m.icon} className="h-5 w-5" stroke={m.color} />
      </div>

      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-gray-800">{titulo}</h1>
        <p className="text-sm text-gray-500">{subtitulo}</p>
      </div>
    </div>
  );
}

/* ── Título de sección con acento de color ──────────────────────────────── */

export function SectionTitle({
  children,
  color,
  paso,
}: {
  children: React.ReactNode;
  color: string;
  paso?: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {paso !== undefined ? (
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: `${color}18`, color }}
        >
          {paso}
        </span>
      ) : (
        <span className="h-3.5 w-1 flex-shrink-0 rounded-full" style={{ background: color }} />
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{children}</p>
    </div>
  );
}

/* ── Bloque de datos del empleado (auto-llenado) ────────────────────────── */

export function DatosEmpleado({
  me,
  color,
  compacto = false,
}: {
  me: { nombre: string; cedula: string; idCore: string; cargo: string } | null;
  color: string;
  compacto?: boolean;
}) {
  const iniciales = me?.nombre
    ? me.nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "··";

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: color }}
        >
          {iniciales}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800">
            {me?.nombre ?? "Cargando..."}
          </p>
          <p className="truncate text-xs text-gray-500">{me?.cargo || "Sin cargo asignado"}</p>
        </div>
        <span className="hidden flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200 sm:inline">
          {me?.idCore ?? "—"}
        </span>
      </div>

      {!compacto && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-200/70 pt-3 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="text-gray-400">Cédula</dt>
            <dd className="font-medium text-gray-700">{me?.cedula ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:hidden">
            <dt className="text-gray-400">ID empleado</dt>
            <dd className="font-medium text-gray-700">{me?.idCore ?? "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/* ── Mensaje de error ───────────────────────────────────────────────────── */

export function ErrorMsg({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <Icon
        path={
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        }
        className="mt-px h-4 w-4 flex-shrink-0"
        strokeWidth={2}
      />
      <span>{children}</span>
    </div>
  );
}

/* ── Botón de envío ─────────────────────────────────────────────────────── */

export function SubmitButton({
  color,
  loading,
  disabled,
  children,
}: {
  color: string;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:brightness-100"
      style={{ background: color }}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/* ── Pantalla de éxito ──────────────────────────────────────────────────── */

export function SuccessCard({
  color,
  titulo,
  mensaje,
  onReset,
  resetLabel,
  basePath,
}: {
  color: string;
  titulo: string;
  mensaje: string;
  onReset: () => void;
  resetLabel: string;
  basePath: string;
}) {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="h-1.5" style={{ background: color }} />
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-10">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: `${color}14` }}
          >
            <Icon path={ICON_CHECK} className="h-8 w-8" stroke={color} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-800">{titulo}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{mensaje}</p>
          </div>
          <div className="mt-2 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <button
              onClick={onReset}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              {resetLabel}
            </button>
            <Link
              href={basePath}
              className="rounded-xl px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md"
              style={{ background: color }}
            >
              Ver mis solicitudes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Utilidades de formato ──────────────────────────────────────────────── */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Formatea "2026-07-28" → "28 jul 2026" sin desfase de zona horaria. */
export function formatFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "—";
  const [, y, mes, d] = m;
  return `${Number(d)} ${MESES[Number(mes) - 1]} ${y}`;
}
