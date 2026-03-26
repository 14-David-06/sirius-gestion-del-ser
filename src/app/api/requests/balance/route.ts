/**
 * API Solicitudes — Saldo de vacaciones
 *
 * GET /api/requests/balance?empleado_id=SIRIUS-PER-XXXX
 *   → Saldo de días de vacaciones del empleado.
 *   Admin puede consultar cualquier empleado; empleado ve su propio saldo.
 *   Si no existe registro en la tabla de saldos, lo calcula desde el contrato activo.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";
import { calcularSaldoVacaciones, SaldoVacaciones } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_SALDOS = env.airtable.tableRequestsSaldos;
const TABLE_CONTRACTS = env.airtable.tableContractsContracts;

function mapearSaldo(
  record: { id: string; fields: Record<string, unknown> }
): SaldoVacaciones {
  const f = record.fields;
  return {
    id: record.id,
    empleadoId: (f["Empleado_ID"] as string) || "",
    nombreEmpleado: (f["Nombre_Empleado"] as string) || "",
    diasTotales: (f["Dias_Totales"] as number) ?? 0,
    diasUsados: (f["Dias_Usados"] as number) ?? 0,
    diasDisponibles: (f["Dias_Disponibles"] as number) ?? 0,
    ultimoCalculo: (f["Ultimo_Calculo"] as string) || new Date().toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const isAdmin = hasMinRole(getRoleFromPayload(payload), "Admin Depto");
    const empleadoIdParam = req.nextUrl.searchParams.get("empleado_id");

    // Admin puede consultar cualquier empleado; empleado solo el suyo
    const empleadoId = isAdmin ? (empleadoIdParam || payload.idCore || "") : (payload.idCore || "");

    if (!empleadoId) {
      return NextResponse.json(
        { error: "No se pudo determinar el empleado a consultar" },
        { status: 400 }
      );
    }

    // Si es empleado regular intentando consultar otro empleado
    if (!isAdmin && empleadoIdParam && empleadoIdParam !== payload.idCore) {
      return NextResponse.json({ error: "Sin permisos para consultar este saldo" }, { status: 403 });
    }

    const safeId = escapeAirtableValue(empleadoId);

    // 1. Buscar saldo en requests_saldos_vacaciones
    const saldoUrl = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_SALDOS)}`
    );
    saldoUrl.searchParams.set("filterByFormula", `{Empleado_ID}='${safeId}'`);
    saldoUrl.searchParams.set("maxRecords", "1");

    const saldoRes = await fetch(saldoUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (saldoRes.ok) {
      const saldoData = await saldoRes.json();
      const saldoRecord = saldoData.records?.[0] as
        | { id: string; fields: Record<string, unknown> }
        | undefined;

      if (saldoRecord) {
        return NextResponse.json({ balance: mapearSaldo(saldoRecord) });
      }
    }

    // 2. Sin saldo registrado — calcular desde contrato activo
    const contratoUrl = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_CONTRACTS)}`
    );
    contratoUrl.searchParams.set(
      "filterByFormula",
      `AND({ID_Empleado}='${safeId}',{Estado}='activo')`
    );
    contratoUrl.searchParams.set("maxRecords", "1");
    contratoUrl.searchParams.set("fields[]", "Fecha_Inicio");
    contratoUrl.searchParams.set("fields[]", "Nombre_Empleado");

    const contratoRes = await fetch(contratoUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (contratoRes.ok) {
      const contratoData = await contratoRes.json();
      const contratoRecord = contratoData.records?.[0] as
        | { id: string; fields: Record<string, unknown> }
        | undefined;

      if (contratoRecord) {
        const fechaInicio = (contratoRecord.fields["Fecha_Inicio"] as string) || "";
        const nombreEmpleado = (contratoRecord.fields["Nombre_Empleado"] as string) || empleadoId;

        if (fechaInicio) {
          const calculado = calcularSaldoVacaciones(fechaInicio, 0);
          const balance: SaldoVacaciones = {
            id: null,
            empleadoId,
            nombreEmpleado,
            diasTotales: calculado.diasTotales,
            diasUsados: 0,
            diasDisponibles: calculado.diasDisponibles,
            ultimoCalculo: new Date().toISOString(),
          };
          return NextResponse.json({ balance });
        }
      }
    }

    // 3. Sin contrato activo — devolver saldo vacío
    const balanceVacio: SaldoVacaciones = {
      id: null,
      empleadoId,
      nombreEmpleado: empleadoId,
      diasTotales: 0,
      diasUsados: 0,
      diasDisponibles: 0,
      ultimoCalculo: new Date().toISOString(),
    };
    return NextResponse.json({ balance: balanceVacio });
  } catch (err) {
    console.error("[Requests balance GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
