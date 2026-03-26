/**
 * API Solicitudes — Aprobar
 *
 * PATCH /api/requests/:id/approve → Aprobar solicitud pendiente (Admin Depto+)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue, hasMinRole, getRoleFromPayload } from "@/lib/security";
import { mapearSolicitud } from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_REQUESTS = env.airtable.tableRequestsRequests;
const TABLE_SALDOS = env.airtable.tableRequestsSaldos;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function recordUrl(table: string, recordId: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}/${recordId}`;
}

function tableUrl(table: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos para aprobar solicitudes" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json() as { comentario?: string };

    // Obtener solicitud actual
    const currentRes = await fetch(recordUrl(TABLE_REQUESTS, id), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!currentRes.ok) {
      if (currentRes.status === 404) {
        return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: "Error al consultar la solicitud" }, { status: 500 });
    }

    const solicitud = mapearSolicitud(await currentRes.json());

    if (solicitud.estado !== "pendiente") {
      return NextResponse.json(
        { error: `No se puede aprobar una solicitud en estado '${solicitud.estado}'` },
        { status: 400 }
      );
    }

    const ahora = new Date().toISOString();

    // Actualizar solicitud - marca como aprobada y lista para nómina
    const updateRes = await fetch(recordUrl(TABLE_REQUESTS, id), {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          Estado: "aprobado",
          ...(body.comentario ? { Comentario_Admin: body.comentario } : {}),
          Revisado_Por: payload.nombre || "Admin",
          Procesado_Nomina: false, // Queda pendiente para procesar por nómina
          Updated_At: ahora,
        },
      }),
    });

    if (!updateRes.ok) {
      console.error("[Requests approve] Airtable error:", updateRes.status, await updateRes.text());
      return NextResponse.json({ error: "Error al aprobar la solicitud" }, { status: 500 });
    }

    // Si es vacaciones, actualizar saldo (no bloqueante)
    if (solicitud.tipo === "vacaciones" && solicitud.diasHabilesCalculados != null) {
      const diasAprobados = solicitud.diasHabilesCalculados;
      const safeEmpId = escapeAirtableValue(solicitud.empleadoId);

      const saldoUrl = new URL(tableUrl(TABLE_SALDOS));
      saldoUrl.searchParams.set("filterByFormula", `{Empleado_ID}='${safeEmpId}'`);
      saldoUrl.searchParams.set("maxRecords", "1");

      fetch(saldoUrl.toString(), {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((saldoData) => {
          const saldoRecord = saldoData.records?.[0] as
            | { id: string; fields: Record<string, unknown> }
            | undefined;

          if (saldoRecord) {
            const diasUsados =
              ((saldoRecord.fields["Dias_Usados"] as number) ?? 0) + diasAprobados;
            const diasTotales = (saldoRecord.fields["Dias_Totales"] as number) ?? 0;
            const diasDisponibles = Math.max(0, diasTotales - diasUsados);

            return fetch(recordUrl(TABLE_SALDOS, saldoRecord.id), {
              method: "PATCH",
              headers: airtableHeaders(),
              body: JSON.stringify({
                fields: {
                  Dias_Usados: diasUsados,
                  Dias_Disponibles: diasDisponibles,
                  Ultimo_Calculo: ahora,
                },
              }),
            });
          } else {
            // Crear saldo con Dias_Totales=0 como fallback (recalcular-saldos lo corregirá)
            return fetch(tableUrl(TABLE_SALDOS), {
              method: "POST",
              headers: airtableHeaders(),
              body: JSON.stringify({
                fields: {
                  Empleado_ID: solicitud.empleadoId,
                  Nombre_Empleado: solicitud.nombreEmpleado,
                  Dias_Totales: 0,
                  Dias_Usados: diasAprobados,
                  Dias_Disponibles: 0,
                  Ultimo_Calculo: ahora,
                },
              }),
            });
          }
        })
        .catch((e) => console.error("[Requests approve] actualizar saldo:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Requests approve] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
