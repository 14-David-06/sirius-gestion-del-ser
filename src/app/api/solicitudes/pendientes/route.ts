import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { obtenerPermisosEmpleado } from "@/lib/permisos";

const BASE_ID_NOVEDADES = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY_NOVEDADES = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;
const BASE_ID_CORE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const API_KEY_CORE = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;

export async function GET(req: NextRequest) {
  try {
    // 1. Verificar autenticación
    const token = (await cookies()).get("sirius-auth")?.value;
    const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;

    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log('[PENDIENTES] Usuario autenticado:', {
      sub: payload.sub,
      nombre: payload.nombre,
      cedula: payload.cedula,
      rol: payload.rol
    });

    // 2. Obtener permisos del usuario
    const permisos = await obtenerPermisosEmpleado(payload.sub);

    console.log('[PENDIENTES] Permisos obtenidos:', permisos.length, permisos);

    if (permisos.length === 0) {
      console.log('[PENDIENTES] Usuario sin permisos de autorización');
      return NextResponse.json({
        ok: true,
        permisos: [],
        solicitudes: {
          permisos: [],
          vacaciones: [],
          novedades: []
        },
        debug: {
          empleadoId: payload.sub,
          mensaje: 'No se encontraron permisos para este empleado'
        }
      });
    }

    // 3. Obtener datos del autorizador (áreas)
    const urlAutorizador = `https://api.airtable.com/v0/${BASE_ID_CORE}/Personal/${payload.sub}`;
    const resAutorizador = await fetch(urlAutorizador, {
      headers: { Authorization: `Bearer ${API_KEY_CORE}` }
    });

    const dataAutorizador = await resAutorizador.json();
    const areasAutorizador = dataAutorizador.fields?.['Areas'] || [];

    // 4. Determinar qué tipos de solicitudes puede ver
    const tiposPermitidos = new Set<string>();
    let ambitoGeneral = "Todos"; // Por defecto

    permisos.forEach(p => {
      if (p.tipo === "Todas") {
        tiposPermitidos.add("Permiso");
        tiposPermitidos.add("Vacaciones");
        tiposPermitidos.add("Horas Extra");
        tiposPermitidos.add("Novedad Nómina");
      } else {
        tiposPermitidos.add(p.tipo);
      }

      // Determinar ámbito más restrictivo
      if (p.ambito === "Solo su área" || p.ambito === "Solo su equipo directo") {
        ambitoGeneral = p.ambito;
      }
    });

    // 5. Fetch solicitudes pendientes según permisos
    const solicitudes: {
      permisos: any[];
      vacaciones: any[];
      novedades: any[];
    } = {
      permisos: [],
      vacaciones: [],
      novedades: []
    };

    // Fetch Permisos
    if (tiposPermitidos.has("Permiso")) {
      const urlPermisos = `https://api.airtable.com/v0/${BASE_ID_NOVEDADES}/Solicitud_Permiso?filterByFormula={Estado_Permiso}='Pendiente'&sort[0][field]=Fecha de solicitud&sort[0][direction]=desc`;

      const resPermisos = await fetch(urlPermisos, {
        headers: { Authorization: `Bearer ${API_KEY_NOVEDADES}` }
      });

      if (resPermisos.ok) {
        const dataPermisos = await resPermisos.json();
        solicitudes.permisos = dataPermisos.records || [];
      }
    }

    // Fetch Vacaciones
    if (tiposPermitidos.has("Vacaciones")) {
      const urlVacaciones = `https://api.airtable.com/v0/${BASE_ID_NOVEDADES}/Solicitud_Vacaciones?filterByFormula=OR({Estado Solicitud}='Pendiente',{Estado Solicitud}='')&sort[0][field]=Fecha de Presentacion&sort[0][direction]=desc`;

      const resVacaciones = await fetch(urlVacaciones, {
        headers: { Authorization: `Bearer ${API_KEY_NOVEDADES}` }
      });

      if (resVacaciones.ok) {
        const dataVacaciones = await resVacaciones.json();
        solicitudes.vacaciones = dataVacaciones.records || [];
      }
    }

    // Fetch Novedades (Horas Extra específicamente)
    if (tiposPermitidos.has("Horas Extra")) {
      const urlNovedades = `https://api.airtable.com/v0/${BASE_ID_NOVEDADES}/Reportes%20Novedades%20Nomina?filterByFormula=AND({Tipo de Novedad}='Horas Extra',{Estado del Registro}='Pendiente')&sort[0][field]=Fecha Creación&sort[0][direction]=desc`;

      const resNovedades = await fetch(urlNovedades, {
        headers: { Authorization: `Bearer ${API_KEY_NOVEDADES}` }
      });

      if (resNovedades.ok) {
        const dataNovedades = await resNovedades.json();
        solicitudes.novedades = dataNovedades.records || [];
      }
    } else if (tiposPermitidos.has("Novedad Nómina")) {
      // Otras novedades (no Horas Extra)
      const urlNovedades = `https://api.airtable.com/v0/${BASE_ID_NOVEDADES}/Reportes%20Novedades%20Nomina?filterByFormula=AND({Tipo de Novedad}!='Horas Extra',{Estado del Registro}='Pendiente')&sort[0][field]=Fecha Creación&sort[0][direction]=desc`;

      const resNovedades = await fetch(urlNovedades, {
        headers: { Authorization: `Bearer ${API_KEY_NOVEDADES}` }
      });

      if (resNovedades.ok) {
        const dataNovedades = await resNovedades.json();
        solicitudes.novedades = dataNovedades.records || [];
      }
    }

    // 6. Filtrar por ámbito si es necesario
    if (ambitoGeneral === "Solo su área" && areasAutorizador.length > 0) {
      // Obtener todos los ID Cores de empleados del área
      const empleadosAreaFormula = areasAutorizador.map((areaId: string) =>
        `FIND('${areaId}', {Areas})`
      ).join(',');

      const urlEmpleadosArea = `https://api.airtable.com/v0/${BASE_ID_CORE}/Personal?filterByFormula=OR(${empleadosAreaFormula})&fields[]=ID Empleado`;

      const resEmpleadosArea = await fetch(urlEmpleadosArea, {
        headers: { Authorization: `Bearer ${API_KEY_CORE}` }
      });

      if (resEmpleadosArea.ok) {
        const dataEmpleadosArea = await resEmpleadosArea.json();
        const idCoresPermitidos = new Set(
          dataEmpleadosArea.records.map((r: any) => r.fields['ID Empleado'])
        );

        // Filtrar solicitudes
        solicitudes.permisos = solicitudes.permisos.filter(s =>
          idCoresPermitidos.has(s.fields['ID Personal Core'])
        );
        solicitudes.vacaciones = solicitudes.vacaciones.filter(s =>
          idCoresPermitidos.has(s.fields['ID Personal Core'])
        );
        solicitudes.novedades = solicitudes.novedades.filter(s =>
          idCoresPermitidos.has(s.fields['ID Personal Core'])
        );
      }
    }

    // 7. Retornar resultado
    return NextResponse.json({
      ok: true,
      permisos: permisos.map(p => ({
        tipo: p.tipo,
        ambito: p.ambito,
        notas: p.notas
      })),
      solicitudes,
      ambito: ambitoGeneral,
      areas: areasAutorizador
    });

  } catch (error: any) {
    console.error("Error en /api/solicitudes/pendientes:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
