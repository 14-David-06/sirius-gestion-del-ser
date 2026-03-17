# Skill: Convenciones de API

Conocimiento de dominio sobre las convenciones de API routes en Sirius Gestión del Ser.

## Estructura de Endpoints

Next.js App Router: un archivo `route.ts` por recurso con funciones HTTP exportadas.

```
src/app/api/
├── ai/
│   ├── agent/route.ts      # POST — Orquestador multi-agente (SSE)
│   ├── chat/route.ts       # POST — Chat simple con Claude
│   └── transcribe/route.ts # POST — Audio a texto
├── auth/
│   ├── login/route.ts      # POST — Login con cédula + password
│   ├── check-user/route.ts # POST — Verificar existencia de usuario
│   ├── set-password/route.ts # POST — Establecer password inicial
│   └── logout/route.ts     # POST — Logout (borrar cookie)
├── asistencia/route.ts     # GET (listar), POST (registrar)
├── dashboard/route.ts      # GET — Datos agregados
├── documentos/
│   ├── route.ts            # GET (listar), PATCH (actualizar estado)
│   └── upload/route.ts     # POST — Subir documentos
├── horarios/route.ts       # GET
├── configuracion-horarios/route.ts  # GET/POST/PUT/DELETE
├── novedades-nomina/route.ts        # GET/POST
└── vinculacion/route.ts             # GET/POST
```

## Patrón de Autenticación JWT

Todos los endpoints (excepto auth) verifican JWT:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getRoleFromPayload, hasMinRole } from "@/lib/security";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  // 1. Extraer token de cookie
  const token = request.cookies.get("sirius-auth")?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Verificar JWT
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
  }

  // 3. Verificar rol mínimo
  const role = getRoleFromPayload(payload);
  if (!hasMinRole(role, "Estándar")) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  }

  // 4. Lógica del endpoint...
  return NextResponse.json({ data: [] });
}
```

## RBAC — Roles y Niveles

```
Super Admin (5) → acceso total
Admin Depto (4) → gestión departamental
Avanzado    (3) → operaciones avanzadas
Estándar    (2) → lectura + operaciones básicas
Lectura     (1) → solo consulta
```

Uso con `hasMinRole()`:
```typescript
hasMinRole("Admin Depto", "Estándar")  // true — Admin Depto >= Estándar
hasMinRole("Lectura", "Avanzado")      // false — Lectura < Avanzado
```

## Respuestas HTTP

### Éxito
```typescript
return NextResponse.json({ data: records, total: records.length });
// Status 200 implícito
```

### Creación
```typescript
return NextResponse.json({ data: newRecord }, { status: 201 });
```

### Error de autenticación
```typescript
return NextResponse.json({ error: "No autorizado" }, { status: 401 });
```

### Error de permisos
```typescript
return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
```

### Error de validación
```typescript
return NextResponse.json({ error: "Cédula es requerida" }, { status: 400 });
```

### Error interno
```typescript
return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
// NUNCA exponer detalles del error al cliente
```

## SSE Streaming Pattern

Para respuestas de agentes IA que tardan (orquestador):

```typescript
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Enviar eventos SSE
      controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ agent: "hr", status: "thinking" })}\n\n`));

      // Ejecutar agente
      const result = await runHRAgent(task, (toolName) => {
        controller.enqueue(encoder.encode(`event: tool_call\ndata: ${JSON.stringify({ tool: toolName })}\n\n`));
      });

      // Resultado final
      controller.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify({ agent: "hr", result })}\n\n`));
      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## Patrones de Datos Airtable en APIs

### Listar con enriquecimiento
```typescript
// GET /api/dashboard — combina datos de múltiples tablas
const [personal, contratos, registro] = await Promise.all([
  getPersonal(),
  getContratos(),
  getRegistroCumplimiento(),
]);
const mapaEmpleados = buildEmpleadoMap(personal);
// Enriquecer registros con nombre de empleado
```

### CRUD con Airtable
```typescript
// POST — Crear registro
const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ records: [{ fields: { ...data } }] }),
});

// PATCH — Actualizar registro
const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ records: [{ id: recordId, fields: { ...updates } }] }),
});
```

## Rate Limiting en Login

```typescript
import { checkRateLimit } from "@/lib/security";

export async function POST(request: NextRequest) {
  const { cedula } = await request.json();
  
  const limit = checkRateLimit(`login:${cedula}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }
  // ... continuar login
}
```
