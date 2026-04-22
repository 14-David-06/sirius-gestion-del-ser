/**
 * API Solicitudes — Catálogo de tipos
 *
 * GET /api/requests/tipos → Lista de subtipos de solicitud activos
 *   ?tipo_padre=permiso|novedad_nomina  (filtro opcional)
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyJWT } from "@/lib/auth";
import { escapeAirtableValue } from "@/lib/security";
import {
  mapearTipoCatalogo,
  obtenerCatalogoFallback,
  type TipoCatalogo,
} from "@/lib/requests/tipos";

export const dynamic = "force-dynamic";

const BASE_ID = env.airtable.baseGestionDelSer;
const API_KEY = env.airtable.apiKey;
const TABLE_TIPOS = env.airtable.tableRequestsTipos;

// Etiquetas genéricas que NO son causas reales de permiso y deben ocultarse.
// Se compara contra el nombre normalizado (sin tildes, en minúsculas, con guiones
// bajos, guiones y espacios convertidos a un único separador).
const ETIQUETAS_GENERICAS_PROHIBIDAS = new Set([
  "remunerado",
  "no remunerado",
  "permiso remunerado",
  "permiso no remunerado",
  "otro",
  "otros",
  "n a",
  "ninguno",
]);

function normalizarEtiqueta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function filtrarEtiquetasGenericas(tipos: TipoCatalogo[]): TipoCatalogo[] {
  return tipos.filter(
    (t) => !ETIQUETAS_GENERICAS_PROHIBIDAS.has(normalizarEtiqueta(t.nombre))
  );
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("sirius-auth")?.value;
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const payload = verifyJWT(token, env.auth.jwtSecret);
    if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

    const tipoPadre = req.nextUrl.searchParams.get("tipo_padre");

    // Siempre filtrar por Activo=1; opcionalmente también por Tipo_Padre
    const conditions = ["{Activo}=1"];
    if (tipoPadre) {
      const safe = escapeAirtableValue(tipoPadre);
      conditions.push(`{Tipo_Padre}='${safe}'`);
    }

    const formula = conditions.length === 1 ? conditions[0] : `AND(${conditions.join(",")})`;

    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_TIPOS)}`
    );
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("sort[0][field]", "Nombre");
    url.searchParams.set("sort[0][direction]", "asc");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      // No usar caché ISR para que los cambios en el catálogo se reflejen al instante
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Requests tipos GET] Airtable error:", res.status, await res.text());
      // Fallback: si la tabla no existe o Airtable falla, responder con catálogo por defecto
      return NextResponse.json({ tipos: obtenerCatalogoFallback(tipoPadre) });
    }

    const data = await res.json();
    const tiposCrudos = (data.records ?? []).map(mapearTipoCatalogo);
    const tiposFiltrados = filtrarEtiquetasGenericas(tiposCrudos);

    // Si tras filtrar etiquetas genéricas no queda nada, usar fallback
    const tipos = tiposFiltrados.length > 0
      ? tiposFiltrados
      : obtenerCatalogoFallback(tipoPadre);

    return NextResponse.json({ tipos });
  } catch (err) {
    console.error("[Requests tipos GET] Error:", err);
    // Aun ante error inesperado, no romper la UI: devolver fallback
    const tipoPadre = req.nextUrl.searchParams.get("tipo_padre");
    return NextResponse.json({ tipos: obtenerCatalogoFallback(tipoPadre) });
  }
}
