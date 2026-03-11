/**
 * Módulo centralizado de seguridad.
 *
 * 1. escapeAirtableValue — Prevenir inyección en fórmulas Airtable
 * 2. Rate Limiter          — Prevenir fuerza bruta en login
 * 3. RBAC                  — Control de acceso por roles (admin / rrhh / empleado)
 * 4. Path Validation       — Prevenir path traversal en rutas OneDrive
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AIRTABLE FORMULA INJECTION PREVENTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escapa un valor para interpolar de forma segura en fórmulas de Airtable.
 * Previene inyección vía comillas simples y caracteres de control.
 */
export function escapeAirtableValue(value: string): string {
  return value
    .replace(/[\x00-\x1f]/g, "")  // eliminar caracteres de control
    .replace(/\\/g, "\\\\")       // escapar backslashes primero
    .replace(/'/g, "\\'");         // escapar comillas simples
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RATE LIMITER (in-memory, sliding window)
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpiar entradas expiradas cada 5 minutos para evitar memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

/**
 * Verifica si una clave (IP, cédula…) excede el límite de intentos.
 *
 * @param key        Identificador único (ej: IP o `login:${cedula}`)
 * @param maxAttempts Máximo de intentos permitidos en la ventana
 * @param windowMs   Duración de la ventana en milisegundos (default 15 min)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanupExpired();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count, retryAfterMs: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. RBAC — Role-Based Access Control
// ═══════════════════════════════════════════════════════════════════════════════

export type AppRole = "admin" | "rrhh" | "empleado";

const ROLE_LEVEL: Record<AppRole, number> = {
  admin: 3,
  rrhh: 2,
  empleado: 1,
};

/**
 * Comprueba si el rol del usuario es suficiente para el rol requerido.
 * admin ≥ rrhh ≥ empleado
 */
export function hasMinRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}

/**
 * Obtiene el AppRole de un payload JWT (backward-compatible con tokens sin rol).
 */
export function getRoleFromPayload(payload: { rol?: string }): AppRole {
  const r = payload.rol;
  if (r === "admin" || r === "rrhh" || r === "empleado") return r;
  return "empleado";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ONEDRIVE PATH VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_PATH_PREFIXES = [
  "Gestion del Ser/01_VLC_VINCULACION_LABORAL/",
  "Gestion del Ser/02_SPS_SALARIOS_PRESTACIONES/",
  "Gestion del Ser/03_SST_SEGURIDAD_SALUD_TRABAJO/",
  "Gestion del Ser/04_FYD_FORMACION_DESARROLLO/",
  "Gestion del Ser/05_RL_RELACIONES_LABORALES/",
  "Gestion del Ser/06_CS_CULTURA_SIRIUS/",
];

/**
 * Valida que una ruta de OneDrive no contenga path traversal
 * y pertenezca a un prefijo permitido.
 */
export function validateOneDrivePath(path: string): boolean {
  if (!path) return false;
  // Bloquear traversal
  if (path.includes("..") || path.includes("~") || /[\x00-\x1f]/.test(path)) {
    return false;
  }
  // Debe empezar con un prefijo permitido
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}
