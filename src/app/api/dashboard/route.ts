import { NextResponse } from "next/server";
import {
  getListaChequeo,
  getTipoDocumento,
  getContratos,
  getRegistroCumplimiento,
  getPersonal,
  getRoles,
  getAreas,
  buildEmpleadoMap,
} from "@/lib/airtable";
import { env } from "@/lib/env";

// Next.js requiere que revalidate sea una constante estática en build time.
// Usamos el valor por defecto; para cambiarlo, actualiza AIRTABLE_REVALIDATE_SECONDS en .env.local
// y la constante se lee en runtime dentro de fetchAllRecords.
export const revalidate = 60;

export async function GET() {
  try {
    const [
      listaChequeo,
      tipoDocumento,
      contratos,
      registroCumplimiento,
      personal,
      roles,
      areas,
    ] = await Promise.all([
      getListaChequeo(),
      getTipoDocumento(),
      getContratos(),
      getRegistroCumplimiento(),
      getPersonal(),
      getRoles(),
      getAreas(),
    ]);

    const empleadoMap = buildEmpleadoMap(personal);

    // Enriquecer contratos con nombre del empleado
    const contratosEnriquecidos = contratos.map((c) => {
      const empId = c.fields["ID_Empleado"] as string;
      const emp = empId ? empleadoMap.get(empId) : null;
      return {
        ...c,
        fields: {
          ...c.fields,
          _nombreEmpleado: emp ? emp["Nombre completo"] : null,
          _estadoEmpleado: emp ? emp["Estado de actividad"] : null,
        },
      };
    });

    // Enriquecer registros de cumplimiento
    const registrosEnriquecidos = registroCumplimiento.map((r) => {
      const empId = r.fields["ID_Empleado"] as string;
      const respId = r.fields["ID_Responsable"] as string;
      const emp = empId ? empleadoMap.get(empId) : null;
      const resp = respId ? empleadoMap.get(respId) : null;
      return {
        ...r,
        fields: {
          ...r.fields,
          _nombreEmpleado: emp ? emp["Nombre completo"] : null,
          _nombreResponsable: resp ? resp["Nombre completo"] : null,
        },
      };
    });

    // Enriquecer lista de chequeo
    const listaChequeoEnriquecida = listaChequeo.map((l) => {
      const respId = l.fields["ID_Colaborador_Responsable"] as string;
      const custId = l.fields["ID_Custodio"] as string;
      const resp = respId ? empleadoMap.get(respId) : null;
      const cust = custId ? empleadoMap.get(custId) : null;
      return {
        ...l,
        fields: {
          ...l.fields,
          _nombreResponsable: resp ? resp["Nombre completo"] : null,
          _nombreCustodio: cust ? cust["Nombre completo"] : null,
        },
      };
    });

    return NextResponse.json({
      listaChequeo: listaChequeoEnriquecida,
      tipoDocumento,
      contratos: contratosEnriquecidos,
      registroCumplimiento: registrosEnriquecidos,
      personal: personal.map((p) => ({
        id: p.id,
        fields: {
          "ID Empleado": p.fields["ID Empleado"],
          "Nombre completo": p.fields["Nombre completo"],
          "Estado de actividad": p.fields["Estado de actividad"],
          "Tipo Personal": p.fields["Tipo Personal"],
          "Correo electrónico": p.fields["Correo electrónico"],
          "Teléfono": p.fields["Teléfono"],
        },
      })),
      roles,
      areas,
      stats: {
        totalEmpleados: personal.length,
        totalContratos: contratos.length,
        totalDocumentos: tipoDocumento.length,
        totalRegistros: registroCumplimiento.length,
        totalChecklist: listaChequeo.length,
        contratosVigentes: contratos.filter(
          (c) => c.fields["Estado"] === "Vigente"
        ).length,
        cumplidos: registroCumplimiento.filter(
          (r) => r.fields["Estado"] === "Cumplido"
        ).length,
        pendientes: registroCumplimiento.filter(
          (r) => r.fields["Estado"] === "Pendiente"
        ).length,
        enProceso: registroCumplimiento.filter(
          (r) => r.fields["Estado"] === "En proceso"
        ).length,
      },
    });
  } catch (error) {
    // Log detallado solo en servidor — nunca exponer al cliente
    console.error("[Dashboard API]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
