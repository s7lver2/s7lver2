# Rediseño v4 — Design Spec (aprobado vía mockups)

**Fecha:** 2026-06-20
**Estado:** Diseño aprobado vía mockups · listo para plan de implementación
**Continúa:** `2026-06-19-portfolio-redesign-v3-design.md`. La v3 dejó hero (orbs+scroll), languages, projects, social proxy y ⌘K command center. Esta v4 añade interacción de skills↔máquinas, carrusel de máquinas HTB, timeline lateral, ajuste del ⌘K, una **capa de contenido en KV** y la **ampliación del panel admin**.
**Stack:** Next.js 14.1 (App Router) · TypeScript · React 18 · Tailwind 3.3 · Upstash Redis (KV). **Sin librerías nuevas** — el mapa de visitantes del admin se dibuja con un **SVG propio** (blips por lat/lon), no se añade dependencia de mapas.

---

## 0. Motivación

Tras la v3, el usuario pide: (1) animar la sección de skills con hover que oscurece todo menos la skill enfocada y resalta las máquinas que tocan ese concepto; (2) un carrusel infinito de últimas máquinas HTB resueltas con sus conceptos; (3) un timeline lateral de progreso al hacer scroll; (4) mover el ASCII del ⌘K a la izquierda (como social); (5) ampliar el panel admin (gestor de contenido, más analíticas, seguridad/ajustes).

Esto implica una **capa de contenido** nueva: hoy proyectos/skills/redes están hardcodeados en los componentes; pasan a leerse de KV para que el admin pueda editarlos.

Se hace **un solo spec** cubriendo todo; el plan empezará por la capa de datos.

---

## 1. Arquitectura de datos

### 1.1 Contenido editable (KV)
- Almacenamiento: **Upstash Redis** reutilizando `app/lib/redis.ts` (`kvGetJSON(key, file, def)` / `kvSetJSON(key, file, value)`), que ya usa el analytics. Compatible con Vercel (HTTP serverless); fallback a archivos locales en dev. **Sin infra nueva.**
- Claves KV:
  - `content:projects` → `Project[]`
  - `content:skills` → `SkillAxis[]` (6 ejes: name, value 0-1, color, tools, conceptKey)
  - `content:socials` → `Social[]`
  - `content:home` → `{ heroTitle, heroSubtitle, chips?... }` (textos de la home)
- **Lectura pública:** route handlers `GET /api/content/projects`, `/api/content/skills`, `/api/content/socials`, `/api/content/home` (cacheados con `s-maxage`). Los componentes públicos (`Projects`, `Skills`, `Social`, `Hero`) pasan a consumir estos endpoints, con **fallback a los valores hardcodeados actuales** si KV está vacío (primera vez / sin datos).
- **Escritura (admin):** `POST/PUT /api/admin/content/<tipo>` protegidos por la auth admin existente; escriben con `kvSetJSON` y registran en el audit log existente (`app/lib/audit.ts`).
- **Seed:** un script/iniciación que vuelca los valores hardcodeados actuales a KV la primera vez (o el fallback lo cubre hasta que el admin guarde).

### 1.2 Máquinas HTB (carrusel + hover de skills)
- **Fuente A — owns recientes:** ampliar el proxy `app/api/htb/route.ts` para incluir la **HTB activity API** (`/api/v4/user/profile/activity/{id}`), devolviendo las últimas máquinas resueltas: `{ name, date, difficulty, os, machineAvatar? }`.
- **Fuente B — conceptos:** **snapshot vendorizado** de htbmachines en `public/data/htbmachines.json`. La API sucesora (hackingvault) está tras Cloudflare → no se puede fetchear en vivo de forma fiable; por eso se vendoriza. Esquema por máquina (de htbmachines): `{ name, so, dificultad, skills, youtube, activeDirectory?, bufferOverflow? }` donde `skills` es un string de técnicas separadas por espacios/comas.
  - Un script `scripts/fetch-htbmachines.mjs` (manual, no en runtime) regenera el snapshot desde la fuente cuando se quiera actualizar. Documentado.
- **Cruce:** en el servidor (route handler `GET /api/htb/machines`), por cada own reciente (Fuente A) se busca la máquina por `name` (case-insensitive) en el snapshot (Fuente B) y se fusiona: `{ name, difficulty, os, date, concepts: string[], conceptKeys: ConceptKey[], youtube? }`.
  - `concepts`: lista legible (tags mostrados en la card).
  - `conceptKeys`: mapeo de las skills de la máquina a los 6 ejes del radar (`web | net | recon | ad | rev | crypto`), mediante una tabla de palabras-clave → eje (en `app/lib/htb-concepts.ts`). Esto es lo que conecta el hover.
  - Si una máquina reciente no está en el snapshot: se muestra igual con su `difficulty/os` de la Fuente A y `concepts: []` (degradación elegante).
- Cacheado con `s-maxage` (las owns cambian poco).

### 1.3 Eventos de analítica nuevos
- Nuevos eventos a KV (mismo patrón que las visitas): `cmdk_open`, `terminal_cmd` (+comando), `scroll_depth` (sección + %), `project_click`. Endpoint `POST /api/event` (ligero, fire-and-forget desde el cliente). Agregados por el admin.

### 1.4 Mapeo concepto → eje (tabla)
`app/lib/htb-concepts.ts` exporta `CONCEPT_AXES: Record<ConceptKey, string[]>` con las palabras clave de las `skills` de htbmachines que cuentan para cada eje. Ej.: `web` ← ['sqli','xss','lfi','rce','web','upload'], `ad` ← ['active directory','kerberos','bloodhound','ntlm'], `crypto` ← ['crypto','hash','rsa'], etc. La función `skillsToAxisKeys(skills: string): ConceptKey[]` normaliza y devuelve los ejes tocados.

---

## 2. Sitio público

### 2.1 Skills — animación + hover-dim bidireccional
- La sección Skills (`Skills.tsx`) lee los ejes de `/api/content/skills` (fallback a los actuales) y las máquinas de `/api/htb/machines`.
- **Hover sobre una skill** (fila de leyenda o vértice/punto del radar): se aplica un estado activo (`data-active=<conceptKey>`) al contenedor de la sección que:
  - atenúa (`opacity ~.22`) las **otras** filas de leyenda y los **otros** vértices/líneas del radar; resalta la activa (acento + leve glow).
  - en el carrusel de abajo, **resalta** las máquinas cuyo `conceptKeys` incluye ese eje y **atenúa** (grayscale + opacity) las que no.
- **Hover sobre una máquina del carrusel:** resalta en el radar/leyenda los ejes (`conceptKeys`) que esa máquina toca; el carrusel se pausa (ver 2.2).
- La animación de entrada del polígono del radar (ya existente) se mantiene.
- `prefers-reduced-motion`: sin transiciones de atenuación abruptas (cambios instantáneos), sin glow pulsante.

### 2.2 Carrusel de máquinas HTB (infinito)
- **Debajo** del radar de skills, dentro de la misma sección (`#skills`). Eyebrow propio (p.ej. `$ htb --recent`).
- **Marquee infinito** (contenido duplicado, `translateX(-50%)`, `will-change: transform`), **pausa al hover** de la pista — imprescindible para que el hover-dim de 2.1 sea usable (al detenerte sobre una card, la pista se para).
- Cada card: nombre, badge de **dificultad** con color (Fácil verde, Media amarillo, Difícil naranja, Insane rojo), **OS** (Linux/Windows), **conceptos** como tags, fecha de own, `✓ pwned`, y link al **writeup** (`youtube`) si existe. Borde superior teñido por color (por dificultad u OS).
- Datos de `/api/htb/machines`. Si falla, la sección muestra solo el radar (el carrusel se omite, sin romper).
- `prefers-reduced-motion` y móvil: marquee estático con scroll horizontal por arrastre/scroll-snap (sin animación automática).
- Componente: **`app/components/sections/Machines.tsx`** (componente propio) que recibe `activeConcept` y `onHover` para el enlace bidireccional, montado **dentro** de la sección Skills (`#skills`). El estado `activeConcept` y los handlers viven en `Skills.tsx` y se comparten con `Machines.tsx`.

### 2.3 Timeline lateral de progreso
- Componente nuevo `app/components/ProgressRail.tsx`, montado global (en `page.tsx`).
- **Fijo en el lateral izquierdo**, aparece al **bajar del hero** (oculto mientras el hero está en viewport), con los nodos de las secciones (Home, Skills, Languages, Projects, HackTheBox, GitHub, Contact).
- **Labels al hover** (por defecto solo se ven los puntos; al pasar el ratón aparece el nombre de cada sección). Click en un nodo → `scrollIntoView` a esa sección.
- Nodo **activo** resaltado (azul); nodos ya pasados marcados (morado). **Barra de progreso** vertical que se llena según el scroll de la página.
- Detección de sección activa con `IntersectionObserver` (reutilizable con el scroll-spy del navbar).
- **Oculto en móvil** (`< ~900px`) y bajo `prefers-reduced-motion` se mantiene estático (sin animación de relleno suave, salto directo).

### 2.4 ⌘K — ASCII a la izquierda (2 columnas)
- En `CommandPalette.tsx`, la pestaña **navigate** pasa de apilar (buscador / ASCII / lista en columna) a un **cuerpo de 2 columnas** como el fastfetch de Social: **buscador arriba** (ancho completo), debajo **ASCII a la izquierda** (~230px) + **lista de secciones a la derecha**, **hints abajo**.
- La pestaña terminal y la lógica (navegación, ASCII aleatorio de `/public/art`, atajos) no cambian. Solo el layout de la pestaña navigate y su CSS (`.ccbody` a `display:flex` de 2 columnas; en móvil colapsa a 1).

### 2.5 Componentes públicos → consumir KV
- `Projects.tsx`, `Skills.tsx`, `Social.tsx`, `Hero.tsx` (textos) pasan a leer de `/api/content/*` con fallback a los valores hardcodeados actuales (los actuales se conservan como `DEFAULT_*` para el fallback). Sin cambios visuales si KV está vacío.

---

## 3. Panel admin (ampliación)

### 3.1 Gestor de contenido (nuevo grupo "Contenido" en el sidebar)
- Páginas nuevas en `app/admin/content/`:
  - **Proyectos** (`projects/page.tsx`): lista + alta/edición/borrado (nombre, slug, desc, status, color de acento, tags, web?, shot?). Guarda en `content:projects`.
  - **Skills** (`skills/page.tsx`): editor de los 6 ejes con sliders (value 0-1), color, tools, conceptKey. Guarda en `content:skills`.
  - **Redes** (`socials/page.tsx`): lista editable (k, v, color, url, avatar). Guarda en `content:socials`.
  - **Home/Textos** (`home/page.tsx`): título y subtítulo del hero, etc. Guarda en `content:home`.
- Endpoints admin: `app/api/admin/content/[type]/route.ts` (GET/PUT) con auth admin + audit log.
- Estética: la actual del admin (cards `Sec`, label morado en mayúsculas, Space Mono, botones gradiente).

### 3.2 Más analíticas
- Nueva página **Engagement** (`app/admin/engagement/page.tsx`):
  - KPIs nuevos: `⌘K abierto`, `terminal usada`, `scroll medio`, `% leen completo`.
  - **Profundidad de scroll por sección** (barras).
  - **Mapa de visitantes en vivo** (SVG propio con blips por lat/lon; los datos de geo ya existen en las visitas).
  - **Stream de eventos personalizados** (tabla en vivo: terminal_cmd, cmdk_open, project_click…).
- Backend: agregaciones en `app/lib/data.ts` sobre los nuevos eventos; endpoint `GET /api/admin/engagement`.
- Captura de eventos: `POST /api/event` + hooks ligeros en cliente (⌘K abre, comando de terminal ejecutado, scroll depth por sección, click en proyecto).

### 3.3 Seguridad y ajustes
- Página **Ajustes** (`app/admin/settings/page.tsx` — ya existe `app/api/admin/settings/`; ampliar):
  - **Feature flags**: terminal on/off, carrusel de máquinas on/off, timeline on/off, modo mantenimiento. Guardados en KV (`settings:flags`), leídos por la web (un endpoint público `GET /api/flags`).
  - **Tema de acento**: presets (morado/azul/verde/mono) → setea `--brand-1/--brand-2` (ya existen de la v3) globalmente vía `settings:theme`, leído por la web.
- **Usuarios admin** (`app/admin/users` ya existe; revisar/ampliar): gestión de usuarios + passkeys (webauthn ya implementado), roles (owner/viewer).
- **Sesiones activas**: listar y revocar sesiones admin (según cómo persista la auth hoy; a confirmar en el plan leyendo `app/lib/auth.ts`).

---

## 4. Archivos afectados (resumen)

**Nuevos:**
- `app/lib/htb-concepts.ts` (mapeo skills→ejes)
- `public/data/htbmachines.json` (snapshot vendorizado)
- `scripts/fetch-htbmachines.mjs` (regenera el snapshot, manual)
- `app/api/htb/machines/route.ts` (cruce activity ✕ snapshot)
- `app/api/content/[type]/route.ts` (lectura pública de contenido)
- `app/api/admin/content/[type]/route.ts` (escritura admin)
- `app/api/event/route.ts` (ingesta de eventos) + `app/api/flags/route.ts` (flags públicos)
- `app/components/sections/Machines.tsx` (carrusel)
- `app/components/ProgressRail.tsx` (timeline lateral)
- `app/admin/content/{projects,skills,socials,home}/page.tsx`
- `app/admin/engagement/page.tsx`

**Modificados:**
- `app/api/htb/route.ts` (añadir activity)
- `app/components/sections/Skills.tsx` (hover-dim, consumir KV, integrar carrusel)
- `app/components/sections/Projects.tsx`, `Social.tsx`, `Hero.tsx` (consumir KV con fallback)
- `app/components/CommandPalette.tsx` (navigate a 2 columnas)
- `app/page.tsx` (montar ProgressRail; hooks de eventos)
- `app/admin/components/AdminSidebar.tsx` (grupos Contenido/Sistema nuevos)
- `app/admin/settings/...` (flags + tema)
- `app/lib/data.ts` (agregaciones de eventos)
- `app/globals.css` (hover-dim, carrusel, rail, ⌘K 2 columnas)

---

## 5. Rendimiento, errores, accesibilidad

- Carrusel y rail: animaciones solo con `transform`/`opacity`; pausa al hover; anuladas con `prefers-reduced-motion`.
- Hover-dim: transición de `opacity`/`filter` (compositor); sin reflow.
- Fetches de contenido/máquinas: cacheados (`s-maxage`); fallback elegante si KV/HTB fallan (la web nunca se rompe: usa defaults / omite el carrusel).
- El snapshot htbmachines es estático (sin fetch en runtime de terceros).
- Eventos: `POST /api/event` no bloqueante (sendBeacon/fetch keepalive).
- Timeline oculto en móvil; ⌘K colapsa a 1 columna; admin responsive como ahora.

## 6. Criterios de aceptación

1. Al pasar el ratón por una skill (leyenda o radar), se oscurecen las demás y se resaltan en el carrusel las máquinas que tocan ese concepto; y al revés desde una máquina.
2. Bajo Skills hay un **carrusel infinito** (pausa al hover) de últimas máquinas resueltas con dificultad, OS, conceptos (de htbmachines), fecha y writeup.
3. Al bajar del hero aparece un **timeline lateral izquierdo** con labels al hover, nodo activo, barra de progreso por scroll; oculto en móvil.
4. El ⌘K (pestaña navigate) muestra el **ASCII a la izquierda** en 2 columnas, como social.
5. Proyectos, skills, redes y textos de la home se **leen de KV** (con fallback a los valores actuales) y se **editan desde el admin**.
6. El admin tiene **gestor de contenido**, página de **engagement** (scroll depth, mapa en vivo, eventos) y **ajustes** (feature flags, tema, usuarios/sesiones).
7. Todo es **compatible con Vercel** (KV Upstash, sin filesystem persistente; snapshot estático en `public/`).
8. `npm run build` pasa; responsive; `prefers-reduced-motion` respetado; la web no se rompe si HTB/KV fallan.
