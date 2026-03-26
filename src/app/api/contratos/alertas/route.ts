/**
 * POST /api/contratos/alertas  → Cron job: detectar contratos por vencer y crear/marcar alertas
 * GET  /api/contratos/alertas  → Listar alertas pendientes (Admin Depto+)
 *
 * El endpoint POST debe ser llamado diariamente por Vercel Cron o GitHub Actions.
 * Protegido con CRON_SECRET en el header Authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { hasMinRole, getRoleFromPayload } from "@/lib/security";
import {
  generarIdAlerta,
  DIAS_ALERTA,
  TipoAlerta,
  mapearContrato,
} from "@/lib/contratos/tipos";
import { enviarAlertaVencimiento } from "@/lib/contratos/email";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_ALERTAS = env.airtable.tableContractsAlertas;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

function tableUrl(table: string) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`;
}

// ─── GET: alertas pendientes ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const url = new URL(tableUrl(TABLE_ALERTAS));
    url.searchParams.set("filterByFormula", "{Enviada}=FALSE()");
    url.searchParams.set("sort[0][field]", "Fecha_Alerta");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ error: "Error al consultar alertas" }, { status: 500 });

    const data = await res.json();
    const alertas = (data.records || []).map((r: { id: string; fields: Record<string, unknown> }) => ({
      id: r.id,
      idAlerta: r.fields["ID_Alerta"],
      idContrato: r.fields["ID_Contrato"],
      nombreEmpleado: r.fields["Nombre_Empleado"],
      tipoAlerta: r.fields["Tipo_Alerta"],
      fechaVencimiento: r.fields["Fecha_Vencimiento"],
      fechaAlerta: r.fields["Fecha_Alerta"],
    }));

    return NextResponse.json({ alertas });
  } catch (err) {
    console.error("[Contratos/alertas GET] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ─── POST: cron job de detección y procesamiento de alertas ─────────────────

export async function POST(req: NextRequest) {
  try {
    // Autenticación del cron — CRON_SECRET en header
    const authHeader = req.headers.get("authorization");
    const cronSecret = env.cron.cronSecret;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const hoy = new Date().toISOString().split("T")[0];
    const tiposAlerta: TipoAlerta[] = ["30_dias", "15_dias", "7_dias"];
    let procesadas = 0;
    let creadas = 0;
    const errores: string[] = [];

    // 1. Buscar contratos activos con fecha_fin definida
    const contratosUrl = new URL(tableUrl(TABLE_CONTRATOS));
    contratosUrl.searchParams.set(
      "filterByFormula",
      "AND({Estado}='activo',{Fecha_Fin}!='')"
    );

    const contratosRes = await fetch(contratosUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!contratosRes.ok) {
      return NextResponse.json({ error: "Error al consultar contratos" }, { status: 500 });
    }

    const contratosData = await contratosRes.json();
    const contratos = (contratosData.records || []).map(mapearContrato);

    for (const contrato of contratos) {
      if (!contrato.fechaFin) continue;

      for (const tipoAlerta of tiposAlerta) {
        const diasAntes = DIAS_ALERTA[tipoAlerta];
        const fechaLimite = new Date(contrato.fechaFin);
        fechaLimite.setDate(fechaLimite.getDate() - diasAntes);
        const fechaAlertaStr = fechaLimite.toISOString().split("T")[0];

        // Solo procesar si la fecha de alerta es hoy o ya pasó (y no fue enviada)
        if (fechaAlertaStr > hoy) continue;

        const idAlerta = generarIdAlerta(contrato.idContrato, tipoAlerta);

        // Verificar si ya existe esta alerta
        const checkUrl = new URL(tableUrl(TABLE_ALERTAS));
        checkUrl.searchParams.set(
          "filterByFormula",
          `{ID_Alerta}='${idAlerta}'`
        );
        checkUrl.searchParams.set("maxRecords", "1");

        let alertaExistente: { id: string; fields: Record<string, unknown> } | null = null;
        try {
          const checkRes = await fetch(checkUrl.toString(), {
            headers: { Authorization: `Bearer ${API_KEY}` },
            cache: "no-store",
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            alertaExistente = checkData.records?.[0] || null;
          }
        } catch {
          errores.push(`Error verificando alerta ${idAlerta}`);
          continue;
        }

        // Calcular días restantes para el email
        const diasRestantes = Math.ceil(
          (new Date(contrato.fechaFin).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (alertaExistente) {
          // Si ya existe y no fue enviada, enviar email y marcarla
          if (!alertaExistente.fields["Enviada"]) {
            await enviarAlertaVencimiento({
              nombreEmpleado: contrato.nombreEmpleado,
              idContrato: contrato.idContrato,
              tipoContrato: contrato.tipoContrato,
              fechaVencimiento: contrato.fechaFin!,
              diasRestantes,
              tipoAlerta,
            });
            await fetch(`${tableUrl(TABLE_ALERTAS)}/${alertaExistente.id}`, {
              method: "PATCH",
              headers: airtableHeaders(),
              body: JSON.stringify({
                fields: { Enviada: true, Fecha_Envio: new Date().toISOString() },
              }),
            }).catch((e) => errores.push(`Error marcando alerta ${idAlerta}: ${e}`));
            procesadas++;
          }
        } else {
          // Crear la alerta, enviar email y marcarla como enviada
          await enviarAlertaVencimiento({
            nombreEmpleado: contrato.nombreEmpleado,
            idContrato: contrato.idContrato,
            tipoContrato: contrato.tipoContrato,
            fechaVencimiento: contrato.fechaFin!,
            diasRestantes,
            tipoAlerta,
          });
          await fetch(tableUrl(TABLE_ALERTAS), {
            method: "POST",
            headers: airtableHeaders(),
            body: JSON.stringify({
              fields: {
                ID_Alerta: idAlerta,
                ID_Contrato: contrato.idContrato,
                ID_Empleado: contrato.idEmpleado,
                Nombre_Empleado: contrato.nombreEmpleado,
                Tipo_Alerta: tipoAlerta,
                Fecha_Vencimiento: contrato.fechaFin,
                Fecha_Alerta: fechaAlertaStr,
                Enviada: true,
                Fecha_Envio: new Date().toISOString(),
              },
            }),
          }).catch((e) => errores.push(`Error creando alerta ${idAlerta}: ${e}`));
          creadas++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      hoy,
      contratosRevisados: contratos.length,
      alertasCreadas: creadas,
      alertasProcesadas: procesadas,
      errores: errores.length ? errores : undefined,
    });
  } catch (err) {
    console.error("[Contratos/alertas POST] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
