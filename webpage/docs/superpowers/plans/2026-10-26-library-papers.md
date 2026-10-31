# Biblioteca de los papers: plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** construir la escena de los papers: el apagado de la sala de vigilancia, la grabación de la biblioteca en una sola tele, la carta que rompe la cámara, el frenesí del sujeto con la máscara, el tiempo parado con los papers como hojas sueltas que abren su PDF, y la salida con el rayo rojo.

**Architecture:**
- La biblioteca es una escena three.js propia (`app/oni/library/`) que **no tiene renderer propio**: recibe el de la sala.
- Mientras se ve la grabación, la sala pinta la biblioteca en un render target y lo enseña en la tele central. Cuando la carta rompe la cámara, la sala se desecha **conservando su renderer y su canvas**, y la biblioteca pasa a pintar a pantalla completa con ellos. Así no hay un segundo contexto WebGL ni un corte de carga.
- El sujeto (`bot.glb` + máscara) es una clase propia: clips de Mixamo y, encima, huesos movidos desde código (mirar, IK del brazo, lanzar, congelar).
- Los papers salen del contenido (`getContent('papers')`), como los canales.

**Tech Stack:** Next.js 14.1 (App Router), React 18, TypeScript, three.js r160 (GLTFLoader + meshopt, `CCDIKSolver`, `SkeletonUtils`), GSAP, WebAudio, gltf-transform (tubería de modelos).

**Spec:** `docs/superpowers/specs/2026-10-26-library-papers-design.md` (entera) y, de la spec principal `2026-10-25-portfolio-oni-redesign-design.md`, §4, §5, §6.3, §6.3b, §7 y §9.

## Global Constraints

- Ley anti-slop de `webpage/.claude/CLAUDE.md`, completa. Al terminar, repaso punto por punto.
- Paleta: rojo como único acento sobre negro cálido; la rampa de `app/oni/pc/pixels.ts` (`#070303 #2a0605 #6e120c #c4221a #ff4a36 #ffd9cf`). La biblioteca es de noche: luz fría y tenue de las ventanas, cálida de las lámparas de mesa, y el rojo solo en la máscara, la carta y el rayo.
- Textos de interfaz en inglés. Comentarios del código en español, como el resto de `app/oni/`.
- Sin dependencias nuevas. Lo de three viene de `three/examples/jsm`.
- **Sin tests automáticos** (convención del proyecto). Cada tarea acaba con una comprobación en el navegador con los atajos de desarrollo.
- **Un solo commit al final**, cuando s7lver apruebe la escena. Las tareas no hacen commit.
- **Licencias:** la biblioteca (anaroeto, CC-BY-4.0) va a `app/oni/credits.ts`. El bot no lleva ninguna marca: no se usa su textura con "TESLA". Su licencia está pendiente de s7lver (spec §10): no bloquea el trabajo, pero sí el commit.
- **Recorrido completo** sin atajos en producción. Los atajos nuevos (`?library`, `?papers=N`) son **solo de desarrollo** (`process.env.NODE_ENV === 'development'`), como `?room`.
- **Movimiento reducido:** misma secuencia, sin destellos ni sacudidas, con fundidos; el rayo rojo es un fundido rojo (spec §9).
- **El contenido existe sin animación:** los papers son también una lista de enlaces fuera del lienzo (spec §6.4), que es lo que se ve sin WebGL.
- Rendimiento: 60 fps en un portátil normal durante el tiempo parado con 30 hojas.

## Review Focus

1. **Muchos papers** (30): las hojas se reparten por el pasillo, cada una se puede alcanzar y abrir, y los fps aguantan. Comprobación con `?library&papers=30` en la tarea 6.
2. **Cero papers** (contenido vacío o la API caída): sale la hoja de relleno, su clic suena a error y no abre nada. Comprobación en la tarea 6.
3. **Scroll de trackpad con inercia, o pasar el ratón por las hojas haciendo scroll suave**: el indicador no se llena sin querer, porque baja si paras, y sí se llena con un scroll largo y seguido. Hacer scroll hacia arriba no lo rompe. Comprobación en la tarea 6.
4. **Cambiar el tamaño de la ventana o girar el móvil en el tiempo parado**: las hojas siguen respondiendo a donde apuntas y el indicador sigue visible. Comprobación en la tarea 6.
5. **Pestaña en segundo plano durante la grabación o el frenesí**: al volver, la secuencia sigue desde donde iba, sin saltarse el impacto ni quedarse con dos escenas pintándose. Comprobación en la tarea 7.

---

### Task 1: Los papers como contenido

**Files:**
- Modify: `webpage/app/lib/content-constants.ts`
- Modify: `webpage/app/lib/content.ts`
- Create: `webpage/app/oni/library/papers.ts`

**Interfaces:**
- Produces, en `content-constants.ts`:
  ```ts
  export interface PaperC { title: string; authors: string[]; year: number; venue?: string; abstract: string; pdf: string }
  export const DEFAULT_PAPERS: PaperC[] = []
  ```
- Produces: `'papers'` es un `ContentType` válido (en el tipo, en `DEFAULTS` y en `isContentType`), así que `GET /api/content/papers` funciona sin tocar la ruta.
- Produces, en `papers.ts`:
  ```ts
  export interface Paper extends PaperC { placeholder?: boolean }
  export const PLACEHOLDER: Paper // placeholder: true, pdf: '', título y resumen tachables
  export function loadPapers(): Promise<Paper[]> // [PLACEHOLDER] si no hay ninguno o la API falla
  ```

- [ ] **Step 1:** Añadir el tipo y los datos. El relleno: título `"[REDACTED]"`, autores `['s7lver']`, año del momento, resumen de unas 40 palabras que luego se tacha al pintarlo, `pdf: ''`. Desarrollo: `?papers=N` rellena con N copias numeradas de un paper de prueba con `pdf: 'https://arxiv.org/pdf/1706.03762'`.
- [ ] **Step 2: Comprobación:** `curl http://localhost:3000/api/content/papers` devuelve `[]`. `npx tsc --noEmit -p .` limpio.

### Task 2: Las piezas de la biblioteca

**Files:**
- Modify: `webpage/tools/models/build.mjs` (conjunto nuevo `library`, SRC `public/models/library/src/library/`)
- Modify: `webpage/app/oni/credits.ts`
- Output: `webpage/public/models/library/{shelf,table,chair,desklamp,ceilinglamp,railing,door,shell}.glb`

**Interfaces:**
- Produces: un GLB por pieza, cada uno con su origen en la base de la pieza (y = 0) y centrado en x/z, para colocarlo con `place()`.

- [ ] **Step 1:** Mirar la jerarquía con `inspect.mjs` y anotar el nodo raíz de cada pieza. Prefijos vistos: `prop_biblioteca_estanteria*` (estantería con sus libros `prop_biblioteca_libros*`), `mesa*`, `silla*`, `lampara_mesa*`, `lampara_techo*`, `biblioteca_barandilla*`, `prop_casa_puerta*`, y la carcasa `biblioteca_{suelo,suelo2,suelo_volante,techo,pared,pared2,ventana,remates}`.
- [ ] **Step 2:** Un trabajo por pieza con `root:` (el ya existente) para quedarse con **una sola instancia**, y `shell` con `keep:` para la carcasa. Texturas: 1024 para `shelf` y `shell`, 512 para el resto. `simplify` donde pase de 30k triángulos.
- [ ] **Step 3:** Ejecutar `node build.mjs library`. Esperado: 8 GLB, en total menos de 8 MB, cada uno visible en `/galery` con su nombre.
- [ ] **Step 4:** Añadir "Environment - Library" (anaroeto, `https://sketchfab.com/3d-models/environment-library-26c53ed3f9a84256a45607917c63c321`, CC-BY-4.0) a `CREDITS`.

### Task 3: La escena de la biblioteca

**Files:**
- Create: `webpage/app/oni/library/libraryScene.ts`
- Create: `webpage/app/oni/library/books.ts`
- Create: `webpage/app/oni/library/Library.tsx`
- Create: `webpage/app/oni/library/library.css`
- Modify: `webpage/app/page.tsx` (importar `library.css`)
- Modify: `webpage/app/oni/Hero.tsx` (atajo `?library`)

**Interfaces:**
- Produces, en `libraryScene.ts`:
  ```ts
  export class LibraryScene {
    constructor(opts: { renderer: THREE.WebGLRenderer; papers: Paper[]; reduced: boolean })
    readonly scene: THREE.Scene
    readonly cctvCam: THREE.PerspectiveCamera   // la cámara de seguridad, en lo alto de una esquina
    readonly camera: THREE.PerspectiveCamera    // la de dentro, a pantalla completa
    readonly feed: THREE.WebGLRenderTarget      // 640×480, lo que ve cctvCam
    load(): Promise<void>
    update(dt: number): void                    // animaciones y efectos; no pinta
    renderFeed(): void                          // pinta cctvCam en feed
    takeOver(canvas: HTMLCanvasElement): void   // desde aquí pinta a pantalla completa con su composer y su bucle
    dispose(): void                             // no desecha el renderer: es prestado
  }
  ```
- Produces, en `books.ts`: `makeBook(spine: THREE.Texture, size: [number, number, number]): THREE.Mesh`. Tapas, canto de hojas con relieve y lomo con la textura de las estanterías, con desgaste; nunca una caja lisa (spec §6.2).
- Produces, en `Library.tsx`: `export default function Library({ renderer, canvas, scene }: { renderer?: THREE.WebGLRenderer; canvas?: HTMLCanvasElement; scene?: LibraryScene })`. Con `scene` dado continúa esa (la que viene de la sala); sin nada, crea renderer y escena propios (atajo de desarrollo y móvil sin sala).

- [ ] **Step 1:** Montar la biblioteca con las piezas de la tarea 2:
  - un pasillo largo entre dos filas de estanterías altas, repetidas y algo desalineadas;
  - una entreplanta con barandilla al fondo;
  - mesas de lectura con su lámpara encendida;
  - ventanas altas con luz fría de luna;
  - el suelo de madera con relieve y reflejos (como el de la sala: `surfaces.ts` y entorno PMREM).
- [ ] **Step 2:** Libros sueltos de `books.ts` en algunas baldas (los que el sujeto saca y tira) y un montón en una mesa.
- [ ] **Step 3:** La cámara de seguridad (`camera.glb`) en una esquina alta mirando al pasillo, y `cctvCam` en su objetivo.
- [ ] **Step 4:** `?library` (solo en desarrollo) monta `Library` a pantalla completa sin pasar por la sala.
- [ ] **Step 5: Comprobación:** `?library` enseña la biblioteca de noche con la cámara libre de desarrollo (OrbitControls detrás de `?library&free`), sin errores en consola y a 60 fps. En una captura, la escena no se ve plana: hay luz con dirección, reflejos en el suelo y profundidad en el pasillo.

### Task 4: El sujeto

**Files:**
- Create: `webpage/app/oni/library/subject.ts`
- Create: `webpage/app/oni/library/subjectMaterial.ts`

**Interfaces:**
- Consumes: `public/models/library/bot.glb` (11 clips: `idle`, `searching-files-high`, `reaching-out`, `taking-item`, `picking-up-object`, `looking-behind`, `left-turn`, `nervously-look-around`, `rummaging`, `walking`; `looking-behin2d` se ignora) y `public/models/oni-mask.glb`.
- Produces, en `subject.ts`:
  ```ts
  export type Clip = 'idle' | 'searching-files-high' | 'reaching-out' | 'taking-item' | 'picking-up-object'
    | 'looking-behind' | 'left-turn' | 'nervously-look-around' | 'rummaging' | 'walking'
  export class Subject {
    readonly root: THREE.Group                 // 1.8 m de alto, pies en y = 0
    load(): Promise<void>
    play(clip: Clip, o?: { fade?: number; loop?: boolean; speed?: number }): Promise<void> // se resuelve al acabar si no es bucle
    lookAt(target: THREE.Vector3 | null, o?: { snap?: boolean }): void // cabeza y torso; snap = el tirón robótico al final
    reachTo(target: THREE.Vector3 | null): void // IK del brazo derecho (CCDIKSolver)
    throwAt(target: THREE.Vector3, onRelease: (from: THREE.Vector3, dir: THREE.Vector3) => void): Promise<void> // lanzamiento compuesto a mano
    freeze(on: boolean, drift?: number): void  // congela la pose; drift = avance lentísimo (m/s)
    update(dt: number): void
  }
  ```
- Produces, en `subjectMaterial.ts`: `subjectMaterial(): THREE.MeshPhysicalMaterial`. Separa las zonas en el shader **por pesos de hueso**, porque el modelo no trae UV:
  - Cabeza (`mixamorigHead`, `mixamorigHeadTop_End`): negro brillante tipo visor, `clearcoat` 1 y rugosidad 0.08.
  - Cuello y articulaciones (`Neck`, `Spine2` alto, hombros, codos, muñecas, rodillas): tejido de punto negro mate, con normal procedural de punto.
  - Resto: paneles negro satinado (rugosidad 0.35) con juntas un poco más oscuras donde cambia el hueso dominante.

- [ ] **Step 1:** Cargar el bot, escalarlo a 1.8 m, ponerle `subjectMaterial` y pegar la máscara al hueso `mixamorigHead`, ajustada a mano a la cara de la cápsula.
- [ ] **Step 2:** `play` con `AnimationMixer` y fundidos; `walking` en el sitio, con el avance puesto desde `update`.
- [ ] **Step 3:** `lookAt` y `reachTo` encima del mixer, después de `mixer.update` en cada fotograma: rotación de cabeza y torso limitada a ±80°, e IK de hombro, codo y mano.
- [ ] **Step 4:** `throwAt`: poses clave en código (brazo atrás 0.25 s, latigazo de muñeca 0.12 s, seguimiento 0.3 s) empalmadas desde `left-turn`. `onRelease` llega en el latigazo.
- [ ] **Step 5:** `freeze`: congela el mixer a mitad de paso de `walking` y mueve `root` a `drift` m/s, con un temblor mecánico leve en la cabeza.
- [ ] **Step 6: Comprobación:** con `?library&bot` aparece el sujeto en el pasillo, y unas teclas de desarrollo prueban cada clip, `lookAt` a la cámara, `reachTo` a un libro de la balda, `throwAt` y `freeze`. La mano llega al libro, la cabeza sigue a la cámara sin girar más de lo humano, y la máscara no se separa de la cabeza en ningún clip. No se ve ninguna marca en el cuerpo.

### Task 5: La secuencia

**Files:**
- Create: `webpage/app/oni/library/card.ts`
- Create: `webpage/app/oni/library/crack.ts`
- Create: `webpage/app/oni/library/libraryAudio.ts`
- Modify: `webpage/app/oni/library/libraryScene.ts`

**Interfaces:**
- Produces, en `libraryScene.ts`:
  ```ts
  recording(): Promise<void>  // pasos 3 y 4 de la spec: busca, se gira, lanza; se resuelve al impacto de la carta en cctvCam
  inside(): Promise<void>     // pasos 5 a 7: vista dentro, frenesí, libros y hojas cayendo; se resuelve con el tiempo ya parado
  ```
- Produces, en `card.ts`: `makeCard(): THREE.Mesh` (carta de póker de 63×88 mm con 鬼 en el reverso; anverso con un as de picas rojo).
- Produces, en `crack.ts`: `crackOverlay(canvas: HTMLCanvasElement): { hit(x: number, y: number): void; dispose(): void }`, un cristal roto dibujado sobre la imagen (grietas radiales desde el punto de impacto) para el render target de la grabación.
- Produces, en `libraryAudio.ts`: `class LibraryAudio { hum(on: boolean); whoosh(); glass(); books(n: number); stopTime(); drone(level: number); bolt(); error(); dispose() }`, todo procedural, como `PcAudio`.

- [ ] **Step 1:** `recording()`:
  1. El sujeto en el pasillo con `searching-files-high` y `reachTo` a un libro.
  2. Tras 4–6 s, `nervously-look-around`.
  3. `left-turn` y `lookAt(cctvCam, { snap: true })`.
  4. `throwAt(cctvCam)`: la carta vuela girando hasta el objetivo en 0.35 s.
  5. Al llegar: `crack.hit` en el punto de impacto, `glass()`, y la imagen se corta en estática.
- [ ] **Step 2:** `inside()`:
  1. La cámara dentro, baja y lateral, en un encuadre que no está de frente al sujeto (spec §6.3, el paso 5 queda al constructor). La carta clavada en primer plano unos segundos.
  2. `rummaging` a 1.6× con `reachTo` saltando de libro en libro. Los libros salen despedidos con una curva balística y giro, y caen con `books()`. Las hojas de los papers salen con ellos.
  3. A los 3–4 s: `stopTime()`. Todo se congela, la cámara baja casi al suelo detrás del sujeto, y él `freeze` a mitad de un paso de `walking` que se aleja.
- [ ] **Step 3:** Movimiento reducido: la carta y el cristal sin sacudida; entre la grabación y la vista de dentro, un fundido; la caída de los libros, más corta.
- [ ] **Step 4: Comprobación:** con `?library&seq`, la secuencia completa sin la sala: grabación en un recuadro con el `CctvHud`, la carta, el cristal, la biblioteca por dentro, el frenesí y el tiempo parado. Nada atraviesa las estanterías, el sujeto no flota ni se hunde en el suelo, y el tiempo parado se ve congelado de verdad (sin partículas ni polvo moviéndose, salvo el temblor de la cabeza).

### Task 6: Las hojas, el indicador y la salida

**Files:**
- Create: `webpage/app/oni/library/sheets.ts`
- Create: `webpage/app/oni/library/ScrollMeter.tsx`
- Modify: `webpage/app/oni/library/libraryScene.ts`
- Modify: `webpage/app/oni/library/Library.tsx`
- Modify: `webpage/app/oni/library/library.css`

**Interfaces:**
- Produces, en `sheets.ts`:
  ```ts
  export function paintSheet(paper: Paper): HTMLCanvasElement // portada A4 de 1024×1448 compuesta con los datos (spec §6.4)
  export function placeSheets(papers: Paper[], area: THREE.Box3): { mesh: THREE.Mesh; paper: Paper }[]
  ```
- Produces, en `libraryScene.ts`: `sheetAt(ndc: THREE.Vector2): Paper | null`, `hover(paper: Paper | null)` y `resume(): Promise<void>` (el tiempo arranca, el rayo rojo, el sujeto desaparece; se resuelve al acabar).
- Produces: `ScrollMeter({ value }: { value: number })`, de 0 a 1.

- [ ] **Step 1:** `paintSheet`:
  - Papel ligeramente amarillento con grano.
  - Título en serif grande, autores, año y `venue`, y el resumen en dos columnas cortado en las líneas que quepan.
  - El relleno, con barras negras encima del título y del resumen y un sello `CLASSIFIED` rojo.
  - Hoja con algo de curvatura (un plano con unas pocas filas desplazadas), no un plano rígido.
- [ ] **Step 2:** `placeSheets`: en el aire entre el sujeto y la cámara, a 0.2–1.6 m de altura, giradas al azar ±35°. Una de cada cuatro, en el suelo. Las más cercanas, de cara a la cámara. Sin solaparse al proyectarlas en pantalla.
- [ ] **Step 3:** `hover`: la hoja se aclara y se acerca 4 cm a la cámara en 0.2 s. El cursor pasa a mano. El clic en una hoja con `pdf` abre `window.open(pdf, '_blank', 'noopener')`; en el relleno, `audio.error()`.
- [ ] **Step 4:** El indicador:
  - En el tiempo parado, la rueda, el arrastre del dedo y las teclas (flecha abajo, Re Pág, espacio) suman al valor. No se mueve nada más.
  - El valor baja a 0.25/s cuando no hay scroll.
  - Hace falta el equivalente a unos 3500 px de rueda seguidos.
  - `drone(value)` sube con él.
  - Se dibuja con el lenguaje de `.room-scroll` (la cuenta roja en su carril), pero llenándose.
- [ ] **Step 5:** `resume()` al llegar a 1:
  - Las hojas siguen su caída.
  - El sujeto se descompone en un rayo rojo vertical (unos 0.4 s) y desaparece. `bolt()`.
  - Con movimiento reducido, en vez del rayo, un fundido rojo.
- [ ] **Step 6:** Lista de enlaces de los papers en el DOM, oculta salvo con el teclado (como `.room-nav`). Sin WebGL, se ve a pantalla completa.
- [ ] **Step 7: Comprobación:**
  - `?library&seq&papers=30`: llegan 30 hojas al tiempo parado y cada una se puede alcanzar y abrir.
  - `?library&seq` con la API devolviendo `[]`: sale solo la hoja de relleno, que pita al hacer clic.
  - Un scroll corto con el trackpad, o mover el ratón entre las hojas, no llena el indicador; un scroll largo sí, y hacia arriba no rompe nada.
  - Redimensionar la ventana en el tiempo parado: el hover sigue sobre la hoja correcta.
  - En 375×812, las hojas se tocan y el arrastre llena el indicador.

### Task 7: El apagado lleva a la biblioteca

**Files:**
- Modify: `webpage/app/oni/room/surveillanceScene.ts`
- Modify: `webpage/app/oni/room/Room.tsx`
- Modify: `webpage/app/oni/Hero.tsx`

**Interfaces:**
- Consumes: `LibraryScene` (tarea 3) y `recording()` (tarea 5).
- Produces, en `surveillanceScene.ts`:
  ```ts
  powerOff(): Promise<void>                 // todas las pantallas a uOff = 1 en 0.45 s con desfase de hasta 120 ms; luces a 0; el clonc del tubo (PcAudio.clonk(): 60 Hz con ruido corto)
  showFeed(i: number, tex: THREE.Texture, onFrame: (dt: number) => void): void // una sola tele con tex (uCctv = 1) y la cámara acercándose hasta que llena la vista
  release(): { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } // desecha la sala sin desechar el renderer
  ```
- Produces: `Room` gana `onExit()`, que se llama justo después de `release()`, y Hero monta `Library` con ese renderer y esa escena.

- [ ] **Step 1:** El botón `power` del mando (y la tecla `P`) llama a `powerOff()`. Mientras, Room crea `LibraryScene` con el renderer de la sala y la carga.
- [ ] **Step 2:** Tras 1.2 s de oscuridad, `showFeed` con la tele más centrada y `library.feed.texture`. En cada fotograma, `library.update(dt)` y `library.renderFeed()`. Arranca `recording()`.
- [ ] **Step 3:** Al resolverse `recording()`, `release()`. Hero desmonta Room y monta `Library` con la escena ya cargada, que sigue con `takeOver()` e `inside()`.
- [ ] **Step 4:** Cuando `resume()` de la biblioteca (tarea 6) acaba, Hero desmonta `Library`, quita `overflow: hidden`, arranca Lenis y hace scroll a `.oni-next`, donde irá §6.4.
- [ ] **Step 5: Comprobación:**
  - Recorrido entero desde la habitación: el mando apaga, se enciende una tele con la biblioteca, la carta la rompe y la biblioteca sigue sin pantallazo negro ni carga visible.
  - Con la pestaña oculta durante la grabación unos segundos: al volver sigue desde donde iba, y solo hay un bucle pintando (rendimiento: un solo `requestAnimationFrame` activo).
  - Al acabar, el canvas sale del DOM y la página tiene scroll.

### Task 8: Repaso final

- [ ] **Step 1:** Recorrido completo en escritorio y en móvil (375×812): sala, apagado, grabación, biblioteca, hojas y salida.
- [ ] **Step 2:** `npx tsc --noEmit -p .` limpio. Quitar los registros de desarrollo.
- [ ] **Step 3:** Repasar la ley anti-slop punto por punto y corregir lo que falle.
- [ ] **Step 4:** Enseñárselo a s7lver. **Solo con su aprobación** (y con la licencia del bot aclarada), un commit con todo lo pendiente de la rama y el pie de autoría que indique el sistema.
- [ ] **Step 5:** Revisión final de toda la rama por un revisor nuevo en el modelo más capaz.
