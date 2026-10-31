# La Última Cena: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La escena final tras los créditos (la Última Cena de robots enmascarados), que hace de contacto y de vitrina de logros, con el sistema de logros y su aviso al estilo ONI//OS.

**Architecture:** Un módulo de logros sin React (`achievements.ts`: lista, `unlock`, suscripción, `localStorage`) y un aviso (`Toast.tsx`) montado en `OniHome`. Los créditos, al oscurecerse, pasan renderer y lienzo a `Supper.tsx` (igual que ritual → créditos); `SupperScene` monta la mesa, trece `Subject` y los marcos de logros en la pared; el email y el footer son DOM encima y debajo del lienzo.

**Tech Stack:** Next 14, React, three.js r160, gsap. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-30-last-supper-design.md`

## Global Constraints

- Sin dependencias nuevas. Sin tests automáticos: cada tarea se verifica en el navegador (pestaña «tab-1», luego se devuelve la «seed») y con `npx tsc --noEmit`.
- Textos de la interfaz en inglés; comentarios en español, con la densidad del código de alrededor.
- Firefox: compilar con `compileGently` y sombras con `shadowType` (`app/oni/compile.ts`, `app/oni/quality.ts`); gobernador de resolución como las demás escenas.
- `prefers-reduced-motion` (y `&reduced` en desarrollo): sin zoom out ni peleas en bucle; plano final quieto.
- Móvil y calidad baja del gobernador: apóstoles congelados en una pose, casi sin sombras; el del centro sigue mirando.
- Atajos de desarrollo solo con `process.env.NODE_ENV === 'development'`.
- Ley anti-slop de `webpage/.claude/CLAUDE.md`, repasada punto por punto al final.
- Email: `nickespro130@outlook.es`; texto: `contact me... if u dare`.
- Primer logro: id `end`, «The Last Supper», «You made it to the end.».
- Nada de commits por tarea: un solo commit al final, cuando el usuario lo apruebe.

## Review Focus

1. `localStorage` que lanza (ventana privada, bloqueado): `unlock` sigue mostrando el aviso y la web no rompe; simplemente no se recuerda.
2. Un logro conseguido durante la pantalla de carga o antes de que el aviso esté montado: se encola y sale después, no se pierde.
3. Firefox con trece robots con piel: ningún bloqueo largo al llegar (compilación troceada, los clones comparten programa).
4. WebGL que no arranca (`&nogl`): el email y el footer se ven igual; la escena 3D simplemente falta.
5. Pantalla estrecha o redimensionada: la mesa entera cabe en el plano final (encuadre por aspecto) y el email no tapa al del centro.

---

### Task 1: Logros y su aviso

**Files:**
- Create: `app/oni/achievements.ts`, `app/oni/Toast.tsx`
- Modify: `app/oni/OniHome.tsx` (montar `<Toast />`), `app/oni/oni.css` (estilos del aviso)

**Interfaces:**
- Produces:
  - `type AchievementId = 'end' | 'backrooms' | 'vrchat' | 'lucy' | 'silver' | 'minecraft' | 'nether' | 'gemini' | 'whatsapp'`
  - `const ACHIEVEMENTS: { id: AchievementId; name: string; desc: string }[]` (nueve, en ese orden; solo `end` con texto final, el resto con nombre provisional; se muestran «???» mientras estén bloqueados)
  - `unlock(id: AchievementId): void` (no hace nada si ya se tiene)
  - `has(id: AchievementId): boolean`
  - `onUnlock(fn: (a: Achievement) => void): () => void` (suscripción; devuelve la baja)
  - En desarrollo: `window.__unlock = unlock`, y `?resetach` borra lo guardado.

- [ ] **Step 1:** `achievements.ts`: guarda en `localStorage['oni.achievements']` (array de ids) con try/catch en lectura y escritura. Los avisos pendientes se encolan si nadie está suscrito y se entregan al primer `onUnlock`.
- [ ] **Step 2:** `Toast.tsx`: ventana de ONI//OS en la esquina inferior derecha (borde y título como las ventanas de `pc/Desktop.tsx`, icono tramado con `paintGrid`), nombre y descripción, pitido corto con WebAudio (un `square` de dos notas, como `PcAudio.tone`; solo si el contexto ya está desbloqueado). Uno detrás de otro si llegan varios; se va solo a los 4 s. Se queda oculto mientras `document.documentElement.dataset.loading` exista. `aria-live="polite"`. Va en un portal a `document.body` con un `z-index` por encima de todas las escenas (ordenador, sala, biblioteca, ritual, créditos, cena).
- [ ] **Step 3:** Verificar: `npx tsc --noEmit` sin errores. En `?credits`, `__unlock('end')` en la consola muestra el aviso; repetirlo no muestra nada; recargar y repetir tampoco; `?resetach` lo vuelve a permitir. Con `localStorage` lanzando (sustituirlo en la consola por un objeto que lanza) el aviso sale igual y no hay errores.

### Task 2: De los créditos a la cena

**Files:**
- Create: `app/oni/supper/Supper.tsx`, `app/oni/supper/supperScene.ts` (esqueleto), `app/oni/supper/supper.css`
- Modify: `app/oni/credits/Credits.tsx`, `app/oni/Hero.tsx`, `app/page.tsx` (importar `supper.css`)

**Interfaces:**
- Consumes: `unlock('end')` (Task 1); `CreditsScene.onEnd`, `CreditsScene.renderer`.
- Produces:
  - `Credits` prop `onDone?: (e: CreditsExit) => void`, con `type CreditsExit = { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement }`; al dispararse, los créditos dejan de desechar el renderer.
  - `class SupperScene { constructor(opts: { renderer; reduced: boolean; low: boolean }); load(): Promise<void>; takeOver(canvas: HTMLCanvasElement): void; dispose(): void }`
  - `Supper({ renderer?, canvas? })`: crea los suyos si no le llegan (atajo).

- [ ] **Step 1:** `Credits`: al `onEnd` llama `onDone({ renderer, canvas })` y en su limpieza ya no desecha ni fuerza la pérdida del contexto. `Hero`: estado `inSupper`; al recibir `onDone`, monta `Supper` con lo que llega y desmonta `Credits`. Atajo `?supper` como `?credits`.
- [ ] **Step 2:** `Supper.tsx`: raíz `position: fixed; inset: 0; overflow-y: auto` (la página de detrás sigue bloqueada); dentro, el escenario a `100vh` con el lienzo `position: sticky` y, debajo, el footer (Task 5). Al mostrarse la escena: `unlock('end')`. Corte seco: sin fundido.
- [ ] **Step 3:** `SupperScene`: escena vacía con luz, cámara, composer con `OutputPass`, gobernador y `compileGently` en `load()`, como `CreditsScene`.
- [ ] **Step 4:** Verificar: `npx tsc --noEmit`. En `?credits`, hacer scroll hasta el final: al oscurecerse aparece la escena de la cena sin parpadeo de lienzo, sale el aviso «The Last Supper» y `__hero`/`renderer.info` muestra un solo contexto. `?supper` entra directo. Con `&nogl` no hay errores no capturados.

### Task 3: La mesa y los trece

**Files:**
- Create: `app/oni/supper/table.ts` (mesa, mantel, comida, pared y luz), `app/oni/supper/seats.ts` (los trece sitios)
- Modify: `app/oni/supper/supperScene.ts`, `app/oni/library/subject.ts` (clips de un segundo glb)

**Interfaces:**
- Consumes: `Subject` (`load`, `place`, `to`, `pose`, `lookAt`, `freeze`, `update`), `Pose`.
- Produces:
  - `Subject.load(extra?: string)`: si se da, añade los clips de ese glb (mismo esqueleto de Mixamo) a los suyos.
  - `const SEATS: { at: [number, number, number]; yaw: number; group: 0 | 1 | 2 | 3 | 4 }[]` (13; `group` 2 es el centro; los otros, los cuatro tríos del cuadro)
  - `const CHIN: Pose` (codos en la mesa, manos en la barbilla), si ningún clip sirve.
- Assets: mientras el usuario no mande mesa, comida y armas, la mesa es `public/models/library/table.glb` escalada a lo largo y la comida falta. Los suyos se ponen en `public/models/supper/` cuando lleguen.

- [ ] **Step 1:** La mesa larga cruzando el plano, la pared del fondo con los huecos del cuadro (tres ventanas, tapices) donde irán los marcos, luz cenital fría con un relleno rojo, sombras con `shadowType`.
- [ ] **Step 2:** Trece `Subject` (un solo `load` del glb compartido: los clones comparten geometría y programa). Doce en sus sitios con los clips que hay, en bucle y desfasados, mirándose entre ellos por tríos (`lookAt` a un vecino). El del centro: clip de barbilla si existe; si no, `CHIN` posada a mano como `ritual/poses.ts`; su `lookAt` sigue la cámara desplazada por el puntero (±10°).
- [ ] **Step 3:** La cámara: arranca pegada a la mesa delante del centro y en 4 s se aleja (gsap, `power2.out`) hasta el plano del cuadro, frontal y simétrico, con la distancia calculada para que quepa el ancho de la mesa según `camera.aspect`. Con `reduced`, directamente el plano final. Con `low` (móvil o gobernador en lo bajo), `freeze(true)` en los doce y solo el del centro y la luz cenital proyectan sombra.
- [ ] **Step 4:** Verificar: `npx tsc --noEmit`. `?supper` en Chrome: zoom out completo, trece robots, el del centro sigue al ratón. Redimensionar a 375×812: la mesa entera cabe. `?supper&reduced`: plano quieto. En Firefox: sin bloqueos de más de ~1,5 s al llegar (medido como en la escena de la sala).

### Task 4: Los marcos de los logros

**Files:**
- Create: `app/oni/supper/frames.ts`
- Modify: `app/oni/supper/supperScene.ts`

**Interfaces:**
- Consumes: `ACHIEVEMENTS`, `has`, `onUnlock` (Task 1); el estilo del holograma de `ritual/hologram.ts` (líneas, fallo, rojo).
- Produces: `class Frames { readonly group: THREE.Group; constructor(); refresh(): void; update(t: number, reduced: boolean): void; dispose(): void }`

- [ ] **Step 1:** Nueve marcos en la pared del fondo, repartidos simétricos alrededor del centro (en los huecos de ventanas y tapices). Cada uno: un marco rojo holográfico (textura de lienzo con líneas de barrido) y dentro el nombre. Conseguido: encendido, nombre y descripción. Bloqueado: apagado al 25 %, contorno que parpadea despacio, «???».
- [ ] **Step 2:** `onUnlock` → `refresh()`: el marco recién conseguido se enciende con un fallo de imagen corto.
- [ ] **Step 3:** Verificar: `?supper&resetach`: «The Last Supper» encendido (se acaba de conseguir) y ocho «???». `__unlock('gemini')` en la consola: sale el aviso y su marco se enciende sin recargar.

### Task 5: El email y el footer

**Files:**
- Modify: `app/oni/supper/Supper.tsx`, `app/oni/supper/supper.css`

**Interfaces:**
- Consumes: la posición del borde de la mesa en pantalla (proyectada desde `SupperScene`, `tableEdge(): { x: number; y: number }` en px).

- [ ] **Step 1:** Sobre la mesa, centrado bajo el del centro: `contact me... if u dare` y, debajo, `<a href="mailto:nickespro130@outlook.es">` con el email: texto real y seleccionable, tipografía de la web (`tanker`), rojo tonal sin brillo. Aparece al acabar el zoom out (con `reduced`, desde el principio). Sin WebGL, se ve igual sobre fondo negro.
- [ ] **Step 2:** El footer debajo del escenario: enlaces a `/galery` y `/credits`, en el mismo fondo que el final de la escena (sin costura de color).
- [ ] **Step 3:** Verificar: el clic abre el correo; el texto se puede seleccionar y copiar; a 375 px no tapa la máscara del centro ni se sale por los lados; con `&nogl` el email y el footer se ven; Tab llega al email y a los dos enlaces.

### Task 6: La pelea con los modelos del usuario

**Bloqueada hasta que el usuario mande** las animaciones de Mixamo (FBX), las armas, la mesa y la comida.

**Files:**
- Modify: `tools/models/bot.mjs` (entrada y salida por argumentos), `app/oni/supper/seats.ts`, `app/oni/supper/table.ts`, `app/oni/supper/supperScene.ts`
- Create: `public/models/supper/fight.glb` (salida de la herramienta), `app/oni/supper/brawl.ts`

**Interfaces:**
- Consumes: `Subject.load(extra)` (Task 3).
- Produces: `type Beat = { seat: number; clip: string; at: number; prop?: 'pistol' | 'knife' | string; partner?: number }`, `const BRAWL: Beat[]` (la coreografía en bucle).

- [ ] **Step 1:** `node tools/models/bot.mjs <carpeta de FBX> public/models/supper/fight.glb`: solo los clips (sin malla); elegir los que sirvan y apuntar en el ledger cuáles se descartan.
- [ ] **Step 2:** Las armas pegadas al hueso `RightHand` (o `LeftHand`) de quien las lleva, colocadas a mano por arma.
- [ ] **Step 3:** El entorno: parejas sincronizadas (uno agarra, el otro va contra la mesa, con `partner` y los clips arrancados a la vez), la comida y la vajilla que saltan con un impulso simple al golpe (sin motor de física), alguno a cubierto tras la mesa. Los tríos se mantienen reconocibles.
- [ ] **Step 4:** Verificar: el bucle entero, unos minutos, sin manos que atraviesen la mesa en los golpes, sin saltos al cambiar de clip, en Chrome y en Firefox. Repetir las comprobaciones de Task 3 (móvil congelado, `reduced`, bloqueos).

### Final

- [ ] Repaso de la ley anti-slop punto por punto sobre el aviso, los marcos, el email y el footer.
- [ ] Revisión de toda la rama por un revisor nuevo.
- [ ] Un solo commit, con el mensaje enseñado antes, cuando el usuario lo apruebe.
