---
name: project_schedules_module
description: Módulo de gestión de turnos: endpoints implementados, patrones de datos y decisiones de diseño (2026-03-18)
type: project
---

## Endpoints del módulo de turnos (implementados 2026-03-18)

### Archivos modificados
- `src/lib/env.ts` — Se agregó `AIRTABLE_TABLE_CAMBIOS_HORARIO` (opcional) → `env.airtable.tableCambiosHorario`
- `src/app/api/configuracion-horarios/route.ts` — Se agregaron GET y PUT; se agregó `dynamic = "force-dynamic"` y se importó `escapeAirtableValue`

### Archivos nuevos
- `src/app/api/schedules/active-shift/route.ts` — GET con ?empleado_id y ?fecha; retorna turno activo del día
- `src/app/api/schedules/calendar/route.ts` — GET Admin Depto+; calendario de turnos por rango (máx 31 días)
- `src/app/api/schedules/changes/route.ts` — GET / POST; cambios/excepciones puntuales de turno

### Estructura de datos Airtable relevante

**Asignacion_Horarios** (BASE_GESTION)
- `ID Core Usuario Asignado` — Record ID del empleado en Nómina Core (texto, cross-base FK)
- `Horario` — Link to Record (array de IDs) → Configuracion_Horarios
- `Fecha_Inicio` / `Fecha_Fin` — ISO date strings; Fecha_Fin puede estar vacío (contrato indefinido)
- `Estado` — "Activo" | "Inactivo"

**Configuracion_Horarios** (BASE_GESTION)
- `Hora_Entrada` / `Hora_Salida` — segundos desde medianoche (campo duración de Airtable)
- `Dias_Laborales` — array de strings en español: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
- `Tolerancia_Min` — número de minutos de tolerancia

**Cambios_Horario** (BASE_GESTION) — tabla opcional
- `Empleado_RecordID`, `Fecha`, `Tipo_Cambio`, `Nuevo_Horario_ID`, `Hora_Inicio_Override`, `Hora_Fin_Override`, `Motivo`, `Aprobado_Por`, `Estado`, `Fecha_Creacion`

### Decisiones clave

**Conversión de tiempos:** Airtable guarda duraciones como segundos desde medianoche. Todos los endpoints convierten a "HH:MM" en las respuestas y de "HH:MM" a segundos en los writes. Los helpers `secondsToHHMM()` y `hhmmToSeconds()` se definen localmente en cada archivo (no en lib compartida) para seguir el patrón del proyecto.

**Días laborales y zona horaria:** La función `esDiaLaboral()` usa `Date.UTC` para parsear la fecha y `getUTCDay()` para obtener el día, evitando desfases por zona horaria CST. El mapa `DIA_A_INDICE` acepta tanto "Miércoles" como "Miercoles" (con y sin acento) por robustez.

**active-shift — empleado_id desde JWT:** Si no se provee `?empleado_id`, se usa `payload.sub` (el record ID del empleado en el JWT). Esto permite que un empleado consulte su propio turno sin exponer su ID en la URL.

**calendar — batch de horarios:** Para evitar saturar la API de Airtable, los horarios se obtienen en lotes de 10 (`BATCH_SIZE = 10`) con `Promise.all`. Los detalles de asignaciones sin horario vinculado se muestran como `trabaja: false`.

**changes — tabla opcional:** Si `env.airtable.tableCambiosHorario` está vacío (variable no definida), el GET retorna `{ cambios: [], total: 0 }` y el POST retorna 503. Esto permite desplegar sin la tabla hasta que esté creada en Airtable.

**Why:** Brecha del módulo de gestión de turnos para Sirius Gestión del Ser.
**How to apply:** Al extender estos endpoints, mantener la lógica UTC para fechas, el fallback de Fecha_Fin vacía en las fórmulas Airtable, y el guard de tabla opcional en changes.
