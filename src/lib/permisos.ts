/**
 * Sistema de validación de permisos de autorización
 * Consulta tabla Permisos_Autorizacion en Nómina Core
 */

const BASE_ID_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const API_KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

export type TipoSolicitud = "Permiso" | "Vacaciones" | "Horas Extra" | "Novedad Nómina" | "Todas";
export type Ambito = "Todos" | "Solo su área" | "Solo su equipo directo";

export interface Permiso {
  id: string;
  nombre: string;
  tipo: TipoSolicitud;
  ambito: Ambito;
  puedeAutorizar: boolean;
  notas?: string;
}

export interface ValidationResult {
  puede: boolean;
  razon?: string;
  permisos?: Permiso[];
}

/**
 * Obtiene los permisos de un empleado basado en sus roles
 */
export async function obtenerPermisosEmpleado(empleadoId: string): Promise<Permiso[]> {
  try {
    // 1. Obtener roles del empleado
    const urlEmpleado = `https://api.airtable.com/v0/${BASE_ID_CORE}/Personal/${empleadoId}`;
    const resEmpleado = await fetch(urlEmpleado, {
      headers: { Authorization: `Bearer ${API_KEY_CORE}` }
    });

    if (!resEmpleado.ok) {
      throw new Error('Empleado no encontrado');
    }

    const dataEmpleado = await resEmpleado.json();
    const rolesIds = dataEmpleado.fields['Rol'] || [];

    if (rolesIds.length === 0) {
      return [];
    }

    // 2. Obtener TODOS los permisos activos y filtrar en memoria
    // (Airtable no soporta bien FIND en campos multipleRecordLinks)
    const urlPermisos = `https://api.airtable.com/v0/${BASE_ID_CORE}/Permisos_Autorizacion?filterByFormula={Puede_Autorizar}=TRUE()`;
    const resPermisos = await fetch(urlPermisos, {
      headers: { Authorization: `Bearer ${API_KEY_CORE}` }
    });

    if (!resPermisos.ok) {
      return [];
    }

    const dataPermisos = await resPermisos.json();

    // Filtrar permisos que tengan al menos uno de los roles del empleado
    const rolesSet = new Set(rolesIds);
    const permisosFiltrados = dataPermisos.records.filter((r: any) => {
      const permisoRoles = r.fields['Rol'] || [];
      return permisoRoles.some((rolId: string) => rolesSet.has(rolId));
    });

    return permisosFiltrados.map((r: any) => ({
      id: r.id,
      nombre: r.fields['Nombre_Permiso'] || '',
      tipo: r.fields['Tipo_Solicitud'] as TipoSolicitud,
      ambito: r.fields['Ambito'] as Ambito,
      puedeAutorizar: r.fields['Puede_Autorizar'] === true,
      notas: r.fields['Notas']
    }));

  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return [];
  }
}

/**
 * Valida si un empleado puede autorizar una solicitud específica
 */
export async function validarPermisoAutorizacion(opts: {
  autorizadorId: string;        // payload.sub del JWT
  tipoSolicitud: TipoSolicitud; // Tipo de solicitud a autorizar
  solicitudIdCore: string;      // ID Core del solicitante (SIRIUS-PER-XXX)
}): Promise<ValidationResult> {
  try {
    // 1. Obtener permisos del autorizador
    const permisos = await obtenerPermisosEmpleado(opts.autorizadorId);

    if (permisos.length === 0) {
      return {
        puede: false,
        razon: 'No tiene permisos de autorización configurados'
      };
    }

    // 2. Filtrar permisos relevantes para este tipo de solicitud
    const permisosRelevantes = permisos.filter(p =>
      p.tipo === opts.tipoSolicitud || p.tipo === "Todas"
    );

    if (permisosRelevantes.length === 0) {
      return {
        puede: false,
        razon: `No tiene permisos para autorizar solicitudes de tipo "${opts.tipoSolicitud}"`
      };
    }

    // 3. Obtener datos del autorizador y solicitante para validar ámbito
    const [autorizador, solicitante] = await Promise.all([
      obtenerDatosEmpleado(opts.autorizadorId),
      obtenerDatosEmpleadoPorIdCore(opts.solicitudIdCore)
    ]);

    // 4. Validar ámbito
    for (const permiso of permisosRelevantes) {
      if (permiso.ambito === "Todos") {
        return { puede: true, permisos: permisosRelevantes };
      }

      if (permiso.ambito === "Solo su área") {
        // Verificar si comparten al menos un área
        const autorizadorAreas = autorizador.areas || [];
        const solicitanteAreas = solicitante.areas || [];

        const mismaArea = autorizadorAreas.some((a: string) => solicitanteAreas.includes(a));

        if (mismaArea) {
          return { puede: true, permisos: permisosRelevantes };
        }
      }

      if (permiso.ambito === "Solo su equipo directo") {
        // Verificar si el autorizador es jefe directo del solicitante
        if (solicitante.jefeDirecto === opts.autorizadorId) {
          return { puede: true, permisos: permisosRelevantes };
        }
      }
    }

    return {
      puede: false,
      razon: 'No tiene ámbito de autorización para este empleado. Verifique si comparten área o equipo.'
    };

  } catch (error) {
    console.error('Error validando permisos:', error);
    return {
      puede: false,
      razon: 'Error al validar permisos'
    };
  }
}

/**
 * Obtiene datos de un empleado por su ID de registro
 */
async function obtenerDatosEmpleado(empleadoId: string) {
  const url = `https://api.airtable.com/v0/${BASE_ID_CORE}/Personal/${empleadoId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY_CORE}` }
  });

  if (!res.ok) {
    throw new Error('Empleado no encontrado');
  }

  const data = await res.json();

  return {
    id: data.id,
    nombre: data.fields['Nombre completo'],
    cedula: data.fields['Numero Documento'],
    idCore: data.fields['ID Empleado'],
    areas: data.fields['Areas'] || [],
    jefeDirecto: data.fields['Jefe_Directo'] || null
  };
}

/**
 * Obtiene datos de un empleado por su ID Core (SIRIUS-PER-XXX)
 */
async function obtenerDatosEmpleadoPorIdCore(idCore: string) {
  const formula = `{ID Empleado}='${idCore.replace(/'/g, "\\'")}'`;
  const url = `https://api.airtable.com/v0/${BASE_ID_CORE}/Personal?filterByFormula=${encodeURIComponent(formula)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY_CORE}` }
  });

  if (!res.ok) {
    throw new Error('Empleado no encontrado');
  }

  const data = await res.json();

  if (!data.records || data.records.length === 0) {
    throw new Error('Empleado no encontrado');
  }

  const record = data.records[0];

  return {
    id: record.id,
    nombre: record.fields['Nombre completo'],
    cedula: record.fields['Numero Documento'],
    idCore: record.fields['ID Empleado'],
    areas: record.fields['Areas'] || [],
    jefeDirecto: record.fields['Jefe_Directo'] || null
  };
}

/**
 * Mapea tabla de solicitud a tipo de solicitud
 */
export function mapearTablaTipo(tabla: string): TipoSolicitud {
  switch (tabla.toLowerCase()) {
    case 'permiso':
      return 'Permiso';
    case 'vacaciones':
      return 'Vacaciones';
    case 'novedades':
      return 'Horas Extra'; // Por defecto, se valida por tipo específico
    default:
      throw new Error(`Tabla desconocida: ${tabla}`);
  }
}
