# Funcionalidad de Nota de Voz en Solicitudes de Permiso

## Descripción

Se agregó un botón de **nota de voz** en el formulario de solicitud de permiso que permite a los usuarios describir el motivo del permiso mediante voz, utilizando la Web Speech API del navegador.

## Ubicación

- **Ruta**: `/dashboard/solicitudes/permiso`
- **Componente**: `VoiceNoteButton` en `packages/solicitudes/src/components/VoiceNoteButton.tsx`
- **Integración**: `PermisoForm` en `packages/solicitudes/src/components/PermisoForm.tsx`

## Características

### Funcionalidad Principal

1. **Grabación de audio**: El usuario hace clic en el botón "Grabar nota de voz" y comienza a hablar
2. **Transcripción automática**: La Web Speech API transcribe el audio en tiempo real a texto
3. **Inserción en campo**: El texto transcrito se agrega automáticamente al campo "Motivo"
4. **Idioma**: Configurado para español colombiano (`es-CO`)

### Interfaz de Usuario

#### Estados del botón:

| Estado | Color | Icono | Texto |
|--------|-------|-------|-------|
| **Inactivo** | Azul `#1a51a8` | 🎤 Micrófono | "Grabar nota de voz" |
| **Grabando** | Rojo con animación pulse | ⏹️ Cuadrado | "Detener grabación" |
| **Procesando** | Azul con spinner | ⏳ Spinner | "Procesando..." |

### Manejo de Errores

El componente maneja los siguientes casos:

| Error | Mensaje |
|-------|---------|
| **no-speech** | "No se detectó voz. Intenta de nuevo." |
| **not-allowed** | "Permiso de micrófono denegado." |
| **Navegador no compatible** | "Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge." |
| **Otro error** | "Error al procesar el audio. Intenta de nuevo." |

## Compatibilidad

### Navegadores Soportados

- ✅ **Chrome/Chromium** (todas las versiones recientes)
- ✅ **Edge** (todas las versiones recientes)
- ✅ **Opera** (todas las versiones recientes)
- ✅ **Safari** (14.1+)
- ❌ **Firefox** (no soporta Web Speech API nativa)

### Permisos Requeridos

El navegador solicitará permiso de acceso al micrófono la primera vez que se intente usar la funcionalidad.

## Flujo de Uso

```
1. Usuario completa campos básicos (tipo, fechas, etc.)
   ↓
2. Usuario hace clic en "Grabar nota de voz"
   ↓
3. Navegador solicita permiso de micrófono (primera vez)
   ↓
4. Usuario concede permiso y habla
   ↓
5. Usuario hace clic en "Detener grabación" o deja de hablar
   ↓
6. Transcripción se agrega al campo "Motivo" automáticamente
   ↓
7. Usuario puede editar el texto manualmente si es necesario
   ↓
8. Usuario envía el formulario normalmente
```

## Implementación Técnica

### API Utilizada

**Web Speech API** - `SpeechRecognition`

```typescript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.lang = "es-CO"; // Español colombiano
recognition.continuous = false; // Se detiene automáticamente
recognition.interimResults = false; // Solo resultados finales
```

### Componente Principal

**`VoiceNoteButton`** - Componente client-side reutilizable

**Props:**
- `onTranscript: (text: string) => void` - Callback con el texto transcrito
- `disabled?: boolean` - Desactiva el botón (ej: durante el envío del formulario)

**Ejemplo de uso:**

```tsx
<VoiceNoteButton
  onTranscript={(transcript) => {
    setMotivo((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }}
  disabled={loading}
/>
```

### Integración con Formulario

El botón se ubica **encima** del campo de texto "Motivo", permitiendo:
- Transcribir el motivo completo por voz
- Editar manualmente el texto transcrito
- Agregar más texto por voz múltiples veces (se concatena)

## Ventajas

1. **Accesibilidad**: Facilita la entrada de texto para usuarios con dificultades de escritura
2. **Rapidez**: Más rápido que escribir en dispositivos móviles
3. **Comodidad**: Útil cuando el usuario está en movimiento o tiene las manos ocupadas
4. **No requiere servicios externos**: Utiliza capacidades nativas del navegador (sin costos de API)

## Limitaciones

1. **Dependencia del navegador**: Solo funciona en navegadores compatibles (principalmente Chromium)
2. **Requiere conexión a internet**: La transcripción se procesa en servidores de Google (Chrome) o Apple (Safari)
3. **Precisión variable**: La calidad de la transcripción depende de:
   - Calidad del micrófono
   - Ruido ambiental
   - Claridad del habla del usuario
   - Acento regional
4. **No es obligatorio**: El usuario siempre puede optar por escribir manualmente

## Mejoras Futuras Posibles

- [ ] Agregar nota de voz en otros formularios (vacaciones, novedades)
- [ ] Soporte para transcripción offline (local)
- [ ] Integración con Claude API para mejorar la transcripción y formato
- [ ] Guardar el audio original como archivo adjunto
- [ ] Mostrar transcripción en tiempo real (resultados interinos)
- [ ] Permitir pausar y reanudar la grabación

## Testing

### Testing Manual

1. Abrir `/dashboard/solicitudes/permiso`
2. Hacer clic en "Grabar nota de voz"
3. Conceder permiso de micrófono si se solicita
4. Hablar claramente describiendo un motivo de permiso
5. Detener la grabación
6. Verificar que el texto aparece en el campo "Motivo"
7. Editar el texto si es necesario
8. Enviar el formulario normalmente

### Casos de Prueba

| Caso | Resultado Esperado |
|------|-------------------|
| **Click en botón** | Solicita permiso y comienza grabación |
| **Hablar por 3 segundos** | Transcribe correctamente |
| **Ruido de fondo** | Transcripción con errores o mensaje "No se detectó voz" |
| **Denegar permiso** | Muestra mensaje "Permiso de micrófono denegado" |
| **Firefox** | Muestra mensaje "Tu navegador no soporta..." |
| **Múltiples grabaciones** | Concatena textos correctamente |
| **Editar después de transcribir** | Permite edición manual normal |

## Archivos Modificados

- ✅ `packages/solicitudes/src/components/VoiceNoteButton.tsx` - Componente nuevo
- ✅ `packages/solicitudes/src/components/PermisoForm.tsx` - Integración del botón
- ✅ `packages/solicitudes/src/index.ts` - Export del componente

## Build Status

✅ **Build limpio** - `npm run build` exitoso sin errores
✅ **Lint limpio** - Sin advertencias de ESLint
✅ **TypeScript** - Sin errores de tipos

---

**Fecha de implementación**: 2026-07-07  
**Implementado por**: Claude Code (Sonnet 4.5)
