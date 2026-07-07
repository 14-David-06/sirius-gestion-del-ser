# CLAUDE.md — Sirius Gestión del Ser

> Archivo leído automáticamente por Claude Code CLI en cada sesión. Documenta el proyecto para todos los agentes de desarrollo.

## Stack Tecnológico

- **Framework**: Next.js 16.1.6 con App Router (monorepo — sin separación backend/frontend)
- **React**: 19.2.3 / **TypeScript**: 5.x strict
- **Estilos**: Tailwind CSS 4, glassmorphism UI (fondo `#f1f5f9`, sidebar `#0f172a`)
- **Bases de datos**: Airtable — 2 bases activas (ver sección Airtable)
- **AI**: Anthropic Claude API (`claude-sonnet-4-5` agentes, `claude-opus-4-5` transcripción)
- **Auth**: JWT HMAC-SHA256 Web Crypto API (sin libs externas) + bcryptjs 12 rounds
- **Testing**: Vitest + jsdom / **CI/CD**: GitHub Actions

## Estado del Proyecto

| Módulo | Rutas | Estado |
|--------|-------|--------|
| Landing | `/` | ✅ |
| Login | `/login` + `/api/auth/login` + `/api/auth/logout` | ✅ |
| Auth libs | `src/lib/auth.ts` + `src/lib/security.ts` | ✅ |
| Route guard | `src/proxy.ts` | ✅ |
| Dashboard home | `/dashboard` | ✅ |
| Solicitudes | `/dashboard/solicitudes/**` + `/api/solicitudes/**` + `/api/me` | ✅ |
| Asistencia | `/dashboard/asistencia` | ❌ Pendiente |
| Contratos | `/dashboard/contratos` | ❌ Pendiente |
| Documentos | `/dashboard/documentos` | ❌ Pendiente |
| Horarios | `/dashboard/horarios` | ❌ Pendiente |
| Asistente IA | `/dashboard/asistente` | ❌ Pendiente |

## Estructura del Monorepo

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts          # POST — autentica cédula+password, emite JWT
│   │   │   └── logout/route.ts         # POST — borra cookie sirius-auth
│   │   ├── me/route.ts                 # GET  — perfil autenticado (+ cargo de Airtable)
│   │   └── solicitudes/
│   │       ├── permiso/route.ts        # GET lista | POST → Solicitud_Permiso
│   │       ├── vacaciones/route.ts     # GET lista | POST → Solicitud_Vacaciones
│   │       └── novedades/route.ts      # GET lista | POST → Reportes Novedades Nomina
│   ├── dashboard/
│   │   ├── layout.tsx                  # Sidebar (NavLinks) + avatar + logout — server
│   │   ├── page.tsx                    # Home: saludo, banner, tarjetas módulos
│   │   └── solicitudes/
│   │       ├── page.tsx                # Overview: 3 acciones + historial — server
│   │       ├── permiso/page.tsx        # Formulario permiso — client
│   │       ├── vacaciones/page.tsx     # Formulario vacaciones — client
│   │       └── novedades/page.tsx      # Formulario novedad nómina — client
│   ├── login/page.tsx                  # Login glass card — client
│   ├── page.tsx                        # Landing (DSCF8676 + botón Acceder) — server
│   ├── layout.tsx                      # Root layout — Geist + favicon Logo-Sirius.png
│   └── globals.css                     # Tailwind 4
├── components/
│   ├── NavLinks.tsx                    # Nav sidebar — client, usePathname() para activo
│   └── LogoutButton.tsx               # Logout — client, POST /api/auth/logout
├── lib/
│   ├── airtable-schema.ts              # FUENTE ÚNICA: TABLES, FIELDS, FK_ID_CORE, estados
│   ├── constants.ts                    # Enums de negocio: TIPOS_PERMISO, TIPOS_NOVEDAD
│   ├── auth.ts                         # signJWT(), verifyJWT(), hashPassword(), verifyPassword()
│   └── security.ts                     # escapeAirtableValue()
└── proxy.ts                            # Auth guard Next.js 16: protege /dashboard/**
```

## Bases de Datos Airtable

### Base 1 — Nómina Core (`appQYSeZ5F8D3acu5`)
Identidad, roles y nómina de empleados.

**Tabla: Personal** (`tblJNdYasZrhBniJj`)

| Campo | Tipo | Uso |
|-------|------|-----|
| `ID Empleado` | formula | Genera `SIRIUS-PER-XXXX` → `payload.idCore` |
| `Numero Documento` | singleLineText | Clave de login |
| `Nombre completo` | singleLineText | En JWT y UI |
| `Password` | singleLineText | Hash bcrypt `$2b$12$...` (60 chars) |
| `Estado de actividad` | singleSelect | `"Activo"` para ingresar; `"De baja"` bloquea |
| `Rol` | multipleRecordLinks | → Roles y Permisos |

**Tabla: Roles y Permisos** (`tblKcfXywV83X5ACp`)

| Campo | Tipo | Uso |
|-------|------|-----|
| `Rol` | singleLineText | Nombre del cargo (ej: `"CTO (CHIEF TECHNOLOGY OFFICER)"`) |
| `Nivel_Acceso` | singleSelect | Rol del sistema para RBAC |

**Jerarquía RBAC:** `Super Admin > Admin Depto > Avanzado > Estándar > Lectura`

---

### Base 2 — Novedades Nómina (`appnRVYZMd4EAQoRF`)
Solicitudes de empleados. Reemplaza el sistema de HTML estáticos en S3.

**Tabla: Solicitud_Permiso**

| Campo | Tipo | Origen |
|-------|------|--------|
| `Nombre` | multilineText | Auto — `payload.nombre` |
| `Cedula` | singleLineText | Auto — `payload.cedula` |
| `Cargo` | singleLineText | Auto — `/api/me` → `Roles y Permisos.Rol` |
| `ID Personal Core` | singleLineText | Auto — `payload.idCore` (FK de filtrado) |
| `Fecha de solicitud` | date | Auto — fecha del día |
| `Tipo_Permiso` | singleLineText | Usuario — enum de 8 opciones |
| `Fecha de permiso` | date | Usuario |
| `Fecha fin de permiso` | date | Usuario (opcional) |
| `Horas Permiso` | singleLineText | Usuario (guardado como string) |
| `Motivo_Permiso` | multilineText | Usuario |
| `Remunerado` | checkbox | Usuario |
| `Compensado` | checkbox | Usuario |
| `Fecha de compensatorio` | date | Usuario (visible solo si Compensado=true) |
| `Estado_Permiso` | singleSelect | Auto — `"Pendiente"` al crear |

**Tabla: Solicitud_Vacaciones**

| Campo | Tipo | Origen |
|-------|------|--------|
| `Nombre` | singleLineText | Auto — `payload.nombre` |
| `Cedula` | singleLineText | Auto — `payload.cedula` |
| `Cargo` | singleLineText | Auto — `/api/me` |
| `ID Personal Core` | singleLineText | Auto — `payload.idCore` |
| `Fecha de Presentacion` | date | Auto — fecha del día |
| `Fecha Inicio` | date | Usuario |
| `Fecha Fin` | date | Usuario |
| `Fecha Reintegro` | date | Usuario (opcional) |
| `Dias Vacaciones` | number | Auto — calculado en frontend (días calendario) |
| `Motivo` | multilineText | Usuario (opcional) |
| `Estado Solicitud` | singleSelect | Sin valor inicial — RRHH lo gestiona |

**Tabla: Reportes Novedades Nomina**

| Campo | Tipo | Origen |
|-------|------|--------|
| `ID Personal Core` | singleLineText | Auto — `payload.idCore` |
| `Tipo de Novedad` | singleLineText | Usuario — enum de 7 opciones |
| `Descripción de la Novedad` | multilineText | Usuario |
| `Número Horas Extras` | number | Usuario (visible solo si tipo = "Horas Extra") |
| `Estado del Registro` | singleSelect | Auto — `"Pendiente"` al crear |

**Enums controlados** — definidos en `src/lib/constants.ts`, importados por formularios y routes:

```typescript
import { TIPOS_PERMISO, TIPOS_NOVEDAD, TIPO_HORAS_EXTRA } from "@/lib/constants";
```

## Módulo de Solicitudes

### Flujo de una solicitud

```
[Formulario "use client"]
    │
    ├─ useEffect → GET /api/me
    │       └─ auto-llena readonly: Nombre, Cédula, Cargo, ID empleado
    │
    └─ submit → POST /api/solicitudes/{permiso|vacaciones|novedades}
                    ├─ verifica JWT (cookie sirius-auth)
                    ├─ extrae nombre, cedula, idCore del payload
                    ├─ escapeAirtableValue(idCore) antes de filtros
                    ├─ agrega fecha del día y Estado="Pendiente"
                    └─ POST a Airtable → { ok: true, id: "recXXX" }
```

### Página overview `/dashboard/solicitudes` — server component

1. Lee JWT desde cookie → `idCore`
2. `Promise.allSettled` con 3 fetches paralelos a Airtable filtrando por `idCore`
3. Fusiona, ordena por fecha desc, muestra los 10 más recientes
4. Badges de estado por color:

| Estado | Estilo |
|--------|--------|
| Pendiente | amarillo `bg:#fef9c3 / text:#a16207` |
| Concedido / Aprobado / Autorizado / Resuelto | verde `bg:#dcfce7 / text:#15803d` |
| Rechazado / No autorizado | rojo `bg:#fee2e2 / text:#b91c1c` |
| Revisado | azul `bg:#dbeafe / text:#1d4ed8` |

### Formularios — patrón client component

```typescript
"use client"
import { VoiceNoteButton } from "@sirius/solicitudes";
import { FirmaCanvas } from "@sirius/solicitudes";

export default function FormPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);
  const [firmaConfirmada, setFirmaConfirmada] = useState(false);
  
  useEffect(() => { fetch("/api/me").then(r => r.json()).then(setMe) }, []);
  
  // submit deshabilitado hasta que me !== null Y firmaConfirmada === true
  // campos auto: readonlyCls (bg-gray-50, no editables)
  // campos usuario: inputCls (focus ring en color del módulo)
  // nota de voz: encima de campos de texto largo (motivo, descripción)
  // firma digital: sección final obligatoria antes del botón enviar
  // éxito: reemplaza form con confirmación + botones "Nueva solicitud" + "Ver solicitudes"
}
```

Colores por sub-módulo: Permiso `#1a51a8` · Vacaciones `#6bb543` · Novedades `#e07b39`

### Funcionalidades estándar en formularios (2026-07+)

#### 1. Nota de voz (Web Speech API)
- **Componente**: `VoiceNoteButton` de `@sirius/solicitudes`
- **Ubicación**: Encima de campos de texto largo (motivo, descripción, comentario)
- **Idioma**: Español colombiano (`es-CO`)
- **Comportamiento**: Transcripción se agrega al campo de texto, permitiendo edición manual posterior
- **Compatibilidad**: Chrome, Edge, Opera, Safari 14.1+ (no Firefox)

#### 2. Firma digital del trabajador
- **Componente**: `FirmaCanvas` de `@sirius/solicitudes`
- **Ubicación**: Sección final del formulario, antes del botón de envío
- **Obligatoriedad**: ✅ Botón "Enviar" deshabilitado sin firma confirmada
- **Almacenamiento**:
  - Frontend: captura como PNG blob
  - Backend: convierte a base64, upload a S3 vía `uploadFirmaTrabajador()`
  - Airtable: guarda referencia S3 (`Firma_S3_Key` + `Fecha_Firma_Trabajador`)
- **NO guardar**: base64 directamente en Airtable — solo la ruta S3

#### 3. Pantalla de éxito
- **Diseño**: Icono verde + título + descripción + 2 botones
- **Botones**:
  1. "Nueva solicitud" — reinicia el formulario para otra solicitud
  2. "Ver mis solicitudes" — redirige a overview de solicitudes

## Sistema de Autenticación

### Flujo de login

```
POST /api/auth/login  { cedula, password }
    ├─ escapeAirtableValue(cedula) → busca en Personal WHERE {Numero Documento}='{cedula}'
    ├─ 401 genérico si no existe (no revela si el usuario existe)
    ├─ 403 si Estado de actividad ≠ "Activo"
    ├─ 403 si Password vacío
    ├─ bcrypt.compare(password, storedHash) → 401 si falla
    ├─ Fetch Roles y Permisos/{rolId} → Nivel_Acceso (fallback "Estándar")
    ├─ signJWT({ sub, idCore, cedula, nombre, rol }, JWT_SECRET, 86400s)
    └─ Set-Cookie: sirius-auth (httpOnly, SameSite=strict, 24h, secure en prod)
```

### JWT payload

```typescript
type JWTPayload = {
  sub: string;     // Airtable record ID — SOLO para fetch tabla Personal
  idCore: string;  // "SIRIUS-PER-XXXX" — FK canónica en TODAS las demás tablas
  cedula: string;  // Número de documento
  nombre: string;  // Nombre completo
  rol: string;     // "Super Admin" | "Admin Depto" | "Avanzado" | "Estándar"
  iat: number;
  exp: number;     // iat + 86400
};
```

### ⚠️ Regla crítica de identificadores

```
payload.sub     → recXXX          → SOLO fetch tabla Personal (Nómina Core)
payload.idCore  → SIRIUS-PER-XXXX → FK en TODAS las tablas de Novedades y Gestión del Ser
payload.cedula  → número          → validaciones secundarias únicamente
```

**NUNCA usar `payload.sub` como FK fuera de la tabla Personal.**

### Lectura del JWT en route handlers

```typescript
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

const token = (await cookies()).get("sirius-auth")?.value;
const payload = token ? await verifyJWT(token, process.env.JWT_SECRET!) : null;
if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
// payload.idCore → FK Airtable
// payload.rol    → RBAC
// payload.nombre → UI
```

### Route guard — proxy.ts

`src/proxy.ts` intercepta `/dashboard/**`. Exporta `proxy` (Next.js 16, no `middleware`).
JWT inválido/ausente → redirect `/login` + borra cookie.

## Patrones Clave

### escapeAirtableValue() — obligatorio antes de interpolar en fórmulas

```typescript
const safe = escapeAirtableValue(valor); // elimina chars de control, escapa \\ y '
const formula = `{Campo}='${safe}'`;
```

### uploadFirmaTrabajador() — Upload de firmas digitales a S3

```typescript
import { uploadFirmaTrabajador } from "@/lib/s3";

// En el handler POST de solicitudes
if (body.firmaBase64) {
  const uploadResult = await uploadFirmaTrabajador({
    base64: body.firmaBase64,
    cedula: payload.cedula,
    idCore: payload.idCore,
    tipo: "permiso" | "vacaciones" | "novedades",  // tipo de solicitud
    metadata: {
      // campos relevantes del formulario para trazabilidad
      tipoPermiso: body.tipo,
      fechaSolicitud: today,
      // ...otros campos contextuales
    },
  });

  // Guardar SOLO la referencia S3 en Airtable (NO el base64)
  fields[FIELDS.XXX.FIRMA_S3_KEY] = uploadResult.s3Key;
  fields[FIELDS.XXX.FECHA_FIRMA_TRAB] = uploadResult.uploadedAt;
}
```

**Estructura S3**: `firmas/{tipo}/{año}/{mes}/{idCore}_{cedula}_{fecha}_{uuid}.png`

### signJWT() / verifyJWT() — Web Crypto API, edge-compatible

```typescript
const token = await signJWT({ sub, idCore, cedula, nombre, rol }, JWT_SECRET);
const payload = await verifyJWT(token, JWT_SECRET); // null si inválido/expirado
```

### NavLinks — estado activo del sidebar

Client component con `usePathname()`. Activo si `pathname === href` (exacto para Inicio)
o `pathname.startsWith(href + "/")` para el resto. El layout del dashboard es server component.

### /api/me — perfil del usuario autenticado

```
GET /api/me → { nombre, cedula, idCore, rol, cargo }
cargo: Personal.Rol[0] → Roles y Permisos.Rol (nombre completo del cargo)
Si falla el fetch de cargo → retorna "" — no es bloqueante
Consumido por todos los formularios al montar (auto-llenado de campos readonly)
```

## Variables de Entorno

```bash
# Nómina Core (identidad y roles)
AIRTABLE_BASE_ID_SIRIUS_NOMINA_CORE=appQYSeZ5F8D3acu5
AIRTABLE_API_KEY_SIRIUS_NOMINA_CORE=pat...

# Novedades Nómina (solicitudes)
AIRTABLE_BASE_ID_NOVEDADES_NOMINA=appnRVYZMd4EAQoRF
AIRTABLE_API_KEY_NOVEDADES_NOMINA=pat...

# Auth
JWT_SECRET=<cadena aleatoria — generar con: openssl rand -base64 48>

# Nombres de tablas Airtable — sobreescriben los fallbacks de src/lib/airtable-schema.ts
# Útil si se renombra una tabla sin tocar código fuente
AIRTABLE_TABLE_PERSONAL=Personal
AIRTABLE_TABLE_ROLES=Roles y Permisos
AIRTABLE_TABLE_SOLICITUD_PERMISO=Solicitud_Permiso
AIRTABLE_TABLE_SOLICITUD_VACACIONES=Solicitud_Vacaciones
AIRTABLE_TABLE_NOVEDADES_NOMINA=Reportes Novedades Nomina

# S3 (firmas digitales)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_FIRMAS=sirius-firmas-empleados

# Pendientes
ANTHROPIC_API_KEY=
```

## Comandos

```bash
npm run dev --webpack    # Desarrollo (no turbopack)
npm run build            # Build — correr siempre después de cambios
npm run lint             # ESLint
npx vitest run           # Tests
npx tsc --noEmit         # Type-check (ignorar errores de .next/types — caché antiguo)
```

## Reglas para Agentes de Desarrollo

1. **`npm run build` después de cada cambio** — sin excepciones
2. **No separar el monorepo** — todo bajo `src/` con App Router
3. **`escapeAirtableValue()`** siempre antes de interpolar en fórmulas Airtable
4. **`payload.idCore` como FK** — nunca `payload.sub` fuera de tabla Personal
5. **Formularios de solicitudes** — SIEMPRE incluir:
   - Nota de voz (`VoiceNoteButton`) en campos de texto largo
   - Firma digital (`FirmaCanvas`) obligatoria antes de enviar
   - Upload de firma a S3 (NO guardar base64 en Airtable)
   - Pantalla de éxito con botones "Nueva solicitud" + "Ver solicitudes"
   - Campos Airtable: `Firma_S3_Key` (text) + `Fecha_Firma_Trabajador` (date)
5. **Campos auto-llenados** — nombre, cédula, cargo, idCore nunca se piden al usuario con sesión activa
6. **Español colombiano** — UI, mensajes de error y comentarios
7. **Minimal changes** — no refactorizar lo que funciona sin pedido explícito
8. **proxy.ts** — Next.js 16: `export async function proxy()` en `src/proxy.ts`
9. **Sin hardcoding de Airtable** — nombres de tabla en `src/lib/airtable-schema.ts` (TABLES), campos en FIELDS, enums en `src/lib/constants.ts`. Nunca strings literales de tabla/campo en routes o componentes.
