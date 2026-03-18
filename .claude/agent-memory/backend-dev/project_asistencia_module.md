---
name: proyecto_asistencia_module
description: Módulo de asistencia backend: endpoints implementados, lógica clave y decisiones de diseño adoptadas en la sesión de 2026-03-17
type: project
---

## Endpoints del módulo de asistencia (implementados 2026-03-17)

### Archivos modificados
- `src/lib/env.ts` — Se agregaron `env.airtable.tableFestivosColombia` y `env.cron.cronSecret`
- `src/app/api/asistencia/route.ts` — 4 cambios: tolerancia 10→60 min, tolerancia dinámica desde campo `Tolerancia_Min` del horario, flujo motivo-requerido para marcaciones fuera de horario, rate limiting (10 req / 5 min)

### Archivos nuevos
- `src/lib/asistencia/calcularHoras.ts` — Función pura `calcularHoras()` con lógica colombiana (CST)
- `src/app/api/asistencia/summary/route.ts` — `GET /api/asistencia/summary?empleado_id=X&periodo=YYYY-MM`
- `src/app/api/asistencia/novedades/route.ts` — GET / POST / PUT sobre tabla `Novedades_Asistencia`
- `src/app/api/asistencia/ausentismo/route.ts` — `POST` cron: detecta faltas injustificadas del día anterior

### Decisiones clave

**Motivo obligatorio fuera de horario:** Cuando `checkFueraHorario` devuelve `true` y el body carece de `motivo`, el POST devuelve `{ ok: false, requiereMotivo: true, contexto: "..." }` con HTTP 200 (no 4xx) para que el frontend pueda mostrar el formulario sin tratar la respuesta como error.

**fireWebhook:** Se replicó el helper de `novedades-nomina/route.ts` directamente en `asistencia/route.ts` (no se extrajo a un módulo compartido) para cumplir la regla de no modificar archivos fuera del scope de la tarea.

**calcularHoras:** Tramo nocturno = 21:00–06:00. Dominicales y festivos se cuentan aparte del bucket ordinarias/extras. `horas_nocturnas` y `horas_extras_nocturnas` son el mismo valor (todo el tramo nocturno es extra según CST). Redondeo a 2 decimales.

**calcularHoras — entrada sin salida (fix 2026-03-18):** Si un día laboral tiene Entrada sin Salida: (a) si es el día de hoy (jornada en curso) se ignora completamente — ni horas ni faltante; (b) si es un día pasado, se estima la salida en `horario.horaSalidaSeg` (fallback 17:00). Implementado con parámetro opcional `_fechaHoy?: string` para inyección determinista en tests (no rompe la firma pública). `totalHorasDia` en `horarioBase` de tests es 8h; jornada 08:00–17:00 produce 9h → 8 ordinarias + 1 extra (no 0 extras como tenían los tests preexistentes — se corrigieron dos expectativas erróneas).

**Ausentismo cron:** Autorización dual: header `Authorization: Bearer <CRON_SECRET>` o JWT con rol `Super Admin`. No duplica novedades: verifica existencia antes de crear.

**Why:** Requerimiento del plan de módulo de asistencia para Sirius Gestión del Ser.
**How to apply:** Al extender cualquiera de estos endpoints, mantener el patrón de autorización dual en ausentismo, el flujo requiereMotivo en asistencia/route.ts, y la función pura en calcularHoras.ts.
