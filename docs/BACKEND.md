# BACKEND — Documentación del Sistema de Gestión de Talento Humano

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Módulo de Autenticación](#módulo-de-autenticación)
3. [Módulo de Asistencia](#módulo-de-asistencia)
4. [Módulo de Novedades Nómina](#módulo-de-novedades-nómina)
5. [Módulo de Horarios](#módulo-de-horarios)
6. [Módulo de Configuración de Horarios](#módulo-de-configuración-de-horarios)
7. [Módulo de Vinculación](#módulo-de-vinculación)
8. [Módulo de Gestión Documental](#módulo-de-gestión-documental)
9. [Módulo de Carga de Archivos (OneDrive)](#módulo-de-carga-de-archivos-onedrive)
10. [Módulo de Dashboard](#módulo-de-dashboard)
11. [Sistema Multi-Agente de IA](#sistema-multi-agente-de-ia)
12. [Autenticación de Chat IA](#autenticación-de-chat-ia)
13. [Seguridad](#seguridad)
14. [Flujo de Autenticación (3 pasos)](#flujo-de-autenticación-3-pasos)
15. [Bases de Datos Airtable](#bases-de-datos-airtable)
16. [Patrones Arquitectónicos](#patrones-arquitectónicos)
17. [Variables de Entorno](#variables-de-entorno)
18. [Estado Actual](#estado-actual)

---

## Introducción

El backend de Sirius Gestión del Ser es un sistema **monorepo Next.js 16** que integra gestión de talento humano con IA avanzada. La arquitectura es **edge-compatible** (middleware en Web Crypto API) y se conecta con dos bases Airtable (Gestión del Ser + Nómina Core) para sincronización de datos en tiempo real.

**Stack tecnológico:**
- Next.js 16.1.6 App Router (backend en `src/app/api/`)
- TypeScript 5.x (strict mode)
- Airtable API (2 bases)
- Anthropic Claude API (`claude-sonnet-4-5` agentes, `claude-opus-4-5` transcripción)
- JWT HMAC-SHA256 custom (sin dependencias externas)
- bcryptjs (12 rounds) para hashing de contraseñas
- Microsoft Graph API (OneDrive integrado)

---

## Módulo de Autenticación

### Descripción Funcional

Sistema de autenticación de **3 pasos** con JWT en cookie httpOnly, rate limiting de bruta fuerza y RBAC (5 niveles de acceso).

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| POST | `/api/auth/check-user` | No | Valida si un usuario existe y si ya tiene contraseña configurada |
| POST | `/api/auth/set-password` | No | Permite que un usuario nuevo defina su contraseña inicial (hasheo bcrypt) |
| POST | `/api/auth/login` | No | Autentica con cédula y contraseña. Retorna JWT en cookie httpOnly |
| POST | `/api/auth/logout` | No | Elimina la cookie de sesión |

### Notas de Implementación

**Hashing de Contraseñas:**
- Algoritmo: bcryptjs con 12 salt rounds
- Función `hashPassword(password)` → hash seguro
- Función `verifyPassword(password, hash)` → compara de forma segura

**JWT (src/lib/auth.ts):**
- Firma: HMAC-SHA256 con secret desde `JWT_SECRET`
- Payload: `{ sub, cedula, nombre, rol, iat, exp }`
- Expiración: 24 horas por defecto
- Verificación: edge-compatible en `middleware.ts` con Web Crypto API

**Rate Limiting (check-user → login):**
- 5 intentos por cédula en 15 minutos
- Si se excede, retorna 429 con tiempo de reintento
- Limpieza de caché cada 5 minutos

**Resolución de Rol:**
- Busca la tabla `Roles y Permisos` (Nomina Core)
- Campo `Nivel_Acceso` → uno de: "Super Admin", "Admin Depto", "Avanzado", "Estándar", "Lectura"
- Si no hay rol, default: "Lectura"
- Compatibilidad con sistema anterior: `admin` → "Super Admin", `rrhh` → "Admin Depto"

---

## Módulo de Asistencia

### Descripción Funcional

Registro de entrada/salida de empleados con validación de horarios y generación automática de novedades cuando se marca fuera de horario.

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| GET | `/api/asistencia` | JWT requerido | Retorna registros de asistencia del empleado + datos del empleado |
| POST | `/api/asistencia` | JWT requerido | Crea nuevo registro (entrada/salida). Valida contra horario asignado |

### Notas de Implementación

**GET - Datos devueltos:**
```json
{
  "empleado": {
    "recordId": "recXXXX",
    "nombre": "Juan Pérez",
    "cedula": "1234567890"
  },
  "hoy": "2026-03-16",
  "registrosHoy": [ ... ],
  "registros": [ ... ]  // últimos 50 registros ordenados descendente
}
```

**POST - Validación de Horario:**
1. Busca asignación activa por cédula en tabla `Asignacion_Horarios`
2. Si existe, obtiene horario desde tabla `Configuracion_Horarios`
3. Compara hora actual con `Hora_Entrada` o `Hora_Salida` (campos en segundos, formato duration Airtable)
4. Tolerancia: ±10 minutos
5. Si fuera de horario: `fueraHorario: true` → frontend muestra formulario de novedad

**Auto-generación de Novedades:**
- Si `fueraHorario: true`, crea registro **automático** en tabla `Novedades_Asistencia`
- Tipo: "Por fuera de horario"
- Estado: "Pendiente"
- Contexto: nombre del horario, hora esperada, hora marcada

**Zona Horaria:**
- Toda operación usa zona horaria de Colombia (UTC-5)
- `fechaHoyColombia()`: ISO string en zona de Bogotá
- `horaAhoraColombia()`: formato HH:MM en zona de Bogotá
- `isoAhoraColombia()`: ISO datetime en UTC (para Airtable)

---

## Módulo de Novedades Nómina

### Descripción Funcional

Gestión de solicitudes de vacaciones, permisos y novedades de asistencia. Integración con n8n para procesamiento de archivos y notificaciones.

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| GET | `/api/novedades-nomina` | JWT requerido | Retorna datos del empleado logueado (nombre, cargo, área, etc.) |
| POST | `/api/novedades-nomina` | JWT requerido | Crea solicitud (vacaciones, permiso, novedad asistencia). Dispara webhook n8n |

### Notas de Implementación

**GET - Datos devueltos:**
```json
{
  "nombre": "María García",
  "cedula": "9876543210",
  "cargo": "Especialista HR",
  "area": "Recursos Humanos",
  "correo": "maria@sirius.com",
  "telefono": "+57 300 123 4567"
}
```

**POST - Tipos de Solicitud:**

**1. Novedad de Asistencia (FormData + audio):**
- Content-Type: `multipart/form-data`
- Campos:
  - `empleado` (string)
  - `cedula` (string)
  - `transcripcion` (string) — de análisis de voz
  - `contextoAsistencia` (string) — motivo de la novedad
  - `registroAsistenciaId` (string) — link a registro de asistencia
  - `audio` (File, opcional) — archivo de audio
- Crea en tabla: `Novedades_Asistencia`
- Webhook: n8n procesa audio, adjunta archivo

**2. Vacaciones (JSON):**
- `tipoSolicitud: "vacaciones"`
- Campos:
  - `nombre`, `cedula`, `cargo`, `area`
  - `fechavacaciones` (yyyy-MM-dd)
  - `fechaFinal` (yyyy-MM-dd)
  - `diasvacaciones` (number)
  - `motivo` (string)
- Crea en tabla: `Solicitudes_Vacaciones`
- Webhook: n8n maneja firma digital

**3. Permiso (JSON):**
- `tipoSolicitud: "permiso"`
- Campos:
  - `nombre`, `cedula`
  - `tipo` (string) — "personal", "medico", "calamidad", "maternidad", "paternidad", "bancaria"
  - `fechaPermiso` (yyyy-MM-dd)
  - `horas` (string) — "4 horas", "8 horas", etc.
  - `motivo` (string)
- Crea en tabla: `Solicitudes_Permisos`
- Mapeo de tipos: `TIPO_PERMISO_MAP`
- Webhook: n8n procesa notificación

**Flujo de Webhook (no-bloqueante):**
```typescript
fireWebhook(url, {
  method: "POST",
  body: formData,
}).catch((e) => console.error("[Webhook]", e));
```
- No espera respuesta
- Errores solo se loguean
- Garantiza que la solicitud se guarde en Airtable incluso si webhook falla

**Validaciones:**
- Mínimo 8 caracteres en contraseña
- Las fechas se validan en el cliente (frontend)
- Horas de permiso se parsean de strings como "4 horas" → 4

---

## Módulo de Horarios

### Descripción Funcional

Gestión de asignaciones de horarios a empleados. Soporta múltiples horarios por empleado (ej: L-J diferente a Viernes).

### Endpoints

| Método | Ruta | Autenticación | Rol Mínimo | Descripción |
|--------|------|---------------|-----------|-------------|
| GET | `/api/horarios` | JWT | Estándar | Lista empleados, horarios disponibles y asignaciones actuales |
| POST | `/api/horarios` | JWT | Admin Depto | Crea nueva asignación (soporta múltiples horarios) |
| PUT | `/api/horarios` | JWT | Admin Depto | Actualiza una asignación existente |
| DELETE | `/api/horarios` | JWT | Admin Depto | Desactiva una asignación (soft-delete) |

### Notas de Implementación

**GET - Estructura:**
```json
{
  "empleados": [
    {
      "id": "recXXXX",
      "idEmpleado": "0001",
      "nombre": "Carlos López",
      "cedula": "1234567890",
      "cargo": "Ingeniero",
      "tipoPersonal": "Planta",
      "area": "Desarrollo"
    }
  ],
  "horarios": [
    {
      "id": "recYYYY",
      "nombre": "Jornada Diurna",
      "dias": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
      "horaEntrada": 28800,      // segundos (8:00 AM)
      "horaSalida": 57600,       // segundos (4:00 PM)
      "totalHoras": 8,
      "tipoJornada": "Presencial"
    }
  ],
  "asignaciones": [
    {
      "id": "recZZZZ",
      "cedula": "1234567890",
      "nombre": "Carlos López",
      "horarios": [ ... ],       // array de horarios asignados
      "horarioNombres": "Jornada Diurna",
      "fechaInicio": "2026-03-01",
      "fechaFin": "2026-12-31",
      "estado": "Activo",
      "notas": "..."
    }
  ]
}
```

**POST - Body:**
```json
{
  "cedula": "1234567890",
  "nombre": "Carlos López",
  "horarioIds": ["recYYYY", "recZZZZ"],  // array de IDs de horarios
  "idEmpleado": "0001",
  "fechaInicio": "2026-03-16",
  "fechaFin": "2026-12-31",
  "notas": "Horario especial por proyecto"
}
```

**Lógica POST:**
1. Busca asignaciones activas previas por cédula
2. Las desactiva (PATCH con `Estado: Inactivo` y `Fecha_Fin: hoy`)
3. Crea nueva asignación con array de `horarioIds`
4. Campo `Horario` es Link to Record (múltiples)

**PUT - Body:**
```json
{
  "id": "recZZZZ",
  "horarioIds": [ ... ],
  "estado": "Activo",
  "fechaFin": "2026-12-31",
  "notas": "Actualizado"
}
```

**DELETE:**
- No borra, marca como `Estado: Inactivo`
- Establece `Fecha_Fin: hoy`

**Cross-base FK:**
- Campo `ID Core Usuario Asignado` almacena el record ID del empleado desde tabla `Personal` (Nomina Core)
- Permite validaciones y auditoría

---

## Módulo de Configuración de Horarios

### Descripción Funcional

Administración de horarios laborales disponibles (creación y edición de patrones de jornada).

### Endpoints

| Método | Ruta | Autenticación | Rol Mínimo | Descripción |
|--------|------|---------------|-----------|-------------|
| POST | `/api/configuracion-horarios` | JWT | Admin Depto | Crea nuevo horario en tabla `Configuracion_Horarios` |

### Notas de Implementación

**POST - Body:**
```json
{
  "nombre": "Jornada Nocturna",
  "horaEntrada": 64800,          // segundos (18:00)
  "horaSalida": 21600,           // segundos (6:00 del día siguiente, overflow)
  "diasLaborales": ["Lunes", "Martes", "Miércoles", "Jueves"],
  "totalHoras": 12,
  "tipoJornada": "Presencial",
  "horaInicioAlmuerzo": 68400,
  "horaFinAlmuerzo": 72000,
  "descripcion": "Jornada para soporte técnico 24/7",
  "estado": "Activo"
}
```

**Campos Requeridos:**
- `nombre`
- `horaEntrada` (segundos)
- `horaSalida` (segundos)
- `diasLaborales` (array)

**Campos Opcionales:**
- `totalHoras`
- `tipoJornada`
- `horaInicioAlmuerzo`
- `horaFinAlmuerzo`
- `descripcion`
- `estado` (default: "Activo")

**Validaciones:**
- Envío con `typecast: true` → Airtable convierte tipos automáticamente
- Duración en segundos (Airtable duration field)

---

## Módulo de Vinculación

### Descripción Funcional

CRUD completo de empleados (tabla `Personal`). Gestión de datos maestros: nombre, cédula, cargo, área, estado laboral.

### Endpoints

| Método | Ruta | Autenticación | Rol Mínimo | Descripción |
|--------|------|---------------|-----------|-------------|
| GET | `/api/vinculacion` | JWT | Estándar | Listar todos los empleados activos + resolución de áreas |
| POST | `/api/vinculacion` | JWT | Admin Depto | Crear nuevo registro de personal |
| PUT | `/api/vinculacion` | JWT | Admin Depto | Actualizar registro existente |
| DELETE | `/api/vinculacion` | JWT | Super Admin | Eliminar registro (borrado físico, no soft-delete) |

### Notas de Implementación

**GET - Estructura:**
```json
{
  "personal": [
    {
      "id": "recXXXX",
      "createdTime": "2026-01-15T10:30:00.000Z",
      "fields": {
        "ID Empleado": "0001",
        "Nombre completo": "Juan Pérez",
        "Tipo Personal": "Planta",
        "Estado de actividad": "Activo",
        "Correo electrónico": "juan@sirius.com",
        "Teléfono": "+57 300 111 1111",
        "Numero Documento": "1234567890",
        "Cargo": "Ingeniero Senior",
        "Area": "Desarrollo",
        "Fecha de Ingreso": "2020-06-15",
        "Fecha de Retiro": null
      }
    }
  ],
  "areas": [
    {
      "id": "recAAA",
      "name": "Desarrollo"
    }
  ]
}
```

**POST - Body:**
```json
{
  "nombreCompleto": "Ana Martínez",
  "tipoPersonal": "Contratista",
  "estadoActividad": "Activo",
  "correo": "ana@sirius.com",
  "telefono": "+57 300 222 2222",
  "cedula": "9876543210",
  "cargo": "Diseñadora UX",
  "area": "Diseño",
  "fechaIngreso": "2026-01-20"
}
```

**PUT - Body:**
```json
{
  "id": "recXXXX",
  "nombreCompleto": "Juan P. García",
  "tipoPersonal": "Planta",
  "estadoActividad": "Inactivo",
  "correo": "juan.garcia@sirius.com",
  "cargo": "Ingeniero Lead",
  "fechaRetiro": "2026-03-31"
}
```

**DELETE:**
- Requiere rol **Super Admin**
- Borrado físico (DELETE HTTP)

**Resolución de Áreas:**
- Campo `Areas` es Link to Record (puede tener múltiples)
- GET devuelve solo la primera área (por ahora)
- Busca en tabla `Areas` de Nomina Core

---

## Módulo de Gestión Documental

### Descripción Funcional

Administración de cumplimiento documental. Registro de documentos requeridos, estados de cumplimiento y trazabilidad.

### Endpoints

| Método | Ruta | Autenticación | Rol Mínimo | Descripción |
|--------|------|---------------|-----------|-------------|
| GET | `/api/documentos` | JWT | Estándar | Listar registros de cumplimiento con tipo documento expandido |
| PATCH | `/api/documentos` | JWT | Admin Depto | Actualizar estado, fecha de cumplimiento, URL OneDrive |

### Notas de Implementación

**GET - Estructura:**
```json
{
  "registros": [
    {
      "id": "recXXXX",
      "fields": {
        "ID Registro": "RC-001",
        "ID_Empleado": "0001",
        "Nombre_Empleado": "Juan Pérez",
        "Código_Documento": "VLC-001",
        "Nombre_Documento": "Cédula copia simple",
        "Capítulo": "Vinculación",
        "Periodicidad": "Una vez",
        "Estado": "Pendiente",
        "Período": "2026-Q1",
        "Fecha de Cumplimiento": "2026-03-15",
        "Fecha de Carga": "2026-03-16",
        "Ruta_Carpeta": "Gestion del Ser/01_VLC_VINCULACION_LABORAL/_Empleados/Juan Pérez",
        "URL_OneDrive": "https://sharepoint.com/...",
        "Observaciones": "Documento aceptado",
        "Tipo_Documento_ID": "recYYYY"
      }
    }
  ],
  "total": 150
}
```

**PATCH - Body (campos permitidos):**
```json
{
  "id": "recXXXX",
  "Estado": "Cumplido",
  "Fecha de Cumplimiento": "2026-03-16",
  "Fecha de Carga": "2026-03-16",
  "URL_OneDrive": "https://sharepoint.com/...",
  "Ruta_Carpeta": "Gestion del Ser/01_VLC_VINCULACION_LABORAL/_Empleados/Juan Pérez",
  "Observaciones": "Aceptado sin observaciones",
  "ID_Responsable": "0002"
}
```

**Campos permitidos en PATCH:**
- `Estado`
- `Fecha de Cumplimiento`
- `Fecha de Carga`
- `URL_OneDrive`
- `Ruta_Carpeta`
- `Observaciones`
- `ID_Responsable`

**Enriquecimiento de datos:**
- Busca tipo documento por ID en tabla `Tipo_Documento`
- Expande campos: `Código`, `Nombre del Documento`, `Capítulo`, `Periodicidad`

---

## Módulo de Carga de Archivos (OneDrive)

### Descripción Funcional

Subida segura de archivos a OneDrive con validación de rutas, generación de links de compartición y actualización automática en Airtable.

### Endpoints

| Método | Ruta | Autenticación | Rol Mínimo | Descripción |
|--------|------|---------------|-----------|-------------|
| POST | `/api/documentos/upload` | JWT | Admin Depto | Sube archivo a OneDrive y actualiza Airtable |

### Notas de Implementación

**POST - FormData:**
```
file (File) — archivo a subir
recordId (string) — ID del registro Airtable
rutaCarpeta (string) — ruta en OneDrive (validada contra allowlist)
```

**Flujo:**
1. Valida autenticación JWT
2. Valida rol (Admin Depto mínimo)
3. **Validación de ruta** → contra allowlist (`validateOneDrivePath()`)
4. Sanitiza nombre de archivo (elimina caracteres peligrosos)
5. Obtiene token de Microsoft Graph (client credentials flow)
6. Sube a OneDrive con PUT
7. Crea link de compartición (scope: organization)
8. Actualiza registro Airtable con URL + estado "Cumplido"

**Validaciones de Seguridad:**
- Path traversal: bloquea `..`, `~`, caracteres de control
- Allowlist de prefijos (6 carpetas principales de recursos humanos)
- Sanitización de filename (elimina: `<>:"/\|?*` y caracteres de control)
- Tamaño máximo: 50 MB

**Prefijos permitidos:**
```typescript
[
  "Gestion del Ser/01_VLC_VINCULACION_LABORAL/",
  "Gestion del Ser/02_SPS_SALARIOS_PRESTACIONES/",
  "Gestion del Ser/03_SST_SEGURIDAD_SALUD_TRABAJO/",
  "Gestion del Ser/04_FYD_FORMACION_DESARROLLO/",
  "Gestion del Ser/05_RL_RELACIONES_LABORALES/",
  "Gestion del Ser/06_CS_CULTURA_SIRIUS/",
]
```

**Microsoft Graph Flow:**
1. POST a `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
2. Usa client credentials: `client_id`, `client_secret`, `scope: .default`
3. Token válido por 60 minutos (aprox.)
4. Cada upload requiere nuevo token

**Respuesta exitosa:**
```json
{
  "success": true,
  "url": "https://sharepoint.com/...",
  "filename": "cedula_juan.pdf",
  "path": "Gestion del Ser/01_VLC.../cedula_juan.pdf"
}
```

---

## Módulo de Dashboard

### Descripción Funcional

Agregación de datos de todas las bases (personal, contratos, documentación, listas de chequeo) con estadísticas consolidadas.

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| GET | `/api/dashboard` | No | Retorna datos agregados + KPIs (public, sin auth requerida) |

### Notas de Implementación

**GET - Estructura:**
```json
{
  "listaChequeo": [ ... ],
  "tipoDocumento": [ ... ],
  "contratos": [ ... ],
  "registroCumplimiento": [ ... ],
  "personal": [ ... ],
  "roles": [ ... ],
  "areas": [ ... ],
  "stats": {
    "totalEmpleados": 45,
    "totalContratos": 42,
    "totalDocumentos": 120,
    "totalRegistros": 5400,
    "totalChecklist": 85,
    "contratosVigentes": 38,
    "cumplidos": 3200,
    "pendientes": 1800,
    "enProceso": 400
  }
}
```

**Enriquecimiento:**
- Busca nombres de empleados/responsables en tabla `Personal`
- Mapea `ID_Empleado` y `ID_Responsable` a nombres completos
- Devuelve con prefijo `_` para campos derivados (ej: `_nombreEmpleado`)

**Revalidación:**
- ISR (Incremental Static Regeneration) con `revalidate: 60`
- Cache default: 60 segundos (configurable en `AIRTABLE_REVALIDATE_SECONDS`)

---

## Sistema Multi-Agente de IA

### Descripción Funcional

Orquestador de agentes especializados que consultan Airtable de forma autónoma. Streaming SSE con eventos de estado.

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| POST | `/api/ai/agent` | JWT requerido | Orquestador multi-agente (SSE streaming) |

### Notas de Implementación

**POST - Body:**
```json
{
  "messages": [
    { "role": "user", "content": "¿Cuántos empleados activos hay en el área de Desarrollo?" },
    { "role": "assistant", "content": "Voy a consultar esa información..." },
    { "role": "user", "content": "Necesito saber también sus contratos" }
  ]
}
```

**Flujo de Orquestación (max 8 iteraciones):**
1. Orquestador recibe consulta
2. Analiza si requiere datos en tiempo real o respuesta general
3. Si requiere datos, delega a sub-agentes:
   - **Agente HR**: consulta empleados, contratos, documentación
   - **Agente de Asistencia**: consulta asistencia, horarios, jornadas
4. Sub-agentes corren su propio loop (max 5 iteraciones)
5. Sintetiza resultados y devuelve respuesta estructurada

**Herramientas del Orquestador:**
- `llamar_agente_hr` → input: `{ tarea: string }`
- `llamar_agente_asistencia` → input: `{ tarea: string }`

**Eventos SSE:**
```json
{ "type": "agent_status", "agent": "Sirius AI", "message": "Analizando tu consulta…" }
{ "type": "tool_call", "tool": "llamar_agente_hr", "agent": "Sirius AI" }
{ "type": "agent_status", "agent": "Agente HR", "message": "Consultando empleados..." }
{ "type": "tool_result", "tool": "llamar_agente_hr", "preview": "Encontré 45 empleados..." }
{ "type": "delta", "text": "Actualmente hay 15 empleados" }
{ "type": "done" }
```

**Modelos utilizados:**
- Orquestador: `claude-sonnet-4-5` (max 2048 tokens)
- Sub-agentes: `claude-sonnet-4-5` (max 2048 tokens)

---

## Autenticación de Chat IA

### Descripción Funcional

Chatbot simple (sin herramientas) para preguntas generales sobre procesos HR, normativa laboral y orientación.

### Endpoints

| Método | Ruta | Autenticación | Descripción |
|--------|------|---------------|-------------|
| POST | `/api/ai/chat` | JWT requerido | Chat simple con Claude (SSE streaming) |

### Notas de Implementación

**POST - Body:**
```json
{
  "messages": [
    { "role": "user", "content": "¿Cuál es el mínimo de días de vacaciones en Colombia?" },
    { "role": "assistant", "content": "En Colombia, el Código Sustantivo del Trabajo establece..." }
  ]
}
```

**Diferencias con `/api/ai/agent`:**
- No delega a sub-agentes
- No accede a Airtable en tiempo real
- Basado en knowledge de Claude (normativa laboral, procesos generales)
- Máximo 20 turnos de historial
- Max tokens: 1024

**Flujo:**
1. Valida JWT
2. Sanitiza mensajes (solo "user" o "assistant", max 20 turnos)
3. Envía a Claude con system prompt
4. Streams respuesta carácter a carácter (SSE)

---

## Seguridad

### JWT (Generación y Verificación)

**Generación (`src/lib/auth.ts`):**
```typescript
const token = signJWT(
  {
    sub: record.id,           // Airtable record ID
    cedula: cedula,           // Número de cédula
    nombre: nombre,           // Nombre completo
    rol: rol,                 // "Super Admin" | "Admin Depto" | ...
  },
  env.auth.jwtSecret
);
// Resultado: eyJhbGc...eyJzdWI...signature
```

**Verificación en Middleware (`src/middleware.ts`):**
- Edge-compatible usando Web Crypto API
- Valida firma HMAC-SHA256
- Verifica expiración (claims `iat` y `exp`)
- Retorna null si inválido/expirado

**Cookie httpOnly:**
- Nombre: `sirius-auth`
- httpOnly: true (JS no puede acceder)
- Secure: true en production (solo HTTPS)
- SameSite: lax (CSRF mitigation)
- MaxAge: 86400 segundos (24 horas)

### RBAC (5 Niveles)

| Nivel | Valor | Acceso | Uso Típico |
|-------|-------|--------|-----------|
| 5 | Super Admin | Todo (crear usuarios, eliminar registros) | IT, Directiva |
| 4 | Admin Depto | Gestión de recursos (asignar horarios, subir documentos) | Jefes de área |
| 3 | Avanzado | Creación/edición de datos (crear contratos, nómina) | Especialistas HR |
| 2 | Estándar | Consulta y auto-gestión (marcar asistencia, solicitar vacaciones) | Empleados |
| 1 | Lectura | Solo lectura (ver datos) | Stakeholders externos |

**Verificación:**
```typescript
const role = getRoleFromPayload(payload); // Extrae rol del JWT
if (!hasMinRole(role, "Admin Depto")) {
  return NextResponse.json({ error: "Rol insuficiente" }, { status: 403 });
}
```

### Rate Limiting

**Login:**
- 5 intentos por cédula en 15 minutos
- Sliding window con cleanup automático cada 5 minutos

**Implementación:**
```typescript
const rl = checkRateLimit(`login:${cedula}`, 5, 15 * 60 * 1000);
if (!rl.allowed) {
  const retryMin = Math.ceil(rl.retryAfterMs / 60000);
  return { error: `Demasiados intentos. Intenta en ${retryMin} min.` };
}
```

### Prevención de Inyección Airtable

**Riesgo:** Fórmulas Airtable pueden interpretarse como código si contienen caracteres especiales.

**Solución:** `escapeAirtableValue(value)`
```typescript
escapeAirtableValue("O'Brien") // → "O\\'Brien"
escapeAirtableValue("test\\value") // → "test\\\\value"
escapeAirtableValue("test\x00null") // → "testnull" (remove control chars)
```

**Uso:**
```typescript
const safeCedula = escapeAirtableValue(cedula);
const filterFormula = `{Numero Documento}='${safeCedula}'`;
// ✓ Seguro contra inyección
```

### Manejo de Rutas OneDrive

**Validación:**
```typescript
validateOneDrivePath(ruta) // → true/false
```

**Checks:**
1. No vacío
2. No contiene `..` o `~` (traversal)
3. No contiene caracteres de control
4. Comienza con prefijo permitido (6 carpetas HR)

---

## Flujo de Autenticación (3 pasos)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO NUEVO                            │
└─────────────────────────────────────────────────────────────────┘

         1. CHECK-USER
      ┌─────────────────┐
      │ Cédula: 1234567 │
      └────────┬────────┘
               │
    ┌──────────▼──────────────┐
    │ ¿Usuario existe? ¿Tiene │
    │      contraseña?        │
    └────────┬─────────────┬──┘
             │             │
         Sí  │ No          │
             │      ¿Contraseña?
             │      Sí: next → login
             │      No: next → set-password
             │
      ┌──────▼─────────────────┐
      │ Respuesta:             │
      │ {                       │
      │   "exists": true,      │
      │   "hasPassword": false  │
      │ }                       │
      └───────────┬────────────┘
                  │
         2. SET-PASSWORD
      ┌─────────────────────────┐
      │ Cédula: 1234567         │
      │ Password: "MiPass123"   │
      │ Confirm: "MiPass123"    │
      └────────┬────────────────┘
               │
    ┌──────────▼────────────────┐
    │ 1. Hash con bcrypt        │
    │ 2. Guardar en Airtable    │
    │ 3. Generar JWT (auto-auth)│
    │ 4. SetCookie sirius-auth  │
    └────────┬─────────────────┘
             │
      ┌──────▼─────────────────┐
      │ Respuesta:             │
      │ {                       │
      │   "success": true,      │
      │   "nombre": "Juan Pérez"│
      │ }                       │
      └──────────┬──────────────┘
                 │ Redirige a dashboard
                 │
    ┌────────────▼──────────────────┐
    │      USUARIO EXISTENTE        │
    │    (ya tiene contraseña)      │
    └───────────────────────────────┘

         3. LOGIN
      ┌──────────────────────┐
      │ Cédula: 1234567      │
      │ Password: "MiPass123"│
      └─────────┬────────────┘
                │
    ┌───────────▼──────────────┐
    │ 1. Buscar usuario        │
    │ 2. bcrypt.compare()      │
    │ 3. Obtener Nivel_Acceso  │
    │ 4. Generar JWT           │
    │ 5. SetCookie sirius-auth │
    └───────────┬──────────────┘
                │
      ┌─────────▼──────────────┐
      │ Respuesta:             │
      │ {                       │
      │   "success": true,     │
      │   "nombre": "Juan..."  │
      │ }                       │
      │ (Cookie set)           │
      └─────────┬──────────────┘
                │ Redirige a dashboard
                │
        ✓ AUTENTICADO
        Cookie: sirius-auth=eyJ...
```

---

## Bases de Datos Airtable

### Bases

| Base | ID de Entorno | Tablas Principales |
|------|-------------|-------------------|
| **Gestión del Ser** | `AIRTABLE_BASE_GESTION_DEL_SER` | Registro_Asistencia, Novedades_Asistencia, Asignacion_Horarios, Configuracion_Horarios, Contratos, Registro_Cumplimiento, Tipo_Documento, Lista de Chequeo |
| **Nómina Core** | `AIRTABLE_BASE_NOMINA_CORE` | Personal, Roles y Permisos, Areas, Solicitudes_Vacaciones, Solicitudes_Permisos |

### Tablas Clave

#### Personal (Nomina Core)
- `ID Empleado` (text) — identificador único
- `Numero Documento` (text) — cédula
- `Nombre completo` (text)
- `Cargo` (text)
- `Areas` (Link to Record) — área(s) del empleado
- `Estado de actividad` (single select) — Activo/Inactivo
- `Correo electrónico` (email)
- `Teléfono` (phone)
- `Rol` (Link to Record) → Roles y Permisos
- `Password` (text) — bcrypt hash

#### Registro_Asistencia (Gestión del Ser)
- `Empleado_RecordID` (text) — cross-base FK a Personal.id
- `Nombre_Empleado` (text)
- `Cedula` (text)
- `Tipo` (single select) — Entrada/Salida
- `Fecha` (date) — YYYY-MM-DD
- `Hora` (text) — HH:MM
- `Fecha_Hora` (dateTime) — ISO timestamp
- `Ubicacion` (text)
- `Notas` (text)

#### Asignacion_Horarios (Gestión del Ser)
- `ID Core Usuario Asignado` (text) — cross-base FK a Personal.id
- `Cedula_Empleado` (text)
- `Nombre_Empleado` (text)
- `Horario` (Link to Record, multiple) → Configuracion_Horarios
- `Fecha_Inicio` (date)
- `Fecha_Fin` (date)
- `Estado` (single select) — Activo/Inactivo
- `Notas` (text)

#### Configuracion_Horarios (Gestión del Ser)
- `Nombre_Horario` (text)
- `Hora_Entrada` (duration) — segundos desde medianoche
- `Hora_Salida` (duration) — segundos desde medianoche
- `Dias_Laborales` (multiple select) — Lunes, Martes, ...
- `Total_Horas_Dia` (number)
- `Tipo_Jornada` (text) — Presencial/Remota/Híbrida
- `Hora_Inicio_Almuerzo` (duration)
- `Hora_Fin_Almuerzo` (duration)
- `Descripcion` (text)
- `Estado` (single select) — Activo/Inactivo

#### Novedades_Asistencia (Gestión del Ser)
- `Nombre_Empleado` (text)
- `Cedula_Empleado` (text)
- `Empleado_RecordID` (text)
- `Tipo_Novedad` (single select) — "Por fuera de horario", etc.
- `Fecha_Novedad` (date)
- `Descripcion` (long text)
- `Transcripcion_Voz` (long text) — si es voz
- `Contexto_Asistencia` (text)
- `Registro_Asistencia_Link` (Link to Record) → Registro_Asistencia
- `Estado` (single select) — Pendiente/Aprobado/Rechazado
- `Usuario_Registro` (text)

#### Solicitudes_Vacaciones (Nómina Core)
- `Nombre_Empleado` (text)
- `Cedula_Empleado` (text)
- `Empleado_RecordID` (text)
- `Cargo` (text)
- `Area` (text)
- `Fecha_Inicio` (date)
- `Fecha_Fin` (date)
- `Dias_Solicitados` (number)
- `Motivo` (text)
- `Estado` (single select) — Pendiente/Aprobado/Rechazado
- `Usuario_Registro` (text)

#### Solicitudes_Permisos (Nómina Core)
- `Nombre_Empleado` (text)
- `Cedula_Empleado` (text)
- `Empleado_RecordID` (text)
- `Tipo_Permiso` (single select) — Personal/Médico/Calamidad/...
- `Fecha_Permiso` (date)
- `Duracion_Horas` (number)
- `Motivo` (text)
- `Estado` (single select) — Pendiente/Aprobado/Rechazado
- `Usuario_Registro` (text)

#### Registro_Cumplimiento (Gestión del Ser)
- `ID Registro` (text) — identificador único
- `ID_Empleado` (text)
- `Nombre_Empleado` (text)
- `Tipo Documento` (Link to Record) → Tipo_Documento
- `Estado` (single select) — Pendiente/Cumplido/En proceso/No aplica
- `Período` (text)
- `Fecha de Cumplimiento` (date)
- `Fecha de Carga` (date)
- `Ruta_Carpeta` (text) — ruta en OneDrive
- `URL_OneDrive` (url)
- `Observaciones` (text)

---

## Patrones Arquitectónicos

### Route Handler Pattern (src/app/api/*/route.ts)

**Estructura estándar:**
```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Sin cache, siempre fresh

function authenticate(req: NextRequest) {
  const token = req.cookies.get("sirius-auth")?.value;
  if (!token) return { error: NextResponse.json(..., { status: 401 }) };
  const payload = verifyJWT(token, env.auth.jwtSecret);
  if (!payload) return { error: NextResponse.json(..., { status: 401 }) };
  return { payload };
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  // Lógica GET
  return NextResponse.json({ ... });
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  // Lógica POST
  return NextResponse.json({ ... });
}
```

### fetchAllRecords() — Paginación Airtable

**Ubicación:** `src/lib/airtable.ts`

**Uso:**
```typescript
const records = await fetchAllRecords(baseId, tableName);
// Itera automáticamente sobre offset, devuelve todos los registros
```

**Características:**
- Maneja automaticamente paginación (offset)
- Respeta ISR revalidation (cache control)
- Devuelve array de `AirtableRecord`

### runAgentLoop() — Motor de Agentes

**Ubicación:** `src/lib/ai/agents.ts`

**Flujo:**
1. Recibe `systemPrompt`, `task`, `tools`, callback `onToolCall`
2. Corre loop (max 5 iteraciones)
3. En cada iteración:
   - Llama a Claude con tools
   - Si `stop_reason === "tool_use"`: ejecuta herramientas
   - Si `stop_reason === "end_turn"`: devuelve respuesta
4. Agrega resultados al historial

**Uso:**
```typescript
const result = await runAgentLoop({
  systemPrompt: HR_SYSTEM,
  task: "Cuántos empleados hay?",
  tools: HR_TOOLS,
  onToolCall: (toolName) => console.log(`Usando ${toolName}`),
});
```

### Server-Sent Events (SSE) Streaming

**Patrón:**
```typescript
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: AgentEvent) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };

    send({ type: "agent_status", ... });
    send({ type: "tool_call", ... });
    send({ type: "delta", text: "Respuesta..." });
    send({ type: "done" });

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
```

### Webhooks (n8n) — Non-Blocking Fire

**Patrón:**
```typescript
function fireWebhook(url: string, init: RequestInit): void {
  if (!url) return;
  fetch(url, init).catch((e) => console.error("[Webhook]", e));
  // No espera respuesta, no bloquea
}

// Uso:
fireWebhook(env.webhooks.vacaciones, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

---

## Variables de Entorno

### Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `AIRTABLE_API_KEY` | API key de Airtable | `pat123abc...` |
| `AIRTABLE_BASE_GESTION_DEL_SER` | Base ID | `appXXXXXXXX` |
| `AIRTABLE_BASE_NOMINA_CORE` | Base ID | `appYYYYYYYY` |
| `AIRTABLE_TABLE_NOMINA_PERSONAL` | Nombre de tabla | `Personal` |
| `JWT_SECRET` | Secret para firmar JWTs | `<minimo-32-caracteres-aleatorios>` |

### Opcionales (si no se configura, tendrán valor default o se desactivan funcionalidades)

| Variable | Descripción | Default | Ejemplo |
|----------|-------------|---------|---------|
| `AIRTABLE_REVALIDATE_SECONDS` | ISR cache en segundos | 60 | `120` |
| `AIRTABLE_TABLE_NOMINA_AREAS` | Tabla de áreas | (env.ts) | `Areas` |
| `AIRTABLE_TABLE_REGISTRO_CUMPLIMIENTO` | Tabla cumplimiento | (env.ts) | `Registro_Cumplimiento` |
| `AIRTABLE_TABLE_TIPO_DOCUMENTO` | Catálogo de documentos | (env.ts) | `Tipo_Documento` |
| `AIRTABLE_TABLE_CONFIGURACION_HORARIOS` | Horarios | (env.ts) | `Configuracion_Horarios` |
| `AIRTABLE_TABLE_ASIGNACION_HORARIO` | Asignaciones | (env.ts) | `Asignacion_Horarios` |
| `AIRTABLE_TABLE_NOMINA_ROLES_PERMISOS` | Roles y permisos | (env.ts) | `Roles y Permisos` |
| `AIRTABLE_TABLE_NOVEDADES_ASISTENCIA` | Novedades | (env.ts) | `Novedades_Asistencia` |
| `AIRTABLE_TABLE_SOLICITUDES_VACACIONES` | Vacaciones | (env.ts) | `Solicitudes_Vacaciones` |
| `AIRTABLE_TABLE_SOLICITUDES_PERMISOS` | Permisos | (env.ts) | `Solicitudes_Permisos` |
| `ADM_MICROSOFT_TENANT_ID` | Tenant Azure | (desactivado) | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `ADM_MICROSOFT_CLIENT_ID` | Client ID | (desactivado) | `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy` |
| `ADM_MICROSOFT_CLIENT_SECRET` | Client secret | (desactivado) | `Abc123!@#...` |
| `ADM_MICROSOFT_EMAIL` | Email para acceder OneDrive | (desactivado) | `admin@sirius.onmicrosoft.com` |
| `WEBHOOK_VACACIONES` | Webhook n8n | (desactivado) | `https://n8n.sirius.com/webhook/vacaciones` |
| `WEBHOOK_PERMISO` | Webhook n8n | (desactivado) | `https://n8n.sirius.com/webhook/permiso` |
| `WEBHOOK_NOVEDAD_NOMINA` | Webhook n8n | (desactivado) | `https://n8n.sirius.com/webhook/novedad` |
| `ANTHROPIC_API_KEY` | API key Claude | (requerido para IA) | `sk-ant-...` |

### Carga de Variables (.env.local)

```bash
# Airtable
AIRTABLE_API_KEY=pat123abc...
AIRTABLE_BASE_GESTION_DEL_SER=appXXXXXXXX
AIRTABLE_BASE_NOMINA_CORE=appYYYYYYYY
AIRTABLE_TABLE_NOMINA_PERSONAL=Personal
AIRTABLE_REVALIDATE_SECONDS=60

# Auth
JWT_SECRET=<minimo-32-caracteres-aleatorios-aqui>

# Microsoft Graph (opcional)
ADM_MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ADM_MICROSOFT_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
ADM_MICROSOFT_CLIENT_SECRET=Abc123!@#...
ADM_MICROSOFT_EMAIL=admin@sirius.onmicrosoft.com

# Webhooks n8n (opcional)
WEBHOOK_VACACIONES=https://n8n.sirius.com/webhook/vacaciones
WEBHOOK_PERMISO=https://n8n.sirius.com/webhook/permiso
WEBHOOK_NOVEDAD_NOMINA=https://n8n.sirius.com/webhook/novedad

# IA
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Estado Actual

### Módulos Completados

✓ **Autenticación (3 pasos)**
- Check-user, set-password, login, logout
- JWT con expiración 24h
- Rate limiting por cédula

✓ **Asistencia**
- Registro entrada/salida
- Validación de horario (±10 min tolerancia)
- Auto-generación de novedades fuera de horario

✓ **Novedades Nómina**
- Vacaciones, permisos, novedades asistencia
- Integración n8n (webhooks no-bloqueantes)
- Transcripción de voz (multipart/form-data)

✓ **Horarios**
- Creación y asignación (múltiples horarios por empleado)
- Soft-delete (cambio de estado)
- Validación de rol (Admin Depto+)

✓ **Configuración de Horarios**
- CRUD de patrones de jornada
- Duración en segundos (Airtable duration)

✓ **Vinculación**
- CRUD de personal (tabla Personal en Nomina Core)
- Filtrado por estado activo
- Resolución de áreas

✓ **Gestión Documental**
- Lista de registros de cumplimiento
- Actualización de estado/URL OneDrive
- Enriquecimiento con tipo documento

✓ **Carga OneDrive**
- Upload seguro con validación de rutas
- Sanitización de filenames
- Generación de links de compartición
- Integración Microsoft Graph

✓ **Dashboard**
- Agregación de datos multi-base
- Estadísticas consolidadas (KPIs)
- ISR con revalidation configurable

✓ **Sistema Multi-Agente**
- Orquestador con 2 sub-agentes (HR, Asistencia)
- SSE streaming con eventos de estado
- Loop autónomo (max 8 iteraciones orquestador, max 5 por agente)
- Integración con Anthropic Claude

✓ **Chat IA Simple**
- Chat general para preguntas sobre procesos
- Basado en knowledge de Claude
- SSE streaming

✓ **Seguridad**
- Escapado de inyección Airtable
- RBAC 5 niveles
- Rate limiting
- Validación de rutas OneDrive
- JWT con verificación en middleware (edge-compatible)

### Puntos Mejorables

**Observado en el código:**

1. **Transcripción de Voz** (`/api/ai/transcribe`)
   - Endpoint no fue revisado en detalle
   - Probablemente usa Anthropic Audio API
   - Pendiente de documentación específica

2. **Estado de Mensajes Chat**
   - Actualmente no hay persistencia de historial
   - Las conversaciones se pierden al recargar
   - Podría implementarse con Airtable

3. **Paginación en GET**
   - Algunos endpoints devuelven últimos 50 registros (limit hardcoded)
   - Podría implementarse paginación con offset en query params

4. **Validación de Fechas**
   - Algunos endpoints NO validan que fechas sean válidas
   - Podrían agregarse validaciones con date-fns o similar

5. **Logs y Observabilidad**
   - Logs solo a console (development-only)
   - Podría integrarse con plataforma observability (LogRocket, Sentry)

6. **Testing**
   - Vitest está configurado pero sin coverage
   - Falta suite de tests para endpoints críticos (auth, asistencia)

7. **Transacciones Airtable**
   - No hay transacciones/rollback en operaciones múltiples
   - Si una llamada falla a mitad de camino, registro puede quedar inconsistente

8. **Caché Estratégica**
   - ISR en dashboard es fixed (60s)
   - Podría ser más granular por tabla

---

**Documento generado:** 2026-03-16
**Versión:** 1.0 (Estado actual del código)
