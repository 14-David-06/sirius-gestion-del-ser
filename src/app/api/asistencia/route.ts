/**
 * Marcaciones de entrada y salida del colaborador autenticado.
 *
 *   GET  /api/asistencia?mes=YYYY-MM  → estado de hoy + días del mes
 *   POST /api/asistencia              → registra la marcación que toca
 *
 * El cliente nunca dice si marca entrada o salida: el servidor lo deduce de la
 * última marcación del día. Así la pantalla es un único botón y no hay forma de
 * registrar dos entradas seguidas por equivocación.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";
import { fetchTodos, type RegistroAirtable } from "@/lib/airtable-fetch";
import { FIELDS, FK_ID_CORE, TABLES } from "@/lib/airtable-schema";
import { ORIGEN_MARCACION, TIPOS_ASISTENCIA, type TipoAsistencia } from "@/lib/constants";
import {
  agruparPorDia,
  fechaBogota,
  horaBogota,
  mesBogota,
  resumirDia,
  siguienteTipo,
  type Marcacion,
} from "@/lib/asistencia";

const BASE = process.env.AIRTABLE_BASE_ID_NOVEDADES_NOMINA!;
const KEY = process.env.AIRTABLE_API_KEY_NOVEDADES_NOMINA!;
const CAMPOS = FIELDS.ASISTENCIA;

/**
 * Ventana en la que se ignora una segunda pulsación. Un doble clic o un toque
 * repetido en el móvil no debe abrir y cerrar la jornada en el mismo minuto.
 */
const SEGUNDOS_ENTRE_MARCACIONES = 60;

async function sesion() {
  const token = (await cookies()).get("sirius-auth")?.value;
  return token ? verifyJWT(token, process.env.JWT_SECRET ?? "") : null;
}

/** YYYY-MM válido; cualquier otra cosa cae al mes en curso. */
function normalizarMes(valor: string | null): string {
  return valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor) ? valor : mesBogota();
}

function aMarcacion(registro: RegistroAirtable): Marcacion | null {
  const campos = registro.fields;
  const tipo = String(campos[CAMPOS.TIPO] ?? "").trim();
  const fecha = String(campos[CAMPOS.FECHA] ?? "");
  const fechaHora = String(campos[CAMPOS.FECHA_HORA] ?? "");

  // Un registro sin fecha o sin instante no se puede ubicar en la jornada.
  if (!fecha || !fechaHora) return null;
  if (tipo !== TIPOS_ASISTENCIA.ENTRADA && tipo !== TIPOS_ASISTENCIA.SALIDA) return null;

  return {
    id: registro.id,
    tipo: tipo as TipoAsistencia,
    fecha,
    hora: String(campos[CAMPOS.HORA] ?? "") || horaBogota(new Date(fechaHora)),
    fechaHora,
    notas: campos[CAMPOS.NOTAS] ? String(campos[CAMPOS.NOTAS]) : undefined,
  };
}

/** Marcaciones del colaborador dentro de un mes (YYYY-MM). */
async function leerMes(idCore: string, mes: string): Promise<Marcacion[]> {
  const seguro = escapeAirtableValue(idCore);
  const formula = `AND({${FK_ID_CORE}}='${seguro}', DATETIME_FORMAT({${CAMPOS.FECHA}}, 'YYYY-MM')='${mes}')`;

  const registros = await fetchTodos(BASE, KEY, TABLES.ASISTENCIA, {
    filterByFormula: formula,
  });

  return registros.map(aMarcacion).filter((m): m is Marcacion => m !== null);
}

function estadoDelDia(marcacionesHoy: Marcacion[], fecha: string) {
  const dia = resumirDia(fecha, marcacionesHoy);
  return {
    fecha,
    siguienteTipo: siguienteTipo(marcacionesHoy),
    jornadaAbierta: dia.jornadaAbierta,
    primeraEntrada: dia.primeraEntrada,
    ultimaSalida: dia.ultimaSalida,
    minutosTrabajados: dia.minutosTrabajados,
    marcaciones: dia.marcaciones,
  };
}

export async function GET(request: NextRequest) {
  const payload = await sesion();
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const mes = normalizarMes(request.nextUrl.searchParams.get("mes"));
  const hoy = fechaBogota();

  try {
    const delMes = await leerMes(payload.idCore, mes);

    // Si se consulta un mes pasado, el estado de hoy se lee aparte.
    const marcacionesHoy = mes === mesBogota()
      ? delMes.filter((m) => m.fecha === hoy)
      : (await leerMes(payload.idCore, mesBogota())).filter((m) => m.fecha === hoy);

    const dias = agruparPorDia(delMes);

    return NextResponse.json({
      mes,
      hoy: estadoDelDia(marcacionesHoy, hoy),
      dias,
      minutosMes: dias.reduce((total, dia) => total + dia.minutosTrabajados, 0),
    });
  } catch (error) {
    console.error("[asistencia GET]", error);
    return NextResponse.json({ error: "No se pudo consultar la asistencia" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = await sesion();
  if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let notas = "";
  try {
    const body = await request.json();
    if (typeof body?.notas === "string") notas = body.notas.trim().slice(0, 500);
  } catch {
    // Sin cuerpo: es el caso normal, marcar no necesita datos.
  }

  const ahora = new Date();
  const fecha = fechaBogota(ahora);
  const hora = horaBogota(ahora);

  try {
    const marcacionesHoy = (await leerMes(payload.idCore, mesBogota(ahora))).filter(
      (m) => m.fecha === fecha,
    );

    const ultima = marcacionesHoy
      .slice()
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
      .at(-1);

    if (ultima) {
      const segundos = (ahora.getTime() - new Date(ultima.fechaHora).getTime()) / 1000;
      if (segundos < SEGUNDOS_ENTRE_MARCACIONES) {
        return NextResponse.json(
          {
            error: `Ya registraste tu ${ultima.tipo.toLowerCase()} a las ${ultima.hora}. Espera un momento antes de volver a marcar.`,
            estado: estadoDelDia(marcacionesHoy, fecha),
          },
          { status: 409 },
        );
      }
    }

    const tipo = siguienteTipo(marcacionesHoy);
    const cedula = Number(payload.cedula);

    const fields: Record<string, unknown> = {
      [FK_ID_CORE]: payload.idCore,
      // Referencia heredada de la tabla: el record ID de Personal. La FK real
      // con la que se filtra es ID Personal Core (ver CLAUDE.md § identificadores).
      [CAMPOS.EMPLEADO_RECORD_ID]: payload.sub,
      [CAMPOS.NOMBRE]: payload.nombre,
      [CAMPOS.TIPO]: tipo,
      [CAMPOS.FECHA]: fecha,
      [CAMPOS.HORA]: hora,
      [CAMPOS.FECHA_HORA]: ahora.toISOString(),
      [CAMPOS.UBICACION]: ORIGEN_MARCACION,
    };
    if (Number.isFinite(cedula)) fields[CAMPOS.CEDULA] = cedula;
    if (notas) fields[CAMPOS.NOTAS] = notas;

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLES.ASISTENCIA)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      },
    );

    if (!res.ok) {
      console.error("[asistencia POST]", res.status, await res.text());
      return NextResponse.json({ error: "No se pudo registrar la marcación" }, { status: 500 });
    }

    const creado = await res.json();
    const marcacion = aMarcacion({ id: creado.id, fields: creado.fields ?? fields });
    const actualizadas = marcacion ? [...marcacionesHoy, marcacion] : marcacionesHoy;

    return NextResponse.json({
      ok: true,
      tipo,
      hora,
      fecha,
      estado: estadoDelDia(actualizadas, fecha),
    });
  } catch (error) {
    console.error("[asistencia POST]", error);
    return NextResponse.json({ error: "No se pudo registrar la marcación" }, { status: 500 });
  }
}
