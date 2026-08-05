/**
 * El colaborador elige cómo repone un permiso que Gestión del Ser marcó como
 * compensatorio sin definir el plan.
 *
 * Solo el dueño del permiso puede tocarlo, y solo una vez: el plan es un
 * compromiso, no una preferencia editable. Como en el resto del módulo, negar el
 * acceso responde 404 y no 403 — un 403 confirmaría que el registro existe.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { TABLES, FIELDS, FK_ID_CORE, ESTADOS_APROBADOS } from "@/lib/airtable-schema";
import {
  PLAN_SABADO,
  PLAN_RETO,
  diasEntre,
  esSabado,
  generarDiasCompensacion,
  horasAReponer,
  nombrePlan,
} from "@/lib/compensacion";

const BASE_ID = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const API_KEY = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;

interface CompensacionBody {
  recordId: string;
  /** Id del plan — ver PLANES_COMPENSACION en src/lib/compensacion.ts. */
  plan: string;
  /** Plan 1: sábados elegidos. */
  fechas?: string[];
  /** Plan 2: primer día de la reposición. */
  desde?: string;
  /** Plan 3: fecha límite del reto. */
  fechaLimite?: string;
  /** Plan 3: en qué consiste el reto. */
  reto?: string;
}

const noEncontrado = () =>
  NextResponse.json({ error: "Permiso no encontrado" }, { status: 404 });

export async function POST(req: NextRequest) {
  try {
    const token = (await cookies()).get("sirius-auth")?.value;
    const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;
    if (!payload) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body: CompensacionBody = await req.json();
    const { recordId, plan, fechas = [], desde = "", fechaLimite = "", reto = "" } = body;

    if (!recordId || !plan) {
      return NextResponse.json(
        { error: "Campos requeridos: recordId, plan" },
        { status: 400 }
      );
    }

    const planNombre = nombrePlan(plan);
    if (!planNombre) {
      return NextResponse.json(
        { error: "El plan de reposición no es válido" },
        { status: 400 }
      );
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLES.PERMISO)}/${recordId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) return noEncontrado();

    const campos: Record<string, unknown> = (await res.json()).fields ?? {};

    // Tener sesión no basta: el permiso tiene que ser suyo.
    if (campos[FK_ID_CORE] !== payload.idCore) return noEncontrado();

    // Solo se elige plan si Gestión del Ser declaró el permiso compensatorio al
    // aprobarlo. Un permiso pendiente todavía no compromete a nada: puede
    // terminar rechazado, y la casilla marcada de antemano no es una decisión.
    if (!campos[FIELDS.PERMISO.COMPENSADO]) return noEncontrado();
    const estado = String(campos[FIELDS.PERMISO.ESTADO] ?? "");
    if (!(ESTADOS_APROBADOS as readonly string[]).includes(estado)) return noEncontrado();

    // El plan se define una sola vez: cambiarlo después sería rehacer un
    // compromiso ya firmado en el documento de autorización. Los días acordados
    // cuentan igual que el plan — si ya están, la reposición quedó cerrada
    // aunque nadie le pusiera nombre al plan.
    const yaDefinido =
      String(campos[FIELDS.PERMISO.PLAN_COMPENSACION] ?? "").trim() ||
      String(campos[FIELDS.PERMISO.DIAS_COMPENSACION] ?? "").trim();
    if (yaDefinido) {
      return NextResponse.json(
        { error: "Este permiso ya tiene definido cómo se repone" },
        { status: 409 }
      );
    }

    // Las horas salen del permiso, no del cliente: si no, bastaría con enviar
    // media hora para saldar un día entero.
    const horasTotal = horasAReponer(
      campos[FIELDS.PERMISO.HORAS],
      diasEntre(
        String(campos[FIELDS.PERMISO.FECHA_INICIO] ?? "").slice(0, 10),
        String(campos[FIELDS.PERMISO.FECHA_FIN] ?? "").slice(0, 10)
      )
    );

    if (plan === PLAN_SABADO && fechas.some((f) => f && !esSabado(f))) {
      return NextResponse.json(
        { error: "Las fechas del plan de sábado deben caer en sábado" },
        { status: 400 }
      );
    }

    if (plan === PLAN_RETO && !reto.trim()) {
      return NextResponse.json(
        { error: "Describe en qué consiste el reto" },
        { status: 400 }
      );
    }

    // La agenda se recalcula en el servidor a partir del plan y sus fechas.
    const dias = generarDiasCompensacion(plan, {
      horasTotal,
      fechas,
      desde,
      fechaLimite,
      reto,
    }).filter((d) => d.horas > 0);

    if (dias.length === 0) {
      return NextResponse.json(
        { error: "Completa las fechas del plan de reposición" },
        { status: 400 }
      );
    }

    const resUpdate = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          [FIELDS.PERMISO.PLAN_COMPENSACION]: planNombre,
          [FIELDS.PERMISO.DIAS_COMPENSACION]: JSON.stringify(dias),
          // El campo nativo de Airtable solo admite una fecha: se usa la primera.
          [FIELDS.PERMISO.FECHA_COMP]: dias.map((d) => d.fecha).sort()[0],
        },
      }),
    });

    if (!resUpdate.ok) {
      console.error("[solicitudes/permiso/compensacion]", await resUpdate.text());
      return NextResponse.json(
        { error: "No se pudo guardar el plan de reposición" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, plan: planNombre, dias });
  } catch (error: unknown) {
    console.error("Error en /api/solicitudes/permiso/compensacion:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
