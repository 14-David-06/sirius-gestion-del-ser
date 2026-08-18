# @sirius/solicitudes

Módulo de solicitudes de Sirius: **permisos, vacaciones y novedades de nómina**.
Trae los formularios, la nota de voz, la firma manuscrita, el calendario, los
planes de compensación y los route handlers que escriben en Airtable.

No trae auth ni almacenamiento. Cada app inyecta esas dos cosas: **cómo resuelve
la sesión** y **dónde archiva firmas y documentos**. Por eso el paquete no depende
del SDK de AWS, y `pdf-lib` es una dependencia **opcional**: si tu app solo monta
los formularios, no instala nada de eso.

Sí trae el **documento oficial del día siriano** —maqueta institucional, logo, QR y
firma de Gestión del Ser—, porque ese permiso nace autorizado y el papel es su
único respaldo: si cada app escribiera el suyo, el mismo permiso saldría con
distinta cara según desde dónde se radicó.

---

## 1. Instalar

Se distribuye en TypeScript, sin paso de build. Tres formas, de menos a más
ceremonia:

```bash
# a) Otro paquete del mismo monorepo
npm i @sirius/solicitudes --workspace=apps/mi-app

# b) Tarball — el flujo normal entre repos distintos. Guárdalo DENTRO del repo
#    consumidor: si el .tgz vive fuera, el `npm ci` del CI o del Docker no lo
#    encuentra y el despliegue falla.
cd packages/solicitudes && npm pack --pack-destination ../../../mi-app/vendor
cd ../../../mi-app && npm i file:vendor/sirius-solicitudes-1.2.0.tgz

# c) Desarrollo en paralelo, con enlace vivo a esta copia de trabajo
npm i file:../sirius-gestion-del-ser/packages/solicitudes
```

⚠️ **(b) es la vía recomendada, no (c).** Un `file:` a otro repositorio deja en
`node_modules` un enlace que apunta **fuera del project root**, y Turbopack se
niega a seguirlo al construir: rompe en `next build` aunque `next dev` funcione.
El tarball no tiene ese problema porque npm copia los archivos dentro del
proyecto. Si necesitas (c) para desarrollar, construye con `next build --webpack`.

`npm i git+…` no sirve: el paquete es un subdirectorio del repositorio y npm solo
instala repos cuya raíz es el paquete. Para fijar una versión, empaqueta el
tarball desde el commit que quieras y guárdalo donde tu app pueda leerlo.

Peers: `next >= 15`, `react >= 19`, `react-dom >= 19`.

### `next.config.ts`

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@sirius/solicitudes"],
};
```

Sin esto Next intenta ejecutar los `.ts` del paquete tal cual y falla al primer
import.

### CSS

Los componentes dependen de las primitivas de la superficie nocturna
(`.glass`, `.campo-oscuro`, `.anim-*`). No están en clases de Tailwind repartidas
por componente **porque al imprimir hay que devolver todas las tarjetas a blanco
sobre negro de un solo golpe**: un permiso con fondo translúcido sale ilegible en
papel. En tu CSS global:

```css
@import "tailwindcss";
@import "@sirius/solicitudes/styles.css";

/* Tailwind ignora node_modules al buscar clases: sin esto los componentes
   salen sin estilos de utilidad. Ajusta la ruta relativa a tu archivo CSS. */
@source "../../node_modules/@sirius/solicitudes/src";
```

El paquete asume texto claro sobre fondo oscuro. Da color de texto por herencia
con `.superficie-noche` en el contenedor de la vista, y ponle un fondo oscuro
(la app de referencia usa una fotografía nocturna). **`text-white/60` es el piso
de contraste**: por debajo, el blanco sobre fondo oscuro baja de 4.5:1.

---

## 2. Lo que tu app tiene que proveer

### 2.1 La sesión

```ts
// lib/sesion.ts
import type { ResolvePayload } from "@sirius/solicitudes/server";

export const resolvePayload: ResolvePayload = async () => {
  // …tu auth. null = sin sesión → los handlers responden 401.
  return { idCore: "SIRIUS-PER-9001", nombre: "…", cedula: "…" };
};
```

⚠️ `idCore` es el identificador canónico del colaborador (`SIRIUS-PER-XXXX`) y la
FK con la que se filtran **todas** las tablas de solicitudes. No pases el record
ID de Airtable: ese solo sirve dentro de la tabla Personal.

### 2.2 El almacenamiento (`SolicitudesInfra`)

Radicar con firma archiva un PNG. El paquete **nunca** lo guarda en Airtable —un
base64 en un campo de texto queda legible para cualquiera con acceso a la
tabla—, así que necesita un adaptador. Ver `@sirius/solicitudes/infra` para los
tipos completos.

```ts
import type { SolicitudesInfra } from "@sirius/solicitudes/infra";
import { crearDiaSirianoInfra } from "@sirius/solicitudes/dia-siriano";

export const infra: SolicitudesInfra = {
  // Obligatorio si tus formularios piden firma.
  async guardarFirma({ base64, cedula, idCore, tipo, metadata }) {
    const { key, uploadedAt } = await miStorage.subir(/* … */);
    return { key, archivadaEn: uploadedAt };   // `key`, no una URL firmada
  },

  // Opcional: copia el archivo en un campo Attachment de Airtable, por comodidad
  // de consulta. Si falla, el handler lo registra y sigue.
  async adjuntar({ recordId, campo, contenido, filename, contentType }) { /* … */ },

  // Opcional: solo si tu app tiene el beneficio de día siriano. El documento lo
  // trae hecho el paquete; tú solo dices dónde archivarlo.
  diaSiriano: crearDiaSirianoInfra({
    archivarDocumento: async ({ pdf, idCore, cedula, fechaPermiso }) => ({
      key, url, filename, sha256,
    }),
  }),
};
```

`crearDiaSirianoInfra` sale de `@sirius/solicitudes/dia-siriano` y necesita dos
cosas del entorno: **`pdf-lib`** (dependencia opcional del paquete: instálala si
usas esta parte) y **`FIRMA_GESTION_SER_BASE64`**, el PNG de la firma
institucional. Un permiso por día siriano nace autorizado, así que el documento no
es un extra: es lo único que acredita la autorización que él mismo declara.

⚠️ Necesita además que tu app **sirva el documento** en
`/api/documentos/permiso/{recordId}` —o donde le digas con `rutaDocumentos`—,
porque el handler guarda ese enlace en Airtable. Y ahí tener sesión no basta: el
PDF lleva el motivo del permiso, la cédula y la firma manuscrita. Mira la sección
7 antes de escribirlo.

Reglas que el adaptador debe respetar:

- **`key` no puede ser una URL firmada.** Es lo que queda escrito en Airtable, y
  una URL firmada expira: el registro se quedaría con un enlace muerto.
- **`firmaInstitucionalBase64()` debe lanzar si no está configurada.** Devolver
  vacío emite un documento sin firma, y el fallo es invisible en el PDF: el papel
  saldría declarando una autorización que no acredita.
- **Sin `diaSiriano`, el handler rechaza (400) las solicitudes de día siriano**, y
  el formulario debe ir con `diaSirianoHabilitado={false}` para no ofrecer un
  camino que termina en error. Nacen autorizadas, y registrar una autorización sin
  documento deja al colaborador con un permiso concedido y nada que lo pruebe.

### 2.3 Dos endpoints que consumen los formularios

Los componentes cliente los llaman por su cuenta. Si no existen, los formularios
se quedan con los campos del colaborador vacíos y el botón de enviar apagado.

| Ruta | Respuesta esperada |
|------|--------------------|
| `GET /api/me` | `{ nombre, cedula, idCore, cargo }` |
| `GET /api/dias-sirianos/saldo` | `{ saldo_disponible: number }` — solo si usas días sirianos |

El del saldo lo trae el paquete: `createDiasSirianosHandlers({ resolvePayload })`
de `@sirius/solicitudes/server`. La forma de esa respuesta es parte del contrato
del formulario, así que no conviene reescribirla — nombrarla distinto deja el saldo
en cero sin ningún error.

Se pueden montar bajo otro prefijo con la prop `apiBasePath`.

---

## 3. Montar las rutas

Un archivo por endpoint, en `app/api/solicitudes/…/route.ts`:

```ts
import { createPermisoHandlers } from "@sirius/solicitudes/server";
import { resolvePayload } from "@/lib/sesion";
import { infra } from "@/lib/infra";

export const { GET, POST } = createPermisoHandlers({ resolvePayload, infra });
```

Igual con `createVacacionesHandlers` y `createNovedadesHandlers` (las novedades
no llevan firma ni documento: no necesitan `infra`).

`GET` devuelve las 20 solicitudes más recientes del colaborador de la sesión;
`POST` crea una y responde `{ ok: true, id }`.

Las credenciales de Airtable salen de `AIRTABLE_BASE_ID_NOVEDADES_NOMINA` /
`AIRTABLE_API_KEY_NOVEDADES_NOMINA` y las tablas de `AIRTABLE_TABLE_*`, o se
pasan explícitas — útil si tu app ya las lleva en su propia config:

```ts
createPermisoHandlers({
  resolvePayload,
  infra,
  airtable: {
    baseId, apiKey,
    // Nombre o ID (tblXXX): el API de Airtable acepta los dos.
    tablas: { permiso: "tbl…", vacaciones: "tbl…", novedades: "tbl…" },
  },
});
```

⚠️ Si se las pasas a los handlers, **pásaselas también a `SolicitudesOverview`**:
lee las tres tablas por su cuenta, y apuntarlo a otras distintas de las que
escriben los handlers deja el historial siempre vacío.

## 4. Montar las páginas

```tsx
// app/solicitudes/page.tsx — server component
import { SolicitudesOverview } from "@sirius/solicitudes";

export default async function Page() {
  const { idCore, nombre } = await miSesion();
  return <SolicitudesOverview idCore={idCore} nombre={nombre} basePath="/solicitudes" />;
}
```

```tsx
// app/solicitudes/permiso/page.tsx — client
import { PermisoForm } from "@sirius/solicitudes";
export default () => <PermisoForm basePath="/solicitudes" diaSirianoHabilitado={false} />;
```

`diaSirianoHabilitado={false}` quita ese tipo de permiso de la lista. Úsalo si tu
app no implementa `infra.diaSiriano`: si no, el colaborador llena el formulario y
recibe un 400 al enviarlo.

`basePath` es el prefijo de las páginas (enlaces internos); `apiBasePath`, el de
los endpoints. Los dos por defecto asumen la estructura de la app de referencia:
`/dashboard/solicitudes` y rutas de API en la raíz.

⚠️ `SolicitudesOverview` es un **server component** y lee Airtable directamente
con las variables de entorno de arriba. `VacacionesForm` y `NovedadesForm`
aceptan las mismas props que `PermisoForm`.

### Componentes sueltos

`VoiceNoteButton` (dictado `es-CO`, Web Speech API — no hay soporte en Firefox),
`FirmaCanvas`, `FirmaSection`, `CalendarioPermiso`, `SelectorFecha`,
`PlanCompensacion`, `AvisoCompensacion`, `TarjetaTilt`, y el sistema de diseño
(`Field`, `FormHeader`, `SubmitButton`, `SuccessCard`, `inputCls`…) para construir
formularios nuevos con la misma cara.

⚠️ El canvas de `FirmaCanvas` se queda **blanco con trazo negro**: ese PNG es el
que va al almacenamiento y al documento oficial. Oscurecerlo deja la firma
invisible en el papel.

## 5. Subrutas del paquete

| Import | Qué trae |
|--------|----------|
| `@sirius/solicitudes` | Componentes y sistema de diseño (cliente) |
| `@sirius/solicitudes/server` | `create*Handlers`, tipos, `TABLES`/`FIELDS`, `escapeAirtableValue` |
| `@sirius/solicitudes/infra` | Los puertos de almacenamiento y documento |
| `@sirius/solicitudes/dia-siriano` | `crearDiaSirianoInfra()` + el generador del documento |
| `@sirius/solicitudes/pdf` | Maqueta institucional, logo, QR, firma de Gestión del Ser |
| `@sirius/solicitudes/compensacion` | Planes de reposición de un permiso compensable |
| `@sirius/solicitudes/fecha` | `fechaBogota()`, `horaBogota()`, `fechaHoyBogota()` |
| `@sirius/solicitudes/festivos` | Festivos de Colombia |
| `@sirius/solicitudes/schema` · `/constants` | Nombres de tablas y campos, enums de negocio |

Los handlers viven en `/server` y no en el barril principal a propósito:
importan `next/server`, y un solo barril arrastraría eso al bundle del navegador
de cualquier página que solo quisiera un formulario.

## 6. Airtable

El paquete espera tres tablas en una base: `Solicitud_Permiso`,
`Solicitud_Vacaciones` y `Reportes Novedades Nomina` (más `Dias_Sirianos` si usas
el beneficio). Los nombres se sobreescriben con variables de entorno y los campos
están en `@sirius/solicitudes/schema` — esa es la fuente única, no strings
literales en tu código.

```bash
AIRTABLE_BASE_ID_NOVEDADES_NOMINA=app…
AIRTABLE_API_KEY_NOVEDADES_NOMINA=pat…
AIRTABLE_TABLE_SOLICITUD_PERMISO=Solicitud_Permiso
AIRTABLE_TABLE_SOLICITUD_VACACIONES=Solicitud_Vacaciones
AIRTABLE_TABLE_NOVEDADES_NOMINA=Reportes Novedades Nomina
AIRTABLE_TABLE_DIAS_SIRIANOS=Dias_Sirianos
```

⚠️ **Tipos de fecha**: `Fecha_Firma_Autorizador` y `Fecha_Autorizacion` son `date`
y rechazan un ISO con hora; `Fecha_Firma_Trabajador` y `Fecha_Firma_Aprobador` son
`dateTime`. Y usa siempre `fechaHoyBogota()`: `new Date().toISOString()` da el día
siguiente después de las 19:00 en Colombia.

## 7. Lo que NO trae

Vive en la app de referencia y no está empaquetado:

- **Autorización de solicitudes** — aprobar/rechazar, el PDF de autorización, el
  dashboard de pendientes.
- **Acceso a documentos** — servir el PDF y la firma con control de acceso. Es la
  pieza delicada: un permiso lleva el motivo (a menudo médico), la cédula y la
  firma manuscrita, así que **tener sesión no es autorización**. Si expones
  documentos, el cliente nunca debe nombrar el archivo (se pide `tipo, recordId,
  clase` y el servidor resuelve la ruta), no se entregan URLs firmadas al
  navegador, y al denegar se responde **404, no 403** — un 403 confirmaría que el
  registro existe.
- **Histórico** y `/api/me`.

La generación de PDF sí está en el paquete (`/pdf` y `/dia-siriano`): lo que la app
aporta es dónde archivar el documento y cómo servirlo.
