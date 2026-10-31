# Escena de los papers: la biblioteca

**Fecha:** 2026-10-26 · **Rama:** `redesign/oni` · **Amplía:** `2026-10-25-portfolio-oni-redesign-design.md` (la spec principal). Esta escena va entre la sala de videovigilancia (§6.3) y el desenmascaramiento con las redes (§6.4), y cambia lo que pasa al apagar las teles.

**Orden del final (decidido con s7lver):** sala de vigilancia → **biblioteca (esta escena)** → desenmascaramiento con las redes sociales (§6.4, la penúltima) → final con persecución o explosión → cierre (§6.5).

La ley anti-slop de `webpage/.claude/CLAUDE.md` aplica entera, igual que las secciones 4, 5, 7 y 9 de la spec principal.

## 1. Intención

La escena enseña los **papers académicos** de s7lver (PDFs), pero su papel en el recorrido es otro: es **donde empieza la tensión** que lleva al final, que s7lver quiere que sea una persecución o una explosión. No es una pausa de lectura entre la sala y el final, es el puente. Hasta aquí el oni te vigilaba a ti; ahora **tú le vigilas a él, y te pilla**.

Los papers no se leen en la escena. Se ven y se abren: cada uno es una hoja suelta, y al hacer clic se abre su PDF.

## 2. Objetivos

- Que el apagado de las teles no sea un final, sino el arranque de algo peor.
- Un momento de "tiempo parado" con la cámara casi a ras de suelo, con las hojas suspendidas, que se quede en la memoria.
- Que los papers se encuentren y se abran sin esfuerzo, aunque haya muchos.
- Que funcione hoy con **cero papers** (lleva uno de relleno) y crezca sin tocar código.

## 3. No objetivos

- El desenmascaramiento (§6.4) y el final con persecución o explosión: se diseñan aparte. Esta escena termina cuando el sujeto se esfuma.
- Leer los papers dentro de la web: el PDF se abre en una pestaña nueva.
- Editar los papers desde el admin: como los canales, por ahora se editan en los datos.

## 4. Anti-objetivos

- Que rompa el ritmo: una escena lenta de "mira mis papers" entre la sala y el final.
- Una figura de primitivas o con aspecto de maniquí de pruebas sin tratar. Es un personaje: negro, humanoide y con la máscara.
- Que la carta, el cristal roto o el rayo se vean como efectos de plantilla.
- Contenido que solo existe si una animación se ejecuta: las hojas y su enlace tienen que existir aunque la escena no se anime (movimiento reducido, sin WebGL).

## 5. El recorrido, paso a paso (decidido con s7lver)

1. **El apagado.** En la sala de vigilancia, el botón de apagar del mando apaga todas las teles (cada una se aplasta en una línea y luego en un punto blanco) y la sala se queda a oscuras. Esto sustituye al final de §6.3 de la spec principal, donde el apagado llevaba al desenmascaramiento.
2. **Una sola tele.** Tras un instante de oscuridad, **se enciende una sola tele**. Enseña una grabación de cámara de seguridad: **una biblioteca de noche**.
3. **La grabación.** En la biblioteca, **un sujeto con la máscara oni** busca libros en las estanterías.
4. **Te pilla.** El sujeto **se gira, mira a la cámara y le lanza una carta de póker**. La carta **rompe la cámara**.
5. **En la biblioteca.** De ahí se pasa a una vista dentro de la biblioteca, cerca de él (no exactamente de frente; los encuadres se deciden al construir). Ya no es una grabación: estás ahí.
6. **Frenético.** Él se pone a **buscar libros como loco**. Saca libros, los tira, y unos cuantos caen al suelo junto con hojas sueltas.
7. **El tiempo se para.** Todo se congela.
   - La cámara queda **prácticamente en el suelo, a su espalda**.
   - Él está a mitad de paso, **caminando hacia el otro lado**.
   - Los papeles están **suspendidos en el aire o tirados en el suelo**.
8. **Los papers.** Esas hojas sueltas son los papers. **Se pueden seleccionar**: un clic abre el PDF directamente en una pestaña nueva.
9. **Salir.** El tiempo vuelve a correr cuando **haces mucho scroll**. Hay un **indicador de scroll que se va llenando**.
10. **El final.** Cuando el indicador se llena, el tiempo arranca de golpe y **el sujeto se esfuma en un rayo rojo**. Se le vuelve a ver en el desenmascaramiento (§6.4): **es la misma figura** que allí se quita la máscara, así que el bot, su esqueleto y sus materiales se hacen pensando en reutilizarlos.

## 6. Las piezas

### 6.1 El sujeto (decidido con s7lver)

- **Un humanoide esbelto, como un androide, todo negro.** Referencia: el Tesla Bot conceptual: cabeza de cápsula lisa sin cara, cuello y articulaciones de tejido, cuerpo de paneles con juntas. Debe ser **mucho más humanoide** que los X Bot / Y Bot de Mixamo, que s7lver descartó.
- Lleva **la máscara oni** (`public/models/oni-mask.glb`) pegada al hueso de la cabeza.
- **Sin ninguna marca.** El modelo de origen trae "TESLA" en la textura: no se usa esa textura.
- **Materiales propios** (decisión de Claude, revisable): la cabeza en negro brillante tipo visor, que refleja las luces de la biblioteca; el cuello y las articulaciones en tejido de punto negro mate; los paneles en negro satinado con las juntas algo más oscuras. El modelo llega como una sola malla sin UV, así que las zonas se separan en el shader por los pesos de hueso (cabeza, cuello, articulaciones) y no por material (decisión de Claude).
- **Modelo animado de verdad**, con esqueleto. Las animaciones de Mixamo dan el cuerpo base y se completan moviendo los huesos desde código (decidido con s7lver):
  - la cabeza y el torso giran hacia el objetivo exacto de la cámara de seguridad;
  - el brazo llega con IK al libro concreto que coge;
  - el lanzamiento de la carta, que no tiene animación de Mixamo, se compone con poses clave;
  - en el tiempo parado, la pose congelada a mitad de paso, con una deriva lentísima;
  - empalmes entre animaciones y algún tic mecánico.
- **Ya disponible:** `public/models/library/bot.glb`, que reúne **el bot de la referencia, riggeado con el auto-rig de Mixamo** (a partir de `bot-para-mixamo.obj`; tiene sus mismos 5.040 triángulos), y 11 clips de Mixamo: `idle`, `searching-files-high`, `reaching-out`, `taking-item`, `picking-up-object`, `looking-behind`, `left-turn`, `nervously-look-around`, `rummaging` y `walking` (en el sitio). Lo genera `tools/models/bot.mjs` desde `public/models/animations/*.fbx`.
- **Pendiente:** la licencia del modelo de origen (`tesla-bot.zip` no trae `license.txt`; falta su enlace de Sketchfab). Si no se pudiera usar, se cambia el modelo en `bot.mjs` sin tocar la escena.

### 6.2 La biblioteca

- **Biblioteca de noche**, casi a oscuras.
- Se construye un escenario **propio y más complejo** a partir de las piezas del modelo `environment_-_library` (anaroeto, CC-BY-4.0, en `public/models/library/`): estanterías, barandillas, carteles y demás, recolocadas y repetidas (decidido con s7lver). No se usa el modelo entero tal cual. El original pesa unos 100 MB sin comprimir: las piezas pasan por la tubería de `tools/models/` (meshopt y texturas en webp).
- Libros sueltos para que caigan, una mesa de lectura y su lámpara. El modelo de la biblioteca **no trae libros sueltos** (van fundidos en las estanterías). Decisión de Claude: se le pide a s7lver un modelo de libros sueltos; mientras no llegue, se hacen libros con las texturas de lomo que ya trae la biblioteca, con tapas, canto de hojas y algo de desgaste, nunca una caja lisa.

### 6.3 La grabación y la carta

- **La tele que se enciende** (decisión de Claude, revisable): la del centro del muro. La cámara de la sala se le acerca mientras se ve la grabación, de modo que cuando la carta impacta la imagen ya llena la pantalla.
- La grabación es **la propia biblioteca en 3D renderizada a una textura**, vista desde una cámara de seguridad (el modelo `camera.glb`), con el mismo lenguaje que la llegada a la sala: grano, banda de tracking y rótulo `CAM` con `REC` y la hora (el `CctvHud` existente). Así la carta, el giro y el impacto son continuos con la escena en la que se entra después.
- **El impacto:** la carta se clava, el cristal de la cámara se raja, la señal se corta en estática y se pasa a la vista dentro de la biblioteca. *(Decisión de Claude, revisable:)* la carta clavada puede seguir visible en el primer plano de la vista nueva.
- **La carta de póker:** se hace a mano (un plano con su textura), con el kanji 鬼 o la máscara en el reverso (decisión de Claude, revisable).

### 6.4 Los papers

- Cada paper es **una hoja suelta** (decidido con s7lver). La cara visible es **una portada compuesta con sus datos** (§7): título, autores, año y el principio del resumen, maquetados como la primera página de un paper y legibles al acercarte. No se rasteriza el PDF real: así no hay problemas con PDFs de otros dominios ni un paso de horneado (decisión de Claude).
- En el tiempo parado hay hojas en el aire, a distintas alturas y algo giradas, y alguna en el suelo junto a los libros caídos.
- **Al pasar el ratón** (o al tocar en el móvil), la hoja se ilumina un poco y se acerca unos centímetros; lo demás sigue congelado (decisión de Claude).
- **Un clic abre el PDF directamente** en una pestaña nueva (decidido con s7lver).
- **Con cero papers**, hay **una hoja de relleno** que se nota que es de relleno: un expediente casi todo tachado (decidido con s7lver que exista; el aspecto es decisión de Claude). Su clic no abre nada y suena el pitido de error.
- **Muchos papers:** la escena aguanta los que haya. Si son muchos, las hojas se reparten por más espacio del pasillo; la cámara del suelo no tiene que verlas todas a la vez.
- **Accesibilidad:** los papers existen también como lista de enlaces fuera del lienzo, oculta salvo con el teclado (igual que la `room-nav` de los canales), y es lo que se ve si no hay WebGL.

### 6.5 El indicador de scroll y la salida

- Mientras el tiempo está parado, **el scroll no mueve nada: llena un indicador** (decidido con s7lver).
- *(Decisión de Claude, revisable:)* si dejas de hacer scroll, el indicador baja poco a poco, para que no se llene sin querer mientras miras las hojas. Hace falta un scroll largo y seguido; el tamaño exacto queda para el constructor.
- Sigue el lenguaje del indicador de scroll existente (la cuenta roja en su carril), pero se llena en vez de caer.
- En el móvil, el scroll es arrastrar con el dedo; en el teclado, flecha abajo, Re Pág y espacio.
- Al llenarse: el tiempo arranca, **el sujeto se esfuma en un rayo rojo** y la escena acaba. Lo que viene después es el desenmascaramiento (§6.4). Mientras no exista, el rayo enlaza con lo que haya después en la página.

## 7. Datos

*(Decisión de Claude, revisable.)* Los papers son contenido, como los proyectos: `getContent('papers')`, con su ruta de API como `/api/content/projects`, y unos `DEFAULT_PAPERS` con el de relleno para cuando no hay datos. Cada paper lleva:

- título
- autores
- año
- dónde se publicó (opcional)
- resumen corto
- enlace al PDF: una URL externa (arXiv, revista) o un archivo propio en `public/papers/`

Añadir un paper es añadir una hoja. El admin actual no se toca.

## 8. Sonido

*(Decisión de Claude, revisable.)* Procedural, como el del ordenador (`PcAudio`):

- el clic seco del apagado y el zumbido de la tele que vuelve;
- la grabación casi muda;
- el silbido de la carta y el cristal roto;
- libros cayendo;
- al parar el tiempo, todo se corta y queda un tono grave sostenido que sube mientras llenas el indicador;
- el rayo rojo, un golpe eléctrico.

## 9. Movimiento reducido y fallos

- **Movimiento reducido:** misma secuencia, sin destellos ni sacudidas, con fundidos. El rayo rojo es un fundido rojo, no un destello. El tiempo parado no cambia, porque ya es quieto.
- **Sin WebGL:** se ve la lista de papers como enlaces.
- **PDF que no carga:** es un enlace normal, así que el navegador se encarga.

## 10. Recursos y licencias

| Recurso | Estado | Licencia |
|---|---|---|
| Biblioteca (`environment_-_library`, anaroeto) | En `public/models/library/` | CC-BY-4.0: va a los créditos |
| Maniquí y animaciones (Mixamo) | `public/models/library/bot.glb` | Licencia de Mixamo (uso libre en proyectos) |
| Bot de referencia (`tesla-bot.zip`) | Sin rigging propio; su zip no trae licencia | **Pendiente:** enlace de Sketchfab de s7lver |
| Máscara oni | `public/models/oni-mask.glb` | Propia |
| Cámara de seguridad | `public/models/surveilance_room/camera.glb` | CC-BY-4.0 (ya en créditos) |
| Carta de póker, hojas, efectos | Se hacen a mano | Propios |

## 11. Lo que queda para el constructor

- Los encuadres y movimientos de cámara exactos de cada paso, en especial el paso 5 ("no exactamente frente a él").
- Los tiempos de cada paso, siempre corto y en tensión: la grabación y el frenesí son segundos, no minutos.
- La distribución de la biblioteca con las piezas del modelo.
- Cómo se ve el rayo rojo y el cristal roto, dentro de la estética (rojo como único acento, nada de efecto de plantilla).
- Cuánto scroll llena el indicador y a qué ritmo baja.
- Qué clips de Mixamo usar en cada paso y qué se compone a mano.
