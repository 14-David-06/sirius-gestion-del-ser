/**
 * Módulo de autenticación — hashing de contraseñas con bcryptjs
 * y manejo de tokens JWT con firma HMAC-SHA256.
 */

import { createHmac } from "crypto";
import bcrypt from "bcryptjs";

// ─── Password Hashing (bcrypt — 12 salt rounds) ─────────────────────────────

const SALT_ROUNDS = 12;

/**
 * Genera un hash seguro de la contraseña usando bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica una contraseña contra un hash almacenado con bcrypt.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(password, storedHash);
}

// ─── JWT (HMAC-SHA256, sin dependencias externas) ────────────────────────────

interface JWTPayload {
  sub: string; // record ID de Airtable
  cedula: string;
  nombre: string;
  rol?: string; // "Super Admin" | "Admin Depto" | "Avanzado" | "Estándar" | "Lectura"
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Genera un token JWT firmado con HMAC-SHA256.
 * Expira en 24 horas por defecto.
 */
export function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresInSeconds = 86400
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verifica y decodifica un token JWT.
 * Retorna null si es inválido o expirado.
 */
export function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verificar firma
    const expectedSig = createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (expectedSig !== signatureB64) return null;

    // Decodificar payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));

    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
