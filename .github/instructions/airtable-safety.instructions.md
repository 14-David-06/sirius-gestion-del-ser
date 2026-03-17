---
description: "Use when writing or modifying Airtable queries, filterByFormula, API routes that query Airtable, or any code interpolating user input into Airtable formulas. Covers injection prevention and safe data fetching."
applyTo: "src/app/api/**"
---
# Seguridad Airtable — Prevención de Inyección de Fórmulas

## Regla #1: Sanitizar inputs (obligatorio)

Envolver **todo** valor dinámico con `escapeAirtableValue()` antes de interpolarlo en `filterByFormula`:

```typescript
import { escapeAirtableValue } from "@/lib/security";

// ✅ Correcto
const safe = escapeAirtableValue(userInput);
const formula = `{Cedula} = '${safe}'`;

// ❌ NUNCA interpolar directamente
const formula = `{Cedula} = '${userInput}'`; // Vulnerable a inyección
```

## Consultas paginadas

Siempre usar `fetchAllRecords(baseId, tableName)` de `@/lib/airtable`. Nunca paginar manualmente con `offset`.

```typescript
import { fetchAllRecords } from "@/lib/airtable";
import { env } from "@/lib/env";

const records = await fetchAllRecords(env.airtable.baseGestionDelSer, "Contratos");
```

## Nombres de tabla con espacios

Usar `encodeURIComponent()` para tablas con caracteres especiales:

```typescript
const table = encodeURIComponent("Lista de Chequeo");
```

## Soft-delete

Nunca eliminar registros. Marcar como inactivos y filtrar:

```typescript
filterByFormula: `AND({Estado}!='Inactivo', {Cedula}='${escapeAirtableValue(cedula)}')`
```
