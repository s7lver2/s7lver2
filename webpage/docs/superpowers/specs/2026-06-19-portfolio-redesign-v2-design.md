# Rediseño visual v2 — Design Spec (aprobado)

**Fecha:** 2026-06-19
**Estado:** Diseño aprobado vía mockups · listo para plan de implementación
**Reemplaza:** la parte **visual** de `2026-06-19-portfolio-phase1-redesign-design.md`. La Fase 1 original ya añadió command palette, sección GitHub y `/api/github`; aquí se **rediseña** todo con un lenguaje concreto y se añaden piezas nuevas (ola ASCII, radar, bento, fastfetch social, ⌘K con arte ASCII).
**Stack:** Next.js 14.1 (App Router) · TypeScript · Tailwind 3.3 · React 18. Sin librerías nuevas (todo con canvas/SVG nativos).

---

## 0. Concepto e identidad

**Terminal-native developer.** El portfolio se presenta como el entorno de un dev/hacker. Elementos firma:
- **Eyebrows de comando**: cada sección se encabeza con un comando de shell en verde (`$ whoami`, `$ cat skills.md`, `$ ls ~/projects`, `$ htb --stats`, `$ git log --stat`, `$ ./connect.sh`).
- **ASCII generado por canvas**: avatares de redes y arte del `⌘K` se convierten a ASCII en cliente (pipeline reutilizable).
- **Ola de caracteres** en el hero (flow field estilo MidJourney).

**Sistema visual:**
- Fondo `#08080b`; dúo de marca morado `#8b5cf6` → azul `#3b82f6` (gradiente); **verde `#22c55e` reservado a los prompts**; color por lenguaje en proyectos/skills.
- Tipografía: **Sora** (display, pesos 700–800, tracking apretado) + **JetBrains Mono** (prompts, datos, chips, paths).
- Atmósfera: glows radiales morado/azul + grid sutil. Glass (`rgba(255,255,255,.025)`) con borde que se tiñe al hover y glow.
- Accesibilidad transversal: `prefers-reduced-motion` pausa/anula animaciones (ola, marquees, reveals); navegación por teclado y foco visible en componentes interactivos (palette, fastfetch).

---

## 1. Alcance

Rediseñar el front público con secciones: **Hero, Skills, Projects, HTB, GitHub, Contact (social), Footer** + **Command Palette ⌘K** global. Datos reales vía `/api/htb` y `/api/github` (existentes). Sin tocar backend/auth/analytics (Fases 2-3).

**Fuera de alcance:** panel admin, login, tracking (fases posteriores).

---

## 2. Hero

- Layout **a la izquierda**, compacto (no a pantalla completa dramática): eyebrow `$ whoami` con cursor; título `Hi, I'm `**s7lver**` (gradiente) / Developer & Cybersecurity Student` en Sora bold; botones `View Projects →` (gradiente) y `$ start hacking` (outline, abre terminal); fila de chips de tecnologías.
- **Fondo animado con crossfade cada ~8s** entre dos capas:
  1. **Glow**: gradientes radiales morado/azul (actual).
  2. **Ola de caracteres** (flow field MidJourney): `<canvas>` que dibuja una rejilla de caracteres blancos (`· : - = + / \ | *`) cuya presencia/alpha sigue un campo de ruido animado (`requestAnimationFrame`). **Sutil** (alpha baja) + velo oscuro (`radial`/`linear` gradient) tras el texto para legibilidad.
- Crossfade: las dos capas alternan `opacity` con transición ~1.6s, en bucle de 8s. `prefers-reduced-motion`: sin animación de ola (capa estática o solo glow).
- Componente: `app/components/HeroBackground.tsx` (canvas + crossfade) montado en `Hero.tsx`.

## 3. Skills — Radar

- **Radar hexagonal (SVG)** con 6 ejes: Web Exploit, Network, Recon, Active Directory, Reversing, Crypto; polígono de datos relleno con el morado de marca, vértices en color por dominio, anillos de rejilla y etiquetas.
- A la derecha, **leyenda**: por eje, nombre + herramientas + porcentaje.
- Datos hardcodeados (config en el componente). Componente: `Skills.tsx` reescrito.

## 4. Projects — Bento irregular animado + preview web

- **Grid irregular** (CSS grid, tiles de distinto tamaño). Al hover de un tile, **las columnas se redistribuyen** hacia él (`.bento:has(.pN:hover){ grid-template-columns: … }` con `transition`), los demás se **atenúan**, y el tile **despliega su descripción** + se eleva con glow en su **color de lenguaje** (C2). Cada tile: badge de estado, **path mono** `~/projects/<slug>`, nombre, tags, glyph de marca de agua (C3). Un tile especial muestra **commits + sparkline**.
- **Proyectos con web**: badge `↗ live`; al hover, el **fondo del tile se convierte en una captura de la home** del proyecto (atenuada + degradado para legibilidad). 
  - Fuente de la captura: imagen guardada en `public/projects/<slug>.png` (recomendado) o generada en build. Campo `web?: string` y `shot?: string` en los datos del proyecto.
- Componente: `Projects.tsx` reescrito. Capa CSS importante: `.tile>*:not(.shot):not(.shade){position:relative;z-index:2}` para que el screenshot quede de fondo.

## 5. HTB

- **Tiles KPI**: Rank (gradiente), User owns, System owns, Points (con delta).
- Dos tarjetas con **barras animadas**: owns por dificultad (Easy/Medium/Hard/Insane, colores) y por SO (Linux/Windows/…, gradiente). Animación de ancho al entrar.
- Datos de `/api/htb` (existente). `HTB.tsx` reescrito al nuevo lenguaje.

## 6. GitHub

- **Bento**: tile grande con **heatmap de contribuciones** + barra de **top languages**; alrededor, tiles KPI (repos, stars, followers, commits/yr).
- Datos de `/api/github` (existente). `GitHub.tsx` reestilizado. Nota: el heatmap real de contribuciones requiere GraphQL autenticado (`GITHUB_TOKEN`); sin él, el heatmap es decorativo o se omite (documentado en Fase 1 original).

## 7. Contact / Social — Fastfetch ASCII

- Estilo **fastfetch/neofetch**: ventana con barra; a la izquierda **ASCII de la foto de perfil** de la red seleccionada; a la derecha **lista de redes** (GitHub, Discord, X, TikTok, Instagram, HTB) navegable por **hover / ↑↓ / click**.
- Al cambiar de red, el ASCII de la izquierda muestra el **avatar de esa cuenta**, generado con el pipeline `canvas→ASCII`; clave coloreada con el color de la plataforma; feedback `→ opening <url>` al activar.
- **Fuente de avatares**: URL del avatar de cada red (config). Si la imagen es cross-origin sin CORS, el canvas se "tainta" y `getImageData` falla → estrategia: **descargar/guardar los avatares en `public/avatars/<red>.png`** (mismo origen) o proxiarlos por un route handler. Documentar.
- Componente: `Social.tsx` (sustituye al `Contact.tsx` actual o lo reescribe). Mantiene el email CTA.

## 8. Command Palette ⌘K (global)

- Overlay (Ctrl/⌘+K) para **saltar de sección** (Home, Skills, Projects, HTB, GitHub, Contact): lista navegable ↑↓/↵/click → `scrollIntoView`.
- A la izquierda, **arte ASCII aleatorio** generado de una imagen de **`/public/art`** (canvas→ASCII), distinto en cada apertura.
- Convive con el atajo backtick (`` ` ``) de la terminal y con el `useKeyboard` existente. Reescribe/extiende `CommandPalette.tsx` (de la Fase 1) para añadir el panel ASCII y la fuente `/public/art`.
- **Fuente del arte**: lista de archivos en `public/art/` (config o `import`/manifest). Carga `<img>` mismo-origen → canvas → ASCII.

## 9. Pipeline ASCII (reutilizable)

`app/lib/ascii.ts`:
- `toAscii(source: HTMLCanvasElement|HTMLImageElement, cols, rows): string` — muestrea luminancia por celda (downsample) y mapea a una rampa `" .:-=+*#%@"`.
- Helper para cargar imagen mismo-origen a canvas antes de convertir.
- Usado por Social (avatares) y ⌘K (arte). El flow-field del hero es su propio canvas animado (no usa este helper).

## 10. Datos y configuración

- Proyectos: estructura con `{ slug, name, desc, status, langColor, tags, web?, shot? }` (hardcoded por ahora; gestor de contenido es fase futura).
- Skills radar: ejes + valores + herramientas (config en componente).
- Avatares de redes: rutas en `public/avatars/` o URLs (config).
- Arte ⌘K: imágenes en `public/art/`.
- `.env`: `GITHUB_USERNAME` (existente), opcional `GITHUB_TOKEN`.

## 11. Rendimiento y errores

- Hero canvas: `requestAnimationFrame`, rejilla acotada (~celda 12px), se pausa con reduced-motion; pausar cuando el hero no está en viewport (IntersectionObserver) para no gastar CPU.
- ASCII de avatares/arte: generar una vez y cachear (no por frame).
- Degradación: si falla la carga de un avatar/imagen, mostrar un ASCII placeholder; si `/api/htb`/`/api/github` fallan, las secciones muestran estado de error (como hoy).
- `:has()` + transición de `grid-template-columns`: animado en navegadores modernos; degradación elegante (cambio sin animar) en antiguos.

## 12. Archivos afectados (resumen)

**Nuevos:** `app/components/HeroBackground.tsx`, `app/components/Social.tsx`, `app/lib/ascii.ts`, `public/projects/*`, `public/avatars/*`, `public/art/*`.
**Reescritos:** `Hero.tsx`, `Skills.tsx`, `Projects.tsx`, `HTB.tsx`, `GitHub.tsx`, `CommandPalette.tsx`, `globals.css` (tokens/utilidades nuevas).
**Posible retiro:** `Contact.tsx` (sustituido por `Social.tsx`).

## 13. Criterios de aceptación

1. Hero a la izquierda con el fondo alternando glow ↔ ola de caracteres cada ~8s, sutil y legible; pausa con reduced-motion.
2. Skills muestra el radar de 6 ejes + leyenda.
3. Projects es un bento irregular que se reorganiza al hover; los proyectos con web muestran su screenshot de fondo y badge `↗ live`.
4. HTB y GitHub renderizan datos reales en el nuevo lenguaje (KPIs/barras y bento/heatmap).
5. Contact es un fastfetch navegable que muestra el avatar ASCII de cada red.
6. ⌘K abre un selector de secciones con arte ASCII aleatorio de `/public/art` y navega de verdad.
7. Identidad coherente (eyebrows de comando, morado/azul, glass) en todas las secciones.
8. `npm run build` pasa; responsive en móvil; `prefers-reduced-motion` respetado.
