# Biblioteca: acabado, carta joker y toque cómic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la escena de la biblioteca deje de sentirse inacabada:
- animaciones encadenadas sin cortes;
- luz y atmósfera de cine;
- decorado vivo;
- cámara que acompaña;
- carta joker de dos caras lanzada con efecto;
- un toque cómic (dosis 2) solo cuando la máscara hace acto de presencia, también en el hero.

**Architecture:**
- **Módulo de cómic compartido** (`app/oni/comic.ts`). Es una pasada de postproceso que solo afecta a los objetos marcados, mediante una máscara de objeto. Su intensidad es animable y su estado se fusiona con el filtro CCTV. Lo usan la biblioteca y el hero.
- **Sujeto:** gana un secuenciador de clips con transiciones sin saltos y capas procedurales.
- **Escena:** gana un rig de cámara por planos, atmósfera falsa volumétrica y decorado variado. Todas las luces y materiales nuevos existen desde la carga, para no recompilar shaders a mitad de escena.

**Tech Stack:** Next 14 (App Router), three.js r160 (EffectComposer, ShaderPass, InstancedMesh, Points), TypeScript, WebAudio. Sin dependencias nuevas.

**Spec:** `webpage/docs/superpowers/specs/2026-10-29-library-polish-comic-design.md` (y su predecesora `2026-10-26-library-papers-design.md`).

## Global Constraints

- three.js r160, Next 14, **sin dependencias nuevas**.
- **Sin tests automáticos** (convención del proyecto). Cada tarea se verifica en el navegador (pestaña del dev server "webpage", :3000) con las comprobaciones medibles de su paso `Expected:`.
- **Sin commits por tarea.** Un solo commit cuando s7lver apruebe la etapa 3. Commits, push y descargas solo con su permiso.
- **Revisión por etapas.** Al final de cada etapa, parar y enseñar a s7lver en el navegador. No empezar la siguiente sin su aprobación:
  1. Etapa 1 (Tareas 1–2): encadenado y luz.
  2. Etapa 2 (Tareas 3–6): cómic y carta.
  3. Etapa 3 (Tareas 7–11): cámara, decorado y momentos.
- **Cómic en dosis 2**, nunca a pantalla completa ni permanente:
  - el objeto con máscara, a saltos (12 fps), con el resto fluido;
  - contorno fino de tinta;
  - trama de puntos solo en sombras;
  - descuadre de color de 1–1,5 px;
  - sin rayos de fondo ni tinte fuerte.
- **Dentro de la grabación**, el cómic y el filtro CCTV se fusionan un poco: sobre él, el grano y las líneas ceden algo y la trama, el contorno y el descuadre asoman.
- **Nada de luces nuevas ni materiales nuevos a mitad de escena.** Todo existe desde `load()` (apagado si hace falta) y se compila con `lit()`. El número de programas (`renderer.info.programs.length`) no puede cambiar entre el final de `load()` y la salida.
- **Ninguna tarea larga de más de ~300 ms** en la secuencia sala → P → biblioteca → salida (medido con `PerformanceObserver('longtask')`, como el 29-10).
- **`prefers-reduced-motion`:** sin destellos, sin animación a saltos, sin cámara brusca.
- **Móvil 375×812** usable.
- **Textos de UI** en inglés; comentarios de código en español; el código se parece al de alrededor.
- **Ley anti-slop** (`webpage/.claude/CLAUDE.md`), re-chequeo punto por punto al final.
- **Assets:** solo piezas del paquete de la biblioteca ya en el repo (`public/models/library/environment_-_library.zip`, vía `tools/models/build.mjs`) y procedural. No bajar modelos nuevos. Nada vivo nuevo en escena.

## Review Focus

1. **`prefers-reduced-motion`:** cada momento nuevo (cómic, lanzamiento con cámara lenta, cámara de cine, rayo, cierre) tiene una versión sin saltos ni destellos y no se queda colgado. Verificado en la Tarea 11.
2. **Redimensionar o girar el móvil durante el tiempo parado:** las hojas se recolocan, siguen en pantalla y se pueden pulsar. La máscara de cómic sigue alineada (su render target se redimensiona). Verificado en las Tareas 3 y 9.
3. **Pestaña oculta a mitad de un momento:** el reloj de la escena se pausa. El lanzamiento con cámara lenta y los 12 fps no se aceleran al volver (el stepper usa el reloj de la escena, no el de pared). Verificado en las Tareas 4 y 6.
4. **Recompilaciones:** cualquier luz, material o pasada nueva añadida tarde vuelve a congelar el navegador. Se comprueba el contador de programas en cada etapa (Tareas 2, 4 y 11).
5. **Golpe de trackpad con inercia:** no llena el indicador de una vez. Verificado en la Tarea 9.

---

## Etapa 1 — Encadenado de animaciones y luz

### Task 1: Secuenciador de clips sin cortes, capas procedurales y atajos de desarrollo

**Files:**
- Modify: `app/oni/library/subject.ts` (`play`, `turnLeft`, `update`; añadir lo de abajo)
- Modify: `app/oni/library/libraryScene.ts` (`recording`, `inside`: usar la nueva API)
- Modify: `app/oni/library/Library.tsx` (atajo `&from=`)

**Interfaces:**
- Produces:
  - `Subject.to(clip: Clip, o?: { fade?: number; loop?: boolean; speed?: number; sync?: boolean }): Promise<void>` sustituye a `play`. Hace un crossfade con duración mínima de 0,2 s; nunca acepta `fade: 0`. Con `sync`, empieza el clip nuevo en la misma fase normalizada que el anterior (para caminar e idle). Con `loop: false` resuelve al acabar.
  - `Subject.turn(yaw: number, sec: number): Promise<void>` sustituye a `turnLeft`. El giro se lleva a la raíz **cada fotograma** mientras dura, no al final, así que no hay salto. Usa `left-turn` como capa de cuerpo y lo cruza de vuelta a `idle`.
  - `Subject.layers: { breath: number; sway: number }`, ambos de 0 a 1. Respiración en Spine2/Neck y balanceo de peso en Hips, sumados después del mixer. Activos por defecto (1) y a 0 cuando está congelado.
  - `Subject.jump: { rot: number; pos: number }`. Solo en desarrollo: el máximo, desde la última lectura, de la variación por fotograma de la rotación (rad) de Hips/Head en mundo y de la posición (m) de Hips. Se pone a 0 al leerlo con `takeJump()`.
  - `Library.tsx`, dev: `?library&from=throw|inside|still|bolt` salta la secuencia hasta ese momento (con `wait` a 0 hasta llegar), y `&reduced` fuerza el camino de `prefers-reduced-motion`. Se usa en todas las verificaciones siguientes.

- [ ] **Step 1: Medir el estado actual.** Añadir primero `jump`/`takeJump()` (dev) y leerlo cada segundo desde la consola durante `?library` completo.
  Run: `?library`, en consola `setInterval(() => console.log(JSON.stringify(__lib.subject.takeJump())), 1000)`.
  Expected: al final de `left-turn` y en la entrada a `rummaging`/`walking` se ven picos con `rot > 0.25` o `pos > 0.05`. Apuntar los valores en el ledger como línea base.
- [ ] **Step 2: Implementar `to`, `turn`, `layers` y `&from=`; migrar `recording()` e `inside()`** a `to`/`turn`. Ningún `fade: 0` en el repo (`grep -n "fade: 0\b" app/oni/library` vacío).
- [ ] **Step 3: Verificar.**
  Run: lo mismo que el Step 1, la secuencia completa, más `?library&from=inside` y `?library&from=still`.
  Expected:
  - en toda la secuencia `rot ≤ 0.12` y `pos ≤ 0.03` por fotograma a 60 fps;
  - al mirar, sin pies que patinan en `walking` (la traslación de la raíz cuadra con el ciclo; `WALK_SPEED` recalibrado si hace falta);
  - sin parones: no hay ningún tramo de más de 0,4 s en que el sujeto esté quieto entre dos gestos, salvo los `wait` del guion.
  - Ledger: `Task 1: complete`, con los valores medidos.

### Task 2: Luz y atmósfera

**Files:**
- Create: `app/oni/library/atmosphere.ts`
- Modify: `app/oni/library/libraryScene.ts` (`lights()`, `load()`, `update()`)

**Interfaces:**
- Consumes: `LibraryScene.lit()` (ya existe).
- Produces:
  - `atmosphere(scene: THREE.Scene, o: { shafts: { from: THREE.Vector3; to: THREE.Vector3; radius: number }[]; dustBox: THREE.Box3; reduced: boolean }): { update(t: number): void; dispose(): void }`. Crea:
    - haces de luna: conos o planos aditivos con ruido que se desvanece en profundidad, `depthWrite: false`;
    - polvo en suspensión: `THREE.Points`, unas 1500 partículas, que deriva lento y brilla solo dentro de los haces.
  - Luces nuevas, todas creadas en `lights()` al cargar:
    - `rim`: una SpotLight fría detrás del sujeto que recorta su negro;
    - `key` por plano: la luna, reorientada;
    - más contraste: exposición, y un `uGrade` de lift/gamma en `StillShader` o en una pasada de grade nueva añadida en `takeOver`, nunca después.

- [ ] **Step 1: Línea base.** Run: `?library&from=still`. En consola, `__lib.renderer.info.programs.length` justo al terminar `load()` (log dev) y al llegar al tiempo parado. Expected: apuntar ambos números y una captura de cada momento.
- [ ] **Step 2: Implementar `atmosphere.ts` y la luz nueva.** Cada plano tiene una luz que manda. La grabación lleva un haz de luna cruzando el pasillo con polvo dentro.
- [ ] **Step 3: Verificar.**
  Run: secuencia completa desde `?room` + P, con el observador de tareas largas y el contador de programas.
  Expected:
  - el contador de programas no cambia desde el final de `load()` hasta la salida;
  - ninguna tarea larga de más de 300 ms;
  - en capturas de grabación, interior y tiempo parado, el sujeto se separa del fondo (perfil de luz visible);
  - hay haces con polvo;
  - 60 fps en escritorio y al menos 30 en móvil 375×812 (`__lib` dev con un contador de fps).
  - Ledger.
- [ ] **Step 4: PARADA DE ETAPA 1.** Enseñar a s7lver la secuencia completa con capturas. No seguir sin su "ok".

## Etapa 2 — Cómic y carta

### Task 3: Módulo de cómic (`comic.ts`) y el hero

**Files:**
- Create: `app/oni/comic.ts`
- Modify: `app/oni/heroScene.ts` (composer y `frame`)

**Interfaces:**
- Produces:
  - `class Comic`
    - `constructor(renderer: THREE.WebGLRenderer, o: { reduced: boolean })`
    - `pass: ShaderPass`, para añadir al composer justo antes de `OutputPass`.
    - `targets: THREE.Object3D[]`: lo que recibe el tratamiento.
    - `amount: number`, de 0 a 1, animable. Con 0 la pasada se desactiva (`pass.enabled = false`), no solo se queda transparente.
    - `cctv: number`, de 0 a 1: cuánto ceden el grano y las líneas sobre el objeto. Lo lee `CctvShader` por un uniform `tComic` compartido.
    - `step: number`: fps del objeto, 12 (0 = fluido; siempre 0 con `reduced`).
    - `drawFrame(t: number): boolean`: dice si este fotograma toca dibujo. El dueño del objeto solo avanza su pose cuando devuelve `true`, usando el reloj que le pasen, no el de pared.
    - `renderMask(scene: THREE.Scene, camera: THREE.Camera): void`: pinta la silueta de `targets` (con oclusión correcta) en un render target de la mitad de resolución.
    - `setSize(w: number, h: number): void`
    - `dispose(): void`
  - Valores de la dosis 2, los de la maqueta aprobada `estilo-a-dosis.html` (dosis 2): `uMis = 1.5` px, trama de celda 5,5 px girada 46° y solo con luminancia < 0,45, contorno de 1–1,5 px (bordes de la máscara de objeto).
  - Todos los programas del cómic se compilan en la construcción, con `amount` a 0 incluido.

- [ ] **Step 1: Implementar `comic.ts`.** Shader de la pasada:
  - descuadre: R y B desplazados `uMis` px **solo** dentro de la máscara;
  - trama en sombras dentro de la máscara;
  - contorno a partir del gradiente de la máscara.
- [ ] **Step 2: Integrar en el hero.** `targets = [rig]`. `amount` sube a 1 en 0,4 s cuando la máscara termina de encenderse (el `boot` llega a 1) y cuando cruza el umbral de giro por scroll (`deg > 0.5`). Baja a 0 en 0,6 s tras 1,6 s. La pose del `rig` se cuantiza con `drawFrame` mientras `amount > 0`.
- [ ] **Step 3: Verificar.**
  Run: `/` (home).
  Expected:
  - al encenderse la máscara se ve la dosis 2 durante unos 1,6 s y luego se apaga;
  - solo la máscara cambia, no el título ni el fondo (comparar capturas ampliadas);
  - con el cómic a 0, `pass.enabled === false`;
  - redimensionar la ventana con el cómic activo mantiene la máscara alineada;
  - el contador de programas no cambia al encenderse.
  - Ledger.

### Task 4: El cómic en la biblioteca

**Files:**
- Modify: `app/oni/library/libraryScene.ts` (`takeOver`, `renderFeed`, `recording`, `inside`, `resume`)
- Modify: `app/oni/library/subject.ts` (`update`: avanzar el mixer por saltos cuando lo pide el cómic)
- Modify: `app/oni/room/cctvPass.ts` (uniform `tComic`, `uComicCctv`)

**Interfaces:**
- Consumes: `Comic` (Tarea 3), `Subject.to/turn` (Tarea 1).
- Produces: `LibraryScene.comic: Comic`, con `targets = [subject.root]`. `Subject.stepped: (dt: number) => boolean | null`: si existe, el mixer acumula `dt` y solo aplica la pose cuando devuelve `true`.

- [ ] **Step 1: Momentos.**
  - **Giro hacia la cámara y lanzamiento,** en la grabación: `amount` a 1, `cctv` a 0,5 (se fusionan).
  - **Tiempo parado entero:** `amount` a 1.
  - Fuera de esos momentos, 0.
  - La grabación en la sala (`renderFeed`) aplica el mismo cómic, porque también se ve en la tele.
- [ ] **Step 2: Verificar.**
  Run: `?library&from=throw`, `?library&from=still` y la secuencia completa desde `?room`.
  Expected:
  - en la grabación, el grano sigue sobre él pero más suave y la trama, el contorno y el descuadre asoman (captura ampliada);
  - él a saltos mientras el polvo y la cámara siguen fluidos;
  - con la pestaña oculta 5 s a mitad del giro, al volver la secuencia sigue donde estaba;
  - contador de programas sin cambios;
  - ninguna tarea larga de más de 300 ms.
  - Ledger.

### Task 5: La carta joker de dos caras

**Files:**
- Modify: `app/oni/library/card.ts` (rehacer `makeCard`)
- Modify: `app/oni/library/libraryScene.ts` (`load`: la carta necesita la máscara cargada)

**Interfaces:**
- Consumes: `oni-mask.glb` (ya lo carga `Subject`). La pasada de cómic se usa para pintar la máscara en lienzos fuera de pantalla.
- Produces: `makeCard(mask: THREE.Object3D, renderer: THREE.WebGLRenderer): { mesh: THREE.Group; dispose(): void }`. La carta mide 0,063 × 0,088 m.
  - **Cara:** diagonal de (0, 58 %) a (100 %, 42 %) de alto.
    - Arriba, hueso `#ebe4dc` con la máscara en tinta: negro `#0c0909`, trama en medios tonos y ojos rojos.
    - Abajo, negro con la máscara en trama roja `#c9232a`, girada 180° como figura de naipe y **sin cortar por la diagonal** (reducirla o bajarla hasta que quepa entera).
    - "JOKER" en vertical en las dos esquinas, en rojo.
  - **Dorso:** negro con un mosaico de máscaras pequeñas en trama roja al 50 % y un marco rojo de 3 px a 34 px del borde.
  - Esquinas redondeadas (alpha) y grano fino.
  - Referencia visual exacta: `.superpowers/brainstorm/625-1793256345/content/carta-joker.html`, opción 3.

- [ ] **Step 1: Implementar.** Los lienzos se pintan una vez en la carga, a 630×880 como mucho.
- [ ] **Step 2: Verificar.**
  Run: `?library&free` y en consola enfocar la carta (`__lib.debugCard()` dev, que la pone delante de la cámara).
  Expected:
  - cara y dorso como en la maqueta;
  - la máscara de abajo entera;
  - los textos sin cortar;
  - legible a 300 px de alto en pantalla.
  - Ledger.

### Task 6: El lanzamiento con efecto

**Files:**
- Modify: `app/oni/library/subject.ts` (`throwAt` → `drawAndThrow`)
- Modify: `app/oni/library/libraryScene.ts` (`flyCard`, `recording`, `inside`; reloj con `timeScale`)

**Interfaces:**
- Consumes: `makeCard` (Tarea 5), `Subject.turn` (Tarea 1), `Comic` (Tarea 4).
- Produces:
  - `Subject.drawAndThrow(card: THREE.Object3D, target: THREE.Vector3, onRelease: (from: THREE.Vector3, dir: THREE.Vector3) => void): Promise<void>`. La carta se ancla a la mano derecha, entre índice y corazón, en cuanto la saca (0,25 s). Después hay un flick seco de muñeca y antebrazo: la suelta a los 0,15 s del flick.
  - `LibraryScene.timeScale: number` (1 por defecto). Multiplica el `dt` de `update` para todo excepto el ruido CCTV.
  - `flyCard`:
    - vuelo de 0,55 s sobre una curva de Bézier cúbica con una desviación lateral de 0,35–0,5 m (el "efecto");
    - giro sobre su eje largo a unas 9 vueltas/s;
    - el giro se reparte para que **al llegar la cara del joker mire a la lente**.
    - En los últimos 0,12 m, `timeScale` baja a 0,15 durante 0,45 s de reloj real y vuelve a 1 en el impacto.
    - El golpe es grieta + sonido; la estática entra 0,35 s **después** y sube en 0,25 s.
  - Reduced motion: sin cámara lenta, vuelo recto de 0,4 s, sin estática de golpe (fundido).

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Verificar.**
  Run: `?library&from=throw`, grabando capturas cada 100 ms alrededor del impacto (`computer screenshot` en batch).
  Expected:
  - la carta se ve en la mano antes del flick;
  - la trayectoria curva y el giro se aprecian en al menos 3 capturas;
  - en la cámara lenta se lee el joker;
  - la grieta es visible antes de la estática;
  - con reduced motion no hay cámara lenta.
  - Ledger.
- [ ] **Step 3: PARADA DE ETAPA 2.** Enseñar a s7lver el hero y el lanzamiento. No seguir sin su "ok".

## Etapa 3 — Cámara, decorado y momentos

### Task 7: Rig de cámara por planos y el plano de dentro

**Files:**
- Create: `app/oni/library/shots.ts`
- Modify: `app/oni/library/libraryScene.ts` (`move` → rig; `inside`)

**Interfaces:**
- Produces:
  - `class CameraRig`
    - `constructor(camera: THREE.PerspectiveCamera, o: { reduced: boolean })`
    - `cut(shot: Shot): void`
    - `go(shot: Shot, sec: number, ease?: (k: number) => number): Promise<void>`
    - `update(dt: number): void`
  - `Shot = { pos: Vector3; look: Vector3; fov?: number; drift?: number; breathe?: number }`
    - `drift`: m/s de deslizamiento lento hacia `look`;
    - `breathe`: amplitud en rad de un balanceo de cámara en mano, de 0 a 0,004; 0 con reduced.
  - El **plano de dentro**: tras el impacto, la cámara de seguridad y la carta clavada en primer término, de tres cuartos y desde fuera de la línea de la lente, con el joker legible (al menos el 6 % del alto de pantalla) y él al fondo, enfocado por la luz.

- [ ] **Step 1: Implementar y rehacer los planos de `inside()` con el rig.** Transiciones con `go` y facilidad de entrada y salida; cortes solo donde el guion lo pide.
- [ ] **Step 2: Verificar.**
  Run: `?library&from=inside`.
  Expected:
  - la silueta de la cámara no ocupa más del 25 % de la pantalla;
  - la carta legible;
  - él visible;
  - sin cortes secos salvo los del guion.
  - Ledger.

### Task 8: Decorado con vida y la grabación

**Files:**
- Modify: `tools/models/build.mjs` (piezas nuevas del paquete si hacen falta, en `SETS.library`)
- Create: `app/oni/library/dressing.ts`
- Modify: `app/oni/library/libraryScene.ts` (`stacks`, `load`, `recording`)

**Interfaces:**
- Produces:
  - `dress(scene: THREE.Scene, o: { shelves: THREE.InstancedMesh[]; spine: THREE.Texture; rand: () => number }): { lamps: { light: THREE.Light; flicker: number }[]; fallers: THREE.Object3D[]; update(t: number, dt: number): void }`. Rompe la repetición:
    - variación por instancia: huecos, libros tumbados, pilas y alguno sobresaliendo;
    - libros y papeles por el suelo del pasillo;
    - una lámpara que parpadea de verdad (su luz ya existe desde la carga);
    - cortinas o telas que se mecen si hay ventana en plano.
  - `fallers`: libros que el guion deja caer en la grabación.

- [ ] **Step 1: Implementar.** La grabación gana vida del entorno:
  - un libro que cae de una balda en segundo plano mientras él rebusca;
  - la lámpara que parpadea;
  - polvo en el haz.

  Nada vivo nuevo.
- [ ] **Step 2: Verificar.**
  Run: `?library` y `?library&free`.
  Expected:
  - ninguna balda visible en plano es igual a su vecina;
  - en los 7 s de grabación hay al menos 2 cosas que se mueven además de él;
  - contador de programas sin cambios;
  - carga total de GLB de la biblioteca de 6 MB como mucho.
  - Ledger.

### Task 9: Libros volando, tiempo parado de frente y las hojas

**Files:**
- Modify: `app/oni/library/libraryScene.ts` (`frenzyStep`, `flySheets`, `inside`, `placePapers`, `STILL_*`)
- Modify: `app/oni/library/sheets.ts` (separar el pintado de la colocación)
- Modify: `app/oni/library/Library.tsx` (`still`: el indicador)

**Interfaces:**
- Produces:
  - `placeSheets(sheets: { mesh: THREE.Mesh; paper: Paper }[], area: THREE.Box3, eye: THREE.Camera, avoid: THREE.Box2[]): void`. Recoloca hojas ya pintadas: `makeSheets(papers): { mesh; paper }[]` pinta y `placeSheets` coloca.
    - Se llama al congelar el tiempo y en cada `resize` mientras está congelado.
    - Sin hojas en el suelo.
    - Rechaza los candidatos con un área proyectada menor del 1,2 % de la pantalla o tapados al 100 %.
  - El tiempo parado **de frente**:
    - él gira hacia la cámara antes de congelarse, con `turn` (Tarea 1);
    - `STILL_POS`/`STILL_LOOK` nuevos, para que la máscara quede en el tercio superior con el cómic a 1;
    - sin las losas blancas: identificar qué malla son (en `&free`, raycast) y corregir su material o quitarla;
    - la otra mitad del encuadre, ocupada por las hojas y el decorado.
  - Indicador (`still`): cada evento de rueda aporta `min(|deltaY|, 60)`. Los deltas que encadenan una serie monótonamente decreciente (inercia) tras el pico aportan la mitad.

- [ ] **Step 1: Implementar.** Las hojas en vuelo:
  - la cara pintada visible;
  - un dorso de papel con grano, no blanco liso;
  - `emissive` limitado para que no se queme en el vuelo.
- [ ] **Step 2: Verificar.**
  Run: `?library&from=still&papers=30`, `?papers=1` y móvil 375×812, girando a 812×375 mientras está congelado.
  Expected:
  - la máscara de frente con cómic;
  - todas las hojas en pantalla y pulsables tras el giro;
  - ninguna tapada del todo;
  - una ráfaga sintética de inercia (60 eventos con delta de 120 a 2, decreciente, en 1,2 s) **no** llena el indicador;
  - 40 eventos seguidos de 120 sí lo llenan.
  - Ledger.

### Task 10: El rayo y el cierre

**Files:**
- Modify: `app/oni/library/libraryScene.ts` (`resume`, `makeBolt`)

**Interfaces:**
- Consumes: `CameraRig` (Tarea 7), la carta (Tarea 5), `flash` (ya existe desde la carga).
- Produces: `resume()`.
  - El rayo como geometría con forma: tronco y ramas, aditivo, de 0,3 s.
  - El destello ilumina solo con `flash` (PointLight), sin `fadePlane` rojo a pantalla completa.
  - Tras desaparecer él, el **plano de cierre** de 1,6 s: la carta joker cae de la lente dando vueltas y queda en el suelo boca arriba, con la cámara bajando con ella. Después, `onDone`.
  - Reduced motion: sin rayo ni destello; él se desvanece y la carta aparece ya en el suelo.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Verificar.**
  Run: `?library&from=bolt` y `?room` + P de punta a punta.
  Expected:
  - ningún fotograma con más del 40 % de la pantalla teñida de rojo (muestreo de píxeles de la captura);
  - el plano de cierre con el joker legible en el suelo;
  - la salida a `.oni-next` igual que antes;
  - 0 errores;
  - ninguna tarea larga de más de 300 ms.
  - Ledger.

### Task 11: Comprobación final y lista de clips

**Files:**
- Create: `webpage/docs/superpowers/plans/2026-10-29-mixamo-clips.md`

- [ ] **Step 1: Lista de clips de Mixamo para s7lver.** Por cada uno:
  - el nombre exacto en Mixamo;
  - "In Place" o no;
  - "Without Skin";
  - FPS 30;
  - el momento en que se usa;
  - qué capa procedural sustituye.
- [ ] **Step 2: Pasada completa.**
  - Escritorio y móvil.
  - Reduced motion: con `&reduced` (Tarea 1).
  - Pestaña oculta 5 s en cada momento.
  - Contador de programas.
  - Tareas largas.
  - Consola sin errores.
- [ ] **Step 3: Re-chequeo anti-slop punto por punto** de lo nuevo visible (carta, indicador, hojas, cómic). Arreglar lo que falle.
- [ ] **Step 4: PARADA DE ETAPA 3.** Enseñar todo a s7lver y, con su aprobación, un solo commit.
