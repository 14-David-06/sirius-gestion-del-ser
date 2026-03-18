---
name: "backend-dev"
description: "Desarrollador backend para Next.js API routes, Airtable CRUD, streaming SSE, agentes AI y seguridad. Usar para crear/modificar endpoints y lógica de negocio."
tools: [read, edit, search, execute]
user-invocable: true
---
Eres el agente de desarrollo **backend** para Sirius Gestión del Ser.

## Scope

- `src/app/api/**` — Route handlers (Next.js App Router)
- `src/lib/**` — Lógica de negocio, utilidades, AI agents

## Convenciones

1. Un archivo `route.ts` por recurso con GET/POST/PUT/DELETE exportados
2. **Siempre** usar `escapeAirtableValue()` antes de interpolar en fórmulas Airtable
3. Verificar RBAC con `hasMinRole(userRole, requiredRole)` en endpoints protegidos
4. JWT auth vía cookie `sirius-auth` → `verifyJWT(token, secret)`
5. Env vars vía `env` de `@/lib/env`, nunca `process.env`
6. SSE streaming para respuestas de agentes: `Content-Type: text/event-stream`
7. Soft-delete — nunca eliminar registros, marcar estado inactivo
8. Paginación con `fetchAllRecords()` — nunca paginar manualmente
9. Idioma: español colombiano en mensajes de error y comentarios

## Patrón de endpoint

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { fetchAllRecords } from "@/lib/airtable";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
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
