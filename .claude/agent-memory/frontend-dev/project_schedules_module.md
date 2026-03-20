---
name: schedules_module_integration
description: Cronogramas page connected to real API; active-shift turno card added to asistencia page
type: project
---

`/dashboard/cronogramas/page.tsx` now calls `GET /api/schedules/calendar?fecha_inicio&fecha_fin` (lunes–domingo from weekOffset). Badge siglas derived from `obtenerSiglas()`. 403 from API renders an "Acceso restringido" message instead of role-checking from the JWT cookie (cookie is httpOnly, unreadable client-side). Stats grid is dynamic — shows up to 3 unique horario names + descansos count.

`/dashboard/asistencia/page.tsx` fetches `GET /api/schedules/active-shift?fecha=YYYY-MM-DD` in parallel with the asistencia fetch inside `fetchData`. Result stored in `turnoVigente` state. A compact glass card renders between the clock date line and the mark button. API errors are silently swallowed — the card simply doesn't render if the fetch fails or returns non-OK, ensuring the marking flow is never blocked.

**Why:** Backend had already implemented both schedule API routes (confirmed in build output). Role guard is backend-enforced (403 response), not client-side, because the JWT cookie is httpOnly.

**How to apply:** For any future page that needs role-gating, rely on the API returning 403 rather than decoding the JWT in the browser. Detect 403 and render an access-denied UI state.
