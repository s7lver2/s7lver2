# Admin panel — chasis y ventana de lectura (Spec 1 de 5)

**Objetivo:** sustituir el lenguaje visual del panel de administración, que hoy es
un disfraz de TUI aplicado uniformemente a las 9 páginas, por un sistema con una
regla sostenible: el chasis tiene materia, la lectura no.

**Arquitectura:** el panel se compone como un aparato. El cromo (marco, nav,
interruptores, lámparas, statusline) es chasis y recibe tratamiento material.
Los datos y el texto viven en una ventana de lectura hundida y son planos. El
seam es `app/admin/components/ui.tsx`: al reemplazar esas primitivas, las 9
páginas heredan el lenguaje nuevo sin reescribir su contenido.

**Stack:** Next.js 14.1 App Router, React 18, TypeScript, estilos inline con
tokens en objeto (patrón ya establecido en el panel), SSE existente en
`/api/admin/stream`.

---

## Contexto: por qué se cambia

El panel actual aplica el mismo tratamiento a todo: etiquetas `[ EN CORCHETES ]`,
un `$ ` delante de cada título, JetBrains Mono en absolutamente todo el texto, y
caps espaciadas en cada etiqueta pequeña. `.claude/CLAUDE.md` marca dos de esas
decisiones como slop explícito ("monospace as the house voice", "one label
treatment, everywhere"). A eso se suman siete iconos unicode genéricos
(`◈ ⊙ ◫ @ ◇ ⊟ ⚙`) haciendo de iconografía, una barra indicadora con
`boxShadow: 0 0 8px` (el tell de barra de acento con glow), y un fondo `#05000a`
que es un negro morado sin relación con nada.

El panel es una pieza de escaparate: se va a enseñar. Eso hace que los estados
vacíos sean tan importantes como los llenos, y hoy son lo peor del panel — una
tarjeta con etiqueta y nada dentro se lee como roto, no como cero.

---

## Alcance

### Dentro de este spec

- La regla chasis/lectura y sus tokens.
- Reemplazo de las primitivas de `app/admin/components/ui.tsx`.
- El shell: `app/admin/layout.tsx`, `AdminSidebar.tsx`, `StatusLine.tsx`.
- El cromo flotante del shell: `AdminPalette.tsx` y `ToastHost.tsx`.
- El anillo de foco, que hoy no existe.
- Reorganización y reetiquetado de la nav.
- El interruptor de mantenimiento como control (escribe el flag existente).
- La página de login y su secuencia de arranque.
- El patrón de estado vacío, aplicado a los KPI existentes.
- La página de especímenes tipográficos y la elección de familia.

### Fuera de este spec (cada uno con su ciclo)

- **Spec 2 — Mantenimiento:** que `flags.maintenance` haga algo de verdad
  (503 en el sitio público, página de mantenimiento, bypass para sesión admin).
  Este spec solo construye el control que escribe el flag.
- **Spec 3 — Perfiles:** banner, avatar, bio, campos públicos de admin.
  `bannerUrl` ya existe en el modelo y no se usa en ningún sitio.
- **Spec 4 — Proyectos y Redes:** el patrón de tiras de canal para las páginas de
  gestión. Este spec no toca el layout interno de esas dos páginas.
- **Spec 5 — Estadísticas:** gráficos, representación y realtime en la página de
  visitantes e interacción.

El corte es deliberado: este spec cambia el lenguaje y el shell, no el contenido
de las páginas. Cada página quedará con su layout actual dentro del chasis nuevo
y con las primitivas nuevas, lo cual es un estado coherente y desplegable.

---

## Global Constraints

Requisitos que aplican a todas las tareas de este spec:

- **Ninguna sombra sobre texto o datos.** Ni `box-shadow`, ni `text-shadow`, ni
  `filter: blur`, ni glow, en ningún elemento que contenga texto o cifras.
- **Cero `box-shadow` para relieve.** El chasis y las placas consiguen su relieve
  exclusivamente con elevación tonal y bordes del color de la propia superficie.
  Sólo se permite `box-shadow` en tres casos, y en ninguno como halo:
  1. El anillo de foco (`:focus-visible`), que es funcional y obligatorio.
  2. La paleta de comandos, que flota de verdad sobre el contenido.
  3. Los toasts, por lo mismo.
  En los casos 2 y 3 la sombra es corta, direccional y tintada al color de la
  superficie — nunca un bloom negro simétrico. La actual
  (`0 20px 60px rgba(0,0,0,.5)`) es exactamente lo que hay que sustituir.
- **Anillo de foco visible en todo control interactivo.** La clase
  `.admin-focusable` se aplica hoy en cuatro sitios y no está definida en ningún
  CSS: el panel no tiene foco visible en absoluto. Este spec la define de verdad
  o la sustituye por `:focus-visible` en las primitivas.
- **Ningún icono unicode como iconografía.** Los siete actuales se eliminan. Las
  etiquetas de nav son palabras.
- **Mono solo donde el contenido es dato.** Cifras, timestamps, IPs, hashes.
  Prohibida en etiquetas, botones, kickers, títulos y texto de ayuda.
- **Nada de `[ CORCHETES ]` ni `$ ` como decoración de etiqueta.**
- **Contenido visible por defecto.** Ningún texto ni control puede empezar en
  `opacity: 0` dependiendo de una animación o de JavaScript para aparecer.
- **`prefers-reduced-motion: reduce` desactiva toda animación de arranque y
  transición de placa.** Las lámparas siguen actualizando su color.
- **Sin `!important`** salvo donde haya que vencer a una animación CSS en curso,
  y con comentario que lo justifique.
- **Español** en toda la copy visible del panel, en minúscula de frase.

---

## Estructura de ficheros

| Fichero | Acción |
| --- | --- |
| `app/admin/components/tokens.ts` | **Crear.** Tokens del chasis y la lectura. Reemplaza el objeto `T` de `ui.tsx`. |
| `app/admin/components/ui.tsx` | **Reescribir.** Primitivas nuevas; mantiene `DirtyProvider`/`useDirty` tal cual. |
| `app/admin/components/AdminSidebar.tsx` | **Reescribir.** Placas físicas, nav plana, sin iconos, sin barra con glow. |
| `app/admin/components/StatusLine.tsx` | **Modificar.** Reskin como tira de chasis. |
| `app/admin/components/AdminPalette.tsx` | **Modificar.** Retipar y sustituir `0 20px 60px rgba(0,0,0,.5)` por una sombra corta y tintada. |
| `app/admin/components/ToastHost.tsx` | **Modificar.** Lo mismo, y quitar el `backdropFilter: blur(10px)`. |
| `app/admin/layout.tsx` | **Modificar.** Marco de chasis, cabecera con lámpara y placa de cuenta. |
| `app/admin/login/page.tsx` | **Reescribir.** Secuencia de arranque + formulario siempre usable. |
| `app/admin/components/Breaker.tsx` | **Crear.** El interruptor con tapa de guarda. |
| `app/admin/config/page.tsx` | **Modificar.** Aloja el `Breaker`. |
| `app/admin/specimens/page.tsx` | **Crear, temporal.** Página de especímenes. Se borra al elegir familia. |
| `public/fonts/` | **Añadir.** Los `.woff2` de la familia elegida. |
| `app/admin/components/KPICard.tsx` | **Modificar.** Estado vacío como lectura en reposo. |

---

## Tipografía

Ninguna de las candidatas está en un CDN accesible, así que la elección exige
descargarlas y verlas renderizadas. `.claude/CLAUDE.md` lo pide explícitamente
("View candidates rendered before picking") y también prohíbe nombrar familias de
memoria, por eso las tres están verificadas contra la fuente.

### Candidatas (todas SIL OFL 1.1, todas de Velvetyne)

| Familia | Autor | Carácter | Estilos |
| --- | --- | --- | --- |
| **Format 1452** | Frank Adebiaye | Geométrica condensada modular, sin correcciones ópticas deliberadamente, tipo DIN | 1 peso |
| **Sligoil** | Ariel Martín Pérez | Mono con inktraps grandes, hecha para la UI del juego *Unknown Number* | Micro, Micro Medium, Micro Bold |
| **Karrik** | Morizot / Le Bihan | Grotesca brutalista que conserva desajustes de peso y anchos irregulares | Regular, Italic, SS01 |

### Reparto de roles propuesto

- **Chasis** (títulos, etiquetas de nav, etiquetas de control): Format 1452.
  Un solo peso, así que la jerarquía sale de tamaño, caja y color — nunca de
  pesos, que no existen.
- **Lectura numérica** (cifras, timestamps, duraciones, IPs): Sligoil Micro.
- **Cuerpo** (texto de ayuda, descripciones, mensajes de error): `system-ui`.

**Riesgo declarado:** tres familias es donde `CLAUDE.md` avisa de incoherencia.
Lo que lo sostiene es que los roles no se solapan en ningún sitio y que Format
1452 y Sligoil comparten filosofía (técnicas con imperfección deliberada).
**Plan B si al ver los especímenes no cuaja:** eliminar Sligoil y poner las cifras
también en Format 1452, usando `font-variant-numeric: tabular-nums` para
conservar la alineación en columnas de datos.

### Puerta de decisión

La familia se elige viendo la página de especímenes con texto real del panel
(cifras de 1 a 6 dígitos, timestamps, nombres de repo, etiquetas de nav) a los
tamaños reales de uso. Ninguna tarea de UI empieza antes de esa elección.

---

## Tokens

`app/admin/components/tokens.ts` exporta un único objeto. Valores exactos:

```ts
export const C = {
  // Chasis — todo lo que tiene materia
  chassis:     '#101013',
  plate:       '#16161a',
  plateActive: '#c9c9d2',
  onPlateActive: '#0a0a0f',
  lip:         'rgba(255,255,255,.14)',
  edge:        'rgba(255,255,255,.09)',

  // Ventana de lectura — hundida y plana
  readout:     '#08080a',
  readoutEdge: 'rgba(255,255,255,.05)',
  readoutTop:  'rgba(0,0,0,.9)',

  // Tinta sobre lectura
  ink:   '#ffffff',
  ink80: 'rgba(255,255,255,.8)',
  ink50: 'rgba(255,255,255,.5)',
  ink30: 'rgba(255,255,255,.3)',

  // Semántico — nunca decorativo
  live:   '#5eead4',
  ok:     '#22c55e',
  warn:   '#d97706',
  warnInk:'#fbbf24',
  danger: '#f87171',
  data:   '#8b5cf6',
} as const;
```

### La regla del borde superior

Es el mecanismo entero del relieve y no usa una sola sombra:

- **Pieza realzada** (chasis, placa, tira): `border: 1px solid C.edge` con
  `border-top-color: C.lip`. El borde superior más claro lee como un labio que
  atrapa la luz.
- **Pieza hundida** (ventana de lectura): `border: 1px solid C.readoutEdge` con
  `border-top-color: C.readoutTop`. El borde superior más oscuro invierte la
  lectura y hunde la pieza.

Una sola línea de código distingue realzado de hundido, y ninguna de las dos
toca el texto.

### Uso del acento

`C.data` (morado) aparece únicamente en trazos de gráfico. `C.live` (teal) solo
cuando algo está genuinamente ocurriendo ahora (visitantes en línea). `C.ok`
solo en la lámpara de estado del sitio. `C.warn` solo cuando mantenimiento está
activo. Ninguno de ellos se usa en etiquetas, bordes decorativos ni títulos.

---

## Primitivas (`ui.tsx`)

Se conserva `DirtyProvider` / `useDirty` sin cambios: la statusline sigue siendo
la fuente única de "en qué estado estoy".

| Primitiva | Reemplaza a | Comportamiento |
| --- | --- | --- |
| `Readout` | `Panel` | Ventana hundida. Sin etiqueta en corchetes; el título va fuera, encima, como etiqueta de chasis. |
| `Plate` | — | Pieza de chasis realzada. Base de nav, tiras y grupos de control. |
| `Head` | `SectionHead` | Título de página. Sin `$ ` y sin kicker mono. |
| `Field` | `Field` | Igual en API. Fondo `C.readout`, borde hundido, valor en la familia de lectura. |
| `Btn` | `Btn` | Placa realzada. `tone`: `plate` (defecto), `primary`, `danger`. Sin cambio de posición en hover. |
| `Lamp` | — | Punto de estado de 7px. `state`: `off`, `ok`, `live`, `warn`. Color plano, sin glow ni pulso. |
| `Kbd` | `Kbd` | Igual, retipado. |

`Btn` no se mueve en hover. `CLAUDE.md` marca el lift como slop; el cambio de
estado es tonal (la placa sube de valor).

---

## El shell

### Marco

`app/admin/layout.tsx` envuelve todo en un chasis: fondo `C.chassis`, separado
del viewport, con borde realzado. Sustituye el `background: '#05000a'` actual.

### Cabecera

Una tira de chasis con, de izquierda a derecha: la marca `s7lver`, la
designación `unidad de control · v6` en `C.ink30`, un espaciador flexible, la
lámpara de estado del sitio con su etiqueta, y la placa de la cuenta del usuario
(avatar + nombre) que enlaza a `/admin/account`.

La cuenta vive en la cabecera y no en la nav a propósito: no es una sección del
panel, es quién eres. Además prepara el terreno para el Spec 3.

### Nav

Siete placas, plana, sin encabezados de grupo. Los tres grupos actuales
(`Analytics` / `Contenido` / `Sistema`) desaparecen: siete elementos no necesitan
que los reparta en tres cajones.

| Etiqueta | Ruta | Cambio |
| --- | --- | --- |
| Visitantes | `/admin` | Renombrada desde "Analytics" |
| Interacción | `/admin/engagement` | Renombrada desde "Engagement" |
| Proyectos | `/admin/content/projects` | — |
| Redes | `/admin/content/socials` | — |
| Usuarios | `/admin/users` | Renombrada desde "Users" |
| Registro | `/admin/audit` | Renombrada desde "Audit" |
| Sistema | `/admin/config` | Renombrada desde "Configuración" |

Ninguna ruta cambia. Solo etiquetas, orden y tratamiento.

Estado activo: placa realzada clara (`C.plateActive` con texto
`C.onPlateActive`). Estado inactivo: placa hundida oscura (`C.plate` con borde
realzado). **Se elimina la barra indicadora deslizante con `boxShadow`**: el
estado activo lo lleva la propia placa, que es lo que hace un botón físico.

### Statusline

Se mantiene, reskinneada como tira de chasis al pie. Contenido actual (ruta,
estado dirty, renderer) más el intervalo del SSE.

---

## El interruptor

`app/admin/components/Breaker.tsx`, en `/admin/config`. Es la única pieza de
geometría a medida de todo el panel — el resto son rectángulos con radio.

**Anatomía:** un cuerpo vertical de chasis con una tapa de guarda que cubre la
palanca. La tapa está cerrada por defecto.

**Interacción, dos gestos deliberados:**

1. Clic en la tapa: se levanta y deja la palanca accesible. El estado sigue sin
   cambiar.
2. Clic en la palanca: acciona. `PATCH /api/admin/settings` con
   `flags.maintenance`.

No hay modal de confirmación. El gesto físico de dos pasos *es* la confirmación,
y es mejor que un diálogo porque no se puede despachar por reflejo.

**Estados:**

- **Cerrado / inactivo:** tapa abajo, palanca en reposo, cuerpo en `C.plate`.
- **Abierto / inactivo:** tapa levantada, palanca abajo, cuerpo en `C.plate`.
- **Activo:** palanca arriba, cuerpo y borde en `C.warn`, etiqueta en
  `C.warnInk`, y **la lámpara de la cabecera pasa a `warn` en todo el panel**.
- **En vuelo:** la palanca queda a medio recorrido hasta que la petición
  resuelve. Si falla, vuelve a su posición y aparece el error bajo el control.

La tapa se cierra sola al salir de la página.

**Límite de alcance:** este control escribe el flag. Que el flag produzca un 503
en el sitio público es el Spec 2. El control indica lo que el flag *significa*
("el sitio público responde 503") porque eso es su contrato, aunque el efecto se
implemente después. Hasta entonces el control es honesto sobre su estado: el
flag queda escrito y persistido, y se puede verificar leyendo `/api/flags`.

---

## El login

`app/admin/login/page.tsx`. La máquina arranca.

**Secuencia, ~700 ms en total, toda sobre el chasis:**

1. `0–200 ms`: el borde del chasis se traza desde el centro hacia los cantos.
2. `200–450 ms`: las tres lámparas barren de izquierda a derecha y se asientan
   en `C.live`.
3. `450–700 ms`: la ventana de lectura pasa de negro a `C.readout` y aparece su
   borde hundido.

**Restricción no negociable:** el formulario (campos, botón, mensajes) está en su
estado final y es usable desde el primer paint. La secuencia anima el chasis
alrededor. Si el JavaScript no carga, si la pestaña está en segundo plano, o si
la animación no llega a ejecutarse, el login **funciona igual**. Esto es la
trampa del contenido invisible de `CLAUDE.md`, que ya ha producido secciones en
blanco en este proyecto.

**Éxito:** la lámpara pasa a `C.ok` y el chasis se destraba — una transición
única y rápida (≤ 260 ms) hacia el panel. Sin fade a blanco, sin spinner.

**Fallo:** un rechazo mecánico corto — un desplazamiento de 6 px que vuelve, la
lámpara a `C.warn`, y el mensaje bajo el campo. **Sin shake oscilante y sin
borde rojo**, que es el patrón por defecto de todas partes.

`prefers-reduced-motion`: la secuencia no se ejecuta; el login aparece en su
estado final. El éxito y el fallo cambian el color de la lámpara sin movimiento.

---

## Estados vacíos

La regla: **el cero es una lectura, no un error.**

Aplicada a `KPICard.tsx` y a cualquier tarjeta con un valor numérico:

- El valor `0` se dibuja con la misma tipografía y el mismo tamaño que cualquier
  otra cifra, en `C.ink50` en vez de `C.ink`. Se ve que es cero, no que falta.
- Debajo, la línea base del gráfico se dibuja **siempre**, con un trazo de 2 px
  en reposo sobre ella. Una aguja asentada en el cero, no un hueco.
- La leyenda dice qué es (`aguja en reposo`), no se disculpa
  (`sin datos todavía`).
- Las cifras pequeñas reales (104 visitas, 2 países) se ponen grandes y con
  seguridad. Un número pequeño puesto con convicción es un hecho; el mismo
  número escondido parece una carencia.

Esto es lo que más cambia el panel como pieza de escaparate, porque los datos
reales del proyecto son pequeños y hoy se ven como fallos de carga.

---

## Movimiento

| Elemento | Duración | Curva |
| --- | --- | --- |
| Transición de placa (hover, activa) | 160 ms | `ease-out` |
| Tapa del interruptor | 220 ms | `cubic-bezier(.16,1,.3,1)` |
| Palanca del interruptor | 180 ms | `ease-out` |
| Secuencia de arranque del login | 700 ms | por tramos, ver arriba |
| Destrabe al autenticar | 260 ms | `cubic-bezier(.16,1,.3,1)` |
| Cambio de color de lámpara | 200 ms | `ease-out` |

Ninguna animación es infinita. No hay pulsos, ni respiraciones, ni glows
expansivos. Las lámparas cambian de color cuando cambia el estado y se quedan
quietas.

---

## Flujo de datos

Sin endpoints nuevos.

- **Lámpara de estado del sitio:** derivada de `flags.maintenance` vía
  `/api/flags`. `ok` cuando está en línea, `warn` cuando está en mantenimiento.
- **Contador de visitantes en línea de la cabecera:** el SSE existente
  `/api/admin/stream` (tick de 3 s). El sidebar actual hace polling a
  `/api/admin/stats` cada 15 s; se sustituye por el SSE, que ya está montado y da
  datos más frescos con menos peticiones.
- **El interruptor:** `PATCH /api/admin/settings` sobre `flags.maintenance`, que
  ya acepta ese campo.

---

## Qué se elimina

- El objeto `T` de `ui.tsx` (reemplazado por `tokens.ts`).
- Los siete iconos unicode de `AdminSidebar.tsx`.
- La barra indicadora deslizante con `boxShadow: 0 0 8px`.
- Los tres encabezados de grupo de la nav.
- Las etiquetas `[ EN CORCHETES ]` de `Panel`.
- El prefijo `$ ` y el kicker mono de `SectionHead`.
- `background: '#05000a'` en `layout.tsx`.
- `app/admin/specimens/page.tsx`, una vez elegida la familia.

---

## Verificación

Cada tarea se verifica en el navegador contra el servidor de desarrollo, no solo
con `tsc`. Comprobaciones obligatorias antes de dar por cerrada la última tarea:

1. `npx tsc --noEmit` limpio y `npm run build` limpio.
2. Las 9 páginas del panel cargan sin errores de consola.
3. **Búsqueda de `box-shadow` / `boxShadow` en `app/admin/`.** Los únicos
   resultados admisibles son el anillo de foco, la paleta y los toasts. Cualquier
   sombra en una placa, un plato de nav, una tarjeta o el chasis es un fallo.
4. **Foco visible con teclado:** tabular por el panel muestra un anillo en cada
   control. Antes de este spec no se ve ninguno.
5. Con JavaScript desactivado, el formulario de login es visible y usable.
6. Con `prefers-reduced-motion: reduce` forzado, ninguna animación de arranque
   se ejecuta y el panel es plenamente usable.
7. El interruptor accionado persiste: `/api/flags` devuelve
   `maintenance: true` tras recargar.
8. La tapa del interruptor requiere dos clics para accionar.
9. Un KPI con valor 0 muestra el cero y su línea base, no una caja vacía.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Tres familias tipográficas leen como incoherencia | Roles estrictos sin solape; plan B de dos familias ya definido |
| Format 1452 tiene un solo peso y la jerarquía se queda plana | Jerarquía por tamaño, caja y color; se valida en la página de especímenes antes de comprometerse |
| El lenguaje físico degenera en esqueumorfismo feo | Los efectos no pueden tocar texto por regla; cero `box-shadow` verificado con búsqueda |
| Las páginas quedan con su layout viejo dentro del chasis nuevo | Aceptado y deliberado: heredan las primitivas, y su layout es el objeto de los specs 4 y 5 |
| El interruptor promete un 503 que aún no existe | El flag se escribe y persiste de verdad; el efecto llega en el Spec 2, que va inmediatamente después |
