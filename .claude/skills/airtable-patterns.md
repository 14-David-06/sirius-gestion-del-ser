# Skill: Patrones Airtable

Conocimiento de dominio sobre la integración con Airtable en Sirius Gestión del Ser.

## Bases de Datos

| Base | ID Variable | Tablas |
|---|---|---|
| Gestión del Ser | `AIRTABLE_BASE_GESTION_DEL_SER` | Lista de Chequeo, Contratos, Registro_Cumplimiento, Configuracion_Horarios, Asignacion_Horarios, Tipo_Documento |
| Nómina Core | `AIRTABLE_BASE_NOMINA_CORE` | Personal, Roles y Permisos, Areas |

## fetchAllRecords() — Paginación completa

Airtable retorna máximo 100 registros por request. `fetchAllRecords()` itera automáticamente sobre el `offset`:

```typescript
// src/lib/airtable.ts
async function fetchAllRecords(baseId: string, tableName: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: revalidateSeconds },  // Cache de Next.js
    });

    const data: AirtableResponse = await res.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}
```

**Puntos clave**:
- `next: { revalidate: 60 }` — cache ISR de 60 segundos por defecto
- `encodeURIComponent(tableName)` — nombres de tablas con espacios
- Siempre autenticar con `Bearer` token

## escapeAirtableValue() — Prevención de inyección

**OBLIGATORIO** antes de interpolar valores en fórmulas de filterByFormula:

```typescript
// src/lib/security.ts
export function escapeAirtableValue(value: string): string {
  return value
    .replace(/[\x00-\x1f]/g, "")  // eliminar caracteres de control
    .replace(/\\/g, "\\\\")       // escapar backslashes primero
    .replace(/'/g, "\\'");         // escapar comillas simples
}
```

**Ejemplo de uso correcto**:
```typescript
const safe = escapeAirtableValue(userInput);
const formula = `{Cedula}='${safe}'`;
const url = `https://api.airtable.com/v0/${baseId}/${table}?filterByFormula=${encodeURIComponent(formula)}`;
```

**NUNCA hacer**:
```typescript
// ❌ VULNERABLE a inyección
const formula = `{Cedula}='${userInput}'`;
```

## Soft-Delete Pattern

Los registros en Airtable no se eliminan físicamente. Se marcan con un campo de estado:

```typescript
// PATCH a Airtable para "eliminar"
const body = {
  records: [{
    id: recordId,
    fields: { Estado: "Inactivo" }  // o "Eliminado"
  }]
};
```

Al consultar, filtrar por activos:
```typescript
const formula = `{Estado}!='Inactivo'`;
```

## Cross-Base References

Cuando datos de una base referencian otra, usar el helper `buildEmpleadoMap()`:

```typescript
// src/lib/airtable.ts
export function buildEmpleadoMap(personalRecords: AirtableRecord[]): Map<string, Record<string, unknown>> {
  const map = new Map();
  for (const rec of personalRecords) {
    const id = rec.fields["ID Empleado"] as string;
    if (id) map.set(id, rec.fields);
  }
  return map;
}

// Uso: enriquecer registros de otra base con datos de Personal
const personal = await getPersonal();
const mapa = buildEmpleadoMap(personal);
const empleado = mapa.get(idEmpleado);
```

## Truncación de Campos para Agentes IA

Los agentes IA tienen límite de tokens. `truncateFields()` reduce la salida:

```typescript
// src/lib/ai/tools.ts
function truncateFields(fields: Record<string, unknown>, limit = 8): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(fields)
      .slice(0, limit)           // máximo 8 campos
      .map((k) => {
        const v = fields[k];
        if (Array.isArray(v)) return [k, v.slice(0, 3)];           // máx 3 items
        if (typeof v === "string" && v.length > 200) return [k, v.slice(0, 200) + "…"];  // máx 200 chars
        return [k, v];
      })
  );
}
```

## Funciones de Consulta Disponibles

| Función | Base | Tabla |
|---|---|---|
| `getPersonal()` | Nómina Core | Personal |
| `getContratos()` | Gestión del Ser | Contratos |
| `getListaChequeo()` | Gestión del Ser | Lista de Chequeo - Sirianos |
| `getRegistroCumplimiento()` | Gestión del Ser | Registro_Cumplimiento |
| `getConfiguracionHorarios()` | Gestión del Ser | Configuracion_Horarios |
| `getAsignacionHorarios()` | Gestión del Ser | Asignacion_Horarios |
| `getTipoDocumento()` | Gestión del Ser | Tipo_Documento |
| `getRoles()` | Nómina Core | Roles y Permisos |
| `getAreas()` | Nómina Core | Areas |
