/**
 * API Solicitudes — Recalcular saldos de vacaciones
 *
 * POST /api/requests/recalcular-saldos → Recalcula saldo de todos los empleados (Admin Depto+)
 *
 * Para cada contrato activo:
 *   1. Suma días hábiles de vacaciones aprobadas
 *   2. Recalcula con CST Art. 186 (15 días/año proporcional)
 *   3. Persiste en requests_saldos_vacaciones (PATCH si existe, POST si no)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";
import { calcularSaldoVacaciones } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_REQUESTS = env.airtable.tableRequestsRequests;
const TABLE_SALDOS = env.airtable.tableRequestsSaldos;
const TABLE_CONTRACTS = env.airtable.tableContractsContracts;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function tableUrl(table: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
}

function recordUrl(table: string, id: string) {
  return `${tableUrl(table)}/${id}`;
}

/** Fetch paginado local para recalcular-saldos */
async function fetchPaginatedLocal(
  table: string,
  formula?: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const results: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(tableUrl(table));
    if (formula) url.searchParams.set("filterByFormula", formula);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    results.push(
      ...((data.records as Array<{ id: string; fields: Record<string, unknown> }>) ?? [])
    );
    offset = data.offset as string | undefined;
  } while (offset);

  return results;
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json(
        { error: "Sin permisos para recalcular saldos de vacaciones" },
        { status: 403 }
      );
    }

    // 1. Obtener todos los contratos activos
    const contratos = await fetchPaginatedLocal(TABLE_CONTRACTS, `{Estado}='activo'`);

    let actualizados = 0;
    const ahora = new Date().toISOString();

    for (const contrato of contratos) {
      const f = contrato.fields;
      const empleadoId = (f["ID_Empleado"] as string) || "";
      const nombreEmpleado = (f["Nombre_Empleado"] as string) || "";
      const fechaInicio = (f["Fecha_Inicio"] as string) || "";

      if (!empleadoId || !fechaInicio) continue;

      const safeId = escapeAirtableValue(empleadoId);

      // 2. Contar días de vacaciones aprobadas
      const vacFormula = `AND({Empleado_ID}='${safeId}',{Tipo}='vacaciones',{Estado}='aprobado')`;
      const solicitudes = await fetchPaginatedLocal(TABLE_REQUESTS, vacFormula);

      const diasUsados = solicitudes.reduce((sum, r) => {
        return sum + ((r.fields["Dias_Habiles_Calculados"] as number) ?? 0);
      }, 0);

      // 3. Calcular saldo con CST Art. 186
      const saldo = calcularSaldoVacaciones(fechaInicio, diasUsados);

      const saldoFields = {
        Empleado_ID: empleadoId,
        Nombre_Empleado: nombreEmpleado,
        Dias_Totales: saldo.diasTotales,
        Dias_Usados: saldo.diasUsados,
        Dias_Disponibles: saldo.diasDisponibles,
        Ultimo_Calculo: ahora,
      };

      // 4. Buscar saldo existente
      const saldoUrl = new URL(tableUrl(TABLE_SALDOS));
      saldoUrl.searchParams.set("filterByFormula", `{Empleado_ID}='${safeId}'`);
      saldoUrl.searchParams.set("maxRecords", "1");

      const saldoRes = await fetch(saldoUrl.toString(), {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      });

      if (!saldoRes.ok) {
        console.error(
          `[recalcular-saldos] Error buscando saldo de ${empleadoId}:`,
          saldoRes.status
        );
        continue;
      }

      const saldoData = await saldoRes.json();
      const saldoRecord = saldoData.records?.[0] as
        | { id: string; fields: Record<string, unknown> }
        | undefined;

      // 5. PATCH si existe, POST si no
      if (saldoRecord) {
        const patchRes = await fetch(recordUrl(TABLE_SALDOS, saldoRecord.id), {
          method: "PATCH",
          headers: airtableHeaders(),
          body: JSON.stringify({ fields: saldoFields }),
        });

        if (!patchRes.ok) {
          console.error(
            `[recalcular-saldos] Error actualizando saldo de ${empleadoId}:`,
            patchRes.status,
            await patchRes.text()
          );
          continue;
        }
      } else {
        const postRes = await fetch(tableUrl(TABLE_SALDOS), {
          method: "POST",
          headers: airtableHeaders(),
          body: JSON.stringify({ fields: saldoFields }),
        });

        if (!postRes.ok) {
          console.error(
            `[recalcular-saldos] Error creando saldo de ${empleadoId}:`,
            postRes.status,
            await postRes.text()
          );
          continue;
        }
      }

      actualizados++;
    }

    return NextResponse.json({ ok: true, actualizados });
  } catch (err) {
    console.error("[recalcular-saldos POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
