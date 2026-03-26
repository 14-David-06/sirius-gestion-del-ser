# Solicitudes Module

## Files
- `src/app/dashboard/solicitudes/page.tsx` — User-facing page (Mis Solicitudes)
- `src/app/dashboard/solicitudes/admin/page.tsx` — Admin panel (Panel de Solicitudes)

## API endpoints consumed
- GET /api/requests — list solicitudes (own or all for admin)
- GET /api/requests/balance?empleado_id=X — vacation balance
- POST /api/requests — create solicitud (tipo, subtipo, fechas, etc.)
- PATCH /api/requests/:id/cancel — cancel (user)
- PATCH /api/requests/:id/approve — approve (admin)
- PATCH /api/requests/:id/reject { comentario } — reject (admin)
- GET /api/requests/tipos?tipo_padre=permiso|novedad_nomina — subtipo catalogs
- GET /api/requests/festivos?anio=XXXX — colombian holidays as string[]
- GET /api/schedules/assignments — employee schedule (for diasLaborales)

## Key patterns
- `calcularDiasHabiles(fechaInicio, fechaFin, diasSemanaEmpleado, festivosSet)` — inline in page.tsx
- `diasSemanaEmpleado` comes from `data.asignacion?.horarios?.[0]?.diasLaborales || []`
- festivosSet is `Set<string>` combining current + next year festivos
- Modal data loaded lazily on first open (permisosTipos, novedadesTipos, festivos, schedule)
- BadgeEstado: pendiente=yellow, aprobado=green, rechazado=red, cancelado=gray (inline component)
- Admin empleadoId input uses `SIRIUS-PER-XXXX` format with pattern validation

## Layout changes (layout.tsx)
- Added `interface NavItem { label, href, icon, adminOnly?: boolean }`
- Added `userRole` state, fetched from POST /api/auth/check-user on mount
- `isAdminUser` = role in ["Admin Depto", "Super Admin", "Avanzado"]
- `visibleNavItems = navItems.filter(item => !item.adminOnly || isAdminUser)`
- "Solicitudes" nav item: visible to all
- "Admin Solicitudes" nav item: adminOnly: true
- routeMeta entries added for /dashboard/solicitudes and /dashboard/solicitudes/admin
