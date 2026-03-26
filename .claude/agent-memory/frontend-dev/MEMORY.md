# Frontend Dev Memory Index

- [project_schedules_module.md](project_schedules_module.md) — Schedules/cronogramas module connected to real API; active-shift card added to asistencia page
- [project_solicitudes_module.md](project_solicitudes_module.md) — Solicitudes module (user page + admin page); role-based nav added to layout

Notes:
- layout.tsx uses NavItem interface with `adminOnly?: boolean`; `visibleNavItems` is derived from user role via POST /api/auth/check-user
- `calcularDiasHabiles` lives in page.tsx; uses `asignacion.horarios[0].diasLaborales` from GET /api/schedules/assignments
