import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, signJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";
import { TABLES, FIELDS, ESTADOS_ACTIVIDAD } from "@/lib/airtable-schema";

const BASE = process.env.AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE!;
const KEY = process.env.AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE!;
const JWT_SECRET = process.env.JWT_SECRET!;

async function airtableGet(path: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json() as Promise<{ fields: Record<string, unknown> }>;
}

async function airtableQuery(table: string, formula: string, fields: string[]) {
  const params = new URLSearchParams({
    filterByFormula: formula,
    maxRecords: "1",
  });
  fields.forEach((f) => params.append("fields[]", f));
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}?${params}`,
    { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json() as Promise<{ records: { id: string; fields: Record<string, unknown> }[] }>;
}

export async function POST(req: NextRequest) {
  // ── Guardia de configuración ──────────────────────────────────────────────
  if (!BASE || !KEY || !JWT_SECRET) {
    console.error("[auth/login] Variables de entorno faltantes");
    return NextResponse.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  let cedula: string, password: string;
  try {
    const body = await req.json();
    cedula = String(body.cedula ?? "").trim();
    password = String(body.password ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!cedula || !password) {
    return NextResponse.json({ error: "Cédula y contraseña son requeridas." }, { status: 400 });
  }

  try {
    // ── 1. Buscar empleado por cédula ─────────────────────────────────────────
    const escaped = escapeAirtableValue(cedula);
    const data = await airtableQuery(
      TABLES.PERSONAL,
      `{${FIELDS.PERSONAL.NUMERO_DOCUMENTO}}='${escaped}'`,
      [
        FIELDS.PERSONAL.ID_EMPLEADO,
        FIELDS.PERSONAL.NOMBRE,
        FIELDS.PERSONAL.NUMERO_DOCUMENTO,
        FIELDS.PERSONAL.PASSWORD,
        FIELDS.PERSONAL.ESTADO,
        FIELDS.PERSONAL.ROL,
      ]
    );

    // Respuesta genérica para no revelar si el usuario existe
    const INVALID = NextResponse.json({ error: "Cédula o contraseña incorrectos." }, { status: 401 });

    if (!data.records.length) return INVALID;

    const record = data.records[0];
    const f = record.fields;

    // ── 2. Verificar estado ───────────────────────────────────────────────────
    if (f[FIELDS.PERSONAL.ESTADO] !== ESTADOS_ACTIVIDAD.ACTIVO) {
      return NextResponse.json(
        { error: "Tu cuenta no está activa. Comunícate con RRHH." },
        { status: 403 }
      );
    }

    // ── 3. Verificar contraseña ───────────────────────────────────────────────
    const storedHash = f[FIELDS.PERSONAL.PASSWORD] as string | undefined;
    if (!storedHash) {
      return NextResponse.json(
        { error: "Cuenta sin contraseña configurada. Comunícate con RRHH." },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, storedHash);
    if (!valid) return INVALID;

    // ── 4. Obtener Nivel_Acceso desde Roles y Permisos ────────────────────────
    const rolLinks = (f[FIELDS.PERSONAL.ROL] as string[]) ?? [];
    let rol = "Estándar";
    if (rolLinks.length > 0) {
      try {
        const rolRecord = await airtableGet(
          `${encodeURIComponent(TABLES.ROLES)}/${rolLinks[0]}?fields[]=${FIELDS.ROLES.NIVEL_ACCESO}`
        );
        rol = (rolRecord.fields?.[FIELDS.ROLES.NIVEL_ACCESO] as string) ?? "Estándar";
      } catch {
        // fallback a Estándar si el rol no se puede leer
      }
    }

    // ── 5. Emitir JWT y setear cookie ─────────────────────────────────────────
    const idCore = (f[FIELDS.PERSONAL.ID_EMPLEADO] as string) ?? "";
    const nombre = (f[FIELDS.PERSONAL.NOMBRE] as string) ?? "";

    const token = await signJWT(
      { sub: record.id, idCore, cedula: String(f[FIELDS.PERSONAL.NUMERO_DOCUMENTO] ?? cedula), nombre, rol },
      JWT_SECRET
    );

    const response = NextResponse.json({ ok: true, nombre, rol, idCore });

    response.cookies.set("sirius-auth", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86400,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 });
  }
}
