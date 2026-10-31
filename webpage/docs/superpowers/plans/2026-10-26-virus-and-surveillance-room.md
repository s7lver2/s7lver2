# Virus y sala de videovigilancia: plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** construir §6.2c (el virus que dispara `passwords.txt`) y §6.3 (la sala de videovigilancia donde cada tele es un canal-proyecto y el mando los recorre), enlazados con el ordenador que ya existe.

**Architecture:**
- El virus vive dentro del ordenador (`app/oni/pc/`) y acaba entregando una imagen de cámara de seguridad de la habitación.
- La sala es una escena three.js propia (`app/oni/room/`) con su canvas, montada a pantalla completa cuando acaba el virus. Al montarse, la habitación (`HeroScene`) se desecha.
- Los canales salen de los proyectos del contenido (`getContent('projects')`).
- La tele encuadrada lleva encima su emisión como componente React real. El resto de teles pintan su emisión como textura.

**Tech Stack:** Next.js 14.1 (App Router), React 18, TypeScript, three.js r160 (GLTFLoader + meshopt), GSAP, WebAudio, gltf-transform (pipeline de modelos).

**Spec:** `docs/superpowers/specs/2026-10-25-portfolio-oni-redesign-design.md`, §6.2b, §6.2c, §6.3, §8, §9, §10. Léelos antes de empezar.

## Global Constraints

- Ley anti-slop de `webpage/.claude/CLAUDE.md`, completa. Al terminar, repaso punto por punto.
- Paleta del ordenador: la rampa de fósforo de `app/oni/pc/pixels.ts` (`#070303 #2a0605 #6e120c #c4221a #ff4a36 #ffd9cf`). La sala usa el mismo rojo para la luz y las teles, con negro cálido de base.
- Textos de interfaz en inglés. Comentarios del código en español, como el resto de `app/oni/`.
- Sin dependencias nuevas salvo que una tarea lo diga.
- **Sin tests automáticos** (convención del proyecto: "sin tests salvo que se pidan"). Cada tarea termina con una comprobación en el navegador, usando los atajos de desarrollo.
- **Un solo commit al final**, cuando s7lver apruebe la escena (convención: "un commit por feature terminada" y solo escenas aprobadas). Las tareas no hacen commit.
- **Licencias:**
  - `CRT TV` (Sketchfab Standard) y su GLB no entran en git.
  - Los CC-BY se acreditan en `app/oni/credits.ts`.
  - La marca SANYO del mando se tapa.
- **Recorrido completo:** se repite siempre entero (sin recordar nada). `?pc` y los atajos nuevos son **solo de desarrollo** (`process.env.NODE_ENV === 'development'`).
- **Movimiento reducido** (`prefers-reduced-motion: reduce`): el virus tiene una versión tranquila, sin destellos, saltos ni cascadas rápidas, con fundidos en su lugar (WCAG 2.3.1). La cámara de la sala corta en vez de viajar.
- Rendimiento: 60 fps en un portátil normal con 40 teles. Las teles fuera de cámara no actualizan su textura cada frame.

## Review Focus

1. **Muchos canales** (60 proyectos): el muro crece, se pueden alcanzar todos con el mando y los fps no se hunden. La comprobación con `?room&channels=60` está en la tarea 6.
2. **Emisión rota** (un vídeo que da 404 o un `component` que no existe): esa tele da estática y el encuadre enseña la tarjeta por defecto, sin romper nada. Comprobación en la tarea 2.
3. **Aporrear el mando** mientras la cámara viaja (CH+ diez veces seguidas): gana el último destino, la cámara no se queda a medias y no quedan dos emisiones encima. Comprobación en la tarea 7.
4. **Cambiar el tamaño de la ventana o girar el móvil** con una tele encuadrada: la emisión se vuelve a alinear con la pantalla. Comprobación en la tarea 7.
5. **Sin risa o sin audio** (falta `laugh.m4a` o el audio está bloqueado): el virus acaba igual, porque los tiempos no dependen del audio. Comprobación en la tarea 3.

---

### Task 1: Modelos de la sala y créditos

**Files:**
- Create: `webpage/tools/models/build.mjs` (copia del script de `C:\Users\NICKE\AppData\Local\Temp\claude\E--s7lver2\308cf6d6-3a43-4295-88da-4bc1e77080ed\scratchpad\gt\build.mjs`, con `SRC`/`OUT` por conjunto)
- Create: `webpage/tools/models/package.json` (las mismas dependencias que `scratchpad/gt/package.json`)
- Create: `webpage/app/oni/credits.ts`
- Modify: `webpage/.gitignore` (añadir `/public/models/surveilance_room/crt.glb` y `/tools/models/node_modules/`)
- Output: `webpage/public/models/surveilance_room/{tvstack,crt,oldtv,retrotv,antennatv,remote,camera}.glb`

**Interfaces:**
- Produces: los GLB de arriba.
- Produces: `export const CREDITS: { title: string; author: string; url: string; license: 'CC-BY-4.0' | 'CC-BY-NC-4.0' }[]`, con todos los modelos CC-BY de la habitación y de la sala (los datos están en cada `license.txt` de `src/`).

- [ ] **Step 1:** Mover el script al repo con un argumento de conjunto: `node build.mjs room` (los trabajos actuales, sin cambios) y `node build.mjs surveillance`. Trabajos del conjunto `surveillance` (SRC `public/models/surveilance_room/src/`):

| job | src | tex | simplify | notas |
|---|---|---|---|---|
| tvstack | `28e9373b8550488bac26b3c35ac2225a` | 1024 | – | 9 teles; pantallas `TV_Sreen_01_0`, `TV_0N_screen_0N_0` (N 2–9) |
| crt | `crt_tv` | 1024 | – | pantalla: material `TVScreen` |
| oldtv | `old_tv` | 1024 | – | una sola malla; escala original ~117 unidades |
| retrotv | `tv__old_tv__retro_tv` | 1024 | – | una sola malla |
| antennatv | `old_analog_tv_with_antenas` | 1024 | 0.2 | pantalla: material `TV_Screen_PBR` |
| remote | `simple_tv_remote` | 2048 | – | ver step 2 |
| camera | `security_camera` | 512 | – | |

- [ ] **Step 2:** En el trabajo `remote`, antes de comprimir, pintar encima del logo (rectángulo aproximado en la textura de 1024 px: x 355–396, y 765–866) con el gris del botón y escribir `ONI` con `sharp` (overlay SVG). En el resultado no puede quedar "SANYO".
- [ ] **Step 3:** Ejecutar desde `webpage/tools/models`: `npm i && node build.mjs surveillance`. Resultado esperado: siete GLB, cada uno de menos de 3 MB, y `node ../../../<scratchpad>/gt/inspect.mjs public/models/surveilance_room/antennatv.glb` con `tris` < 14000.
- [ ] **Step 4:** Escribir `credits.ts`. Comprobación: `git check-ignore public/models/surveilance_room/crt.glb` lo ignora y `git status` no enseña ningún zip ni `src/`.

### Task 2: Canales y emisiones

**Files:**
- Modify: `webpage/app/lib/content-constants.ts` (`ProjectC`)
- Create: `webpage/app/oni/room/channels.ts`
- Create: `webpage/app/oni/room/broadcasts/index.tsx`
- Create: `webpage/app/oni/room/broadcasts/Card.tsx`

**Interfaces:**
- Produces, en `content-constants.ts`:
  ```ts
  export type Broadcast = { kind: 'video'; src: string } | { kind: 'image'; src: string } | { kind: 'component'; id: string };
  // ProjectC gana campos opcionales (compatibles con el admin actual):
  channel?: number; tagline?: string; broadcast?: Broadcast;
  ```
- Produces, en `channels.ts`:
  ```ts
  export interface Channel { number: number; name: string; tagline: string; tags: string[]; web?: string; repo?: string; broadcast: Broadcast }
  export function toChannels(projects: ProjectC[]): Channel[] // ordenados por número
  export async function loadChannels(): Promise<Channel[]>     // fetch('/api/content/projects') con DEFAULT_PROJECTS de respaldo
  ```
  Reglas de `toChannels`:
  - Sin `channel`: números libres consecutivos desde 1.
  - Número repetido: gana el primero y el otro pasa al siguiente libre.
  - Sin `tagline`: se usa `desc`.
  - Sin `broadcast`: `{ kind: 'component', id: 'card' }`.
  - `repo` es `owner/name` y se convierte en `https://github.com/owner/name`.
- Produces, en `broadcasts/index.tsx`:
  ```ts
  export interface BroadcastDef { Component: React.FC<{ channel: Channel }>; paint?: (ctx: CanvasRenderingContext2D, channel: Channel, t: number) => void }
  export const BROADCASTS: Record<string, BroadcastDef> // de momento solo 'card'
  export function broadcastFor(ch: Channel): BroadcastDef // id desconocido → 'card'
  ```
- `image` cubre los GIF: en el encuadre se ven animados con `<img>`, y en la textura de la tele se ve su primer fotograma.
- `Card`:
  - Número de canal arriba a la izquierda (`CH 07`).
  - Nombre grande en Tanker y la frase debajo.
  - Rótulo que corre abajo con `tags`, con la rampa de fósforo.
  - Su `paint` dibuja lo mismo en un canvas de 512×384 para la textura de la tele.

- [ ] **Step 1:** Implementar los tipos, `toChannels`, `loadChannels`, el registro y `Card`.
- [ ] **Step 2:** Comprobar con un `console.table(toChannels(...))` temporal en desarrollo. Esperado:
  - Canales 1–4 para file-meet, ZephyrOS, tsuki y CodeDotJS.
  - Con `[{...p, channel: 2}, {...q, channel: 2}]`, el segundo pasa a 3.
  - `broadcastFor({..., broadcast: { kind: 'component', id: 'nope' }})` devuelve la definición de `card`.

### Task 3: El virus

**Files:**
- Create: `webpage/app/oni/pc/Virus.tsx`
- Modify: `webpage/app/oni/pc/Desktop.tsx` (abrir `virus: true` llama a `onVirus`; el archivo que se mueve solo)
- Modify: `webpage/app/oni/pc/Computer.tsx` (fase `'virus'`, prop `onExit`)
- Modify: `webpage/app/oni/pc/pcAudio.ts` (`laugh()`, `stuckBeeps(on: boolean)`, `detune(amount: number)`)
- Modify: `webpage/app/oni/pc/pc.css`
- Asset (de s7lver): `webpage/public/audio/laugh.m4a`

**Interfaces:**
- Consumes: `PcAudio` y el árbol `DeskNode` (el nodo con `virus: true`).
- Produces:
  - `Computer` gana las props `cctv: ImageBitmap | null` (la CAM 03, que da Hero en la tarea 5; hasta entonces `null`) y `onExit: () => void`, que se llama cuando termina el virus.
  - `Virus` gana las props `{ audio: PcAudio; cctv: ImageBitmap | null; reduced: boolean; onDone: () => void }`.

- [ ] **Step 1: El archivo que quiere ser abierto.** Lo controla un temporizador desde que se monta el escritorio, que se para si el archivo se abre:
  - A los 40 s, un temblor de 300 ms cada 5–8 s.
  - A los 70 s, saltitos de 6–10 px.
  - A los 100 s, se arrastra 2 px por frame hacia el cursor, quedándose dentro del escritorio.
  - Con movimiento reducido, solo un parpadeo del icono.
  - Nunca se abre solo.
- [ ] **Step 2:** Secuencia de `Virus` (≈10 s), con tiempos en milisegundos medidos con `performance.now()` y **sin depender de eventos de audio**:
  - **0–1200, el anzuelo:** la ventana de `passwords.txt` cambia los asteriscos por caracteres aleatorios que se desbordan.
  - **1200–6000, la infección:**
    - Ventanas de error en cascada, con el intervalo bajando de 400 a 60 ms. Texto exacto: `c0rr#pt.exe has performed an illegal operation`.
    - Los iconos caen con gravedad.
    - El cursor deja 8 copias de estela.
    - La terminal añade `pid 7   escalate  root`.
    - `stuckBeeps(true)`, `hdd` continuo y `detune` subiendo de 0 a 1.
  - **6000–9000, la risa:** todo congelado, la máscara de `../mask` en grande en el centro y "HA HA HA" rellenando la pantalla línea a línea. La mandíbula alterna las filas 26–31 de `RAW` desplazadas 1–2 celdas hacia abajo cada 180 ms. `audio.laugh()` suena con banda de radio y algo de saturación.
  - **9000–10000:** la pantalla se convierte en la imagen `cctv`, en gris virado a rojo, con grano, el rótulo `CAM 03` y la hora. Después, `onDone()`.
  - Versión de movimiento reducido: las mismas fases con fundidos de 600 ms, sin cascada ni estela ni destellos, y una sola ventana de error.
  - Si `cctv` es null, se usa la última imagen tramada del fondo `room` (`/pc/room.webp`).
- [ ] **Step 3:** `laugh()` carga `/audio/laugh.m4a` con `fetch`/`decodeAudioData`. Si falla, sigue sin sonido y sin errores en la consola, salvo un `console.info` en desarrollo.
- [ ] **Step 4: Comprobación** en `?pc`, entrando y abriendo `passwords.txt`:
  - La secuencia completa dura unos 10 s y acaba en la imagen de cámara.
  - Renombrando temporalmente `laugh.m4a`, el virus termina igual.
  - Con movimiento reducido emulado en DevTools, no hay ni un destello.
  - Esperando 100 s, el archivo se arrastra hacia el cursor.

### Task 4: La escena de la sala

**Files:**
- Create: `webpage/app/oni/room/surveillanceScene.ts`
- Create: `webpage/app/oni/room/wall.ts`
- Create: `webpage/app/oni/room/screenMaterial.ts`

**Interfaces:**
- Consumes: `Channel[]` y `broadcastFor` (tarea 2), y los GLB (tarea 1).
- Produces, en `wall.ts`:
  ```ts
  export interface TvSlot { model: 'tvstack' | 'crt' | 'oldtv' | 'retrotv' | 'antennatv'; position: [number, number, number]; rotY: number; scale: number; screenCount: number }
  export function layoutWall(screens: number, seed: number): TvSlot[]
  ```
  `layoutWall` apila filas sobre un arco poco profundo frente a la consola:
  - Ancho del arco: unas 8 teles en escritorio.
  - Las filas crecen hacia arriba y hacia los lados según `screens`.
  - Mínimo de 30 pantallas.
  - Jitter de ±3° en `rotY` y de ±4 cm en x y z.
  - `antennatv` aparece como mucho 2 veces y `tvstack` cuenta como 9 pantallas.
  - Determinista con la misma semilla.
- Produces, en `screenMaterial.ts`: `createScreenMaterial(): THREE.ShaderMaterial` con uniforms:
  - `tFeed`: textura del canal o de la cámara.
  - `uMode`: 0 estática, 1 feed, 2 trozo de la flecha.
  - `uArrow`: textura compartida de la flecha.
  - `uWallUv`: vec4 con el rectángulo de esta pantalla dentro del muro.
  - `uOff`: 0 → 1, el apagado que encoge a un punto blanco.
  - `uTime` y `uFocus`.

  El shader añade la curvatura del cristal, las líneas de barrido y la estática con banda de interferencia.
- Produces, en `surveillanceScene.ts`:
  ```ts
  export class SurveillanceScene {
    constructor(opts: { canvas: HTMLCanvasElement; channels: Channel[]; feeds: ImageBitmap[]; reduced: boolean; onReady: () => void })
    readonly screens: { mesh: THREE.Mesh; channel?: Channel }[]   // canal i → screens[i], el resto estática
    remote: THREE.Object3D
    startIntro(): Promise<void>        // tarea 6
    focus(index: number): Promise<void>// tarea 7
    screenRect(index: number): DOMRect | null
    powerOff(): Promise<void>          // tarea 8
    resize(): void
    dispose(): void
  }
  ```
- La escena:
  - Suelo y paredes oscuros, niebla y luz roja tenue (dos spots rojos bajos y un relleno muy suave).
  - Cables (reutilizar `public/models/room/cables.glb`, varias copias rotadas por el suelo).
  - La consola: una caja baja con tapa inclinada, con los materiales de la habitación, hasta que haya modelo.
  - El mando sobre la consola y una `camera.glb` en una esquina alta.
- **Pantallas de los modelos de una sola malla** (`oldtv`, `retrotv`): poner un plano encima de la abertura de la pantalla. Su tamaño y posición se miden a ojo con un helper de desarrollo y se apuntan en una tabla `TV_MODELS` dentro de `wall.ts`.
- **Posprocesado:** el de la habitación (Bloom + OutputPass + SMAA, sin N8AO).

- [ ] **Step 1:** Implementar `wall.ts` y `TV_MODELS` (escala para que cada tele mida 0.45–0.6 m de ancho, pantalla incluida).
- [ ] **Step 2:** Implementar el material y la escena, de momento con todas las pantallas en estática.
- [ ] **Step 3: Comprobación** con un atajo temporal en la tarea 6. Hasta entonces, una página de prueba `app/oni/room/dev/page.tsx`, que se borra al acabar la tarea 6. Esperado:
  - Un muro de 30 o más teles mezcladas, todas con estática.
  - Luz roja tenue y 60 fps en el monitor de rendimiento de DevTools.

### Task 5: Las imágenes de cámara de la habitación

**Files:**
- Modify: `webpage/app/oni/roomScene.ts` (método nuevo)
- Modify: `webpage/app/oni/Hero.tsx`

**Interfaces:**
- Produces: `HeroScene.cctv(): Promise<ImageBitmap[]>`. Son 6 fotos de 480×360 de la habitación desde poses de cámara de seguridad, todas en las esquinas altas mirando hacia abajo. La `[2]` es la CAM 03: desde arriba, encuadra la cama y el escritorio a la vez.
- Para hacer las fotos:
  - Se renderizan con el renderer de la habitación, sin el pase de lente (sin párpados ni viñeta), a un render target.
  - Se leen con `readRenderTargetPixels` y se convierten con `createImageBitmap`.
  - La cámara principal y el estado se restauran después.
- Hero:
  - Al entrar en el ordenador, guarda `cctv()` en una ref antes de `setVisible(false)`.
  - Pasa la CAM 03 al `Computer` y todas a la sala.
  - Al montarse la sala, llama a `scene.dispose()`.

- [ ] **Step 1:** Implementar `cctv()` y el cableado en Hero.
- [ ] **Step 2: Comprobación** en desarrollo, volcando las seis imágenes en un `<canvas>` temporal: se reconoce la habitación desde arriba en las seis, y la `[2]` encuadra la cama y el escritorio.

### Task 6: Montaje, llegada y flecha

**Files:**
- Create: `webpage/app/oni/room/Room.tsx`
- Create: `webpage/app/oni/room/room.css`
- Modify: `webpage/app/oni/Hero.tsx` (montar `Room` con `createPortal` cuando `Computer` llama a `onExit`, y desmontar `Computer`)
- Modify: `webpage/app/page.tsx` (importar `room.css`)

**Interfaces:**
- Consumes: `SurveillanceScene`, `loadChannels`, `cctv` (tarea 5).
- Produces: `Room` con las props `{ feeds: ImageBitmap[]; fontFamily: string }`, exportado con `memo` (por el reloj de Hero, como `Computer`).
- Atajo de desarrollo: `?room` monta `Room` directamente, con `feeds` sacadas de `/pc/room.webp`. `?room&channels=60` multiplica los canales de relleno.

- [ ] **Step 1: La llegada** (`startIntro`):
  - La cámara empieza tan pegada a la pantalla 0 (la de la CAM 03) que esa pantalla llena el viewport igual que la imagen final del virus, así que el corte de DOM a 3D no se nota.
  - Retrocede 3.5 s con easing suave hasta el plano general.
  - El resto de pantallas enseñan las `feeds` repartidas, cada una con su rótulo `CAM 0N`.
- [ ] **Step 2: La flecha.** A los 2 s del plano general, todas las pantallas pasan a `uMode = 2`:
  - Una flecha de píxeles, tramada en la rampa, dibujada en un canvas del tamaño del muro, y cada pantalla enseña su trozo según `uWallUv`.
  - Apunta a la proyección del mando sobre el plano del muro.
  - Sus chevrones se desplazan hacia el mando en bucle.
  - El cursor sobre el mando cambia a `pointer`.
- [ ] **Step 3: Accesibilidad y respaldo.** Un `<nav aria-label="Channels">` oculto visualmente (visible al recibir foco), con un enlace por canal (`CH 07 · ZephyrOS`). Si WebGL falla, esa lista es lo que se ve, con el estilo de la tarjeta.
- [ ] **Step 4: Comprobación:**
  - El recorrido completo, de la habitación al virus y a la sala: no se ve el corte entre la imagen del virus y la tele.
  - La flecha se lee en el muro y apunta al mando.
  - `?room&channels=60`: el muro crece y no baja de unos 50 fps.
  - Quitar entonces la página de prueba de la tarea 4.

### Task 7: El mando y los canales

**Files:**
- Create: `webpage/app/oni/room/remote.ts`
- Modify: `webpage/app/oni/room/surveillanceScene.ts`
- Modify: `webpage/app/oni/room/Room.tsx`

**Interfaces:**
- Produces, en `remote.ts`:
  ```ts
  export type RemoteButton = 'power' | 'chUp' | 'chDown' | 'ok' | 'source' | `d${0|1|2|3|4|5|6|7|8|9}`
  export const REMOTE_BUTTONS: { id: RemoteButton; uv: [number, number, number, number] }[] // u0,v0,u1,v1 en la textura
  export function buttonAt(uv: THREE.Vector2): RemoteButton | null
  ```
  Rectángulos de partida, medidos en la textura de 1024 px (x0,y0,x1,y1; v = y/1024, origen arriba como glTF). **Hay que comprobarlos** con un registro en desarrollo del uv de cada clic y corregir lo que no cuadre:

  | botón | rectángulo |
  |---|---|
  | power | 66,868,112,914 |
  | chUp / chDown | 398,762,442,806 / 398,806,442,852 |
  | ok | 726,862,774,910 |
  | source | 543,885,567,927 |
  | d9 | 3,805,42,850 |
  | d5 | 45,805,85,850 |
  | d7 | 88,805,128,850 |
  | d6 | 132,805,172,850 |
  | d8 | 176,805,216,850 |
  | d0 | 252,862,296,920 |
  | d4 | 310,862,352,920 |
  | d2 | 656,862,700,920 |
  | d1 | 726,798,766,850 |
  | d3 | 770,798,812,850 |

- [ ] **Step 1: Coger el mando.** El clic en el mando lo trae a la esquina inferior derecha de la vista (tween de 0.6 s) y desde ahí sus botones se pueden pulsar con raycast y `buttonAt`. Cada pulsación hunde el botón: un decal brillante sobre su rectángulo durante 120 ms, con el clic de `PcAudio`.
- [ ] **Step 2: Canales.**
  - `chUp` y `chDown` recorren los canales en bucle.
  - Los dígitos componen un número: se espera 1.5 s al siguiente dígito y en pantalla aparece `CH _7` arriba a la derecha, en la rampa. Si el número no existe, se va al canal existente más cercano.
  - Teclado: flechas arriba/abajo, dígitos, Enter = OK y `S` = SOURCE.
  - `focus(i)`:
    - La cámara viaja 1.2 s (`power2.inOut`) hasta un encuadre frontal de `screens[i]`, con la pantalla ocupando el 70 % del alto.
    - Durante el viaje, esa pantalla da estática con un golpe de ruido.
    - Si llega otro `focus` a mitad, se cancela el tween y gana el último.
    - Con movimiento reducido, corte sin viaje.
- [ ] **Step 3: La emisión encima.**
  - Al llegar, `Room` monta `broadcastFor(ch).Component` en un `div` posicionado con `screenRect(i)`, que se recalcula en el resize.
  - Durante el viaje no hay overlay.
  - Las demás pantallas con canal pintan su `paint` (o el vídeo como `VideoTexture`) a 10 fps. Las de fuera del encuadre van a 2 fps.
  - Una emisión `video` que da error vuelve a estática, y el overlay usa `card`.
- [ ] **Step 4: OK y SOURCE.** OK abre `channel.web` en una pestaña nueva y SOURCE abre `channel.repo`. Si el canal no tiene ese enlace, suena el pitido de error.
- [ ] **Step 5: Comprobación:**
  - Coger el mando y pulsar CH+ diez veces seguidas: la cámara acaba en la última y no hay dos overlays.
  - Teclear `0` y `3`: va al canal 3.
  - Redimensionar con una tele encuadrada: la emisión sigue alineada.
  - Un canal con `broadcast: { kind: 'video', src: '/nope.mp4' }`: estática en la tele y tarjeta en el encuadre.
  - OK abre la web y SOURCE abre GitHub.

### Task 8: Apagar

**Files:**
- Modify: `webpage/app/oni/room/surveillanceScene.ts`
- Modify: `webpage/app/oni/room/Room.tsx`
- Modify: `webpage/app/oni/Hero.tsx`

**Interfaces:**
- Produces: `powerOff()`.
  - Todas las pantallas pasan `uOff` de 0 a 1 en 0.45 s, con un desfase aleatorio de hasta 120 ms entre ellas.
  - Las luces bajan a 0.
  - Suena el "clonc" del tubo (sinusoide de 60 Hz con ruido corto).
- Produces: `Room` gana la prop `onExit()`, que se llama 1.5 s después del apagado.
- Hero, al recibir `onExit`:
  - Desmonta `Room`.
  - Quita `overflow: hidden` y arranca Lenis.
  - Hace scroll a `.oni-next`, que es donde se construirá §6.4. El reflejo de la figura queda para §6.4.

- [ ] **Step 1:** Implementar `powerOff()` y la salida.
- [ ] **Step 2: Comprobación:**
  - El botón rojo apaga todas las teles con el punto blanco y llegas a la sección siguiente con el scroll ya libre.
  - Nada sigue sonando ni renderizando: el canvas de la sala desaparece del DOM y la pestaña de rendimiento ya no muestra frames de three.

### Task 9: Repaso final

- [ ] **Step 1:** Recorrido completo en escritorio y en móvil (375×812): habitación, ordenador, virus, sala y apagado. En el móvil, la emisión encuadrada se puede leer y el mando se puede usar con el dedo.
- [ ] **Step 2:** `npx tsc --noEmit -p .` limpio. Quitar los registros de desarrollo de los uv del mando.
- [ ] **Step 3:** Repasar la ley anti-slop punto por punto y corregir lo que falle.
- [ ] **Step 4:** Enseñárselo a s7lver. **Solo con su aprobación**, un commit con todo lo pendiente de la rama y el pie de autoría que indique el sistema.
