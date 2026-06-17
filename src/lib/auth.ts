import bcrypt from "bcryptjs";

export type JWTPayload = {
  sub: string;     // Airtable record ID (recXXX) — solo para fetch de tabla Personal
  idCore: string;  // SIRIUS-PER-XXXX — FK canónica entre tablas
  cedula: string;
  nombre: string;
  rol: string;     // Nivel_Acceso de Roles y Permisos
  iat: number;
  exp: number;
};

// ── Base64url (Web Crypto API — compatible con Node 18+ y Edge) ───────────────

function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const binary = String.fromCharCode(...new Uint8Array(sig));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export async function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
  );
  const signature = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = await hmacSign(`${header}.${body}`, secret);
    if (expected !== signature) return null;
    const payload = JSON.parse(b64urlDecode(body)) as JWTPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Password ──────────────────────────────────────────────────────────────────

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
