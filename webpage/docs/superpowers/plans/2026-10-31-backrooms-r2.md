# Backrooms, revisión 2: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar la «Revisión 2» del spec y los arreglos de la revisión final, sobre el juego que ya existe en
`app/oni/backrooms/`.

**Architecture:**
- **Partes que se reescriben:** `maze.ts` pasa a generarse por zonas. `world.ts` cambia de luz con un lightmap
  horneado por celda.
- **Partes nuevas:**
  - `tvRoom.ts`, la sala del televisor;
  - `ps1Pass.ts`, el render de baja resolución con dithering;
  - `ik.ts`, el IK de dos huesos;
  - `Inventory.tsx`, el inventario;
  - `cursors.ts`, los cursores.
- **Lo demás:** se adapta.

**Tech Stack:** igual que el plan 1 (Next 14, three r160, gsap, Web Audio). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-31-backrooms-design.md`, sección «Revisión 2».

## Global Constraints

Siguen todas las del plan 1:
- sin dependencias ni tests automáticos;
- verificación en el navegador y con `tsc`;
- interfaz en inglés y comentarios en español;
- 0 programas compilados al darle a Play;
- número de luces fijo;
- 30 fps en un móvil medio;
- partida de 10 minutos como mucho.

Lo nuevo de esta revisión:
- **Teclas:**

  | Acción | Tecla |
  |---|---|
  | Mover | WASD |
  | Correr | Shift |
  | Saltar | Space |
  | Linterna | F |
  | Inventario | E |
  | Recoger | G |
  | Recargar | R |
  | Cambiar objeto | Q / rueda |
  | Mirar por la cámara | clic derecho |
  | Foto / disparo | clic izquierdo |
  | Pausa | Escape |

- **Táctil:** se añaden `[ GRAB ]`, `[ BAG ]`, `[ CAM ]` y `[ RELOAD ]`.
- **Fuera de la cámara no hay VHS**, solo PS1. El OSD de la grabación (REC, contador) solo se ve mirando por la
  cámara.

## Review Focus

1. **Pantalla completa y puntero:**
   - salir de pantalla completa con Escape pausa;
   - si el navegador niega el bloqueo del puntero, la partida no corre: sale «click to resume».
2. **Mapa por zonas:** todo alcanzable, ninguna zona aislada y el recorrido dentro del objetivo de 10 minutos, en
   miles de semillas.
3. **Lightmap:** el lightmap es una textura de datos; nunca crea programas nuevos ni cambia el número de luces.
4. **IK:** con cualquier objeto en la mano y al mirar arriba o abajo del todo, los codos no se invierten y las manos
   no atraviesan el objeto.
5. **El inventario abierto mientras una entidad te pilla:** se cierra y entra la muerte sin quedarse a medias.

---

### Task 1: Arreglos de la revisión final

**Files:**
- `pc/Computer.tsx`
- `Backrooms.tsx`
- `input.ts`
- `game.ts`
- `world.ts`
- `entity.ts`
- `items.ts`
- `Touch.tsx`

- [ ] **Pantalla completa sin el PC encima.** `Computer` monta `<Backrooms>` con `createPortal(…, document.body)`,
  como ya hace Hero, y oculta `.pc-cursor` en la fase `game`. Play pide `requestFullscreen()` en `.br` dentro del
  mismo clic; Quit, morir y ganar salen con `exitFullscreen()`.
- [ ] **Puntero, pausa y Play.**
  - Con puntero fino, si la partida corre sin el puntero bloqueado, se pausa y sale una capa «click to resume».
    El bloqueo se pide dentro del clic.
  - Options pide el bloqueo en su propio clic, antes de la animación.
  - `start()` tiene un guardia contra doble llamada.
- [ ] **Ascensor:** se coloca con `-bb.min.z` dentro de su celda, y siempre en un callejón. Ganar exige estar
  dentro de la caja de la cabina, no solo cerca.
- [ ] **Entidades atascadas:** `route()` saca la celda propia del conjunto bloqueado, y la persecución de cerca no
  entra en celdas bloqueadas.
- [ ] **Recarga en táctil:** botón `[ RELOAD ]` con la pistola, y recarga automática con el cargador vacío.
- [ ] **Foto:** se pinta un fotograma con el flash y luego se congela. La cuenta del congelado corre en `frame()` y
  `die()` la pone a 0.
- [ ] **Verificar:** entrar desde el escritorio real (no `?backrooms`) sin movimiento reducido. No debe quedar ni
  cursor rojo ni parpadeo; luego Escape → pausa, y Resume rápido → «click to resume». `tsc` limpio.

### Task 2: Mapa por zonas (`maze.ts`)

**Interfaces:** `Maze` mantiene sus campos (`w`, `h`, `open`, `start`, `elevator`, `tapes`, `spawns`, `voids`, `lamps`,
`props`, …). `CELL` baja a **1,5 m**: las paredes y columnas son celdas macizas de 1,5 m. Se añade
`lit: Uint8Array` (1 = zona con paneles encendidos, 0 = zona apagada).

- [ ] **Generar por zonas.** Se reparte el mapa (unas 70×70 celdas, ~100 m) en rectángulos con un BSP, y cada hoja
  recibe un tipo:
  - **sala de columnas:** sala abierta con columnas de 1 celda cada 3, o en cruz como en la referencia 3;
  - **pasillos paralelos:** tiras de 2 celdas separadas por muros con huecos;
  - **oficina:** sub-BSP de cuartos pequeños con huecos de puerta y tabiques sueltos de 2–4 celdas;
  - **sala vacía grande;**
  - **sala apagada:** cualquiera de las anteriores con `lit = 0`.

  Las hojas se unen con pasillos de 2 celdas y varios huecos por frontera (bucles, como el braid del 15 %).
  Después vienen los callejones, los huecos al vacío (con la misma comprobación BFS) y la colocación de objetos
  con las reglas de antes.
- [ ] **Objetivo de recorrido:** la ruta inicio → cámara → cintas → ascensor cabe en unos 6–8 minutos andando y
  corriendo. El tamaño se ajusta como ahora.
- [ ] **Verificar:**
  - un script de node sobre 5.000 semillas: todo alcanzable, percentiles del recorrido y ninguna celda abierta
    aislada;
  - `asciiMaze` de desarrollo para mirarlo junto a las referencias.

### Task 3: Luz de Backrooms (`world.ts`)

- [ ] **Paneles:** fluorescentes 60×120 en rejilla cada 2 celdas en las zonas `lit`. Unos pocos parpadean y otros
  están fundidos. Las zonas apagadas no tienen ninguno.
- [ ] **Lightmap horneado:** una `DataTexture` de 4 texels por celda, calculada en CPU al crear el mundo. Cada
  texel suma la luz de los paneles cercanos, que se corta si un rayo por la rejilla choca con pared, y la
  multiplica por la oclusión de las paredes vecinas. Suelo, techo y paredes la leen por posición de mundo XZ
  (`onBeforeCompile` en los materiales compartidos). Las paredes además se oscurecen hacia el rodapié y bajo el
  techo.
- [ ] **Paleta:** amarillo mostaza más saturado, moqueta húmeda más oscura, techo de placas, y niebla amarillenta
  más corta. Las 4 `PointLight` siguen a los paneles más cercanos, para la luz sobre personajes y objetos.
- [ ] **Sombras:** la linterna proyecta sombra (mapa de 512, solo en escritorio).
- [ ] **Verificar:**
  - capturas en una sala de columnas, en una oficina y en una zona apagada;
  - 0 programas al darle a Play, con `&nopar`.

### Task 4: Render PS1 y VHS solo con la cámara (`ps1Pass.ts`, `vhsPass.ts`, `game.ts`)

- [ ] **`ps1Pass`:**
  - la escena se dibuja a 240 px de alto, ampliada con `NearestFilter`;
  - dithering Bayer 4×4 y color a 15 bits.
  - en los materiales compartidos y en los de los personajes, el vértice se ajusta a la rejilla de la pantalla
    (`onBeforeCompile`), con el mismo `#define` para todos, así que no se crean programas nuevos.
- [ ] **VHS:** la pasada VHS solo está activa mirando por la cámara y al morir. Va más fuerte que ahora: banda de
  tracking, sangrado de croma, ruido y desenfoque de cabeza.
- [ ] **Verificar:** capturas sin cámara, con cámara y de la muerte. 0 programas al darle a Play.

### Task 5: Estética de los 90 y cursores (`Backrooms.tsx`, `backrooms.css`, `cursors.ts`)

- [ ] **Ventanas de Windows 95:** la pausa, el menú de opciones y los diálogos son ventanas grises biseladas con
  barra de título azul y botones 3D. El menú principal sigue siendo un título de juego, pero con botones de esos.
- [ ] **Carga:** se queda la de texto blanco tipo BIOS/DOS con barra de bloques. Ahora se ve dentro del televisor
  (Task 6) y avisa de que puede tardar.
- [ ] **Cursores:** `cursors.ts` exporta tres cursores CSS `url(data:image/svg+xml…)` pixelados (flecha, reloj de
  arena y mano). La flecha sale en menús y pausa, el reloj de arena mientras carga y la mano sobre los botones.
  Sustituyen al canvas `br-cursor`. El robo del cursor de Options sigue funcionando con un sprite de la flecha.
- [ ] **Verificar:** capturas del menú, de la pausa y del cursor sobre un botón.

### Task 6: La sala del televisor (`tvRoom.ts`, `pc/Computer.tsx`, `Backrooms.tsx`)

- [ ] **Entrada:** al abrir `backrooms.exe`, la pantalla del PC se va a negro (0,6 s). No hay reinicio ni POST:
  la fase pasa a `game` directamente.
- [ ] **La sala:** `tvRoom.ts` es una escena pequeña de three en el mismo canvas del juego.
  - Una sala de hormigón oscura y vacía y un CRT hecho con cajas.
  - En la pantalla del CRT, una `CanvasTexture` con estática y luego la carga de los 90 (barra real de
    `loadAssets`).
  - El único foco de luz es el resplandor de la tele, que parpadea.
  - La cámara avanza despacio hacia la tele mientras cargan los assets.
- [ ] **Meterse dentro:** al terminar la carga, la cámara se mete en la pantalla y la imagen del CRT llena la
  vista. Se pasa a la carga de los 90 a pantalla completa con el menú. Clic o tecla aceleran el avance.
- [ ] **Compilación:** la sala se compila con todo lo demás en `load()`, sin recompilar.
- [ ] **Verificar:** desde el escritorio real, que aparezca la sala, luego meterse en la tele y llegar al menú. La
  vuelta al escritorio al salir funciona igual.

### Task 7: Brazos con IK (`ik.ts`, `player.ts`, `rig.ts`)

- [ ] **Diagnóstico primero** (superpowers:systematic-debugging): capturas del cuerpo en tercera persona con cada
  objeto, para ver qué rompe `aim()` (ejes de los huesos, orden con el mixer, la escala de la cabeza).
- [ ] **`solveTwoBone(upper, lower, end, target, pole)`** analítico: ley de cosenos y polo hacia fuera y abajo. Va
  después del mixer, sustituye a `aim()`, y orienta la mano a la rotación del socket.
- [ ] **Sockets por objeto:** cada viewmodel lleva `grip` (mano derecha) y `support` (mano izquierda), como
  `Object3D` hijos colocados a mano.
  - **Pistola:** empuñadura y guardamanos.
  - **Cámara:** asa a la derecha y la izquierda bajo el cuerpo.
  - **Linterna:** sola en la izquierda.
- [ ] **Verificar:**
  - capturas en primera persona mirando arriba, al frente y abajo con cada objeto;
  - una en tercera persona con `&debug`.

### Task 8: Mirar por la cámara (`items.ts`, `player.ts`, `Backrooms.tsx`)

- [ ] **Clic derecho** (mantener; en táctil `[ CAM ]` alterna) con la cámara en la mano: la camcorder sube al ojo,
  el FOV se cierra y se activa el VHS. Sale la interfaz de grabación de los 90: REC parpadeante, contador, batería,
  fecha, zoom 1×–4× con la rueda, recuadro de enfoque que se cierra sobre una entidad y «PHOTOS n/2».
- [ ] **Fotos:** el clic izquierdo hace la foto, y solo mirando por la cámara. Cada foto guarda una miniatura
  (render a 160×120 → dataURL) para el inventario.
- [ ] **Verificar:** entrar y salir, zoom, una foto con miniatura y el táctil.

### Task 9: Inventario y recoger (`Inventory.tsx`, `items.ts`, `input.ts`, `Touch.tsx`)

- [ ] **G recoge** lo que tienes delante y cerca, con el aviso «[G] pick up …» en pantalla. En táctil, `[ GRAB ]`.
- [ ] **E abre el inventario:** una ventana de Windows 95 «INVENTORY». El juego sigue corriendo y el puntero se
  suelta.
  - **Ranuras:** linterna (batería), camcorder, pistola (cargador y balas sueltas) y 8 ranuras de cinta con su
    etiqueta.
  - **Pestaña «PHOTOS»:** las miniaturas.
  - **Uso:** clic en un objeto para equiparlo. E o Escape cierra.
- [ ] **Si te pillan** con el inventario abierto, se cierra.
- [ ] **Verificar:** recoger con G, equipar desde el inventario, ver las fotos, y que te pillen con él abierto.

### Task 10: Derrota (`game.ts`, `entity.ts`, `player.ts`)

- [ ] **Al pillarte:**
  1. la entidad se lanza al objetivo: ataque de cara, FOV que se abre de golpe, temblor y la cámara bloqueada en
     su cara;
  2. la camcorder sale volando de las manos dando vueltas y cae de lado al suelo;
  3. desde ahí se ve el cuerpo del hazmat caer (clip `Dying` si el usuario lo descarga de Mixamo; si no, se
     desploma por código);
  4. la entidad baila encima;
  5. la estática y la corrupción suben, y llega el cuelgue falso.
- [ ] **Al caer al vacío:** la cámara cae contigo, viento, fundido a negro y corrupción.
- [ ] **Verificar:** las dos muertes, con capturas a mitad.

### Task 11: Revisión final y commit

- [ ] Revisión fresca de toda la rama (opus) y una pasada de arreglos.
- [ ] Con el visto bueno del usuario, el commit (o los commits) y limpiar el workspace del plan.
