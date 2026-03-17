# Skill: Dominio HR — Sirius Gestión del Ser

Conocimiento del dominio de Recursos Humanos de Sirius Energy Group (empresa colombiana de energía).

## Modelo de Datos

### Personal (Base: Nómina Core)
Tabla principal de empleados ("sirianos"):

| Campo | Tipo | Descripción |
|---|---|---|
| ID Empleado | Texto | Identificador único |
| Nombres | Texto | Nombre completo |
| Cedula | Número | Cédula de ciudadanía colombiana |
| Cargo | Texto | Cargo actual |
| Area | Link | Referencia a tabla Areas |
| Estado | Select | Activo / Inactivo / Retirado |
| Tipo_Contrato | Select | Término fijo / Indefinido / Prestación de servicios |
| Fecha_Ingreso | Fecha | Fecha de vinculación |

### Contratos (Base: Gestión del Ser)
| Campo | Tipo | Descripción |
|---|---|---|
| Empleado | Link | Referencia a Personal |
| Tipo | Select | Término fijo / Indefinido / Prestación de servicios |
| Fecha_Inicio | Fecha | Inicio del contrato |
| Fecha_Fin | Fecha | Fin del contrato (null si indefinido) |
| Salario_Base | Número | Salario mensual en COP |
| Estado | Select | Vigente / Terminado / Suspendido |

### Lista de Chequeo — Sirianos (Base: Gestión del Ser)
Documentos requeridos para vinculación laboral:

| Campo | Tipo | Descripción |
|---|---|---|
| Empleado | Link | Referencia a Personal |
| Cedula_Copia | Checkbox | Copia cédula entregada |
| Hoja_Vida | Checkbox | Hoja de vida |
| Examenes_Medicos | Checkbox | Exámenes médicos de ingreso |
| Certificados_Estudio | Checkbox | Certificados académicos |
| Referencias_Laborales | Checkbox | Cartas de referencia |
| Contrato_Firmado | Checkbox | Contrato firmado |
| ARL_EPS_AFP | Checkbox | Afiliaciones a seguridad social |

### Configuración de Horarios (Base: Gestión del Ser)
| Campo | Tipo | Descripción |
|---|---|---|
| Nombre_Turno | Texto | Ej: "Turno Mañana", "Turno Noche" |
| Hora_Entrada | Hora | Hora de inicio |
| Hora_Salida | Hora | Hora de fin |
| Dias | MultiSelect | Lunes, Martes... Domingo |

### Asignación de Horarios (Base: Gestión del Ser)
| Campo | Tipo | Descripción |
|---|---|---|
| Empleado | Link | Referencia a Personal |
| Horario | Link | Referencia a Configuración de Horarios |
| Fecha_Inicio | Fecha | Desde cuándo aplica |
| Fecha_Fin | Fecha | Hasta cuándo aplica |

### Registro de Cumplimiento / Asistencia (Base: Gestión del Ser)
| Campo | Tipo | Descripción |
|---|---|---|
| Empleado | Link | Referencia a Personal |
| Fecha | Fecha | Día del registro |
| Hora_Entrada | Hora | Hora de marcación entrada |
| Hora_Salida | Hora | Hora de marcación salida |
| Estado | Select | Cumplido / Ausente / Tardanza / Justificado |

### Novedades de Nómina
| Tipo | Descripción | Webhook |
|---|---|---|
| Vacaciones | Solicitudes de vacaciones | `WEBHOOK_VACACIONES` |
| Permisos | Permisos laborales | `WEBHOOK_PERMISO` |
| Novedades | Incapacidades, bonificaciones, descuentos | `WEBHOOK_NOVEDAD_NOMINA` |

## Relaciones entre Tablas

```
Personal (Nómina Core)
├── Contratos (1:N) — Un empleado puede tener varios contratos
├── Lista de Chequeo (1:1) — Documentos de vinculación
├── Asignación de Horarios (1:N) — Horarios asignados
├── Registro de Cumplimiento (1:N) — Asistencia diaria
└── Novedades de Nómina (1:N) — Vacaciones, permisos, etc.

Configuración de Horarios
└── Asignación de Horarios (1:N) — Empleados asignados al turno

Areas (Nómina Core)
└── Personal (1:N) — Empleados del área
```

## Reglas de Negocio Colombianas

1. **Jornada laboral ordinaria**: 47 horas semanales (Ley 2101 de 2021, reducción gradual a 42h)
2. **Recargo nocturno**: 35% sobre hora ordinaria (9pm - 6am)
3. **Dominicales y festivos**: 75% adicional
4. **Vacaciones**: 15 días hábiles por año de servicio
5. **Contrato término fijo**: máximo 3 años, renovación automática máx 3 veces
6. **Periodo de prueba**: máximo 2 meses (contrato indefinido), proporcional (contrato fijo)
7. **Seguridad social obligatoria**: EPS (salud), AFP (pensión), ARL (riesgos laborales)
8. **Prestaciones sociales**: Prima de servicios, cesantías, intereses de cesantías

## Agentes IA del Sistema

Los agentes de `src/lib/ai/agents.ts` son para **usuarios finales** (empleados de Sirius):

| Agente | Función | Tools |
|---|---|---|
| HR Agent | Consulta empleados, contratos, documentos | consultar_empleados, consultar_contratos, consultar_lista_chequeo |
| Attendance Agent | Consulta horarios y asistencia | consultar_horarios, consultar_asistencia |
| Orchestrator | Delega tareas al agente correcto | Usa HR y Attendance agents |

**Importante**: Estos agentes IA son DIFERENTES a los agentes de desarrollo en `.claude/agents/`:
- `.claude/agents/` → para el equipo de TI (ayudan a programar)
- `src/lib/ai/agents.ts` → para usuarios finales (consultan datos HR en el chat)
