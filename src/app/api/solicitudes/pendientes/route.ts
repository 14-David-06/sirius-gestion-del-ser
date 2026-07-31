import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { obtenerPermisosEmpleado } from "@/lib/permisos";
import { TABLES, FIELDS, FK_ID_CORE, ESTADO_PENDIENTE } from "@/lib/airtable-schema";
import { TIPO_HORAS_EXTRA } from "@/lib/constants";
import { escapeAirtableValue } from "@/lib/security";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;
const BASE_ID_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const API_KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

type Registro = { id: string; fields: Record<string, unknown> };

/**
 * Trae TODOS los registros de una tabla siguiendo la paginación de Airtable.
 * Airtable devuelve máximo 100 registros por página; sin este bucle las
 * solicitudes más allá de la primera página nunca llegaban al panel.
 */
async function fetchTodos(
  baseId: string,
  apiKey: string,
  tabla: string,
  params: Record<string, string | string[]>,
): Promise<Registro[]> {
  const registros: Registro[] = [];
  let offset: string | undefined;

  // Tope de seguridad: 20 páginas = 2000 registros
  for (let pagina = 0; pagina < 20; pagina++) {
    const qs = new URLSearchParams({ pageSize: "100" });
    for (const [clave, valor] of Object.entries(params)) {
      // "fields[]" admite varios valores repitiendo la clave
      for (const v of Array.isArray(valor) ? valor : [valor]) qs.append(clave, v);
    }
    if (offset) qs.set("offset", offset);

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tabla)}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });

    if (!res.ok) {
      console.error(`[PENDIENTES] Airtable ${res.status} en ${tabla}:`, await res.text());
      break;
    }

    const data = await res.json();
    registros.push(...(data.records ?? []));

    if (!data.offset) break;
    offset = data.offset;
  }

  return registros;
}

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

    // 2. Obtener permisos del usuario
    const permisos = await obtenerPermisosEmpleado(payload.sub);

    if (permisos.length === 0) {
      return NextResponse.json({
        ok: true,
        permisos: [],
        solicitudes: { permisos: [], vacaciones: [], novedades: [] },
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
        tiposPermitidos.add(TIPO_HORAS_EXTRA);
        tiposPermitidos.add("Novedad Nómina");
      } else {
        tiposPermitidos.add(p.tipo);
      }

      // Determinar ámbito más restrictivo
      if (p.ambito === "Solo su área" || p.ambito === "Solo su equipo directo") {
        ambitoGeneral = p.ambito;
      }
    });

    const puedeHorasExtra = tiposPermitidos.has(TIPO_HORAS_EXTRA);
    const puedeOtrasNovedades = tiposPermitidos.has("Novedad Nómina");

    // 5. Fetch en paralelo de las solicitudes pendientes según permisos
    const [permisosPend, vacacionesPend, novedadesPend] = await Promise.all([
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

      // ── Novedades ──
      // Si tiene ambos permisos ve todas las novedades pendientes;
      // si solo tiene uno, se filtra por tipo (los tipos vienen como texto
      // libre e inconsistente: "Horas Extra ", "Horas Extras", ...).
      puedeHorasExtra || puedeOtrasNovedades
        ? fetchTodos(BASE_ID_NOVEDADES, API_KEY_NOVEDADES, TABLES.NOVEDADES, {
            filterByFormula: (() => {
              const pendiente = esPendiente(FIELDS.NOVEDADES.ESTADO);
              const esHorasExtra = `REGEX_MATCH(LOWER(TRIM({${FIELDS.NOVEDADES.TIPO}})), '^horas extra')`;
              if (puedeHorasExtra && puedeOtrasNovedades) return pendiente;
              return `AND(${pendiente}, ${puedeHorasExtra ? esHorasExtra : `NOT(${esHorasExtra})`})`;
            })(),
            "sort[0][field]": FIELDS.NOVEDADES.FECHA_CREACION,
            "sort[0][direction]": "desc",
          })
        : Promise.resolve([]),
    ]);

    const solicitudes = {
      permisos: permisosPend,
      vacaciones: vacacionesPend,
      novedades: novedadesPend,
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
      solicitudes.novedades = solicitudes.novedades.filter(enAmbito);
    }

    // 7. Enriquecer con datos del empleado
    // La tabla de Novedades solo guarda "ID Personal Core": sin este paso las
    // tarjetas de novedades se mostraban como "Sin nombre".
    const empleados = await obtenerEmpleados(
      solicitudes.novedades.map((r) => r.fields[FK_ID_CORE]).filter(Boolean) as string[],
    );

    const novedadesConEmpleado = solicitudes.novedades.map((r) => ({
      ...r,
      empleado: empleados.get(r.fields[FK_ID_CORE] as string) ?? null,
    }));

    // 8. Retornar resultado
    return NextResponse.json({
      ok: true,
      permisos: permisos.map((p) => ({ tipo: p.tipo, ambito: p.ambito, notas: p.notas })),
      solicitudes: { ...solicitudes, novedades: novedadesConEmpleado },
      ambito: ambitoGeneral,
      areas: areasAutorizador,
    });
  } catch (error: unknown) {
    console.error("Error en /api/solicitudes/pendientes:", error);
    const mensaje = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}

/**
 * Resuelve nombre y cédula de un conjunto de idCore ("SIRIUS-PER-XXXX").
 */
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
