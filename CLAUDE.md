# CLAUDE.md — Sirius Gestión del Ser

> Archivo leído automáticamente por Claude Code CLI en cada sesión. Documenta el proyecto para todos los agentes de desarrollo.

## Stack Tecnológico

- **Framework**: Next.js 16.1.6 con App Router (monorepo — sin separación backend/frontend)
- **React**: 19.2.3
- **TypeScript**: 5.x (strict mode)
- **Estilos**: Tailwind CSS 4 con PostCSS, glass-morphism UI
- **Base de datos**: Airtable — base **Nómina Core** (`appQYSeZ5F8D3acu5`)
- **AI**: Anthropic Claude API (`claude-sonnet-4-5` para agentes, `claude-opus-4-5` para transcripción)
- **Auth**: JWT HMAC-SHA256 con Web Crypto API (sin librerías externas), bcryptjs (12 rounds)
- **Testing**: Vitest + jsdom
- **CI/CD**: GitHub Actions

## Estado Actual del Proyecto

El proyecto fue reiniciado (commit "empezando de 0"). Lo que existe hoy:

| Capa | Archivo | Estado |
|------|---------|--------|
| Landing | `src/app/page.tsx` | ✅ Implementado |
| Login UI | `src/app/login/page.tsx` | ✅ Implementado |
| Auth API | `src/app/api/auth/login/route.ts` | ✅ Implementado |
| Auth lib | `src/lib/auth.ts` | ✅ Implementado |
| Security lib | `src/lib/security.ts` | ✅ Implementado |
| Route guard | `src/proxy.ts` | ✅ Implementado |
| Dashboard | `src/app/dashboard/` | ❌ Pendiente |
| Resto de módulos | `src/app/api/*` | ❌ Pendiente |

## Estructura del Monorepo (estado actual)

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── login/
│   │           └── route.ts       # POST /api/auth/login
│   ├── login/
│   │   └── page.tsx               # Login con cédula + contraseña
│   ├── page.tsx                   # Landing page (fondo DSCF8676, botón Acceder)
│   ├── layout.tsx                 # Root layout con Geist + favicon Sirius
│   └── globals.css                # Tailwind 4
├── lib/
│   ├── auth.ts                    # signJWT(), verifyJWT(), hashPassword(), verifyPassword()
│   └── security.ts                # escapeAirtableValue()
└── proxy.ts                       # Auth guard: redirige /dashboard/** si no hay JWT válido
```

## Airtable — Nómina Core

### Tablas relevantes para auth

**Personal** (`tblJNdYasZrhBniJj`)

| Campo | Tipo | Uso en auth |
|-------|------|-------------|
| `ID Empleado` | formula | Genera `SIRIUS-PER-XXXX` → `payload.idCore` |
| `Numero Documento` | singleLineText | Identificador de login (cédula) |
| `Password` | singleLineText | Hash bcrypt `$2b$12$...` (60 chars) |
| `Estado de actividad` | singleSelect | Debe ser `"Activo"` para poder ingresar |
| `Nombre completo` | singleLineText | Va en el JWT y en la UI |
| `Rol` | multipleRecordLinks | Link a tabla `Roles y Permisos` |

**Roles y Permisos** (`tblKcfXywV83X5ACp`)

| Campo | Tipo | Uso en auth |
|-------|------|-------------|
| `Nivel_Acceso` | singleSelect | Determina el rol del JWT (`Super Admin`, `Admin Depto`, `Avanzado`, `Estándar`) |

### Jerarquía de roles (RBAC)

```
Super Admin > Admin Depto > Avanzado > Estándar > Lectura
```

Ejemplos de cargos por nivel:
- **Super Admin**: Director Ejecutivo, CTO, Director Financiero, Coordinadora Líder Gerencia
- **Admin Depto**: Jefes de área, Supervisores, Coordinadores líderes
- **Avanzado**: Contadora, Asistente Financiero, Investigador
- **Estándar**: Auxiliares operativos y administrativos

## Sistema de Autenticación

### Flujo completo de login

```
[Login UI]  POST /api/auth/login  { cedula, password }
    │
    ├─ 1. Validar inputs (cedula y password no vacíos)
    │
    ├─ 2. Buscar en Airtable Personal WHERE {Numero Documento}='{cedula}'
    │       └─ escapeAirtableValue(cedula) antes de interpolar
    │
    ├─ 3. Si no existe → 401 genérico (no revela si el usuario existe)
    │
    ├─ 4. Si Estado de actividad ≠ "Activo" → 403 "cuenta no activa"
    │
    ├─ 5. Si Password vacío → 403 "sin contraseña configurada"
    │
    ├─ 6. bcrypt.compare(password, storedHash)
    │       └─ Si falla → 401 genérico
    │
    ├─ 7. Fetch Roles y Permisos/{rolLinks[0]} → obtener Nivel_Acceso
    │       └─ Si falla → fallback "Estándar"
    │
    ├─ 8. signJWT({ sub, idCore, cedula, nombre, rol }, JWT_SECRET, 86400s)
    │
    └─ 9. Set-Cookie: sirius-auth (httpOnly, SameSite=strict, 24h)
         Response: { ok: true, nombre, rol, idCore }
```

### JWT payload

```typescript
type JWTPayload = {
  sub: string;     // Airtable record ID (recXXX) — SOLO para fetch de tabla Personal
  idCore: string;  // "SIRIUS-PER-XXXX" — FK canónica entre todas las demás tablas
  cedula: string;  // Número de documento
  nombre: string;  // Nombre completo del empleado
  rol: string;     // Nivel_Acceso: "Super Admin" | "Admin Depto" | "Avanzado" | "Estándar"
  iat: number;     // issued at (Unix timestamp)
  exp: number;     // expiry = iat + 86400
};
```

### ⚠️ Identificador único de empleado — Arquitectura crítica

```
payload.sub     → Airtable record ID (recXXX)    → SOLO para fetch de tabla Personal
payload.idCore  → SIRIUS-PER-XXXX                → FK entre tablas de Gestión del Ser
payload.cedula  → Número de documento            → Validaciones secundarias
```

**Regla:** NUNCA usar `payload.sub` como FK en tablas distintas a `Personal`.
Siempre usar `payload.idCore` en el campo `{ID Core Usuario Asignado}` y en cualquier referencia cruzada.

### Cookie de sesión

```
Nombre:    sirius-auth
httpOnly:  true   (inaccesible desde JavaScript del cliente)
sameSite:  strict (no se envía en requests cross-site)
path:      /
maxAge:    86400  (24 horas)
secure:    true en producción, false en desarrollo
```

### Route guard — proxy.ts

`src/proxy.ts` (Next.js 16 — antes se llamaba `middleware.ts`) intercepta todo request a `/dashboard/**`:
- Si no hay cookie `sirius-auth` → redirect a `/login`
- Si el JWT es inválido o expirado → borra la cookie + redirect a `/login`
- Si el JWT es válido → deja pasar el request

> **Next.js 16**: el archivo se llama `proxy.ts` y exporta `proxy` (no `middleware`).
> La API es idéntica a `NextRequest`/`NextResponse`, solo cambió el nombre.

## Patrones Clave del Código

### escapeAirtableValue() — Prevención de inyección

Siempre escapar antes de interpolar en fórmulas Airtable:

```typescript
// src/lib/security.ts
const safe = escapeAirtableValue(cedula);
const formula = `{Numero Documento}='${safe}'`;
// Elimina chars de control (\x00-\x1f), escapa \\ y '
```

### signJWT() / verifyJWT() — Web Crypto API

```typescript
// src/lib/auth.ts — funciona en Node 18+ y en el edge runtime
const token = await signJWT({ sub, idCore, cedula, nombre, rol }, JWT_SECRET);
const payload = await verifyJWT(token, JWT_SECRET); // null si inválido o expirado
```

La implementación usa `crypto.subtle` (HMAC-SHA256) + `btoa`/`atob` — sin dependencias externas,
compatible con el edge runtime de Next.js.

### Lectura del JWT en route handlers

```typescript
// En cualquier route.ts que necesite identificar al usuario:
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

const token = (await cookies()).get("sirius-auth")?.value;
const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;
if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

// payload.idCore  → usar como FK en Gestión del Ser
// payload.rol     → usar para RBAC
// payload.nombre  → mostrar en UI
```

## Variables de Entorno

```bash
# Nómina Core (Airtable)
AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE=appQYSeZ5F8D3acu5
AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE=pat...

# Auth
JWT_SECRET=<cadena aleatoria larga — generar con: openssl rand -base64 48>

# (pendiente cuando se agreguen los módulos)
AIRTABLE_BASE_ID_SIRIUS_GESTION_DEL_SER=
ANTHROPIC_API_KEY=
```

## Comandos

```bash
npm run dev --webpack    # Desarrollo con webpack (no turbopack)
npm run build            # Build producción
npm run lint             # ESLint
npx vitest run           # Tests
npx tsc --noEmit         # Type-check (ignorar errores de .next/types — son caché antiguo)
```

## Reglas para Agentes de Desarrollo

1. **No romper lo existente** — verificar con `npm run build` después de cada cambio
2. **No separar el monorepo** — todo vive bajo `src/` con App Router
3. **Seguridad primero** — validar inputs, usar `escapeAirtableValue()`, respetar RBAC
4. **Español colombiano** — en UI, comentarios y mensajes al usuario
5. **Minimal changes** — no refactorizar código que funciona sin pedido explícito
6. **proxy.ts, no middleware.ts** — Next.js 16 usa `export async function proxy()` en `src/proxy.ts`
