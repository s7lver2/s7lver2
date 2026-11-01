# Backrooms: diseño

El primer easter egg del portfolio oni (rama `redesign/oni`). Sale de `juegos/backrooms.exe`, en el escritorio de
ONI//OS (`app/lib/content-constants.ts`), que hoy solo da el pitido de error (`app/oni/pc/Desktop.tsx`). Da el
logro **«Noclip»**, que ya está en la pared de la Última Cena (`app/oni/achievements.ts`,
`docs/superpowers/specs/2026-10-30-last-supper-design.md`).

## Intención

Un **juego completo dentro del portfolio**, escondido en una carpeta del ordenador: las backrooms grabadas con una
cámara de mano de los 80. Es lo que alguien curioso encuentra al hurgar, y tiene que dar la sensación de que no
debería existir dentro de una web personal. Da miedo, pero también es una broma: el menú se ríe de ti, la entidad
baila sobre tu cadáver y matar a un bicho te llama idiota.

## Lo que pasa

1. **El reinicio.** Doble clic en `backrooms.exe`: el ordenador de ONI//OS se reinicia. Arranca con una pantalla
   de los 90: letra blanca antigua sobre negro y una barra de carga. Es aquí donde se descarga y se prepara el
   juego. Como los modelos pesan, la pantalla **avisa de que puede tardar**.
2. **El menú.** Al terminar la carga sale el menú del juego **BACKROOMS**, con tres botones:
   - **Play** empieza la partida.
   - **Quit** se cae, literalmente: el botón se descuelga de la pantalla. No se puede salir así.
   - **Options** te agarra el cursor, lo arrastra hasta Play y le da él.
3. **La partida.** Apareces en un laberinto nuevo, generado para esta partida.
4. **El final.** Hay dos maneras de terminar:
   - **Salir:** con todas las misiones hechas, el ascensor se abre. Te subes, las puertas se cierran y la
     grabación se corta. Vuelves al principio de la web, la habitación, y salta el aviso de «Noclip».
   - **Morir:** si te pilla una entidad o caes al vacío, la grabación se corrompe y llega un cuelgue falso. Luego
     vuelves al escritorio de ONI//OS, con `backrooms.exe` ahí para volver a intentarlo.

## El jugador

- **Primera persona.** Andar, correr, saltar y mirar.
- **Eres el hazmat, y se ve su cuerpo:** al mirar abajo, piernas y botas; con algo en la mano, los brazos.
- **Los objetos:**
  - **La linterna.** La llevas siempre.
  - **La cámara** (camcorder) se recoge en el mapa. Con ella se hacen las fotos.
  - **La pistola** está escondida en el mapa y no siempre aparece. Mata entidades.
- **Las animaciones del hazmat:**

  | Momento | Animación |
  |---|---|
  | Quieto | Neutral Idle |
  | Andar | Walking222 |
  | Correr | Slow Run |
  | Recoger la cámara o la pistola del suelo | Picking Up |
  | Recoger una cinta | Taking Item |
  | Recargar | Reloading |
  | Apuntar | Rifle Idle |

- **Controles:** teclado y ratón en el ordenador, y controles táctiles en el móvil (tiene que poder jugarse
  entero en el móvil).

## Las misiones

- **Fotografiar 2 entidades.**
- **Recoger 8 cintas VHS** tiradas por el mapa.
- **El ascensor** solo se abre si llevas las 2 fotos y las 8 cintas.
- **Duración:** jugando bien, una partida hasta el ascensor dura **como mucho unos 10 minutos**. El tamaño del
  laberinto sale de ahí.

## El laberinto

- **Generado por código en cada partida:** laberinto, cintas, entidades, pistola y ascensor cambian cada vez que
  se le da a Play.
- **Hecho con piezas de `backrooms_vr2`**, que es el mismo escenario que `backrooms_vr` pero con texturas más
  ligeras.
  - **Objetos sueltos para ir colocando:** paneles de luz del techo, rejillas, enchufes, cartel de EXIT, puerta y
    sillón o muebles.
  - **Paredes, moqueta y techo:** sus texturas llevan la luz horneada de esa habitación, así que se recorta un
    trozo limpio de cada una y se hace repetible.
- **Huecos al vacío:** se puede caer al vacío. Por eso hay huecos en el suelo.

## Las entidades

- **Bacteria y partygoer** deambulan por el mapa. Al empezar hay **una de cada**.
- **Las fotos** valen de **2 entidades distintas cualesquiera**, no hace falta una de cada tipo.
- **Al matar una**, aparece otra nueva **del tipo contrario**, lejos del jugador. Siempre quedan entidades vivas a
  las que fotografiar, así que la partida siempre se puede ganar.
- **Sus animaciones:**

  | Entidad | Quieta | Andar | Correr | Atacar | Bailar |
  |---|---|---|---|---|---|
  | Bacteria | Idle | Walking, Walking2 | Run | Jump Attack | Booty Hip Hop Dance, Twist Dance |
  | Partygoer | Happy Idle | Dwarf Walk | Drunk Run Forward | Standing Melee Attack Horizontal | Macarena Dance |

- **El globo rojo del partygoer** se le quitó para pasarlo por Mixamo. Va pegado a su mano en el juego.
- **Matar una entidad con la pistola:**
  - La entidad se parte en cachitos que salen volando.
  - Te llevas un logro nuevo, **«Good job idiot, now what?»**.
  - La nueva del tipo contrario es un **15 % más rápida** y necesita **2 tiros** para morir.

## Morir

- **Cómo se muere:** te pilla una entidad o caes al vacío.
- **Lo que se ve:** la estática sube y la grabación se corrompe. Si te ha pillado una entidad, **se queda bailando**
  delante de la cámara con uno de sus bailes.
- **El cuelgue falso:** la imagen se congela y sale una pantalla de error que da el pego de que todo ha petado.
  **Nunca se cuelga ni se cierra el navegador de verdad:** la página sigue viva.
- **Después:** vuelves al escritorio de ONI//OS.

## El aspecto

- **Todo el juego es la grabación de la cámara:** estática todo el rato, efectos VHS y aspecto de pantalla de los
  80.
- **Los modelos los ha dado el usuario.** Todo está en `public/models/backrooms/` y las animaciones en
  `public/models/backrooms/animations/`.
  - Hazmat, partygoer y bacteria están riggeados en Mixamo. Cada FBX de animación trae la malla de su personaje.
  - Ascensor (con la animación de las puertas), cámara, cinta VHS, pistola, linterna y `backrooms_vr2`.
  - Los FBX preparados para Mixamo están en `tools/models/mixamo/`.

## Logros

- **«Noclip»** (`backrooms`), al subir al ascensor. Ya existe.
- **«Good job idiot, now what?»**, nuevo, al matar una entidad. Necesita su marco en la pared de la cena (un icono
  en `app/oni/supper/frames.ts`, como los demás) y entrar en la lista de `achievements.ts`.

## Créditos

- **Todos los modelos son CC-BY-4.0.** Los créditos irán en una página `/credits` o en una galería que el usuario
  hará más adelante, no dentro del juego.
- **Autores:**

  | Modelo | Autor |
  |---|---|
  | backrooms_vr | carlcapu9 |
  | backrooms_vr2 | VTX |
  | bacteria | Roman Trace |
  | elevator_building | adventurer |
  | hazmat | taggedk |
  | gun | Dries Deryckere |
  | partygoer | FilinMinv |
  | camcorder | ZwiebelGames |
  | vhs | Terizmeh |
  | flashlight | FayBall |

## Objetivos

- Que sea un juego de verdad, completo y que se pueda ganar, no una demo.
- Jugable con ratón y teclado y en el móvil.
- Que la web de alrededor no lo pague: la página normal no descarga nada del juego hasta que se abre
  `backrooms.exe`.

## No objetivos

- Guardar la partida o tener niveles: cada Play es una partida suelta.
- Créditos dentro del juego.
- Más easter eggs. VRChat, c0rr#pt, WhatsApp y los demás son otros proyectos.

## Anti-objetivos

- Colgar o cerrar el navegador de verdad, o tocar nada fuera de la página.
- Imitar la pantalla de error de un navegador real (Chrome, Firefox). El error es del mundo del juego.
- Tirones al entrar o durante la partida. En Firefox, donde los shaders compilan sin paralelo, todo se compila en
  la pantalla de carga (ver `app/oni/still.ts` y `app/oni/compile.ts`).
- Que se vea como un juego de navegador barato: el aspecto de grabación VHS es la gracia.

## Decisiones de Claude (el usuario puede cambiarlas)

- **El reinicio** vuelve a usar el arranque de `Computer.tsx` (fase `post`) con otra pantalla. La partida pasa a
  pantalla completa y la habitación de detrás deja de pintar mientras se juega.
- **Pantalla de grabación:**
  - `REC` parpadeando, fecha y hora estilo VHS, y la batería.
  - Los contadores `TAPES 3/8` y `PHOTOS 1/2`.
  - Las balas, solo si llevas la pistola.
- **La pistola** sale en más o menos la mitad de las partidas, con 6 balas y sin más munición.
- **Una foto cuenta** si la entidad está en el centro del encuadre, a la vista, sin pared delante y a una distancia
  razonable. Cada entidad cuenta una sola vez. Al disparar la foto hay flash y un fotograma congelado.
- **Las entidades** deambulan y te persiguen cuando te ven. Si las pierdes de vista un rato, vuelven a deambular.
  Corriendo, el jugador es algo más lento que una entidad que corre, así que hay que esconderse y no solo huir.
- **Cada entidad que mates** trae otra, más rápida y más dura que la anterior (15 % y 2 tiros, acumulándose). El
  logro sale solo la primera vez.
- **Matar no cuenta como foto.** Una entidad fotografiada y luego muerta sigue contando.
- **Los huecos al vacío** son pocos y se ven al iluminarlos con la linterna. Caer es culpa del jugador, no una
  trampa invisible.
- **El baile de la muerte** es uno al azar entre los de la entidad que te ha pillado.
- **La linterna** va en una mano y la cámara o la pistola en la otra.
- **Sonido:**
  - el zumbido de los fluorescentes de fondo
  - pasos sobre moqueta
  - el siseo de la cinta
  - un sonido propio para cada entidad cuando está cerca
  - el disparo
  - el obturador
  - el ascensor

  Se generan con Web Audio, como el resto del ordenador (`app/oni/pc/pcAudio.ts`), salvo que haga falta algo
  grabado.
- **Quit, al caerse,** no vuelve: en el menú solo quedan Play y Options. Para salir del juego sin jugar, Escape (o
  el botón de atrás del móvil) vuelve al escritorio de ONI//OS.
- **Options en el móvil:** como no hay cursor, aparece uno falso que arrastra el dedo hasta Play.
- **Controles táctiles:**
  - joystick a la izquierda para moverse
  - arrastrar en la mitad derecha para mirar
  - botones de saltar, correr, linterna, sacar o guardar la cámara o la pistola, y disparar
- **Movimiento reducido** (`prefers-reduced-motion`): sin balanceo de cabeza y con los efectos VHS más suaves. El
  juego sigue siendo jugable.
- **Presupuesto:**
  - Todo lo del juego, una vez preparado, en **unos 25 MB como mucho**.
  - Objetivo de 30 fps en un Android de gama media.
  - En el móvil hay calidad baja: menos resolución, sin sombras y una pasada VHS más barata.
- **Pausa:**
  - En una partida, Escape (que además suelta el puntero) o el botón de atrás del móvil pausan el juego.
  - La pausa es una pantalla con Resume y Quit. Quit vuelve al escritorio de ONI//OS sin morir.
- **Al ganar**, el aviso de «Noclip» sale ya en el ascensor, y luego la página se recarga arriba del todo, con
  la pantalla de carga de la web y el ordenador apagado.
- **Si falta una animación del hazmat** (salto, disparo, andar de lado o hacia atrás), se pide al usuario en
  Mixamo. Lo que solo ocurre en primera persona (sujetar la linterna, apuntar la pistola) se resuelve con poses de
  brazos por código encima de la animación.
- **El peso:** una sola malla por personaje con todas sus animaciones juntas, texturas reducidas y en webp, y la
  linterna simplificada (trae 276 mil vértices). Se prepara con el mismo `tools/models/build.mjs` que el resto de
  modelos.

## Lo que queda para quien lo construya

- El algoritmo del laberinto, siempre que dé una partida de unos 10 minutos y deje todo alcanzable.
- La IA exacta de las entidades: cómo ven, cómo te pierden y por dónde patrullan.
- El diseño de la pantalla de carga, del menú y del error falso, dentro del aspecto de los 90 y los 80.
- Cómo se hacen los efectos VHS y de estática: una pasada de postproceso, la misma idea que `cctvPass.ts`.

## Revisión 2 (tras jugarlo)

Lo que el usuario pidió después de probar la primera versión, con sus decisiones:

- **Entrada:** al abrir `backrooms.exe` ya no se reinicia el ordenador. La pantalla se queda en negro y aparecemos
  en una sala oscura y vacía con un televisor encendido. Nos acercamos a él y nos metemos dentro; dentro está la carga
  de los 90 y el menú.
- **Pantalla completa:** el juego ocupa toda la pantalla (Fullscreen API al darle a Play) y nada del ordenador
  (cursor rojo, cristal, parpadeo) queda por encima.
- **Estética de los 90, las dos cosas:**
  - render tipo PS1: baja resolución con píxeles gordos, vértices que bailan, dithering y paleta corta;
  - menús, carga, pausa e inventario como ventanas de Windows 95 / DOS.
- **Cursor propio:** flecha pixelada de los 90; reloj de arena mientras carga; mano sobre los botones.
- **VHS solo con la cámara**, y más fuerte que antes. Sin cámara la imagen es la del PS1, limpia.
- **Cámara con clic derecho:** se levanta la camcorder y se mira por ella, con su interfaz (REC, contador, batería,
  zoom, recuadro de enfoque). El clic izquierdo hace la foto.
- **Inventario completo con E.** Para recoger las cosas, otra tecla (G; botón en táctil).
- **El mapa como los Backrooms de las referencias** (mapas del BR Movie y de Escape the Backrooms): salas abiertas e
  irregulares, salas de columnas, pasillos largos paralelos, zonas de tabiques sueltos y huecos de puerta, callejones.
  Sigue siendo procedural en cada partida.
- **Luz:** ni plana ni sin sombras. Paneles fluorescentes en rejilla, zonas apagadas, sombras y oclusión en
  esquinas y pies de pared.
- **Brazos:** el arma tiene que estar bien cogida con las manos (IK), y los brazos dejar de estar rotos.
- **Derrota:** mejor animación de muerte.
