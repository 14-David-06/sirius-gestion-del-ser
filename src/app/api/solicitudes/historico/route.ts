/**
 * GET /api/solicitudes/historico
 *
 * Histórico completo de permisos, vacaciones y novedades de nómina.
 *
 * Alcance según los permisos de autorización del usuario:
 * - Sin permisos de autorización → solo sus propias solicitudes.
 * - Con ámbito "Todos"           → todas las solicitudes de la empresa.
 * - Con ámbito de área/equipo    → solo las de los empleados de sus áreas.
 *
 * A diferencia de /pendientes, aquí no se filtra por estado: el objetivo es ver
 * el trámite completo, incluido lo ya resuelto y su documento oficial.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { obtenerPermisosEmpleado } from "@/lib/permisos";
import { fetchTodos, type RegistroAirtable } from "@/lib/airtable-fetch";
import { TABLES, FIELDS, FK_ID_CORE } from "@/lib/airtable-schema";
import { escapeAirtableValue } from "@/lib/security";
import {
  documentosDeSolicitud,
  type CategoriaSolicitud,
  type DocumentoSolicitud,
} from "@/lib/documentos-solicitud";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;
const BASE_ID_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const API_KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

/** Alcance de lo que el usuario puede ver en el histórico. */
type Alcance =
  | { tipo: "propio"; idCore: string }
  | { tipo: "todos" }
  | { tipo: "areas"; idCores: Set<string> };

export async function GET() {
  try {
    const token = (await cookies()).get("sirius-auth")?.value;
    const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;

    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const alcance = await resolverAlcance(payload.sub, payload.idCore);

    // Con alcance propio se filtra en Airtable; con alcance amplio se trae todo
    // y se filtra en memoria (una sola fórmula no cubre listas grandes de FK).
    const soloPropio =
      alcance.tipo === "propio"
        ? `{${FK_ID_CORE}} = '${escapeAirtableValue(alcance.idCore)}'`
        : undefined;

    const [permisos, vacaciones, novedades] = await Promise.all([
      fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.PERMISO, {
        ...(soloPropio ? { filterByFormula: soloPropio } : {}),
        "sort[0][field]": FIELDS.PERMISO.FECHA_SOLICITUD,
        "sort[0][direction]": "desc",
      }),
      fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.VACACIONES, {
        ...(soloPropio ? { filterByFormula: soloPropio } : {}),
        "sort[0][field]": FIELDS.VACACIONES.FECHA_PRESENTACION,
        "sort[0][direction]": "desc",
      }),
      fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.NOVEDADES, {
        ...(soloPropio ? { filterByFormula: soloPropio } : {}),
        "sort[0][field]": FIELDS.NOVEDADES.FECHA_CREACION,
        "sort[0][direction]": "desc",
      }),
    ]);

    const enAlcance = (r: RegistroAirtable) => {
      if (alcance.tipo === "todos") return true;
      const idCore = r.fields[FK_ID_CORE] as string | undefined;
      if (!idCore) return false;
      return alcance.tipo === "propio"
        ? idCore === alcance.idCore
        : alcance.idCores.has(idCore);
    };

    const solicitudes = {
      permisos: permisos.filter(enAlcance),
      vacaciones: vacaciones.filter(enAlcance),
      novedades: novedades.filter(enAlcance),
    };

    // La tabla de novedades solo guarda el idCore: sin esto las filas saldrían
    // sin nombre ni cédula del reportante.
    const empleados = await obtenerEmpleados(
      solicitudes.novedades.map((r) => r.fields[FK_ID_CORE]).filter(Boolean) as string[],
    );

    const novedadesConEmpleado = solicitudes.novedades.map((r) => ({
      ...r,
      empleado: empleados.get(r.fields[FK_ID_CORE] as string) ?? null,
    }));

    // Todos los archivos de todos los registros, para la pestaña de documentos.
    // Se arman en el servidor porque los nombres de campo de Airtable no deben
    // salir al cliente (ver regla 9 de CLAUDE.md).
    const documentos: (DocumentoSolicitud & {
      nombre: string;
      cedula: string;
      fecha: string;
    })[] = [];

    const recolectar = (
      categoria: CategoriaSolicitud,
      registros: { id: string; fields: Record<string, unknown>; empleado?: { nombre: string; cedula: string } | null }[],
      campoFecha: string,
    ) => {
      for (const r of registros) {
        const nombre =
          (r.fields[FIELDS.PERMISO.NOMBRE] as string) || r.empleado?.nombre || "Sin nombre";
        const cedula = (r.fields[FIELDS.PERMISO.CEDULA] as string) || r.empleado?.cedula || "";
        const fecha = String(r.fields[campoFecha] ?? "").slice(0, 10);

        for (const doc of documentosDeSolicitud(categoria, r.id, r.fields)) {
          documentos.push({ ...doc, nombre, cedula, fecha });
        }
      }
    };

    recolectar("permisos", solicitudes.permisos, FIELDS.PERMISO.FECHA_SOLICITUD);
    recolectar("vacaciones", solicitudes.vacaciones, FIELDS.VACACIONES.FECHA_PRESENTACION);
    recolectar("novedades", novedadesConEmpleado, FIELDS.NOVEDADES.FECHA_CREACION);

    documentos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    return NextResponse.json({
      ok: true,
      alcance: alcance.tipo,
      solicitudes: { ...solicitudes, novedades: novedadesConEmpleado },
      documentos,
    });
  } catch (error: unknown) {
    console.error("Error en /api/solicitudes/historico:", error);
    const mensaje = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

/** Traduce los permisos de autorización del usuario a un alcance de lectura. */
async function resolverAlcance(recordId: string, idCore: string): Promise<Alcance> {
  const permisos = await obtenerPermisosEmpleado(recordId);
  if (permisos.length === 0) return { tipo: "propio", idCore };

  if (permisos.some((p) => p.ambito === "Todos")) return { tipo: "todos" };

  // Ámbito por área: se resuelven los empleados de las áreas del autorizador
  const persona = await fetch(
    `https://api.airtable.com/v0/${BASE_ID_CORE}/${encodeURIComponent(TABLES.PERSONAL)}/${recordId}`,
    { headers: { Authorization: `Bearer ${API_KEY_CORE}` }, cache: "no-store" },
  ).then((r) => (r.ok ? r.json() : null));

  const areas: string[] = persona?.fields?.["Areas"] ?? [];
  if (areas.length === 0) return { tipo: "propio", idCore };

  const formula = areas
    .map((areaId) => `FIND('${escapeAirtableValue(areaId)}', ARRAYJOIN({Areas}))`)
    .join(",");

  const empleadosArea = await fetchTodos(BASE_ID_CORE, API_KEY_CORE, TABLES.PERSONAL, {
    filterByFormula: `OR(${formula})`,
    "fields[]": FIELDS.PERSONAL.ID_EMPLEADO,
  });

  const idCores = new Set(
    empleadosArea
      .map((r) => r.fields[FIELDS.PERSONAL.ID_EMPLEADO] as string | undefined)
      .filter(Boolean) as string[],
  );
  // El propio usuario siempre ve su historial
  idCores.add(idCore);

  return { tipo: "areas", idCores };
}

/** Resuelve nombre y cédula de un conjunto de idCore ("SIRIUS-PER-XXXX"). */
async function obtenerEmpleados(
  idCores: string[],
): Promise<Map<string, { nombre: string; cedula: string }>> {
  const mapa = new Map<string, { nombre: string; cedula: string }>();
  const unicos = [...new Set(idCores)];
  if (unicos.length === 0) return mapa;

  // Airtable limita el tamaño de la fórmula: se consulta por lotes de 50
  for (let i = 0; i < unicos.length; i += 50) {
    const lote = unicos.slice(i, i + 50);
    const formula = `OR(${lote
      .map((id) => `{${FIELDS.PERSONAL.ID_EMPLEADO}} = '${escapeAirtableValue(id)}'`)
      .join(",")})`;

    const registros = await fetchTodos(BASE_ID_CORE, API_KEY_CORE, TABLES.PERSONAL, {
      filterByFormula: formula,
      "fields[]": [
        FIELDS.PERSONAL.ID_EMPLEADO,
        FIELDS.PERSONAL.NOMBRE,
        FIELDS.PERSONAL.NUMERO_DOCUMENTO,
      ],
    });

    registros.forEach(({ fields }) => {
      const idCore = fields[FIELDS.PERSONAL.ID_EMPLEADO] as string | undefined;
      if (!idCore) return;
      mapa.set(idCore, {
        nombre: (fields[FIELDS.PERSONAL.NOMBRE] as string) ?? "",
        cedula: (fields[FIELDS.PERSONAL.NUMERO_DOCUMENTO] as string) ?? "",
      });
    });
  }

  return mapa;
}
