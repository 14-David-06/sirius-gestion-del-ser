/**
 * POST /api/lifecycle/onboard — Proceso completo de vinculación (onboarding)
 *
 * Crea en cascada:
 * 1. Registro de empleado en tabla Personal (Nómina Core)
 * 2. Contrato laboral vía POST /api/contratos
 * 3. Asignación de turno vía POST /api/schedules/assignments
 * 4. Evento de auditoría en lifecycle_events
 *
 * Si un paso falla, revierte los anteriores.
 * Acceso: Solo Admin Depto+
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import {
  OnboardRequest,
  DatosCascada,
  TipoContrato,
  generarIdEvento,
} from "@/lib/lifecycle/tipos";

export const dynamic = "force-dynamic";

const BASE_NC = env.airtable.baseNominaCore;
const BASE_GESTION = env.airtable.baseGestionDelSer;
const TABLE_PERSONAL = env.airtable.tablePersonal;
const TABLE_LIFECYCLE = env.airtable.tableLifecycleEvents;
const API_KEY = env.airtable.apiKey;

function airtableHeaders() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

// Tipos que requieren fecha_fin
const TIPOS_CON_FECHA_FIN: TipoContrato[] = ["fijo", "obra_labor"];

export async function POST(req: NextRequest) {
  try {
    // ─── Autenticación y autorización ─────────────────────────────────────────
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    if (!hasMinRole(getRoleFromPayload(payload), "Admin Depto")) {
      return NextResponse.json({ error: "Solo administradores pueden vincular empleados" }, { status: 403 });
    }

    // ─── Parsear y validar body ───────────────────────────────────────────────
    const body = await req.json();
    const { datosPersonales, datosLaborales } = body as OnboardRequest;

    // Validaciones de datos personales
    if (!datosPersonales?.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    if (!datosPersonales?.cedula?.trim()) {
      return NextResponse.json({ error: "La cédula es obligatoria" }, { status: 400 });
    }

    // Validaciones de datos laborales
    if (!datosLaborales?.cargo?.trim()) {
      return NextResponse.json({ error: "El cargo es obligatorio" }, { status: 400 });
    }
    if (!datosLaborales?.fechaInicio) {
      return NextResponse.json({ error: "La fecha de inicio es obligatoria" }, { status: 400 });
    }
    if (!datosLaborales?.tipoContrato) {
      return NextResponse.json({ error: "El tipo de contrato es obligatorio" }, { status: 400 });
    }
    if (datosLaborales.salarioBase == null || datosLaborales.salarioBase <= 0) {
      return NextResponse.json({ error: "El salario base debe ser mayor a 0" }, { status: 400 });
    }
    if (!datosLaborales?.jornadaId) {
      return NextResponse.json({ error: "El tipo de turno (jornadaId) es obligatorio" }, { status: 400 });
    }

    // Validar fecha_fin para contratos a término fijo y obra/labor
    if (TIPOS_CON_FECHA_FIN.includes(datosLaborales.tipoContrato) && !datosLaborales.fechaFin) {
      return NextResponse.json(
        { error: `Los contratos tipo "${datosLaborales.tipoContrato}" requieren fecha de fin` },
        { status: 400 }
      );
    }

    // ─── Verificar cédula y correo no duplicados ──────────────────────────────
    const safeCedula = escapeAirtableValue(datosPersonales.cedula);
    const checkCedulaUrl = new URL(
      `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}`
    );
    checkCedulaUrl.searchParams.set("filterByFormula", `{Numero Documento}='${safeCedula}'`);
    checkCedulaUrl.searchParams.set("maxRecords", "1");

    const checkCedulaRes = await fetch(checkCedulaUrl.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: "no-store",
    });

    if (checkCedulaRes.ok) {
      const checkData = await checkCedulaRes.json();
      if (checkData.records?.length > 0) {
        return NextResponse.json(
          { error: `Ya existe un empleado con la cédula ${datosPersonales.cedula}` },
          { status: 409 }
        );
      }
    }

    if (datosPersonales.correo) {
      const safeCorreo = escapeAirtableValue(datosPersonales.correo);
      const checkCorreoUrl = new URL(
        `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}`
      );
      checkCorreoUrl.searchParams.set("filterByFormula", `{Correo electrónico}='${safeCorreo}'`);
      checkCorreoUrl.searchParams.set("maxRecords", "1");

      const checkCorreoRes = await fetch(checkCorreoUrl.toString(), {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      });

      if (checkCorreoRes.ok) {
        const checkData = await checkCorreoRes.json();
        if (checkData.records?.length > 0) {
          return NextResponse.json(
            { error: `Ya existe un empleado con el correo ${datosPersonales.correo}` },
            { status: 409 }
          );
        }
      }
    }

    // ─── CASCADA DE OPERACIONES ───────────────────────────────────────────────
    const cascada: DatosCascada = {
      pasosCompletados: [],
      advertencias: [],
    };

    let empleadoRecordId: string | undefined;
    let empleadoId: string | undefined;
    let contratoRecordId: string | undefined;
    let contratoId: string | undefined;
    let asignacionId: string | undefined;

    try {
      // ─── PASO 1: Crear empleado en Personal ──────────────────────────────────
      const personalFields: Record<string, unknown> = {
        "Nombre completo": datosPersonales.nombre.trim(),
        "Numero Documento": datosPersonales.cedula.trim(),
        "Estado de actividad": "Activo",
        "Tipo Personal": "Planta",
        "Fecha de Ingreso": datosLaborales.fechaInicio,
      };

      if (datosPersonales.correo) personalFields["Correo electrónico"] = datosPersonales.correo.trim();
      if (datosPersonales.telefono) personalFields["Teléfono"] = datosPersonales.telefono.trim();
      if (datosLaborales.cargo) personalFields["Cargo"] = datosLaborales.cargo.trim();

      const createEmpleadoRes = await fetch(
        `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}`,
        {
          method: "POST",
          headers: airtableHeaders(),
          body: JSON.stringify({ fields: personalFields }),
        }
      );

      if (!createEmpleadoRes.ok) {
        const errText = await createEmpleadoRes.text();
        console.error("[Onboard] Error creando empleado:", errText);
        throw new Error("Error al crear el registro de empleado");
      }

      const empleadoCreado = await createEmpleadoRes.json();
      empleadoRecordId = empleadoCreado.id;
      empleadoId = (empleadoCreado.fields["ID Empleado"] as string) || empleadoRecordId;

      cascada.pasosCompletados.push("empleado");
      cascada.empleadoId = empleadoId;
      cascada.empleadoRecordId = empleadoRecordId;

      // ─── PASO 2: Crear contrato vía endpoint interno ─────────────────────────
      const contratoBody = {
        id_empleado: empleadoId,
        tipo_contrato: datosLaborales.tipoContrato,
        fecha_inicio: datosLaborales.fechaInicio,
        fecha_fin: datosLaborales.fechaFin || undefined,
        salario_base: datosLaborales.salarioBase,
        periodicidad_pago: datosLaborales.periodicidadPago || "mensual",
        jornada_id: datosLaborales.jornadaId,
        observaciones: `Vinculación automática - ${new Date().toISOString()}`,
      };

      // Llamar al endpoint de contratos internamente
      const baseUrl = req.nextUrl.origin;
      const contratoRes = await fetch(`${baseUrl}/api/contratos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sirius-auth=${token}`,
        },
        body: JSON.stringify(contratoBody),
      });

      if (!contratoRes.ok) {
        const errData = await contratoRes.json().catch(() => ({}));
        console.error("[Onboard] Error creando contrato:", errData);
        throw new Error(errData.error || "Error al crear el contrato");
      }

      const contratoData = await contratoRes.json();
      contratoRecordId = contratoData.contrato?.id || contratoData.id;
      contratoId = contratoData.contrato?.idContrato || contratoData.idContrato;

      cascada.pasosCompletados.push("contrato");
      cascada.contratoId = contratoId;
      cascada.contratoRecordId = contratoRecordId;

      // ─── PASO 3: Asignar turno vía endpoint interno ───────────────────────────
      const asignacionBody = {
        idEmpleado: empleadoId,
        cedula: datosPersonales.cedula.trim(),
        nombre: datosPersonales.nombre.trim(),
        horarioIds: [datosLaborales.jornadaId],
        fechaInicio: datosLaborales.fechaInicio,
        notas: `Asignación automática por vinculación - ${new Date().toISOString()}`,
      };

      const asignacionRes = await fetch(`${baseUrl}/api/schedules/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `sirius-auth=${token}`,
        },
        body: JSON.stringify(asignacionBody),
      });

      if (!asignacionRes.ok) {
        const errData = await asignacionRes.json().catch(() => ({}));
        console.error("[Onboard] Error asignando turno:", errData);
        // No fallar todo el proceso si falla la asignación de turno — agregar advertencia
        cascada.advertencias?.push(
          `No se pudo asignar el turno automáticamente: ${errData.error || "Error desconocido"}. Asígnelo manualmente.`
        );
      } else {
        const asignacionData = await asignacionRes.json();
        asignacionId = asignacionData.id;
        cascada.pasosCompletados.push("turno");
        cascada.asignacionId = asignacionId;
      }

      // ─── PASO 4: Registrar evento en lifecycle_events ─────────────────────────
      const eventoFields: Record<string, unknown> = {
        ID_Evento: generarIdEvento(),
        Empleado_ID: empleadoId,
        Tipo_Evento: "vinculacion",
        Subtipo: "nuevo_ingreso",
        Fecha_Efectiva: datosLaborales.fechaInicio,
        Registrado_Por: payload.nombre || payload.idCore || "Admin",
        Notas: `Vinculación completa de ${datosPersonales.nombre}`,
        Datos_Cascada: JSON.stringify(cascada),
      };

      await fetch(
        `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}`,
        {
          method: "POST",
          headers: airtableHeaders(),
          body: JSON.stringify({ fields: eventoFields }),
        }
      ).catch((e) => console.error("[Onboard] Error registrando evento:", e));

      cascada.pasosCompletados.push("evento");

      // ─── Respuesta exitosa ────────────────────────────────────────────────────
      return NextResponse.json({
        ok: true,
        mensaje: "Vinculación completada exitosamente",
        empleado: {
          id: empleadoRecordId,
          idEmpleado: empleadoId,
          nombre: datosPersonales.nombre,
        },
        contrato: {
          id: contratoRecordId,
          idContrato: contratoId,
        },
        turno: asignacionId ? { id: asignacionId } : null,
        cascada: {
          pasosCompletados: cascada.pasosCompletados,
          advertencias: cascada.advertencias?.length ? cascada.advertencias : undefined,
        },
      });
    } catch (error) {
      // ─── ROLLBACK: Revertir operaciones en orden inverso ─────────────────────
      console.error("[Onboard] Error en cascada, revirtiendo:", error);
      cascada.error = (error as Error).message;

      // Revertir contrato si fue creado
      if (contratoRecordId && cascada.pasosCompletados.includes("contrato")) {
        try {
          const baseUrl = req.nextUrl.origin;
          await fetch(`${baseUrl}/api/contratos/${contratoRecordId}/terminate`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Cookie: `sirius-auth=${token}`,
            },
            body: JSON.stringify({
              motivo: "Rollback por error en vinculación",
              fecha_terminacion: new Date().toISOString().split("T")[0],
              estado: "terminado",
            }),
          });
          cascada.pasosCompletados = cascada.pasosCompletados.filter((p) => p !== "contrato");
        } catch (e) {
          console.error("[Onboard Rollback] Error revirtiendo contrato:", e);
        }
      }

      // Marcar empleado con estado de error si fue creado
      if (empleadoRecordId && cascada.pasosCompletados.includes("empleado")) {
        try {
          await fetch(
            `https://api.airtable.com/v0/${BASE_NC}/${encodeURIComponent(TABLE_PERSONAL)}/${empleadoRecordId}`,
            {
              method: "PATCH",
              headers: airtableHeaders(),
              body: JSON.stringify({
                fields: { "Estado de actividad": "Error_Vinculacion" },
              }),
            }
          );
        } catch (e) {
          console.error("[Onboard Rollback] Error marcando empleado:", e);
        }
      }

      // Registrar evento de error
      try {
        await fetch(
          `https://api.airtable.com/v0/${BASE_GESTION}/${encodeURIComponent(TABLE_LIFECYCLE)}`,
          {
            method: "POST",
            headers: airtableHeaders(),
            body: JSON.stringify({
              fields: {
                ID_Evento: generarIdEvento(),
                Empleado_ID: empleadoId || "DESCONOCIDO",
                Tipo_Evento: "vinculacion",
                Subtipo: "error",
                Fecha_Efectiva: datosLaborales.fechaInicio,
                Registrado_Por: payload.nombre || payload.idCore || "Admin",
                Notas: `Error en vinculación: ${(error as Error).message}`,
                Datos_Cascada: JSON.stringify(cascada),
              },
            }),
          }
        );
      } catch (e) {
        console.error("[Onboard] Error registrando evento de error:", e);
      }

      return NextResponse.json(
        {
          error: (error as Error).message || "Error durante la vinculación",
          cascada: {
            pasosCompletados: cascada.pasosCompletados,
            error: cascada.error,
          },
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[Onboard] Error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
