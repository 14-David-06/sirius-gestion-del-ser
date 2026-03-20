# CLAUDE.md — Sirius Gestión del Ser

> Archivo leído automáticamente por Claude Code CLI en cada sesión. Documenta el proyecto para todos los agentes de desarrollo.

## Stack Tecnológico

- **Framework**: Next.js 16.1.6 con App Router (monorepo — sin separación backend/frontend)
- **React**: 19.2.3
- **TypeScript**: 5.x (strict mode)
- **Estilos**: Tailwind CSS 4 con PostCSS, glass-morphism UI
- **Base de datos**: Airtable (2 bases: Gestión del Ser + Nómina Core)
- **AI**: Anthropic Claude API (`claude-sonnet-4-5` para agentes, `claude-opus-4-5` para transcripción)
- **Auth**: JWT HMAC-SHA256 custom (sin librerías externas), bcryptjs (12 rounds)
- **Testing**: Vitest + jsdom
- **CI/CD**: GitHub Actions

## Estructura del Monorepo

```
src/
├── app/
│   ├── api/                    # Backend — Route handlers (Next.js)
│   │   ├── ai/                 # Agentes IA (agent/, chat/, transcribe/)
│   │   ├── auth/               # Login, logout, check-user, set-password
│   │   ├── asistencia/         # Asistencia GET/POST
│   │   ├── dashboard/          # Datos agregados HR
│   │   ├── documentos/         # Compliance (+ upload/)
│   │   ├── horarios/           # Horarios laborales
│   │   ├── configuracion-horarios/
│   │   ├── novedades-nomina/   # Vacaciones, permisos, novedades
│   │   └── vinculacion/        # Vinculación laboral
│   ├── dashboard/              # Frontend — Páginas protegidas
│   │   ├── asistencia/         # Módulo asistencia
│   │   ├── asistente/          # Chat IA
│   │   ├── contratos/          # Gestión contratos
│   │   ├── cronogramas/        # Planificación
│   │   ├── documentos/         # Gestión documental
│   │   ├── horarios/           # Vista horarios
│   │   ├── novedades-nomina/   # Nómina
│   │   ├── vinculacion/        # Vinculación
│   │   ├── layout.tsx          # Sidebar + navegación
│   │   └── page.tsx            # Home dashboard
│   ├── login/page.tsx          # Login 3 pasos
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Tailwind 4
├── components/                 # Componentes compartidos
│   ├── CumplimientoChart.tsx   # Visualización progreso
│   ├── DataTable.tsx           # Tabla genérica
│   ├── StatCard.tsx            # Tarjetas KPI
│   └── StatusBadge.tsx         # Badges de estado
├── lib/                        # Lógica de negocio
│   ├── ai/
│   │   ├── agents.ts           # runHRAgent(), runAttendanceAgent(), runAgentLoop()
│   │   └── tools.ts            # HR_TOOLS, ATTENDANCE_TOOLS, executeAirtableTool()
│   ├── auth.ts                 # signJWT(), verifyJWT(), hashPassword(), verifyPassword()
│   ├── airtable.ts             # fetchAllRecords() con paginación, getPersonal(), getContratos()...
│   ├── env.ts                  # Validación centralizada de env vars
│   └── security.ts             # escapeAirtableValue(), checkRateLimit(), hasMinRole(), validateOneDrivePath()
└── middleware.ts               # JWT verification (edge-compatible, Web Crypto API)
```

## Convenciones

- **Idioma**: Español colombiano en UI, comentarios y mensajes de agentes
- **Path alias**: `@/*` → `./src/*`
- **API pattern**: GET/POST/PUT/DELETE en un solo `route.ts` por recurso
- **Auth**: Cookie `sirius-auth` (httpOnly, 24h), middleware verifica JWT
- **RBAC**: 5 niveles — Super Admin > Admin Depto > Avanzado > Estándar > Lectura
- **Soft-delete**: Registros no se eliminan, se marcan inactivos
- **SSE streaming**: `text/event-stream` para respuestas de agentes IA
- **Airtable safety**: Siempre usar `escapeAirtableValue()` antes de interpolar en fórmulas

## Patrones Clave del Código

### runAgentLoop() — Motor de agentes IA
```typescript
// src/lib/ai/agents.ts
// Loop autónomo: hasta 5 iteraciones, tool-use con Airtable
await runAgentLoop({ systemPrompt, task, tools, onToolCall });
```

### escapeAirtableValue() — Prevención de inyección
```typescript
// src/lib/security.ts
escapeAirtableValue(value) // elimina chars de control, escapa \\ y '
```

### hasMinRole() — Control de acceso
```typescript
// src/lib/security.ts
hasMinRole(userRole, "Admin Depto") // true si userRole >= Admin Depto
```

### fetchAllRecords() — Paginación Airtable
```typescript
// src/lib/airtable.ts
// Itera sobre offset para obtener todos los registros
const records = await fetchAllRecords(baseId, tableName);
```

### JWT Auth (sin dependencias externas)
```typescript
// src/lib/auth.ts
const token = signJWT({ sub, idCore, cedula, nombre, rol }, secret);
const payload = verifyJWT(token, secret); // null si inválido/expirado
```

### ⚠️ Identificador único de empleado — Arquitectura crítica

El identificador canónico de un empleado en Sirius es **`SIRIUS-PER-XXXX`**, almacenado en el campo `ID Empleado` de la tabla `Personal` (base Nómina Core).

```
payload.sub     → Airtable record ID (recXXX)    → SOLO para fetch de tabla Personal
payload.idCore  → SIRIUS-PER-XXXX                → FK entre tablas de Gestión del Ser
payload.cedula  → Número de documento            → Validaciones secundarias
```

**Regla:** NUNCA usar `payload.sub` como FK en tablas distintas a `Personal`.
Siempre usar `payload.idCore` para el campo `{ID Core Usuario Asignado}` y cualquier referencia cruzada entre módulos.

Si `payload.idCore` no está disponible (sesión emitida antes del 2026-03-18), hacer fallback:
```typescript
// Fallback para sesiones antiguas
const personalRecord = await fetch(`/v0/${baseNominaCore}/Personal/${payload.sub}`);
const idCore = personalRecord.fields["ID Empleado"]; // SIRIUS-PER-XXXX
```

## Comandos

```bash
npm run dev --webpack    # Desarrollo con webpack (no turbopack)
npm run build            # Build producción
npm run lint             # ESLint
npx vitest run           # Tests
npx tsc --noEmit         # Type-check sin emitir
```

## Variables de Entorno Requeridas

```
AIRTABLE_API_KEY            # API key de Airtable
AIRTABLE_BASE_GESTION_DEL_SER  # Base ID Gestión del Ser
AIRTABLE_BASE_NOMINA_CORE  # Base ID Nómina Core
AIRTABLE_TABLE_NOMINA_PERSONAL
JWT_SECRET                  # Secret para firmar JWTs
ANTHROPIC_API_KEY           # API key de Anthropic
```

## Arquitectura del Sistema de Agentes IA

```
Usuario (Chat UI)
    ↓ POST /api/ai/agent
Orquestador (SSE streaming)
    ├── HR Agent → consultar_empleados, consultar_contratos, consultar_lista_chequeo
    └── Attendance Agent → consultar_horarios, consultar_asistencia
    ↓
Airtable API (2 bases)
```

**IMPORTANTE**: Los agentes en `.claude/agents/` son para TI (ayudan a desarrollar). Los agentes en `src/lib/ai/agents.ts` son para usuarios finales (empleados de Sirius en el chat).

## Reglas para Agentes de Desarrollo

1. **No romper lo existente** — siempre verificar con `npm run build` después de cambios
2. **No separar el monorepo** — todo vive bajo `src/` con App Router
3. **Seguridad primero** — validar inputs, usar `escapeAirtableValue()`, respetar RBAC
4. **Español colombiano** — en UI, comentarios y documentación
5. **Minimal changes** — no refactorizar código que funciona sin pedido explícito
