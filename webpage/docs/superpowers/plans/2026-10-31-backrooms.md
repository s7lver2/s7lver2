# Backrooms: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El easter egg de `juegos/backrooms.exe`: un juego en primera persona completo, grabado con una
camcorder de los 80, que da los logros «Noclip» y «Good job idiot, now what?».

**Architecture:**
- **Assets:** un script de Blender junta cada personaje con todas sus animaciones y saca piezas sueltas de
  `backrooms_vr2`. Un trabajo nuevo de `tools/models/build.mjs` los comprime.
- **Juego:** vive en `app/oni/backrooms/`:
  - un generador de laberintos puro (`maze.ts`)
  - una clase `BackroomsGame` sin React, con renderer, mundo, jugador, entidades, pasada VHS y audio
  - un caparazón React (`Backrooms.tsx`) con la carga de los 90, el menú, el HUD, la pausa, los controles
    táctiles y el cuelgue falso
- **Entrada:** `Computer.tsx` lo abre tras reiniciar, y el juego le devuelve el control al escritorio o recarga
  la web al ganar.

**Tech Stack:** Next 14, React, three.js r160 (`SkeletonUtils`, `EffectComposer` ya en uso), gsap, Web Audio,
Blender 4.5 (`tools/.blender/`), gltf-transform (`tools/models/`). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-31-backrooms-design.md`

## Global Constraints

- **Sin dependencias nuevas y sin tests automáticos.**
  - Cada tarea se verifica en el navegador: pestaña «tab-1», y luego se vuelve a la «seed».
  - También con `npx tsc --noEmit`.
- **Idioma:** textos de la interfaz en inglés. Comentarios en español, con la densidad del código de alrededor.
- **Peso:** todo lo del juego, preparado, en **≤ 25 MB**. La página normal no descarga nada del juego hasta que se
  abre `backrooms.exe` (`import()` dinámico).
- **Rendimiento:** 30 fps en un Android de gama media.
  - En el móvil (`pointer: coarse`, o `&low` en desarrollo) hay calidad baja: densidad de píxeles 0,75, sin
    sombras y VHS barata.
  - En escritorio, `governor` de `app/oni/quality.ts`.
- **Firefox:** todo se compila en la pantalla de carga con `compileGently`, sujetando `holdStill()`
  (`app/oni/compile.ts`, `app/oni/still.ts`).
  - **Número de luces fijo** durante toda la partida, para no recompilar: una `SpotLight` (la linterna), una
    `HemisphereLight` y como mucho 4 `PointLight` que siguen a las lámparas más cercanas.
- **Misiones:** 8 cintas, 2 fotos de entidades distintas cualesquiera, y el ascensor solo con todo.
  - Al empezar hay 1 bacteria y 1 partygoer.
  - Matar una saca otra del tipo contrario lejos del jugador, ×1,15 de velocidad y +1 tiro de vida respecto a la
    que murió.
- **Pistola:** sale en más o menos el 50 % de las partidas, con 6 balas en total, sin más munición.
- **Duración:** partida buena de ≤ 10 min, unos 7–10 min sin perderse.
- **Logros:**
  - `backrooms`, «Noclip», ya existe.
  - Nuevo: id `idiot`, nombre `Good job idiot, now what?`, desc `Killed something in the Backrooms.`. Solo la
    primera vez.
- **Nunca** se cuelga ni se cierra el navegador de verdad, y nada imita la pantalla de error de Chrome o
  Firefox.
- **Movimiento reducido** (`prefers-reduced-motion` o `&reduced`): sin balanceo de cabeza y VHS suave.
- **Atajos de desarrollo** solo con `process.env.NODE_ENV === 'development'`:
  - `?backrooms` salta directo al juego (sin habitación ni ordenador)
  - `&seed=N` fija el laberinto
  - `&god` hace al jugador inmortal
  - `&nopar` (ya existe) imita Firefox
- **No tocar** `tools/.bake/meta.json` ni `scene.glb`. La `.claude/` de la raíz se queda sin commitear.
- **Ley anti-slop** de `webpage/.claude/CLAUDE.md`, repasada punto por punto al final.
- **Commits:** ninguno por tarea. Un solo commit al final, cuando el usuario lo apruebe.

## Review Focus

1. **Puntero bloqueado que el navegador suelta:** Escape, cambiar de pestaña o una ventana del sistema pausan el
   juego. Volver con Resume lo vuelve a pedir, y en táctil no hace falta. Nunca queda el ratón libre con el juego
   corriendo.
2. **Pestaña oculta o fotograma larguísimo:** el `dt` se limita a 0,05 s y la pestaña oculta pausa. Ninguna
   entidad se teletransporta encima del jugador al volver.
3. **Laberinto siempre ganable:** las 8 cintas, la cámara, la pistola, el ascensor y el arranque de las entidades
   se alcanzan desde el inicio sin pasar por un hueco. La misma semilla da el mismo laberinto.
4. **Entrar y salir muchas veces** (morir, Quit, morir otra vez…): cada salida libera el contexto WebGL
   (`forceContextLoss`), el audio y los listeners. A la décima partida no hay avisos de demasiados contextos.
5. **Assets que no cargan** (404, sin red): la pantalla de carga dice que ha fallado y vuelve al escritorio. La
   barra nunca se queda congelada.

---

### Task 1: Los assets preparados

**Files:**
- Create: `tools/models/backrooms.py` (Blender: personajes y piezas), `tools/models/backrooms-tex.mjs` (texturas
  repetibles)
- Modify: `tools/models/build.mjs` (set `backrooms`)
- Output: `public/models/backrooms/*.glb`, `public/models/backrooms/tex/*.webp`

**Interfaces:**
- **Produces** (todo en metros, con el origen en la base y centrado en x/z):
  - **Personajes:** `hazmat.glb`, `bacteria.glb`, `partygoer.glb`. Una malla con piel y todas sus animaciones,
    cada clip con el nombre del archivo de Mixamo sin extensión (`'Neutral Idle'`, `'Walking222'`, `'Jump Attack'`,
    …). Andar y correr ya están *In Place*.
  - **Globo:** `balloon.glb`, el globo del partygoer.
  - **Objetos:** `camcorder.glb`, `vhs.glb`, `gun.glb`, `flashlight.glb` (simplificada a ≤ 15 000 vértices) y
    `elevator.glb` (con su clip de puertas `'02'`).
  - **Piezas de `backrooms_vr2`**, una por archivo, sacadas por partes sueltas: `lamp.glb` (un panel de luz del
    techo), `vent.glb`, `socket.glb`, `exit.glb` (cartel), `door.glb`, `armchair.glb`.
  - **Texturas repetibles** (1024², webp): `tex/wall.webp`, `tex/carpet.webp`, `tex/ceiling.webp`.

- [ ] **Step 1:** `backrooms.py`, la parte de personajes (`blender -b -P backrooms.py -- chars`).
  - Por cada personaje, importa sus FBX de `public/models/backrooms/animations/`. El reparto está en la tabla de
    la spec: la malla dice de quién es cada uno (15 648 vértices bacteria, 4 244 partygoer, 38 678 hazmat).
  - Se queda con la malla y el esqueleto del primero y pasa cada acción a ese esqueleto con el nombre del archivo.
  - Exporta glTF con todas las acciones (NLA), a `public/models/backrooms/src/<char>/scene.gltf`.
  - El globo sale de `partygoer_from_backrooms_updated` (el nodo `Baloon`) a `src/balloon/`.
- [ ] **Step 2:** `backrooms.py`, la parte de piezas (`-- pieces`).
  - Importa `backrooms_vr2` y separa por partes sueltas las mallas `Ceiling_Lamp`, `Vent_1`, `Socket_1`,
    `Exit_Sign` (más `Exit_Traslucent`), `Exit_Door` y `ArmChair_1`.
  - De cada una se queda con la parte suelta más grande (la puerta y el sillón, con todas las piezas que caen en
    su caja).
  - Exporta cada una a `src/<pieza>/scene.gltf`.
- [ ] **Step 3:** `backrooms-tex.mjs` (sharp).
  - Recorta de `Wall_1`, `Moquette_1` y `Ceiling_1` un trozo de 512–1024 px sin sombras ni bordes.
  - Elige el rectángulo mirando la textura: apúntalo en el script como constante, con un comentario de qué zona es.
  - Lo hace repetible mezclando en espejo los bordes en una franja del 12 %, y escribe `tex/*.webp` (calidad 82).
- [ ] **Step 4:** set `backrooms` en `build.mjs` con un trabajo por glb.

  | Asset | Textura |
  |---|---|
  | Personajes | 1024 (hazmat 2048 en el cuerpo si cabe en el presupuesto) |
  | Objetos | 512 |
  | Piezas | 512 |

  - `flashlight` con `simplify` hasta ≤ 15 000 vértices.
  - Los zips de `public/models/backrooms/` se descomprimen a `src/` como en los demás sets.
- [ ] **Step 5:** verificar.
  - `node tools/models/build.mjs backrooms` sin errores.
  - La suma de `public/models/backrooms/*.glb` + `tex/` es ≤ 25 MB (`du -ch`).
  - `npx gltf-transform inspect` de cada personaje lista todos sus clips.
  - Render de vista previa en Blender de cada pieza y de cada textura repetida 3×3: sin costuras visibles.

### Task 2: De `backrooms.exe` al menú

**Files:**
- Create: `app/oni/backrooms/Backrooms.tsx`, `app/oni/backrooms/backrooms.css`
- Modify: `app/oni/pc/Desktop.tsx` (abrir la app), `app/oni/pc/Computer.tsx` (reinicio y fase `game`),
  `app/page.tsx` o donde se importen los css de oni (importar `backrooms.css`)

**Interfaces:**
- **Consumes:** Task 1 (los glb, solo para la barra de carga).
- **Produces:**
  - `Desktop` recibe `onApp(app: string): void`, que sustituye a `audio.error()` para `app === 'backrooms'`. Las
    demás apps siguen con el pitido.
  - `Computer` tiene la fase `'game'`: `onApp('backrooms')` hace el reinicio (`setPhase('post')` + `power`).
    Tras el POST, en vez de ONI//OS, va a `'game'` y monta `<Backrooms>`, que cubre todo `.pc`, cristal incluido.
  - `<Backrooms onQuit={() => void} onWin={() => void} />`. `onQuit` vuelve a la fase `'desk'`. `onWin` hace
    `window.scrollTo(0, 0)` + `location.reload()`.
  - La fase del caparazón: `type Screen = 'load' | 'menu' | 'play' | 'pause' | 'dead' | 'crash'`.

- [ ] **Step 1:** la carga de los 90.
  - Negro con letra blanca monoespaciada (la pila `--pc-font`), un encabezado `BACKROOMS` y la línea
    `Loading assets... this may take a while.`.
  - Debajo, una barra de bloques que avanza con el progreso real de `BackroomsGame.load`. Hasta la Task 3, el
    progreso es una carga de prueba de los glb.
  - Mientras carga, `holdStill()`.
  - Si falla, `Failed to load. Press any key.` y `onQuit`.
- [ ] **Step 2:** el menú. Título `BACKROOMS` y tres botones: `Play`, `Options`, `Quit`.
  - `Quit`, al pulsarlo, se descuelga: gira sobre una esquina, se suelta y cae fuera de la pantalla con gravedad
    (gsap). Desaparece del DOM y no vuelve en este menú.
  - `Options` agarra el cursor. Oculta el cursor real (`cursor: none`) y pinta uno falso (`ARROW` de
    `pc/pixels.ts`) que viaja con una curva hasta `Play` en ~0,9 s. Al llegar, «pulsa» con un pequeño hundimiento,
    y empieza la partida.
  - En táctil, el cursor falso sale donde está el dedo.
  - Escape en el menú lleva a `onQuit`.
  - Movimiento reducido: el botón cae sin girar, y el cursor va en línea recta.
- [ ] **Step 3:** atajo `?backrooms`. `Hero.tsx` monta `<Backrooms>` directo, sin habitación ni carga de la web.
  `onQuit` y `onWin` recargan sin el parámetro.
- [ ] **Step 4:** verificar.
  - Doble clic en `juegos/backrooms.exe`: reinicio con POST, carga con barra y menú.
  - `Quit` se cae y no vuelve. `Options` lleva el cursor a `Play`.
  - Escape vuelve al escritorio.
  - Las otras apps siguen pitando.
  - `npx tsc --noEmit` limpio.

### Task 3: El laberinto

**Files:**
- Create: `app/oni/backrooms/maze.ts`, `app/oni/backrooms/world.ts`, `app/oni/backrooms/game.ts`

**Interfaces:**
- **Produces:**
  - Tipos del laberinto:
    ```ts
    export type Cell = { x: number; y: number };
    export interface Maze {
      w: number; h: number;              // en celdas de 3 m
      open: Uint8Array;                  // w*h, 1 = suelo, 0 = pared
      voids: Cell[];                     // huecos al vacío (suelo abierto que no se pisa)
      start: Cell; elevator: Cell; camera: Cell; pistol: Cell | null;
      tapes: Cell[];                     // 8
      spawns: Cell[];                    // arranque de bacteria y partygoer, y candidatos para las que reaparezcan
      lamps: Cell[];                     // celdas con panel de luz encendido
      props: { cell: Cell; kind: 'vent' | 'socket' | 'armchair' | 'exit' | 'door'; rot: number }[];
    }
    export function generateMaze(seed: number): Maze;
    ```
  - `class World { constructor(maze: Maze, assets: Assets); root: THREE.Group; solid(x: number, z: number): boolean; voidAt(x: number, z: number): boolean; lightsNear(p: THREE.Vector3): THREE.Vector3[] }`
  - `class BackroomsGame { constructor(canvas: HTMLCanvasElement, opts: { low: boolean; reduced: boolean }); load(progress: (f: number) => void): Promise<void>; start(seed: number): void; dispose(): void }`
    (crece en tareas siguientes).

- [ ] **Step 1:** `generateMaze`.
  - PRNG con semilla (mulberry32).
  - Rejilla de unos 26×26 celdas. Habitaciones rectangulares de 2–5 celdas unidas por pasillos, más un 15 % de
    paredes quitadas para que haya bucles y no sea un árbol.
  - Los huecos al vacío (4–6) solo en celdas cuya retirada no desconecte nada: se comprueba con BFS desde `start`
    con el hueco puesto.
  - El ascensor en la celda más lejana del inicio. La cámara a 3–6 celdas del inicio. Las cintas repartidas, a ≥ 4
    celdas entre ellas.
  - La pistola, con probabilidad 0,5 (si no, `null`), en un rincón sin salida a ≥ 8 celdas del inicio.
  - Ajusta el tamaño para que el recorrido BFS inicio → cámara → cintas (vecino más cercano) → ascensor sume unas
    400–550 celdas: andando a 1,4 m/s, unos 7–10 min contando búsqueda.
- [ ] **Step 2:** atajo de desarrollo: `window.__maze(seed)` imprime el laberinto en ASCII en la consola. Hay que
  comprobar que es determinista y que todo es alcanzable con BFS, y pintarlo con 5 semillas.
- [ ] **Step 3:** `World`.
  - Suelo, techo y paredes como `InstancedMesh` de cajas de 3 × 2,7 m con las texturas repetibles de la Task 1, en
    repetición por metro.
  - En los huecos, un agujero negro con un borde de moqueta rota.
  - Un panel `lamp.glb` cada 2 celdas de techo, emisivo (alguno parpadeando y alguno apagado). Las piezas
    repartidas según `props`, el ascensor en su celda y niebla amarilla oscura.
  - Las luces son las fijas de Global Constraints. Las 4 `PointLight` se mueven cada fotograma a las 4 lámparas
    encendidas más cercanas al jugador.
- [ ] **Step 4:** `BackroomsGame`.
  - `load` descarga los glb de la Task 1 con progreso. Compila con `compileGently` mientras la carga sujeta
    `holdStill()`.
  - `start(seed)` monta el mundo.
  - De momento, cámara libre (WASD + ratón) para mirarlo.
- [ ] **Step 5:** verificar.
  - Con `?backrooms&seed=1`, Play deja recorrer el laberinto con la cámara libre: paredes texturadas sin costuras,
    lámparas y piezas.
  - Con `&nopar`, la consola muestra `[compile]` con todo durante la carga y ninguno después.

### Task 4: El jugador

**Files:**
- Create: `app/oni/backrooms/input.ts`, `app/oni/backrooms/player.ts`, `app/oni/backrooms/Touch.tsx`
- Modify: `app/oni/backrooms/game.ts`, `app/oni/backrooms/Backrooms.tsx`

**Interfaces:**
- **Consumes:** `World.solid`, `World.voidAt` (Task 3).
- **Produces:**
  - El estado de los controles:
    ```ts
    export interface Controls {
      move: THREE.Vector2; look: THREE.Vector2;   // look: radianes este fotograma
      run: boolean; jump: boolean; flash: boolean; // flash: alterna la linterna (pulsación)
      use: boolean; fire: boolean; reload: boolean; swap: boolean; pause: boolean; // pulsaciones
    }
    export class Input { constructor(el: HTMLElement); read(): Controls; lock(): void; dispose(): void }
    ```
  - `class Player { pos: THREE.Vector3; yaw: number; pitch: number; hand: 'none' | 'camera' | 'gun'; has: { camera: boolean; gun: boolean }; ammo: number; update(dt: number, c: Controls): void; onFall?: () => void }`
  - `BackroomsGame.pause(): void`, `resume(): void`, `onPause?: () => void`.

- [ ] **Step 1:** `Input`.
  - **Teclado:**
    - WASD o flechas para moverse
    - Shift para correr y espacio para saltar
    - F para la linterna y E para usar o recoger
    - clic para disparar o hacer la foto
    - R para recargar
    - Q o la rueda para cambiar de mano
    - Escape para pausar
  - **Ratón:** con `requestPointerLock`.
  - **Táctil**, vía `Touch.tsx`:
    - joystick a la izquierda
    - arrastrar en la mitad derecha para mirar
    - botones de saltar, correr, linterna, usar, cambiar y disparar
  - Los botones táctiles son del mundo del juego (OSD de la cámara) y siguen la ley anti-slop: nada de círculos
    de cristal.
  - `pointerlockchange` sin bloqueo, `blur` o `visibilitychange` oculto → `pause` a true.
  - El botón de atrás del móvil: `history.pushState` al empezar la partida y `popstate` → pausa.
- [ ] **Step 2:** `Player`.
  - Velocidades: 1,4 m/s andando y 3,2 corriendo. Salto de 0,9 m con gravedad de 9,8.
  - Colisión con la rejilla con un radio de 0,3 m.
  - Si pisa un hueco, cae, y a 3 m por debajo del suelo llama a `onFall`.
  - Ojos a 1,62 m. Balanceo de cabeza de camcorder, que no hay con movimiento reducido.
  - `dt` limitado a 0,05.
- [ ] **Step 3:** el cuerpo.
  - `hazmat.glb` con `AnimationMixer`: `Neutral Idle`, `Walking222`, `Slow Run`, con cruce de 0,2 s. La velocidad
    del clip va con la velocidad real.
  - La cabeza y el cuello se esconden (escala 0 del hueso `Head`), y la cámara se pega al hueso de la cabeza con un
    pequeño adelanto.
  - Brazos en primera persona:
    - se sobreescriben por código los huesos del brazo derecho (objeto en la mano) y el izquierdo (linterna)
      después del mixer, con una pose fija que apunta al centro de la vista
    - si faltan clips de salto o disparo, se hace igual, por código
  - La linterna (`flashlight.glb` + la `SpotLight`, ángulo 0,45 rad y alcance 14 m) va en la mano izquierda.
  - Con la pistola en la mano, el tronco usa `Rifle Idle` en vez de `Neutral Idle` (las piernas siguen andando).
- [ ] **Step 4:** la pausa.
  - `Screen 'pause'`, con el juego congelado y dos botones: `Resume` (vuelve a pedir el bloqueo) y `Quit`
    (`onQuit`).
  - El mismo aspecto que el menú.
- [ ] **Step 5:** verificar.
  - En escritorio: andar, correr, saltar, chocar con paredes y caer por un hueco (se llama a `onFall`, de momento
    un `console.info`).
  - Al mirar abajo se ven piernas y botas.
  - Escape pausa, y Resume vuelve a bloquear el ratón.
  - En móvil (`resize_window` mobile + recarga): joystick, mirar y botones.
  - Cambiar de pestaña pausa.

### Task 5: La grabación (VHS, HUD y sonido)

**Files:**
- Create: `app/oni/backrooms/vhsPass.ts`, `app/oni/backrooms/audio.ts`
- Modify: `app/oni/backrooms/game.ts`, `app/oni/backrooms/Backrooms.tsx`, `app/oni/backrooms/backrooms.css`

**Interfaces:**
- **Produces:**
  - `VhsShader` (uniforms `uTime`, `uRes`, `uMove`, `uCorrupt` 0–1, `uFlash` 0–1), para `ShaderPass`.
  - `class GameAudio { constructor(ctx?: AudioContext); start(): void; step(run: boolean): void; near(kind: 'bacteria' | 'partygoer', d: number): void; shot(): void; shutter(): void; pickup(): void; elevator(): void; corrupt(f: number): void; dispose(): void }`
  - `BackroomsGame.hud: { rec: boolean; tapes: number; photos: number; ammo: number | null; battery: number }`,
    que se lee desde React cada 250 ms.

- [ ] **Step 1:** `VhsShader`.
  - Como `app/oni/room/cctvPass.ts`, pero de cinta y no de cámara de seguridad:
    - estática fina siempre
    - sangrado de croma horizontal
    - banda de tracking que sube a ratos
    - líneas de barrido y viñeteado
    - blancos quemados y curva de tubo ligera
  - `uCorrupt` sube todo: desplaza filas, rompe en bloques, congela trozos y llega a casi solo nieve.
  - `uFlash` es el blanco del flash de la foto.
  - En calidad baja, sin sangrado de croma y con la mitad de muestras. Con movimiento reducido, sin banda ni
    saltos.
- [ ] **Step 2:** el OSD (DOM encima del lienzo, letra monoespaciada en mayúsculas con borde de croma).
  - Arriba a la izquierda, `● REC` parpadeando y el contador de la cinta.
  - Arriba a la derecha, la batería en bloques.
  - Abajo a la izquierda, la fecha y hora estilo VHS (`OCT 31 1994  23:52:07`).
  - Abajo a la derecha, `TAPES 3/8`, `PHOTOS 1/2` y `AMMO 6` (solo con la pistola).
  - Es dato de verdad, así que el mono aquí es correcto.
  - Sin cajas, sin pastillas y sin bordes alrededor.
- [ ] **Step 3:** `GameAudio`, todo sintetizado como `app/oni/pc/pcAudio.ts`.
  - Zumbido de fluorescentes: 120 Hz con armónicos y un ruido filtrado que respira.
  - Pasos sobre moqueta: ruido grave con envolvente corta, más rápidos al correr.
  - Siseo de cinta.
  - Para cada entidad, un sonido que sube de volumen al acercarse:
    - bacteria: chasquidos y crujidos
    - partygoer: un pitido de fiesta desafinado y una risita
  - Disparo, obturador, recoger y ascensor.
  - `corrupt(f)` distorsiona y corta todo.
- [ ] **Step 4:** verificar. La imagen de la partida tiene estática, croma, tracking y OSD. Con `__game.corrupt(1)`
  en la consola la grabación se rompe. Hay zumbido y pasos, y con movimiento reducido no hay banda.

### Task 6: Objetos, misiones y la salida

**Files:**
- Create: `app/oni/backrooms/items.ts`
- Modify: `app/oni/backrooms/game.ts`, `app/oni/backrooms/player.ts`, `app/oni/backrooms/Backrooms.tsx`

**Interfaces:**
- **Consumes:** `Maze.tapes/camera/pistol/elevator` (Task 3), `Player.has/hand/ammo` (Task 4),
  `GameAudio` (Task 5).
- **Produces:**
  - `BackroomsGame.onWin?: () => void`
  - `BackroomsGame.photo(): boolean`: hace la foto y dice si contó. La usa la Task 7.
  - `photographed: Set<Entity>`

- [ ] **Step 1:** las cintas.
  - `vhs.glb` tumbadas en el suelo, girando un poco y con un reflejo para que se vean con la linterna.
  - E a menos de 1,5 m, mirándola: la recoge, con `Taking Item` en el cuerpo, el sonido y `TAPES n/8`.
- [ ] **Step 2:** la cámara y la pistola.
  - Se recogen con E, con `Picking Up`. Pasan a `has` y a la mano.
  - Q cambia de mano: nada, cámara o pistola.
  - Con la pistola en la mano, clic dispara: raycast con alcance de 30 m y retroceso.
  - R recarga, con `Reloading` y un cargador de 6. Las balas no vuelven.
- [ ] **Step 3:** la foto (`photo()`).
  - Con la cámara en la mano, clic hace flash, sonido y 0,15 s de imagen congelada.
  - **Cuenta** si una entidad viva está a ≤ 15 m, dentro de un cono de 12° del centro y sin pared en medio (paso
    por la rejilla), y aún no estaba en `photographed`.
  - `PHOTOS n/2`.
- [ ] **Step 4:** el ascensor.
  - Con 8 cintas y 2 fotos, al acercarse a ≤ 3 m se abre (clip `'02'`). Si falta algo, se queda cerrado y al
    tocarlo suena un zumbido de rechazo.
  - Dentro, las puertas se cierran y la grabación se corta a negro en 1,5 s.
  - `unlock('backrooms')`: el aviso de ONI//OS sale encima.
  - A los 2,5 s, `onWin`.
- [ ] **Step 5:** verificar.
  - Con `?backrooms&seed=1&god`, recoger la cámara, las 8 cintas y la pistola, disparar, recargar y hacer fotos.
    Con 2 fotos de prueba (`__game.fakeEntities()` crea dos dianas quietas), el ascensor se abre.
  - Subir da «Noclip» y vuelve arriba de la web.
  - Sin todo, el ascensor no abre.

### Task 7: Las entidades, morir y matar

**Files:**
- Create: `app/oni/backrooms/entity.ts`, `app/oni/backrooms/shatter.ts`
- Modify: `app/oni/backrooms/game.ts`, `app/oni/backrooms/Backrooms.tsx`, `app/oni/achievements.ts` (id
  `idiot`)

**Interfaces:**
- **Consumes:** `World`, `Maze.spawns`, `Player`, `photo()` (Task 6), `GameAudio.near/corrupt`, `VhsShader.uCorrupt`.
- **Produces:**
  - `class Entity { kind: 'bacteria' | 'partygoer'; hp: number; speed: number; state: 'wander' | 'chase' | 'attack' | 'dance' | 'dead'; update(dt: number): void; hit(): boolean }`
    (`hit()` devuelve true si muere)
  - `BackroomsGame.onDeath?: () => void`
  - `AchievementId` con `'idiot'`

- [ ] **Step 1:** `Entity`.
  - `SkeletonUtils.clone` del glb, con mixer y los clips de la tabla de la spec.
  - El partygoer lleva `balloon.glb` pegado al hueso de la mano derecha, con un balanceo.
  - **IA:**
    - `wander`: va a celdas al azar por BFS en la rejilla, andando a 1,1 m/s.
    - Pasa a `chase` si ve al jugador: ≤ 18 m, sin pared en medio, y en su cono de 100°. Con la linterna
      encendida, el cono llega a 24 m.
    - En `chase` corre a 3,4 m/s (× el multiplicador) por BFS hacia la última posición vista.
    - Tras 6 s sin verlo, vuelve a `wander`.
    - A ≤ 1,2 m, `attack`.
  - Las entidades no pisan huecos ni la celda del ascensor.
- [ ] **Step 2:** morir.
  - **Por entidad:**
    - El clip de ataque. La cámara cae al suelo (rueda y queda ladeada, mirando a la entidad).
    - La entidad pasa a `dance` con un baile al azar de los suyos.
    - Durante 4 s, `uCorrupt` 0 → 1 y `corrupt()`.
  - **Por caída:** el mismo corrupto, sobre la caída.
  - Luego `Screen 'crash'`:
    - Último fotograma congelado y entrecortado.
    - Encima, una pantalla de error de ONI//OS y de la cinta, no de un navegador real: fondo azul de fósforo
      apagado y texto blanco mono, con `RECORDING CORRUPTED`, un código hexadecimal y `the tape was eaten`.
    - Sin botón: a los 3,5 s, `onQuit` (vuelve al escritorio).
  - Con `&god` no se muere.
- [ ] **Step 3:** matar.
  - `hit()` resta vida (1 al empezar).
  - Al morir, `shatter.ts`:
    - Toma la pose actual de la malla con piel (`SkinnedMesh.getVertexPosition` por vértice) y la parte en 40–60
      trozos por grupos de triángulos cercanos.
    - Cada trozo sale volando con velocidad desde el impacto, gravedad, rebote en el suelo y giro.
    - Se desvanecen y se liberan a los 5 s.
  - La primera vez, `unlock('idiot')`.
  - Aparece una entidad del tipo contrario en el `spawn` más lejano del jugador, con
    `speed = muerta.speed × 1,15` y `hp = muerta.hpInicial + 1`.
  - El globo del partygoer sale volando hacia arriba.
- [ ] **Step 4:** `achievements.ts`: añadir `'idiot'` al tipo y a `ACHIEVEMENTS`, después de `backrooms`.
- [ ] **Step 5:** verificar.
  - Una entidad que te ve te persigue y te pilla. Baila, la grabación se corrompe, sale la pantalla de error y
    vuelves al escritorio.
  - Matar: trozos volando, aviso «Good job idiot, now what?» solo la primera vez, y aparece la del otro tipo, más
    rápida y que necesita 2 tiros.
  - Una partida completa sin `&god` se puede ganar.

### Task 8: El marco del logro nuevo

**Files:**
- Modify: `app/oni/supper/frames.ts`

**Interfaces:**
- **Consumes:** `AchievementId` con `'idiot'` (Task 7).

- [ ] **Step 1:** `ICON.idiot`, en el estilo de los demás iconos (`box`, `ext`, `voxels`): una pistola de
  píxeles con un globo pinchado colgando del cañón.
- [ ] **Step 2:** la colocación de los marcos.
  - Hoy, `ACHIEVEMENTS.slice(1)` reparte 8 marcos en 4 pilares a 2 alturas (`i < 4 ? 2.62 : 2.0`). Con 9, el
    noveno cae encima del quinto.
  - Pasar a 3 alturas cuando haga falta (2,62 / 2,0 / 1,38), o repartir 9 en filas que no se pisen. Comprobarlo
    con `?supper` y todos los logros desbloqueados (`__unlock`).
- [ ] **Step 3:** verificar con `?supper&resetach`: el marco nuevo sale bloqueado («???»). Con `__unlock('idiot')`
  se enciende con su nombre, y ningún marco se pisa con otro.

### Task 9: Repaso final

**Files:**
- Modify: lo que salga.

- [ ] **Step 1:** rendimiento.
  - En móvil (`&low`), una partida a ≥ 30 fps en el panel: sin sombras, densidad de píxeles 0,75 y VHS barata.
  - En escritorio, con `governor`.
  - Con `&nopar`, ninguna compilación después de la carga en toda la partida (consola).
- [ ] **Step 2:** entrar y salir 10 veces (morir, Quit y Quit desde la pausa): ni avisos de contextos WebGL ni
  listeners de más.
- [ ] **Step 3:** assets que fallan: bloquear un glb en la red. La carga dice que ha fallado y vuelve al escritorio.
- [ ] **Step 4:** repaso de la ley anti-slop punto por punto: carga, menú, pausa, OSD, botones táctiles y error
  falso.
- [ ] **Step 5:** revisión final de toda la rama (superpowers:executing-plans) y, con el visto bueno del usuario, un
  único commit.
