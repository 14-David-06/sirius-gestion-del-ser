---
description: "Scaffold completo de un API route de Next.js con auth JWT, RBAC, Airtable y manejo de errores siguiendo las convenciones del proyecto."
agent: "agent"
argument-hint: "Describe el recurso y operaciones necesarias (ej: 'reportes de asistencia con GET y POST')"
---
Genera un API route completo en `src/app/api/{{recurso}}/route.ts` siguiendo estas convenciones exactas del proyecto:

## Estructura obligatoria

1. **Imports**: Usar path alias `@/*`
```typescript
import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole, escapeAirtableValue } from "@/lib/security";
import { fetchAllRecords } from "@/lib/airtable";
import { env } from "@/lib/env";
```

2. **Auth**: Extraer JWT de cookie `sirius-auth` y verificar:
```typescript
const token = request.cookies.get("sirius-auth")?.value;
if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
const payload = verifyJWT(token, env.auth.jwtSecret);
if (!payload) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
```

3. **RBAC**: Verificar nivel mínimo (Lectura < Estándar < Avanzado < Admin Depto < Super Admin):
```typescript
const role = getRoleFromPayload(payload);
if (!hasMinRole(role, "Estándar"))
  return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
```

4. **Airtable**: Usar `fetchAllRecords()` para consultas, `escapeAirtableValue()` para filtros

5. **Errores**: try/catch con respuesta JSON `{ error: "mensaje" }` y status HTTP apropiado

6. **Env vars**: Usar `env` de `@/lib/env`, nunca `process.env`

7. **Soft-delete**: Filtrar `{Estado}!='Inactivo'` en consultas, nunca DELETE físico

8. **Idioma**: Mensajes de error y comentarios en español colombiano
