import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Rutas públicas (no requieren autenticación) ─────────────────────────────

const PUBLIC_PATHS = ["/", "/login"];
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ─── JWT verification using Web Crypto API (Edge-compatible) ─────────────────

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verifyJWTEdge(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Import the secret key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Compute expected signature
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSig = base64UrlEncode(signatureBuffer);

    if (expectedSig !== signatureB64) return false;

    // Check expiration
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Allow public files (images, videos, etc.)
  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("sirius-auth")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // If JWT_SECRET is not set, redirect to login as a safety measure
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const valid = await verifyJWTEdge(token, jwtSecret);

  if (!valid) {
    // Clear invalid cookie and redirect
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("sirius-auth", "", { maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
