# Sirius Gestión del Ser — Copilot Instructions

## Idioma

Todo código, comentarios, UI, mensajes de error y documentación deben estar en **español colombiano**. No traducir nombres de funciones/variables del código existente.

## Arquitectura

Monorepo Next.js 16 con App Router. No hay separación backend/frontend — todo vive bajo `src/`.

- **API routes**: `src/app/api/` — un solo `route.ts` por recurso con GET/POST/PUT/DELETE
- **Páginas**: `src/app/dashboard/` — `"use client"` con `useEffect` + `fetch` para datos
- **Componentes**: `src/components/` — glass-morphism UI (`bg-black/30 backdrop-blur-xl border-white/[0.12]`)
- **Lógica**: `src/lib/` — auth, airtable, security, AI agents
- **Base de datos**: Airtable (no SQL). Dos bases: Gestión del Ser + Nómina Core

Detalles de arquitectura completos en `CLAUDE.md` y `docs/BACKEND.md`.

## Build & Test

```bash
npm run dev --webpack    # Dev server (NO turbopack)
npm run build            # Producción — ejecutar después de cada cambio
npm run lint             # ESLint (next/core-web-vitals + typescript)
npx vitest run           # Tests unitarios (jsdom)
npx tsc --noEmit         # Type-check
```

## Convenciones Críticas

### Seguridad (no negociable)

1. **`escapeAirtableValue()`** — Obligatorio antes de interpolar valores en `filterByFormula`
2. **RBAC**: Verificar `hasMinRole(role, "NivelMínimo")` en cada endpoint protegido
3. **Auth**: Extraer JWT de cookie `sirius-auth` → `verifyJWT()` → `getRoleFromPayload()`
4. **Rate limit**: Usar `checkRateLimit()` en endpoints de mutación sensible (login, set-password)
5. **Soft-delete**: Nunca eliminar registros. Marcar `Estado: "Inactivo"` y filtrar con `{Estado}!='Inactivo'`
6. **Env vars**: Usar el objeto `env` de `@/lib/env`, nunca `process.env` directamente

### Patrón de API Route

```typescript
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const token = request.cookies.get("sirius-auth")?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const role = getRoleFromPayload(payload);
  if (!hasMinRole(role, "Estándar"))
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  // ...
}
```

### Airtable

- Paginación automática: usar `fetchAllRecords(baseId, tableName)` — nunca paginar manualmente
- Cross-references: usar `buildEmpleadoMap()` para mapear IDs a nombres
- URL encoding: `encodeURIComponent()` para nombres de tabla con espacios
- Revalidación ISR: por defecto 60 segundos

### Frontend

- Componentes `"use client"` con patrón `useEffect` → `fetch` → `setState`
- Estilo glass-morphism con Tailwind 4 (no CSS modules ni styled-components)
- Zona horaria Colombia (UTC-5): usar helpers `fechaHoyColombia()`, `horaAhoraColombia()`
- Componentes reutilizables: `DataTable`, `StatCard`, `StatusBadge`, `CumplimientoChart`

### AI Agents

- SSE streaming (`text/event-stream`) para respuestas de agentes
- Modelos: `claude-sonnet-4-5` (agentes), `claude-opus-4-5` (transcripción)
- Máx 5 iteraciones por agente, 8 del orquestador
- Truncar a 25 registros + 8 campos por respuesta de tool

## Niveles RBAC

Super Admin > Admin Depto > Avanzado > Estándar > Lectura

## TypeScript

Strict mode habilitado. Path alias `@/*` → `./src/*`. Target ES2017.
