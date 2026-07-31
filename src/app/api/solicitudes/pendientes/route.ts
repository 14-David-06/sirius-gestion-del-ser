/**
 * GET /api/solicitudes/pendientes
 *
 * Solicitudes que esperan la decisión del usuario autenticado.
 *
 * Solo permisos y vacaciones: las novedades de nómina son un registro
 * informativo que el colaborador reporta, no un trámite que se apruebe o
 * rechace, así que nunca entran a este panel.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { obtenerPermisosEmpleado } from "@/lib/permisos";
import { TABLES, FIELDS, FK_ID_CORE, ESTADO_PENDIENTE } from "@/lib/airtable-schema";
import { escapeAirtableValue } from "@/lib/security";
import { fetchTodos, type RegistroAirtable as Registro } from "@/lib/airtable-fetch";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;
const BASE_ID_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const API_KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

/**
 * Los valores de texto libre en Airtable llegan con espacios sobrantes
 * ("Horas Extra "), por eso toda comparación se hace sobre TRIM().
 */
const esPendiente = (campo: string) =>
  `TRIM({${campo}}) = '${ESTADO_PENDIENTE}'`;

export async function GET() {
  try {
    // 1. Verificar autenticación
    const token = (await cookies()).get("sirius-auth")?.value;
    const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;

    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener permisos del usuario, quedándose solo con los que aplican a un
    //    flujo de autorización real (permisos y vacaciones).
    const permisos = (await obtenerPermisosEmpleado(payload.sub)).filter(
      (p) => p.tipo === "Permiso" || p.tipo === "Vacaciones" || p.tipo === "Todas",
    );

    if (permisos.length === 0) {
      return NextResponse.json({
        ok: true,
        permisos: [],
        solicitudes: { permisos: [], vacaciones: [] },
      });
    }

    // 3. Obtener datos del autorizador (áreas)
    const urlAutorizador = `https://api.airtable.com/v0/${BASE_ID_CORE}/${encodeURIComponent(TABLES.PERSONAL)}/${payload.sub}`;
    const resAutorizador = await fetch(urlAutorizador, {
      headers: { Authorization: `Bearer ${API_KEY_CORE}` },
    });

    const dataAutorizador = await resAutorizador.json();
    const areasAutorizador: string[] = dataAutorizador.fields?.["Areas"] || [];

    // 4. Determinar qué tipos de solicitudes puede ver
    const tiposPermitidos = new Set<string>();
    let ambitoGeneral = "Todos"; // Por defecto

    permisos.forEach((p) => {
      if (p.tipo === "Todas") {
        tiposPermitidos.add("Permiso");
        tiposPermitidos.add("Vacaciones");
      } else {
        tiposPermitidos.add(p.tipo);
      }

      // Determinar ámbito más restrictivo
      if (p.ambito === "Solo su área" || p.ambito === "Solo su equipo directo") {
        ambitoGeneral = p.ambito;
      }
    });

    // 5. Fetch en paralelo de las solicitudes pendientes según permisos
    const [permisosPend, vacacionesPend] = await Promise.all([
      // ── Permisos ──
      tiposPermitidos.has("Permiso")
        ? fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.PERMISO, {
            filterByFormula: esPendiente(FIELDS.PERMISO.ESTADO),
            "sort[0][field]": FIELDS.PERMISO.FECHA_SOLICITUD,
            "sort[0][direction]": "desc",
          })
        : Promise.resolve([]),

      // ── Vacaciones (el estado inicial puede venir vacío) ──
      tiposPermitidos.has("Vacaciones")
        ? fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.VACACIONES, {
            filterByFormula: `OR(${esPendiente(FIELDS.VACACIONES.ESTADO)}, {${FIELDS.VACACIONES.ESTADO}} = BLANK())`,
            "sort[0][field]": FIELDS.VACACIONES.FECHA_PRESENTACION,
            "sort[0][direction]": "desc",
          })
        : Promise.resolve([]),
    ]);

    const solicitudes = {
      permisos: permisosPend,
      vacaciones: vacacionesPend,
    };

    // 6. Filtrar por ámbito si es necesario
    if (ambitoGeneral === "Solo su área" && areasAutorizador.length > 0) {
      const empleadosAreaFormula = areasAutorizador
        .map((areaId) => `FIND('${escapeAirtableValue(areaId)}', ARRAYJOIN({Areas}))`)
        .join(",");

      const empleadosArea = await fetchTodos(BASE_ID_CORE, API_KEY_CORE, TABLES.PERSONAL, {
        filterByFormula: `OR(${empleadosAreaFormula})`,
        "fields[]": FIELDS.PERSONAL.ID_EMPLEADO,
      });

      const idCoresPermitidos = new Set(
        empleadosArea.map((r) => r.fields[FIELDS.PERSONAL.ID_EMPLEADO]),
      );

      const enAmbito = (r: Registro) => idCoresPermitidos.has(r.fields[FK_ID_CORE]);
      solicitudes.permisos = solicitudes.permisos.filter(enAmbito);
      solicitudes.vacaciones = solicitudes.vacaciones.filter(enAmbito);
    }

    // 7. Retornar resultado
    return NextResponse.json({
      ok: true,
      permisos: permisos.map((p) => ({ tipo: p.tipo, ambito: p.ambito, notas: p.notas })),
      solicitudes,
      ambito: ambitoGeneral,
      areas: areasAutorizador,
    });
  } catch (error: unknown) {
    console.error("Error en /api/solicitudes/pendientes:", error);
    const mensaje = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
