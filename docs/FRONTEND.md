# Documentación Técnica del Frontend — Sirius Gestión del Ser

Guía completa del frontend de Sirius Gestión del Ser. Cubre stack, arquitectura de páginas, componentes, design system y flujos de usuario.

**Fecha**: 2026-03-17
**Stack**: Next.js 16.1.6 + React 19.2.3 + TypeScript 5.x + Tailwind CSS 4

---

## Tabla de Contenidos

1. [Stack Tecnológico](#stack-tecnológico)
2. [Estructura de Páginas](#estructura-de-páginas)
3. [Flujos de Usuario](#flujos-de-usuario)
4. [Componentes Compartidos](#componentes-compartidos)
5. [Design System](#design-system)
6. [Endpoints Consumidos](#endpoints-consumidos)
7. [Patrones y Convenciones](#patrones-y-convenciones)

---

## Stack Tecnológico

### Librerías Principales

| Librería | Versión | Uso |
|----------|---------|-----|
| Next.js | 16.1.6 | Framework (App Router) |
| React | 19.2.3 | UI |
| TypeScript | 5.x | Tipado estricto |
| Tailwind CSS | 4 | Estilos utility-first |

### Características Importantes

- **Sin gestión de estado global** — solo `useState` + fetch nativo
- **Sin librerías UI externas** — todo construido con Tailwind + componentes custom
- **Sin librerías de forms** — formularios html5 + validación manual
- **Sin charts libraries** — gráficos inline con React (barras segmentadas)
- **Sin API clients** — fetch directo a `/api/*`
- **Streaming SSE** — para respuestas de agentes IA en tiempo real

---

## Estructura de Páginas

### Árbol de Páginas

```
src/app/
├── login/
│   └── page.tsx              # Login 3 pasos (cédula → contraseña → crear contraseña)
├── dashboard/
│   ├── layout.tsx            # Navbar + sidebar + hero banner
│   ├── page.tsx              # Home dashboard (resumen + KPIs)
│   ├── asistencia/
│   │   └── page.tsx          # Marcar entrada/salida
│   ├── asistente/
│   │   └── page.tsx          # Chat IA con streaming SSE
│   ├── contratos/
│   │   └── page.tsx          # Gestión de contratos
│   ├── cronogramas/
│   │   └── page.tsx          # Turnos semanales (MOCKDATA)
│   ├── documentos/
│   │   └── page.tsx          # Gestión documental (compliance)
│   ├── horarios/
│   │   └── page.tsx          # Asignación de horarios
│   ├── novedades-nomina/
│   │   └── page.tsx          # Vacaciones + permisos
│   └── vinculacion/
│       └── page.tsx          # CRUD personal
└── layout.tsx                # Root layout + middleware check
```

---

## Flujos de Usuario

### Flujo de Autenticación (Login)

```
┌─────────────────────────────────────────────────────────┐
│ PASO 1: Verificar Cédula                                │
├─────────────────────────────────────────────────────────┤
│ Input: Número de cédula                                 │
│ POST /api/auth/check-user                               │
│ Response: { exists, nombre, recordId, hasPassword }     │
│ ✓ Si exists=false → error "No registrado"               │
│ ✓ Si hasPassword=true → PASO 2                          │
│ ✓ Si hasPassword=false → PASO 3                         │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ PASO 2: Ingresar Contraseña                             │
├─────────────────────────────────────────────────────────┤
│ Input: Contraseña                                       │
│ POST /api/auth/login                                    │
│ Response: Cookie httpOnly sirius-auth (24h)             │
│ ✓ Redirect → /dashboard                                 │
│ ✗ Error → mostrar mensaje                               │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│ PASO 3: Crear Contraseña (usuario nuevo)                │
├─────────────────────────────────────────────────────────┤
│ Input: Nueva contraseña (2 campos)                      │
│ POST /api/auth/set-password                             │
│ ✓ Cookie httpOnly sirius-auth (24h)                     │
│ ✓ Redirect → /dashboard                                 │
└─────────────────────────────────────────────────────────┘
```

**Indicador de Fortaleza Contraseña** (Paso 3):
- Rojo: < 8 caracteres
- Ámbar: 8-11 caracteres
- Verde: ≥ 12 caracteres

### Flujo de Chat IA (Asistente)

```
┌──────────────────────────────────────┐
│ Usuario escribe pregunta             │
│ (6 sugerencias iniciales)            │
└──────────────────────────────────────┘
           ↓
POST /api/ai/agent
   Content-Type: application/json
   Body: { pregunta: string }
           ↓
   Response: text/event-stream
┌──────────────────────────────────────┐
│ Eventos SSE (streaming real-time)    │
├──────────────────────────────────────┤
│ event: agent_status                  │
│ data: { agente, estado }             │
│                                      │
│ event: tool_call                     │
│ data: { herramienta, parámetros }    │
│                                      │
│ event: tool_result                   │
│ data: { resultado }                  │
│                                      │
│ event: delta                         │
│ data: { contenido }                  │
│                                      │
│ event: done                          │
│ data: { mensajeCompleto }            │
│                                      │
│ event: error                         │
│ data: { error }                      │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ Activity log + mensaje del agente    │
│ (autoscroll y autoredimensionamiento)│
└──────────────────────────────────────┘
```

---

## Páginas Detalladas

### Dashboard Home (`/dashboard`)

**Directiva**: `"use client"`
**API**: `GET /api/dashboard`

**Componentes**:
- 4 × StatCard con KPIs:
  1. Empleados total
  2. Contratos vigentes
  3. Registros cumplimiento
  4. Lista chequeo completada
- CumplimientoChart (gráfico segmentado)
- DataTable con últimos 5 contratos

---

### Asistente AI (`/dashboard/asistente`)

**Directiva**: `"use client"` con streaming SSE
**API**: `POST /api/ai/agent` (text/event-stream)

**Funcionalidades**:
- 6 sugerencias iniciales predefinidas
- Activity log con 5 tipos de eventos:
  - `agent_status`: inicio/cambio de agente
  - `tool_call`: herramienta solicitada
  - `tool_result`: resultado de herramienta
  - `delta`: contenido incremental del mensaje
  - `done`: mensaje completado
- Auto-scroll a último evento
- Auto-resize textarea (crece con contenido)
- Toast de error si falla

**Tipos TypeScript**:

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  activity?: ActivityStep[];
}

interface ActivityStep {
  type: "agent_status" | "tool_call" | "tool_result" | "delta" | "done" | "error";
  agent?: string;
  tool?: string;
  label: string;
  detail?: string;
}
```

---

### Asistencia (`/dashboard/asistencia`)

**Directiva**: `"use client"`
**API**: `GET /api/asistencia`, `POST /api/asistencia`

**Funcionalidades**:
- Reloj en vivo (HH:MM:SS) — actualizado cada 1s
- Botón inteligente:
  - Si último registro fue "Salida" → botón muestra "Marcar Entrada"
  - Si último registro fue "Entrada" → botón muestra "Marcar Salida"
  - Si sin registros hoy → botón muestra "Marcar Entrada"
- Historial agrupado por fecha
- Toast de éxito (4s)
- 3 × StatCard: Registros hoy, Última marca, Ubicación

**Tipos TypeScript**:

```typescript
interface RegistroAsistencia {
  id: string;
  tipo: "Entrada" | "Salida";
  hora: string;          // HH:MM:SS
  fecha: string;         // YYYY-MM-DD
  fechaHora: string;     // ISO timestamp
  ubicacion: string;
  notas?: string;
}

interface EmpleadoInfo {
  recordId: string;
  nombre: string;
  cedula: string;
}
```

---

### Contratos (`/dashboard/contratos`)

**Directiva**: `"use client"`
**API**: `GET /api/dashboard`

**Funcionalidades**:
- 3 × StatCard: Total, Vigentes, Otros
- Search bar en vivo (busca por: ID, empleado, tipo)
- DataTable con 7 columnas:
  1. ID Contrato
  2. Empleado
  3. Tipo
  4. Inicio
  5. Vencimiento
  6. Días restantes
  7. Estado

---

### Novedades Nómina (`/dashboard/novedades-nomina`)

**Directiva**: `"use client"` con canvas para firma
**API**: `GET /api/novedades-nomina`, `POST /api/novedades-nomina`

**2 Tabs Principales**:

#### Tab 1: Vacaciones (🏖️)
- Seleccionar fecha inicio y fin
- Cálculo automático: días hábiles (excluye sábados y domingos)
- Canvas para firma digital
- Botón enviar solicitud

#### Tab 2: Permiso (📋)
- Selector de tipo:
  - Personal
  - Médico
  - Calamidad
  - Otro
- Entrada de horas (1-8 o más)
- Canvas para firma digital
- Botón enviar solicitud

**Tipos TypeScript**:

```typescript
type TipoSolicitud = "vacaciones" | "permiso";

interface SolicitudVacaciones {
  fechaInicio: string;   // YYYY-MM-DD
  fechaFin: string;      // YYYY-MM-DD
  diasHabiles: number;
  firma: string;         // base64 canvas
}

interface SolicitudPermiso {
  tipo: "Personal" | "Médico" | "Calamidad" | "Otro";
  horas: number;
  firma: string;         // base64 canvas
}
```

---

### Horarios (`/dashboard/horarios`)

**Directiva**: `"use client"` (archivo ~63.5KB)
**API**: `GET /api/horarios`, `POST /api/horarios`, `PATCH /api/horarios`

**Tipos de Jornada**:
- Completa (8h)
- Media Jornada (4h)
- Flexible (horarios variables)
- Nocturna (22:00-6:00)
- Rotativa (cambios semanales)

**Tipos TypeScript**:

```typescript
interface Empleado {
  id: string;
  idEmpleado: string;
  nombre: string;
  cedula: string;
  cargo: string;
  tipoPersonal: string;
  area: string;
}

interface Horario {
  id: string;
  nombre: string;
  dias: string[];              // ["Lunes", "Martes", ...]
  horaEntrada: string;         // HH:MM
  horaSalida: string;          // HH:MM
  totalHoras: number;
  tipoJornada: "Completa" | "Media Jornada" | "Flexible" | "Nocturna" | "Rotativa";
}

interface Asignacion {
  id: string;
  idAsignacion: string;
  idCoreUsuario: string;
  cedula: string;
  nombre: string;
  horarioIds: string[];
  horarios: Horario[];
  horarioNombres: string[];
  fechaInicio: string;         // YYYY-MM-DD
  fechaFin: string;            // YYYY-MM-DD
  estado: "Activo" | "Inactivo" | "Pendiente";
  notas: string;
}
```

---

### Documentos (`/dashboard/documentos`)

**Directiva**: `"use client"` con modal de detalle
**API**: `GET /api/documentos`, `PATCH /api/documentos`

**Funcionalidades**:
- 4 × StatCard: Total, Pendientes, Cumplidos, % Cumplimiento
- 4 Tabs: Todos, Pendientes, En Proceso, Cumplidos
- Filtros:
  - Search bar (busca por nombre documento)
  - Dropdown empleado
  - Dropdown capítulo
- Máximo 100 registros mostrados (advertencia si hay más)
- Modal edición inline:
  - Estado: 4 botones (Pendiente, En Proceso, Cumplido, No Aplica)
  - URL OneDrive (validación de ruta)
  - Observaciones (textarea)
  - Auto-timestamp "Fecha Cumplimiento" al cambiar a "Cumplido"

**Capítulos Disponibles**:
1. **VLC** — Vinculación Laboral
2. **SPS** — Salarios y Prestaciones
3. **SSP** — Seguridad Social
4. **SST** — Seguridad y Salud en el Trabajo
5. **JYD** — Jornadas y Descansos
6. **OGE** — Obligaciones Generales del Empleador
7. **DVL** — Desvinculación

**Tipos TypeScript**:

```typescript
interface DocRecord {
  id: string;
  fields: {
    "ID Registro": string;
    "ID_Empleado": string;
    "Nombre_Empleado": string;
    "Código_Documento": string;
    "Nombre_Documento": string;
    "Capítulo": "VLC" | "SPS" | "SSP" | "SST" | "JYD" | "OGE" | "DVL";
    "Periodicidad": string;
    "Estado": "Pendiente" | "En Proceso" | "Cumplido" | "No Aplica";
    "Período": string;
    "Fecha de Cumplimiento": string;  // YYYY-MM-DD
    "Fecha de Carga": string;         // YYYY-MM-DD
    "Ruta_Carpeta": string;
    "URL_OneDrive": string;
    "Observaciones": string;
    "Tipo_Documento_ID": string;
  };
}
```

---

### Vinculación (`/dashboard/vinculacion`)

**Directiva**: `"use client"` con multi-tab y modal (archivo ~28.4KB)
**API**: `GET /api/vinculacion`, `POST /api/vinculacion`, `PATCH /api/vinculacion`, `/api/documentos`

**Sección Personal** (3 Tabs):
1. **Activos** — empleados en nómina
2. **Inactivos** — desvinculados
3. **En Proceso** — sin activar aún

**Tipos de Personal**:
- Empleado
- Contratista
- Aprendiz
- Practicante

**Estados**:
- Activo
- Inactivo
- Retirado
- En proceso
- Pendiente

**CRUD**:
- Crear: modal con formulario
- Leer: tabla listado
- Editar: modal inline (doble clic en fila)
- Cambiar estado: switch o dropdown

**Tipos TypeScript**:

```typescript
interface PersonalRecord {
  id: string;
  fields: {
    "ID Empleado": string;
    "Nombre completo": string;
    "Tipo Personal": "Empleado" | "Contratista" | "Aprendiz" | "Practicante";
    "Estado de actividad": "Activo" | "Inactivo" | "Retirado" | "En proceso" | "Pendiente";
    "Correo electrónico": string;
    "Teléfono": string;
    "Numero Documento": string;
    "Cedula": string;
    "Cargo": string;
    "Area": string;
    "Fecha de Ingreso": string;     // YYYY-MM-DD
    "Fecha de Retiro": string;      // YYYY-MM-DD (opcional)
  };
}
```

---

### Cronogramas (`/dashboard/cronogramas`)

**Directiva**: `"use client"` con navegación de semanas
**Datos**: ⚠️ MOCKDATA — NO conectado a API

**Turnos**:
- **M** — Mañana (6:00-14:00)
- **T** — Tarde (14:00-22:00)
- **N** — Noche (22:00-6:00)
- **D** — Descanso

**Tabla**:
- Columna izquierda: Empleado + cargo
- 7 columnas: Lun, Mar, Mié, Jue, Vie, Sáb, Dom
- Cada celda: círculo de color por turno

**4 × StatCard**: Total Mañanas, Tardes, Noches, Descansos de la semana

**Navegación**:
- Botón "Anterior" (semana previa)
- Botón "Siguiente" (semana próxima)
- Display: "Semana del [fecha inicio] al [fecha fin]"

---

### Layout Dashboard (`/app/dashboard/layout.tsx`)

**Estructura**:

```
┌─────────────────────────────────────────────────────────┐
│ NAVBAR (sticky top-0)                                   │
├─────────────────────────────────────────────────────────┤
│ Logo | Nav Items (7) | Reloj | Dot Conectado | Logout  │
├─────────────────────────────────────────────────────────┤
│ HERO BANNER (ruta-específico)                           │
│ Título + subtítulo + fecha                              │
├─────────────────────────────────────────────────────────┤
│ MAIN CONTENT (children)                                 │
└─────────────────────────────────────────────────────────┘
│ TOAST (esquina inferior derecha)                        │
└─────────────────────────────────────────────────────────┘
```

**Navbar**:
- Logo Sirius
- 7 nav items (desktop, hamburger menu mobile):
  1. Resumen → `/dashboard`
  2. Contratos → `/dashboard/contratos`
  3. Novedades Nómina → `/dashboard/novedades-nomina`
  4. Asistencia → `/dashboard/asistencia`
  5. Horarios → `/dashboard/horarios`
  6. Asistente AI → `/dashboard/asistente`
  7. Vinculación → `/dashboard/vinculacion`
- Reloj en vivo (formato es-CO: HH:MM:SS)
- Dot verde "Conectado"
- Botón logout

**Hero Banner**:
- Título ruta-específico
- Subtítulo (descripción de la sección)
- Fecha actual (formato es-CO)

**Toast Inspiracional**:
- 19 mensajes en 6 categorías:
  - Motivación
  - Liderazgo
  - Bienestar
  - Equipo
  - Gratitud
  - Resiliencia
- Aparece 800ms después del mount
- Duración: 10s
- SessionStorage: no repite en la misma sesión

---

## Componentes Compartidos

Ubicación: `src/components/`

### StatCard

**Props**:
```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange" | "red" | "cyan" | "indigo" | "pink";
  subtitle?: string;
}
```

**Ejemplo**:
```typescript
<StatCard
  title="Empleados Activos"
  value={145}
  icon={<Users size={24} />}
  color="blue"
  subtitle="De 180 totales"
/>
```

**Paleta de colores**:
- blue: `bg-blue-500/20 border-blue-500/30`
- green: `bg-green-500/20 border-green-500/30`
- purple: `bg-purple-500/20 border-purple-500/30`
- orange: `bg-orange-500/20 border-orange-500/30`
- red: `bg-red-500/20 border-red-500/30`
- cyan: `bg-cyan-500/20 border-cyan-500/30`
- indigo: `bg-indigo-500/20 border-indigo-500/30`
- pink: `bg-pink-500/20 border-pink-500/30`

**Usado en**: Dashboard (4), Asistencia (3), Contratos (3), Documentos (4)

---

### DataTable

**Props**:
```typescript
interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}
```

**Ejemplo**:
```typescript
<DataTable
  headers={["ID", "Empleado", "Cargo", "Fecha Inicio", "Estado"]}
  title="Últimos Contratos"
  subtitle="5 registros más recientes"
  icon={<FileText size={20} />}
>
  {rows.map(row => (
    <tr key={row.id}>
      <td>{row.id}</td>
      <td>{row.empleado}</td>
      {/* ... */}
    </tr>
  ))}
</DataTable>
```

**Estilos**:
- Header: `text-[11px] font-semibold uppercase tracking-wider text-white/40`
- Filas: hover `bg-white/[0.04]` con transición
- Bordes: `border-b border-white/[0.08]`

**Usado en**: Dashboard, Contratos

---

### StatusBadge

**Props**:
```typescript
interface StatusBadgeProps {
  status: string | null | undefined;
}
```

**Mapeo de estados**:
| Estado | Color |
|--------|-------|
| Cumplido, Completado, Vigente, Activo | Blanco (`white/60`) |
| Pendiente | Gris (`gray-400`) |
| En proceso, En revisión | Gris claro (`gray-300`) |
| Vencido, Terminado, No aplica | Gris muy débil (`gray-200`) |

**Ejemplo**:
```typescript
<StatusBadge status="Cumplido" />      {/* punto blanco */}
<StatusBadge status="Pendiente" />     {/* punto gris */}
<StatusBadge status="En proceso" />    {/* punto gris claro */}
```

**Usado en**: Dashboard, Contratos, Documentos

---

### CumplimientoChart

**Props**:
```typescript
interface CumplimientoChartProps {
  cumplidos: number;
  pendientes: number;
  enProceso: number;
  noAplica?: number;
}
```

**Estructura**:
- Barra horizontal segmentada (100% ancho)
- 3-4 segmentos con colores:
  - Verde: cumplidos
  - Rojo: pendientes
  - Ámbar: en proceso
  - Gris: no aplica (opcional)
- 3 tarjetas leyenda debajo:
  - Etiqueta + count + porcentaje

**Ejemplo**:
```typescript
<CumplimientoChart
  cumplidos={85}
  pendientes={10}
  enProceso={5}
  noAplica={0}
/>
```

**Usado en**: Dashboard

---

## Design System

### Paleta de Colores

**Fondo y Texto Principal**:
```
Fondo oscuro:     bg-gray-950 (casi negro)
Texto primario:   text-white
Texto secundario: text-white/40 a text-white/60
Acento:           text-white/80 a text-white/90
```

**Componentes**:
```
Bordes:          border-white/[0.08]
Hover (bordes):  border-white/[0.15] a border-white/[0.25]
Inputs (bg):     bg-white/[0.04]
Glass-morphism:  bg-black/30 backdrop-blur-2xl border border-white/[0.08]
```

### Tipografía

```typescript
// Títulos de página
className="text-4xl font-bold text-white"

// Subtítulos
className="text-2xl font-semibold text-white/80"

// Headers de tabla
className="text-[11px] font-semibold uppercase tracking-wider text-white/40"

// Texto de cuerpo
className="text-sm text-white/60"

// Etiquetas
className="text-xs font-medium text-white/50"
```

### Botones

**Botón Primary** (blanco):
```typescript
className="bg-white text-gray-900 rounded-xl px-6 py-2 font-semibold hover:bg-white/90 transition-all duration-300"
```

**Botón Secondary** (translúcido):
```typescript
className="bg-white/[0.12] border border-white/[0.15] text-white rounded-xl px-6 py-2 font-semibold hover:bg-white/[0.15] transition-all duration-300"
```

**Botón Icon** (con hover scale):
```typescript
className="group p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-300"
// En el ícono hijo:
className="group-hover:scale-110 transition-transform"
```

### Inputs y Formularios

```typescript
// Input de texto
className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-white placeholder-white/30 focus:border-white/[0.25] focus:outline-none transition-colors"

// Textarea
className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-white placeholder-white/30 focus:border-white/[0.25] focus:outline-none resize-none"

// Select
className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-white focus:border-white/[0.25] focus:outline-none"
```

### Contenedores y Cards

```typescript
// Card base
className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6"

// Card hover
className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300"

// Glass-morphism container
className="bg-black/30 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6"
```

### Animaciones

```typescript
// Spinner
className="animate-spin"

// Transiciones suaves
className="transition-all duration-300"

// Hover escala
className="group-hover:scale-110 transition-transform"

// Fade in
className="animate-fadeIn" // requiere @keyframes fadeIn en CSS global

// Skeleton loading
className="animate-pulse bg-white/[0.05]"
```

### Espaciado

```typescript
// Padding estándar
Componentes: px-6 py-4
Containers: p-6
Espacios: gap-6 space-y-4

// Máximos anchos
Página: max-w-7xl mx-auto
Formulario: max-w-md
Grid 2 col: grid-cols-2 gap-6
Grid 3 col: grid-cols-3 gap-6
```

### Redondeado

```typescript
Botones/Inputs: rounded-xl
Containers: rounded-2xl
Pequeños elementos: rounded-lg
```

---

## Endpoints Consumidos

### Tabla Completa

| Página | Método | Endpoint | Descripción | Query/Body |
|--------|--------|----------|-------------|-----------|
| Login | POST | `/api/auth/check-user` | Verifica si cédula existe | `{ cedula: string }` |
| Login | POST | `/api/auth/login` | Inicia sesión | `{ cedula: string, password: string }` |
| Login | POST | `/api/auth/set-password` | Crea contraseña usuario nuevo | `{ cedula: string, password: string }` |
| Layout | POST | `/api/auth/logout` | Cierra sesión | `` |
| Dashboard | GET | `/api/dashboard` | Datos agregados (KPIs, gráfico, tabla) | `` |
| Asistencia | GET | `/api/asistencia` | Lista historial marcas del usuario | `` |
| Asistencia | POST | `/api/asistencia` | Marca entrada/salida | `{ tipo: "Entrada" \| "Salida" }` |
| Asistente | POST | `/api/ai/agent` | Chat IA (streaming SSE) | `{ pregunta: string }` |
| Documentos | GET | `/api/documentos` | Lista documentos compliance | `?empleado=ID&capitulo=VLC` |
| Documentos | PATCH | `/api/documentos` | Actualiza estado/URL/observaciones | `{ id: string, fields: {...} }` |
| Novedades | GET | `/api/novedades-nomina` | Datos empleado + saldos | `` |
| Novedades | POST | `/api/novedades-nomina` | Envía solicitud vacaciones/permiso | `{ tipo: "vacaciones" \| "permiso", ... }` |
| Horarios | GET | `/api/horarios` | Lista horarios disponibles | `` |
| Horarios | POST | `/api/horarios` | Crea nueva asignación | `{ empleadoId: string, horarioIds: [...] }` |
| Horarios | PATCH | `/api/horarios` | Edita asignación existente | `{ id: string, fields: {...} }` |
| Vinculación | GET | `/api/vinculacion` | Lista personal (Activos/Inactivos/En Proceso) | `?estado=Activo` |
| Vinculación | POST | `/api/vinculacion` | Crea nuevo personal | `{ fields: {...} }` |
| Vinculación | PATCH | `/api/vinculacion` | Edita personal existente | `{ id: string, fields: {...} }` |

---

## Patrones y Convenciones

### Directiva `"use client"`

Todas las páginas interactivas usan `"use client"` (primera línea del archivo) para habilitar:
- Event handlers (`onClick`, `onChange`, etc.)
- Hooks (`useState`, `useEffect`, `useRef`)
- Streaming SSE (`fetch` con `getReader()`)
- Canvas (firma digital)

Ejemplo:
```typescript
"use client";
import { useState } from "react";

export default function MyPage() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Fetch Nativo (sin librerías)

```typescript
// GET simple
const res = await fetch("/api/endpoint");
const data = await res.json();

// POST con body
const res = await fetch("/api/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
});
const data = await res.json();

// Streaming SSE
const res = await fetch("/api/ai/agent", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pregunta })
});
const reader = res.body?.getReader();
while (true) {
  const { done, value } = await reader?.read() || {};
  if (done) break;
  const text = new TextDecoder().decode(value);
  // procesar evento SSE (event: delta, data: {...})
}
```

### Validación de Entrada (Manual)

```typescript
// Validar cédula
if (!cedula || cedula.trim().length < 5) {
  setError("Cédula inválida");
  return;
}

// Validar contraseña
if (password.length < 8) {
  setError("Mínimo 8 caracteres");
  return;
}

// Validar selección
if (!selectedOption) {
  setError("Seleccione una opción");
  return;
}
```

### Estructura de Estado

```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const fetchData = async () => {
  setLoading(true);
  setError("");
  try {
    const res = await fetch("/api/endpoint");
    const json = await res.json();
    setData(json.data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Formateo de Fechas

```typescript
// Locale es-CO
const fecha = new Date();
const formatted = fecha.toLocaleDateString("es-CO", {
  year: "numeric",
  month: "long",
  day: "numeric"
});
// Output: "17 de marzo de 2026"

// Hora
const hora = fecha.toLocaleTimeString("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
// Output: "14:30:45"
```

### Manejo de Errores y Toasts

```typescript
// Error en toast
if (!response.ok) {
  setError("Oops, algo salió mal");
  setTimeout(() => setError(""), 4000);
  return;
}

// Éxito en toast
setSuccess("Operación exitosa");
setTimeout(() => setSuccess(""), 4000);
```

---

## Consideraciones de Seguridad

1. **JWT en Cookie**: La cookie `sirius-auth` es `httpOnly` y `Secure`, protegida contra XSS
2. **Validación del middleware**: Toda solicitud a `/dashboard/*` verifica JWT en el middleware
3. **CORS**: Frontend y backend están en el mismo dominio (monorepo Next.js)
4. **Datos sensibles**: No se almacenan secretos en localStorage o sessionStorage
5. **Canvas (firma)**: Se convierte a base64 en el cliente antes de enviar

---

## Debugging y Testing

### Logs de Desarrollo

```typescript
console.log("DEBUG:", { data, loading, error });
```

### Network Inspector
- Abrir DevTools (F12)
- Tab Network
- Verificar status, response, timing de requests

### LocalStorage (Development only)
```typescript
// Para debug temporal
localStorage.setItem("debug", JSON.stringify({ data }));
```

---

## Referencias

- **CLAUDE.md** — Instrucciones del proyecto
- **src/app/api/** — Backend (route handlers)
- **src/lib/auth.ts** — JWT custom
- **src/lib/airtable.ts** — Integración Airtable
- **Tailwind CSS Docs** — Clases utility
