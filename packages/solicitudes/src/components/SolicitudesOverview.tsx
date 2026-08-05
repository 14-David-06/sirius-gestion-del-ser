import Link from "next/link";
import { escapeAirtableValue } from "../lib/security";
import { TABLES, FIELDS, FK_ID_CORE, ESTADOS_APROBADOS } from "../lib/schema";
import {
  MODULOS,
  ModuloKey,
  Icon,
  ICON_CHEVRON_RIGHT,
  formatFecha,
} from "./ui";
import { AvisoCompensacion, type PermisoSinPlan } from "./AvisoCompensacion";
import { diasEntre, horasAReponer } from "@/lib/compensacion";

interface Props {
  idCore: string;
  basePath?: string;
  apiBasePath?: string;
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

const ESTADO_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  Pendiente:       { bg: "#fef9c3", color: "#a16207", dot: "#eab308" },
  Concedido:       { bg: "#dcfce7", color: "#15803d", dot: "#22c55e" },
  Aprobado:        { bg: "#dcfce7", color: "#15803d", dot: "#22c55e" },
  Rechazado:       { bg: "#fee2e2", color: "#b91c1c", dot: "#ef4444" },
  Revisado:        { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
  Resuelto:        { bg: "#f0fdf4", color: "#16a34a", dot: "#22c55e" },
  Autorizado:      { bg: "#dcfce7", color: "#15803d", dot: "#22c55e" },
  "No autorizado": { bg: "#fee2e2", color: "#b91c1c", dot: "#ef4444" },
};

const ESTADO_DEFAULT = { bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" };

function esEstadoAprobado(estado: string): boolean {
  return (ESTADOS_APROBADOS as readonly string[]).includes(estado);
}

type Row = { modulo: ModuloKey; tipo: string; subtipo: string; fecha: string; estado: string };

async function fetchRecientes(idCore: string): Promise<Row[]> {
  const BASE = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
  const KEY  = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

  const formula    = encodeURIComponent(`{${FK_ID_CORE}}='${escapeAirtableValue(idCore)}'`);
  const sortPerm   = encodeURIComponent(FIELDS.PERMISO.FECHA_SOLICITUD);
  const sortVac    = encodeURIComponent(FIELDS.VACACIONES.FECHA_PRESENTACION);
  const sortNov    = encodeURIComponent(FIELDS.NOVEDADES.FECHA_CREACION);
  const headers    = { Authorization: `Bearer ${KEY}` };
  const opts       = { headers, cache: "no-store" } as const;

  const [permisos, vacaciones, novedades] = await Promise.allSettled([
    fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.PERMISO)}?filterByFormula=${formula}&sort[0][field]=${sortPerm}&sort[0][direction]=desc&maxRecords=5`, opts).then((r) => r.json()),
    fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.VACACIONES)}?filterByFormula=${formula}&sort[0][field]=${sortVac}&sort[0][direction]=desc&maxRecords=5`, opts).then((r) => r.json()),
    fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.NOVEDADES)}?filterByFormula=${formula}&sort[0][field]=${sortNov}&sort[0][direction]=desc&maxRecords=5`, opts).then((r) => r.json()),
  ]);

  const rows: Row[] = [];

  if (permisos.status === "fulfilled") {
    for (const r of (permisos.value.records ?? []) as AirtableRecord[]) {
      rows.push({
        modulo:  "permiso",
        tipo:    "Permiso",
        subtipo: String(r.fields[FIELDS.PERMISO.TIPO] ?? "—"),
        fecha:   String(r.fields[FIELDS.PERMISO.FECHA_SOLICITUD] ?? "—"),
        estado:  String(r.fields[FIELDS.PERMISO.ESTADO] ?? "Pendiente"),
      });
    }
  }
  if (vacaciones.status === "fulfilled") {
    for (const r of (vacaciones.value.records ?? []) as AirtableRecord[]) {
      const ini = r.fields[FIELDS.VACACIONES.FECHA_INICIO];
      const fin = r.fields[FIELDS.VACACIONES.FECHA_FIN];
      rows.push({
        modulo:  "vacaciones",
        tipo:    "Vacaciones",
        subtipo: `${ini ? formatFecha(String(ini)) : "?"} → ${fin ? formatFecha(String(fin)) : "?"}`,
        fecha:   String(r.fields[FIELDS.VACACIONES.FECHA_PRESENTACION] ?? "—"),
        estado:  String(r.fields[FIELDS.VACACIONES.ESTADO] ?? "—"),
      });
    }
  }
  if (novedades.status === "fulfilled") {
    for (const r of (novedades.value.records ?? []) as AirtableRecord[]) {
      rows.push({
        modulo:  "novedades",
        tipo:    "Novedad",
        subtipo: String(r.fields[FIELDS.NOVEDADES.TIPO] ?? "—"),
        fecha:   String(r.fields[FIELDS.NOVEDADES.FECHA_CREACION] ?? "—"),
        estado:  String(r.fields[FIELDS.NOVEDADES.ESTADO] ?? "Pendiente"),
      });
    }
  }

  return rows.sort((a, b) => (b.fecha > a.fecha ? 1 : -1)).slice(0, 10);
}

/**
 * Permisos aprobados como compensatorios a los que Gestión del Ser no les definió
 * el plan: el colaborador tiene que elegir cómo repone. Va en una consulta aparte
 * de las 5 recientes porque un permiso puede quedar pendiente mucho tiempo.
 *
 * El estado aprobado es parte del filtro, no un detalle: quien decide si un
 * permiso se repone es Gestión del Ser al autorizar. Mientras el permiso siga
 * pendiente no hay nada que reponer todavía — y podría terminar rechazado.
 *
 * Tampoco basta con que el plan esté vacío: si el registro ya trae los días de
 * compensación, la reposición quedó acordada aunque nadie nombrara un plan.
 * Preguntarle al colaborador ahí lo haría rehacer un compromiso ya cerrado.
 */
async function fetchSinPlanCompensacion(idCore: string): Promise<PermisoSinPlan[]> {
  const BASE = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
  const KEY  = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

  const aprobado = ESTADOS_APROBADOS.map(
    (e) => `{${FIELDS.PERMISO.ESTADO}}='${escapeAirtableValue(e)}'`
  ).join(", ");

  const formula = encodeURIComponent(
    `AND({${FK_ID_CORE}}='${escapeAirtableValue(idCore)}', ` +
      `{${FIELDS.PERMISO.COMPENSADO}}, ` +
      `OR(${aprobado}), ` +
      `{${FIELDS.PERMISO.PLAN_COMPENSACION}}='', ` +
      `{${FIELDS.PERMISO.DIAS_COMPENSACION}}='')`
  );

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.PERMISO)}?filterByFormula=${formula}&maxRecords=10`,
      { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
    );
    if (!res.ok) return [];

    const data = await res.json();
    return ((data.records ?? []) as AirtableRecord[]).map((r) => {
      const inicio = String(r.fields[FIELDS.PERMISO.FECHA_INICIO] ?? "").slice(0, 10);
      const fin    = String(r.fields[FIELDS.PERMISO.FECHA_FIN] ?? "").slice(0, 10);
      return {
        id: r.id,
        tipo: String(r.fields[FIELDS.PERMISO.TIPO] ?? "Permiso"),
        fecha: inicio,
        horasTotal: horasAReponer(r.fields[FIELDS.PERMISO.HORAS], diasEntre(inicio, fin)),
      };
    });
  } catch (error) {
    // El aviso es informativo: si Airtable falla, la página igual se muestra.
    console.error("[SolicitudesOverview] compensaciones sin plan:", error);
    return [];
  }
}

/* ── Badge de estado ────────────────────────────────────────────────────── */

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLE[estado] ?? ESTADO_DEFAULT;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {estado}
    </span>
  );
}

/* ── Resumen numérico ───────────────────────────────────────────────────── */

function Resumen({ rows }: { rows: Row[] }) {
  const pendientes = rows.filter((r) => r.estado === "Pendiente").length;
  const aprobadas  = rows.filter((r) => esEstadoAprobado(r.estado)).length;

  const stats = [
    { label: "Pendientes", valor: pendientes, color: "#eab308" },
    { label: "Aprobadas",  valor: aprobadas,  color: "#22c55e" },
    { label: "Total",      valor: rows.length, color: "#64748b" },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-white/15">
      {stats.map((s) => (
        <div key={s.label} className="px-4 first:pl-0 last:pr-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            <p className="text-[11px] uppercase tracking-wider text-white/50">{s.label}</p>
          </div>
          <p className="mt-0.5 text-2xl font-bold text-white">{s.valor}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────────────────────── */

export async function SolicitudesOverview({
  idCore,
  basePath = "/dashboard/solicitudes",
  apiBasePath = "",
}: Props) {
  const [recientes, sinPlan] = await Promise.all([
    fetchRecientes(idCore),
    fetchSinPlanCompensacion(idCore),
  ]);

  const acciones: { key: ModuloKey; label: string; href: string }[] = [
    { key: "permiso",    label: "Solicitar Permiso",    href: `${basePath}/permiso` },
    { key: "vacaciones", label: "Solicitar Vacaciones", href: `${basePath}/vacaciones` },
    { key: "novedades",  label: "Reportar Novedad",     href: `${basePath}/novedades` },
  ];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Solicitudes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona tus permisos, vacaciones y novedades de nómina
        </p>
      </div>

      {/* ── Aviso: permisos compensatorios sin plan de reposición ───────── */}
      <AvisoCompensacion permisos={sinPlan} apiBasePath={apiBasePath} />

      {/* ── Banner con resumen ──────────────────────────────────────────── */}
      <div
        className="mb-8 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between print:hidden"
        style={{ background: "linear-gradient(135deg, #1a51a8 0%, #0f172a 100%)" }}
      >
        <div className="max-w-sm">
          <h2 className="font-semibold text-white">Tu actividad reciente</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Consulta el estado de tus últimas solicitudes o crea una nueva.
          </p>
        </div>
        <Resumen rows={recientes} />
      </div>

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2.5 print:hidden">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Nueva solicitud
        </h2>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
        {acciones.map((a) => {
          const m = MODULOS[a.key];
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md"
            >
              <span
                className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                style={{ background: m.color }}
              />
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                  style={{ background: `${m.color}15` }}
                >
                  <Icon path={m.icon} className="h-5 w-5" stroke={m.color} />
                </div>
                <Icon
                  path={ICON_CHEVRON_RIGHT}
                  className="h-4 w-4 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-gray-400"
                  strokeWidth={2}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{a.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{m.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Historial ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-gray-700">Mis solicitudes recientes</h2>
          {recientes.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              {recientes.length}
            </span>
          )}
        </div>

        {recientes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
              <Icon
                path={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                }
                className="h-6 w-6 text-gray-300"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Aún no tienes solicitudes</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Usa las tarjetas de arriba para crear la primera.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Escritorio — tabla */}
            <table className="hidden w-full text-sm sm:table print:table">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Detalle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Fecha</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recientes.map((row, i) => {
                  const m = MODULOS[row.modulo];
                  const esAprobado = row.tipo === "Permiso" ? esEstadoAprobado(row.estado) : true;
                  return (
                    <tr
                      key={i}
                      className={`transition-colors hover:bg-slate-50/60 ${esAprobado ? "" : "print:hidden"}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `${m.color}15` }}
                          >
                            <Icon path={m.icon} className="h-3.5 w-3.5" stroke={m.color} strokeWidth={1.8} />
                          </span>
                          <span className="font-medium text-gray-700">{row.tipo}</span>
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-gray-500">{row.subtipo}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">{formatFecha(row.fecha)}</td>
                      <td className="px-6 py-4 text-right">
                        <EstadoBadge estado={row.estado} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Móvil — lista de tarjetas */}
            <ul className="divide-y divide-gray-50 sm:hidden print:hidden">
              {recientes.map((row, i) => {
                const m = MODULOS[row.modulo];
                const esAprobado = row.tipo === "Permiso" ? esEstadoAprobado(row.estado) : true;
                return (
                  <li key={i} className={`flex gap-3 px-5 py-4 ${esAprobado ? "" : "print:hidden"}`}>
                    <span
                      className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${m.color}15` }}
                    >
                      <Icon path={m.icon} className="h-4 w-4" stroke={m.color} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-700">{row.tipo}</p>
                        <EstadoBadge estado={row.estado} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{row.subtipo}</p>
                      <p className="mt-1 text-xs text-gray-400">{formatFecha(row.fecha)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
