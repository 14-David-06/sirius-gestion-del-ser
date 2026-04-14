/**
 * POST /api/lifecycle/offboard — Proceso completo de desvinculación (offboarding)
 *
 * Realiza en cascada:
 * 1. Verificar solicitudes pendientes (warning, no bloquea)
 * 2. Terminar contrato activo vía PATCH /api/contratos/:id/terminate
 * 3. Desactivar asignación de turno
 * 4. Cambiar estado del empleado a Inactivo
 * 5. Registrar evento en lifecycle_events
 *
 * NO elimina datos históricos — solo cambia estados.
 * Acceso: Solo Admin Depto+
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import {
  OffboardRequest,
  DatosCascada,
  generarIdEvento,
  TIPOS_RETIRO,
} from "@/lib/lifecycle/tipos";

export const dynamic = "force-dynamic";

const BASE_NC = env.airtable.baseNominaCore;
const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_PERSONAL = env.airtable.tablePersonal;
const TABLE_LIFECYCLE = env.airtable.tableLifecycleEvents;
const TABLE_CONTRATOS = env.airtable.tableContractsContracts;
const TABLE_ASIGNACION = env.airtable.tableAsignacionHorario;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

export async function POST(req: NextRequest) {
  try {
    // ─── Autenticación y autorización ─────────────────────────────────────────
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Solo administradores pueden desvincular empleados" }, { status: 403 });
    }

    // ─── Parsear y validar body ───────────────────────────────────────────────
    const body = await req.json();
    const { empleadoId, fechaEfectiva, tipoRetiro, motivo, notas } = body as OffboardRequest;

    if (!empleadoId?.trim()) {
      return NextResponse.json({ error: "El empleadoId es obligatorio" }, { status: 400 });
    }
    if (!fechaEfectiva) {
      return NextResponse.json({ error: "La fecha efectiva es obligatoria" }, { status: 400 });
    }
    if (!tipoRetiro || !TIPOS_RETIRO.some((t) => t.value === tipoRetiro)) {
      return NextResponse.json({ error: "El tipo de retiro es obligatorio y debe ser válido" }, { status: 400 });
    }
    if (!motivo?.trim()) {
      return NextResponse.json({ error: "El motivo es obligatorio" }, { status: 400 });
    }

    // ─── Verificar que el empleado existe y está activo ───────────────────────
    const safeId = escapeAirtableValue(empleadoId);
    const empleadoUrl = new URL(
      `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}`
    );
    empleadoUrl.searchParams.set("filterByFormula", `{ID Empleado}='${safeId}'`);
    empleadoUrl.searchParams.set("maxRecords", "1");

    const empleadoRes = await fetch(empleadoUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (!empleadoRes.ok) {
      return NextResponse.json({ error: "Error al verificar empleado" }, { status: 500 });
    }

    const empleadoData = await empleadoRes.json();
    if (!empleadoData.records?.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const empleadoRecord = empleadoData.records[0];
    const estadoActual = empleadoRecord.fields["Estado de actividad"];

    if (estadoActual === "Inactivo" || estadoActual === "Retirado") {
      return NextResponse.json(
        { error: `El empleado ya está ${estadoActual?.toLowerCase() || "inactivo"}` },
        { status: 409 }
      );
    }

    const nombreEmpleado = (empleadoRecord.fields["Nombre completo"] as string) || empleadoId;

    // ─── CASCADA DE OPERACIONES ───────────────────────────────────────────────
    const cascada: DatosCascada = {
      pasosCompletados: [],
      empleadoId,
      empleadoRecordId: empleadoRecord.id,
      advertencias: [],
    };

    // ─── PASO 1: Verificar solicitudes pendientes (warning) ───────────────────
    const baseUrl = req.nextUrl.origin;
    try {
      const solicitudesRes = await fetch(
        `${baseUrl}/api/requests?empleado_id=${encodeURIComponent(empleadoId)}&estado=pendiente`,
        {
          headers: { Cookie: `sirius-auth=${token}` },
          cache: "no-store",
        }
      );

      if (solicitudesRes.ok) {
        const solicitudesData = await solicitudesRes.json();
        const pendientes = solicitudesData.solicitudes?.length || 0;
        if (pendientes > 0) {
          cascada.advertencias?.push(
            `El empleado tiene ${pendientes} solicitud(es) pendiente(s). Se procesará la desvinculación, pero considere revisar las solicitudes.`
          );
        }
      }
    } catch {
      // Ignorar errores de solicitudes — no es crítico
    }

    cascada.pasosCompletados.push("verificar_solicitudes");

    // ─── PASO 2: Terminar contrato activo ─────────────────────────────────────
    // Buscar contrato activo del empleado
    const contratoUrl = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_CONTRATOS)}`
    );
    contratoUrl.searchParams.set(
      "filterByFormula",
      `AND({ID_Empleado}='${safeId}',{Estado}='activo')`
    );
    contratoUrl.searchParams.set("maxRecords", "1");

    const contratoRes = await fetch(contratoUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    let contratoTerminado = false;
    if (contratoRes.ok) {
      const contratoData = await contratoRes.json();
      if (contratoData.records?.length > 0) {
        const contratoRecord = contratoData.records[0];
        cascada.contratoRecordId = contratoRecord.id;
        cascada.contratoId = (contratoRecord.fields["ID_Contrato"] as string) || "";

        // Terminar contrato vía endpoint interno
        const terminateRes = await fetch(
          `${baseUrl}/api/contratos/${contratoRecord.id}/terminate`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Cookie: `sirius-auth=${token}`,
            },
            body: JSON.stringify({
              motivo: `Desvinculación: ${tipoRetiro} - ${motivo}`,
              fecha_terminacion: fechaEfectiva,
              estado: "terminado",
            }),
          }
        );

        if (terminateRes.ok) {
          contratoTerminado = true;
          cascada.pasosCompletados.push("terminar_contrato");
        } else {
          const errData = await terminateRes.json().catch(() => ({}));
          cascada.advertencias?.push(
            `No se pudo terminar el contrato automáticamente: ${errData.error || "Error desconocido"}`
          );
        }
      } else {
        cascada.advertencias?.push("No se encontró contrato activo para terminar");
      }
    }

    // ─── PASO 3: Desactivar asignación de turno ───────────────────────────────
    const asignacionUrl = new URL(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}`
    );
    asignacionUrl.searchParams.set(
      "filterByFormula",
      `AND({ID Core Usuario Asignado}='${safeId}',{Estado}='Activo')`
    );

    const asignacionRes = await fetch(asignacionUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (asignacionRes.ok) {
      const asignacionData = await asignacionRes.json();
      if (asignacionData.records?.length > 0) {
        // Desactivar todas las asignaciones activas
        for (const asig of asignacionData.records) {
          await fetch(
            `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_ASIGNACION)}/${asig.id}`,
            {
              method: "PATCH",
              headers: airtableHeaders(),
              body: JSON.stringify({
                fields: {
                  Estado: "Inactivo",
                  Fecha_Fin: fechaEfectiva,
                  Notas: `Desvinculación: ${tipoRetiro} - ${motivo}`,
                },
              }),
            }
          ).catch((e) => console.error("[Offboard] Error desactivando asignación:", e));
        }
        cascada.asignacionId = asignacionData.records[0].id;
        cascada.pasosCompletados.push("desactivar_turno");
      } else {
        cascada.advertencias?.push("No se encontró asignación de turno activa");
      }
    }

    // ─── PASO 4: Cambiar estado del empleado a Inactivo ───────────────────────
    const updateEmpleadoRes = await fetch(
      `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}/${empleadoRecord.id}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({
          fields: {
            "Estado de actividad": "Inactivo",
            "Fecha de Retiro": fechaEfectiva,
          },
        }),
      }
    );

    if (!updateEmpleadoRes.ok) {
      const errText = await updateEmpleadoRes.text();
      console.error("[Offboard] Error actualizando empleado:", errText);
      // Continuar de todos modos — el contrato ya está terminado
      cascada.advertencias?.push("No se pudo actualizar el estado del empleado a Inactivo");
    } else {
      cascada.pasosCompletados.push("inactivar_empleado");
    }

    // ─── PASO 5: Registrar evento en lifecycle_events ─────────────────────────
    const eventoFields: Record<string, unknown> = {
      ID_Evento: generarIdEvento(),
      Empleado_ID: empleadoId,
      Tipo_Evento: "desvinculacion",
      Subtipo: tipoRetiro,
      Fecha_Efectiva: fechaEfectiva,
      Registrado_Por: payload.nombre || payload.idCore || "Admin",
      Notas: notas || motivo,
      Datos_Cascada: JSON.stringify(cascada),
    };

    await fetch(
      `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}`,
      {
        method: "POST",
        headers: airtableHeaders(),
        body: JSON.stringify({ fields: eventoFields }),
      }
    ).catch((e) => console.error("[Offboard] Error registrando evento:", e));

    cascada.pasosCompletados.push("evento");

    // ─── Respuesta exitosa ────────────────────────────────────────────────────
    const tipoRetiroLabel = TIPOS_RETIRO.find((t) => t.value === tipoRetiro)?.label || tipoRetiro;

    return NextResponse.json({
      ok: true,
      mensaje: `Desvinculación de ${nombreEmpleado} completada`,
      empleado: {
        id: empleadoRecord.id,
        idEmpleado: empleadoId,
        nombre: nombreEmpleado,
        nuevoEstado: "Inactivo",
      },
      tipoRetiro: tipoRetiroLabel,
      fechaEfectiva,
      contrato: contratoTerminado
        ? { id: cascada.contratoRecordId, terminado: true }
        : null,
      cascada: {
        pasosCompletados: cascada.pasosCompletados,
        advertencias: cascada.advertencias?.length ? cascada.advertencias : undefined,
      },
    });
  } catch (err) {
    console.error("[Offboard] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
