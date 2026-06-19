# Rediseño v3 — Design Spec (aprobado vía mockups)

**Fecha:** 2026-06-19
**Estado:** Diseño aprobado vía mockups · listo para plan de implementación
**Continúa:** `2026-06-19-portfolio-redesign-v2-design.md`. La v2 ya implementó hero (ola+glow), skills radar, projects bento, HTB, GitHub, social fastfetch y ⌘K. Esta v3 corrige rendimiento y rediseña piezas concretas según feedback.
**Stack:** Next.js 14.1 (App Router) · TypeScript · Tailwind 3.3 · React 18. Sin librerías nuevas salvo, opcionalmente, un set de logos SVG de lenguajes (simple-icons como SVG inline, sin dependencia runtime).

---

## 0. Motivación

Tras revisar la v2 en producción, el usuario reporta:
- **Rendimiento pobre**, sobre todo en Projects (canvas generado en cada render + `:has()` que anima `grid-template-columns`).
- El **bento de Projects** se ve roto (badges solapados, tags cortados) y no encaja.
- Quiere ajustes en hero (altura, scroll, orbs), una sección dedicada de lenguajes, avatares reales en social, y unificar/mejorar ⌘K + terminal.

La **ola de caracteres del hero NO se toca** (decisión explícita: "se ve perfecto ahora").

---

## 1. Hero — altura completa, scroll indicator, orbs vivas

- **Altura:** `min-height: 100vh` (hoy 84vh). El hero cubre toda la pantalla.
- **Scroll indicator:** abajo centrado, un "ratón" SVG/CSS con una rueda que baja en bucle (`@keyframes`), etiqueta `scroll` en mono. `z-index` sobre el fondo, bajo el contenido. Se oculta/atenúa con `prefers-reduced-motion` (sin animación de rueda).
- **Orbs (variante V3 elegida):** la capa glow (`.bgGlow`) pasa de gradientes estáticos a **2 orbs XL** (`<div>` con `radial-gradient` + `blur`) que **derivan y respiran** lentamente. Animación **solo `transform` + `opacity`/`scale`** (compositor GPU, coste ~0), duraciones 34–40s, amplitud moderada (~40–60px), `will-change: transform`. La ola sigue cruzando con las orbs cada 8s igual que ahora.
  - Producción = movimiento sutil (no el exagerado del demo).
  - `prefers-reduced-motion`: orbs estáticas (sin `animation`).
- **Se eliminan los chips de tecnologías del hero** (pasan a la nueva sección de lenguajes).
- Archivos: `Hero.tsx` (id ya es `hero`, quitar chips, añadir scroll indicator), `HeroBackground.tsx` (orbs animadas), `globals.css`.

## 2. Languages — tira infinita (sección nueva)

- Sección dedicada nueva: **marquee infinito de logos de lenguajes/herramientas**.
- **2 filas** desplazándose en **direcciones opuestas**, en bucle perfecto (contenido duplicado, `translateX(-50%)`), `mask` lineal en los bordes para fade.
- **Pausa al hover** de la fila. `prefers-reduced-motion`: sin animación, los logos se muestran en `flex-wrap`.
- **Logos reales** en SVG inline (simple-icons / devicons), color de marca, monocromo→color al hover opcional. Stack: TypeScript, Next.js, Rust, Go, Python, JavaScript, React, CSS, Docker, Linux, Git, PostgreSQL (configurable en el componente).
- Ubicación en `page.tsx`: **tras Skills, antes de Projects**.
- Eyebrow `$ cat ~/.stack`, h2 "Tech stack".
- Componente nuevo: `app/components/sections/Languages.tsx`. CSS nuevo en `globals.css`.

## 3. Projects — Opción B (tarjetas uniformes) + scroll infinito

- **Se elimina** la generación de screenshots por canvas (`generateScreenshot`) y el `:has()` que reorganiza el grid. Esto resuelve el lag y los badges rotos.
- **Layout:** tarjetas **uniformes** (mismo tamaño), cada una con:
  - Thumbnail superior: **imagen real estática** en `public/projects/<slug>.png` con `next/image` o `<img loading="lazy">` (degradado de color de acento como placeholder/fallback si no hay imagen). Barra de ventana (3 dots) sobre el thumb; badge `↗ live` si tiene `web`.
  - Cuerpo: badge de estado (`done`/`beta`/`dev`), path mono `~/projects/<slug>`, nombre, descripción, tags.
  - Hover: elevación + borde teñido al color de acento + glow suave (sin reflow del grid).
- **Scroll infinito (B-flow):** las tarjetas se presentan en un **marquee horizontal** que avanza en bucle y **se pausa al hover**. Con pocos proyectos el contenido se duplica para el bucle perfecto.
  - `prefers-reduced-motion` **y** viewport móvil: degradar a **grid estático** (1–2 columnas) sin animación, para legibilidad y accesibilidad.
- Tile especial de commits + sparkline: se mantiene como **bloque aparte estático bajo el marquee** (no entra en el bucle).
- Componente: `Projects.tsx` reescrito. CSS nuevo (`.pcard`, marquee) reemplaza `.bento`/`:has()`.

## 4. Social — avatares reales vía proxy server-side

- Los avatares se **extraen de las redes reales**. Como el ASCII necesita `getImageData` (falla por CORS con dominios externos), se añade un **route handler proxy**: `app/api/avatar/[network]/route.ts` que descarga el avatar remoto **en el servidor** y lo re-sirve **mismo-origen** (con cache headers). Así `loadImageToCanvas` + `toAscii` funcionan para cualquier red.
  - **GitHub:** auto-extraíble vía `https://github.com/<user>.png` (lo descarga el proxy).
  - **Discord / X / TikTok / Instagram / HTB:** la URL del avatar se configura por red (constante en el componente o `.env`); el proxy la descarga. Si una red no tiene URL aún, fallback al avatar generado actual (canvas con iniciales) → ASCII.
- El componente `Social.tsx` cambia las rutas de avatar de `public/avatars/*` a `/api/avatar/<network>`. Resto de la lógica (navegación hover/↑↓/↵, color por red, ASCII) intacto.
- Cache: el route handler cachea la imagen (revalidate diario) para no golpear las redes en cada visita.

## 5. ⌘K Command Center — rediseño + terminal integrada (Propuesta 1: Tabs)

Se **fusiona** la terminal dentro del ⌘K. Una sola ventana con dos pestañas.

### 5.1 Rediseño visual (mantiene función nav + referencia fastfetch)
- Ventana glass: `rgba(12,12,18,.96)` + `backdrop-filter`, borde teñido, sombra profunda, **hairline gradiente morado→azul** en el borde superior.
- Barra estilo macOS (3 dots rojo/amarillo/verde) + título mono `s7lver@portfolio — command center` + badge `⌘K`.
- Ítem de lista seleccionado: **degradado morado→azul** + marcador `❯`.
- Footer con hints **contextuales** según pestaña.

### 5.2 Pestaña `navigate` (fastfetch, intacta en función)
- ASCII art (aleatorio de `/public/art` vía pipeline existente) a la izquierda + lista de secciones a la derecha (Home, Skills, Projects, HackTheBox, GitHub, Contact).
- ↑↓ navegar, ↵ `scrollIntoView` + cerrar. **Sin cambios funcionales.**

### 5.3 Pestaña `terminal` (terminal integrada)
- Se monta el procesador de comandos actual de `Terminal.tsx` **dentro del ⌘K** (mismo motor: whoami, ls, cat, nmap, ping, skills, sudo, hack, uname, history, github, htb, open, help, clear, exit; Tab-complete; historial ↑↓).
- **Cambio de pestaña:** `Tab` (cuando el foco no está mid-typing en nav) o click en la pestaña. El botón **"$ start hacking"** del hero abre el ⌘K **directamente en la pestaña terminal**.
- La hoja inferior `Terminal.tsx` independiente se retira (su lógica se reutiliza dentro del ⌘K). El atajo backtick (`` ` ``) abre el ⌘K en terminal.

### 5.4 Mejoras de la terminal (todas)
1. **Output coloreado:** prompt verde, puertos `open`/éxitos en verde, errores en rojo, acentos en morado, avisos en amarillo. (Hoy casi todo gris.)
2. **Chips de comandos rápidos:** fila de chips clicables (`whoami`, `ls -la`, `cat flag.txt`, `nmap localhost`, `skills`, `hack`, `help`) que ejecutan al click; ayudan a descubrir.
3. **Ghost autocomplete:** sugerencia gris inline al escribir (p.ej. `na…→nmap`), además del Tab actual.
4. **Banner mejorado** + línea de estado (host, uptime/reloj simulado).
5. **`open <sección>`** integrado con el cierre del ⌘K (navega y cierra).
6. **Comandos nuevos / easter eggs:** `neofetch`, `sudo su`, `matrix`, `theme` (y los existentes).

- Componente: `CommandPalette.tsx` reescrito como command center con tabs; reutiliza el `processCommand` de `Terminal.tsx` (extraído a un módulo compartido, p.ej. `app/lib/terminal.ts`). `page.tsx` deja de montar `<Terminal>` por separado; `onOpenTerminal` abre el ⌘K en modo terminal.

## 6. Rendimiento (transversal)

- Projects: fuera canvas-en-render y `:has()` con transición de grid. Imágenes con `loading="lazy"`. Marquee con `transform` (compositor).
- Hero orbs: solo `transform`/`opacity`. Ola del hero **sin cambios** (ya pausada fuera de viewport).
- Marquees (lenguajes, projects): `will-change: transform`, pausa al hover, anulados con reduced-motion.
- Verificar que no quedan animaciones que disparen layout/paint en bucle.

## 7. Archivos afectados (resumen)

**Nuevos:**
- `app/components/sections/Languages.tsx`
- `app/api/avatar/[network]/route.ts`
- `app/lib/terminal.ts` (procesador de comandos extraído, compartido)
- `public/projects/*.png` (capturas reales — el usuario las aporta; fallback a degradado)

**Reescritos / modificados:**
- `Hero.tsx` (100vh, scroll indicator, sin chips)
- `HeroBackground.tsx` (orbs V3 animadas)
- `Projects.tsx` (Opción B + marquee, sin canvas/`:has()`)
- `Social.tsx` (avatares vía `/api/avatar`)
- `CommandPalette.tsx` (command center: tabs nav + terminal, rediseño, mejoras terminal)
- `page.tsx` (montar Languages; `onOpenTerminal` → ⌘K terminal; retirar `<Terminal>`)
- `globals.css` (orbs, scroll indicator, marquees, `.pcard`, command center, colores terminal)

**Retiro:**
- `Terminal.tsx` como overlay independiente (su motor se mueve a `app/lib/terminal.ts` y se usa dentro del ⌘K).

## 8. Criterios de aceptación

1. Hero a 100vh con indicador de scroll abajo; orbs XL que derivan/respiran (transform/opacity); ola intacta; sin chips. Reduced-motion: orbs e indicador estáticos.
2. Existe sección **Languages**: 2 filas de logos en marquee infinito, direcciones opuestas, pausa al hover, fade en bordes, logos SVG reales; reduced-motion = wrap estático.
3. Projects = tarjetas uniformes con imagen real lazy + marquee infinito con pausa al hover; **sin** canvas generado ni `:has()`; sin badges solapados ni tags cortados; reduced-motion/móvil = grid estático.
4. Social muestra avatares **reales** de las redes vía `/api/avatar/<network>` convertidos a ASCII; fallback elegante si falta una URL.
5. ⌘K es un command center con pestañas **navigate** (fastfetch intacto) y **terminal** integrada; "$ start hacking" y backtick abren la terminal; rediseño visual aplicado.
6. Terminal mejorada: output coloreado, chips rápidos, ghost autocomplete, banner+estado, `open` integrado, comandos nuevos.
7. `npm run build` pasa; rendimiento notablemente mejor en Projects; responsive en móvil; `prefers-reduced-motion` respetado en todas las animaciones nuevas.
