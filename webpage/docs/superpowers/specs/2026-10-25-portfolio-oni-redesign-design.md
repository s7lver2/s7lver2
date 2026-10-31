# Portfolio "Oni": rediseño de la portada

**Fecha:** 2026-10-25 · **Rama:** `redesign/oni` · **Sustituye:** el diseño público de v6 (`2026-07-26-portfolio-v6-design.md`) para la ruta `/`.

## 1. Intención

s7lver (16 años, hacker, amante de Linux/Arch) quiere que su portfolio deje a la gente con la boca abierta: **un portfolio nunca visto**. El listón son las webs de 3D cinematográfico de Awwwards que vio y le encantaron: Igloo Inc, Lando Norris, Lusion, KPR, Messenger y Bruno Simon. Lo que tienen en común: un objeto 3D protagonista de calidad real, un scroll que dirige escenas completas en vez de desplazar bloques, y tipografía con carácter.

Pero **sigue siendo un portfolio**: la gente tiene que ver sus proyectos rápido y entender qué son. El 3D y lo cinematográfico están al servicio de eso, nunca lo esconden.

## 2. Objetivos

- Primer impacto brutal: en los primeros segundos, la sensación de "esto no lo había visto nunca".
- Mostrar **3 proyectos destacados** de forma clara, con su **interfaz real dentro de un móvil 3D realista**.
- Una escena final memorable para las **redes sociales** (la del desenmascaramiento, §6.4).
- Que el texto sea un material más: titulares que se arman, se cortan, se descifran y glitchean.

## 3. No objetivos (en este proyecto)

- **`/projects`** (la lista completa de proyectos): proyecto aparte, después.
- **Rediseño del panel de admin**: proyecto aparte, después.
- Secciones de la web actual que **desaparecen**: Skills, Languages, grafo de proyectos, HTB, stats de GitHub, contador de líneas, terminal y paleta ⌘K, ProgressRail y cursor personalizado. No se migran.
- Selector de idioma: la web es **solo en inglés**.

## 4. Anti-objetivos (fracaso aunque "funcione")

Ya se rechazaron tres prototipos. Esto es lo que s7lver dijo que no está a la altura, y no puede volver a aparecer:

- 3D hecho con primitivas (cajas, cilindros) o con aspecto de "programador haciendo 3D". Se usan modelos reales.
- Tipografía básica, sacada por reflejo de Google Fonts.
- Scroll que solo fija o desliza secciones: tiene que dirigir escenas.
- Proyectos **que se apilan o se montan unos encima de otros**, o que parecen pegados desde otra web, con un estilo que no encaja con el resto de la página.
- Minimalismo y "correcto pero sin wow".
- Contenido que solo existe si una animación se ejecuta (ver la ley anti-slop en `webpage/.claude/CLAUDE.md`, que aplica entera).

## 5. Dirección visual (decidida con s7lver)

- **Tema: toda la web oscura.** Juego fuerte de contraste entre **blanco y negro**, con el **rojo como único acento**. Nada de azul (se probó y se descartó).
- **Estética: samurái japonés + cyberpunk.** Un toque de cyberpunk, no un cyberpunk de neón rosa: líneas de escaneo, glitch, aberración cromática, katakana y detalles de HUD.
- **Objeto protagonista: una máscara oni cyberpunk**, blanca y negra, con ojos rojos que brillan y el kanji 鬼 en la frente. Referencias: `docs/superpowers/assets/2026-10-25-oni-mask-reference.webp` (hoja de vistas con paleta: blanco, gris, negro, rojo) y `2026-10-25-oni-mask-photo.webp`. La paleta de la web sale de ahí.
- **Idioma:** textos en inglés. El japonés es textura y voz visual (kanji, katakana en vertical, sellos), no texto que haya que leer.
- **Estructura** inspirada en thatlev.com (proyectos como piezas grandes y claras). **Lenguaje visual** inspirado en Hermes de Nous Research (titulares gigantes, una sola imagen protagonista, etiquetas pequeñas tipo HUD), llevado a lo japonés-cyberpunk.

## 6. La página `/`, escena a escena

Las escenas van en este orden. El montaje exacto (tiempos, curvas, cámara) queda para el constructor, pero lo que pasa en cada escena está decidido.

### 6.1 Hero: la máscara

- La máscara oni flota en la oscuridad, gira siguiendo el ratón como si mirase al visitante, y sus ojos y detalles brillan en rojo.
- "S7LVER" en tipografía display gigante forma parte de la composición, en capas con la máscara (por delante o por detrás), no como un rótulo pegado encima.
- Con el scroll, la escena evoluciona (escaneo, desmontaje o transformación de la máscara) y da paso a los proyectos con una transición, no con un corte seco.
- **Mientras no exista el modelo de la máscara**, el hero usa un iPhone 3D como sustituto (decisión de s7lver). Los modelos están en `public/models/` (ver §8).

### 6.2 Transición

Entre escenas hay transiciones cinematográficas: cortes, glitch, barridos. No basta con que una sección suba y la otra baje.

### 6.2b Fase 2: el ordenador (aprobado con s7lver el 2026-10-26)

Al terminar la inmersión en la pantalla, el visitante queda **atrapado dentro del ordenador**: el scroll deja de mover la página hasta que salta el virus.

1. **Arranque:** el tubo se enciende, el BIOS cuenta la memoria y sale una pantalla de arranque de los 90 (la máscara tramada y quieta, y una barra de bloques sencilla).
2. **Login estilo terminal:** la máscara en píxeles sigue al cursor; usuario y contraseña de mentira, vale cualquier cosa. Al entrar, el escritorio.
3. **Escritorio "ONI//OS dentro de un monitor de fósforo"** (mezcla de las maquetas A y C):
   - Una sola rampa de rojo de fósforo.
   - Líneas de barrido y viñeteado de tubo.
   - Ventanas con esquinas en escalón de píxel.
   - Iconos y cursor en pixel art propios.
   - Ventanas arrastrables al estilo de los 90 (se mueve el contorno punteado).
   - Una terminal con capa hacker.
   - Tres fondos a elegir: la máscara tramada, la habitación tramada y 鬼 en hexadecimal.
4. **Archivos:**
   - Los textos (quién soy, cómo empecé, trayectoria) se abren en un visor.
   - Las carpetas abren un explorador básico.
   - Las apps son para easter eggs; **de momento no hacen nada** (pitido de error). Habrá una carpeta `juegos` con Backrooms y VRChat, una app corrupta y WhatsApp en el escritorio.
   - `passwords.txt` dispara el virus (§6.2c). **Los easter eggs se diseñan después.**
5. **Efectos y sonido de ordenador de los 90**, todo sintetizado:
   - Desgaussado y pitido POST al encender.
   - Disco duro que rasca, con su LED.
   - Clics de tecla y de ratón.
   - Pitidos al abrir, cerrar y en los errores.
   - Reloj de arena al cargar.
   - Parpadeo y saltos de sincronía.
   - Rastro de fósforo al cerrar.
   - Salvapantallas.
6. **Contenido editable:** el árbol de archivos es contenido (`getContent('desktop')`, Redis con respaldo JSON), para que el panel de admin pueda editarlo en el futuro. Por ahora, textos de relleno.

### 6.2c El virus (aprobado con s7lver el 2026-10-26)

**Si el visitante tarda en abrirlo, el archivo empieza a moverse solo, como si quisiera ser abierto** (decisión de s7lver). Cómo va a más lo decide el constructor; por ejemplo, a los ~40 s en el escritorio tiembla de vez en cuando, luego da saltitos y al final se va arrastrando hacia el cursor. No se abre solo.

Abrir `passwords.txt` dispara el virus. Dura unos 10 segundos, va a más, **no se puede parar ni saltar** y termina en la sala de vigilancia (§6.3).

1. **El anzuelo:** el archivo se abre normal, con sus asteriscos; al segundo, los asteriscos se "descifran" solos en caracteres raros que se desbordan de la ventana.
2. **La infección**, todo a la vez y acelerando:
   - Ventanas de error de los 90 en cascada ("c0rr#pt.exe has performed an illegal operation").
   - Los iconos se descolocan y caen.
   - El cursor deja una estela de copias.
   - La terminal escribe sola `pid 7 escalate root`.
   - Los ojos de la máscara del fondo se encienden.
   - Sonido: pitidos de error atascados en bucle, disco a tope, zumbido del tubo desafinándose.
3. **La risa:** todo se congela y aparece en el centro la máscara de píxeles en grande riéndose (la mandíbula se abre y se cierra, los ojos se entrecierran), mientras "HA HA HA" llena la pantalla como texto de terminal. **La risa es una grabación real e inquietante** (licencia libre, la busca s7lver), procesada para que suene por el altavoz del ordenador.
4. **La salida, suave:** la imagen del ordenador se convierte en la señal de una cámara de seguridad (la habitación desde arriba, con grano, rótulo "CAM 03" y la hora) y la cámara **se aleja saliendo de esa pantalla**: era una de las muchas teles de la sala de vigilancia. Es el reflejo de la entrada al ordenador.

### 6.3 Proyectos: la sala de videovigilancia (aprobado con s7lver el 2026-10-26)

Sustituye a la idea anterior de 3 proyectos en móviles 3D. La historia: la radio ya avisaba de que "they can see your screen"; esta es la sala desde donde te vigilaban, y el log de la terminal (`pid 21 copy ~/projects`) ya anunciaba que se llevaban tus proyectos.

- **El lugar (escena 3D, como la habitación):** una sala de videovigilancia con **muchísimas teles CRT antiguas apiladas** en un muro, cables por el suelo y **luz roja tenue**. Delante, una consola con **un mando a distancia**.
- **Canales = proyectos, sin límite.** Cada canal es una tele del muro. Debe aguantar **tantos canales como s7lver quiera** sin hacerse pesado: el muro crece con los proyectos y las teles sobrantes dan estática.
- **La llegada:** primero todas las teles enseñan la habitación desde distintas cámaras de seguridad; después **se coordinan como una sola pantalla y dibujan entre todas una flecha que apunta al mando**.
- **El mando:**
  - **Clic en el mando** y se coge.
  - **Sus botones cambian de canal** (el scroll no cambia de canal).
  - Al cambiar, **la cámara viaja por la sala hasta esa tele y la encuadra**, con estática entre canal y canal.
  - **OK** abre el proyecto y otro botón abre su código.
  - **El botón de apagar** apaga todas las teles de golpe (el punto blanco que se encoge), la sala queda a oscuras y en el reflejo de las pantallas negras aparece la figura con la máscara: así se pasa a §6.4.
- **Qué emite cada canal:**
  - Número de canal en la esquina.
  - Nombre del proyecto en grande y una frase.
  - Rótulo que corre abajo con la tecnología.
  - **Una "emisión" propia por tele: un GIF, un vídeo o un componente React**. El componente React permite meter **easter eggs dentro de los canales**.
  - **No se enseña cómo funciona cada app**: el canal presenta el proyecto, no su interfaz.
- **Cómo se pinta (decisión de Claude, revisable):** las teles que no miras llevan su emisión como textura en el 3D (vídeo o GIF, o una versión en movimiento del componente), con cristal curvo, líneas e interferencias. La tele encuadrada lleva encima el componente React real, alineado a su pantalla, para que sea interactivo y los textos sean reales.
- **Contenido editable:** los canales son contenido (como el escritorio), editables desde el admin en el futuro. Añadir un proyecto es añadir un canal.
- **Decisiones de Claude para el constructor (revisables):**
  - **Visitas repetidas (decisión de s7lver):** se repite siempre todo el recorrido, sin recordar nada ni atajos; es parte de la experiencia.
  - **Navegación:** la sala es una escena a pantalla completa y bloqueada, como el ordenador. No se vuelve atrás con el scroll y solo se sale con el botón de apagar.
  - **OK y "código"** abren el proyecto y el repositorio en una pestaña nueva. La sala sigue igual al volver.
  - **Movimiento reducido o fotosensibilidad:** el virus tiene una versión tranquila, con la misma secuencia pero sin destellos, saltos ni cascadas rápidas, y con fundidos en su lugar (WCAG 2.3.1).
  - **Datos:** los canales salen del contenido de proyectos que ya existe (`getContent('projects')`), con campos nuevos compatibles (número de canal y emisión), para que el admin actual siga funcionando. Añadir un proyecto es añadir un canal.
  - **Consola y cables:** los cables se reutilizan de la habitación; para la consola se busca un modelo o, si no aparece, se reutiliza una mesa de la habitación.
- **Idea guardada para un easter egg:** el "rescate" (los proyectos cifrados por un ransomware que hay que descifrar).

### 6.3b Papers: la biblioteca

Ver `2026-10-26-library-papers-design.md`. El apagado de las teles ya no lleva directo a §6.4: lleva a la biblioteca, y de ahí al desenmascaramiento. Orden decidido con s7lver: sala → biblioteca → desenmascaramiento (§6.4) → final con persecución o explosión → cierre (§6.5). La figura de §6.4 es el mismo sujeto de la biblioteca.

### 6.4 Redes sociales: el desenmascaramiento

- En el centro, una **figura negra sin rostro** lleva puesta la máscara oni. **Se la quita** y debajo no hay cara, solo oscuridad, mientras la máscara se ilumina.
- **Las redes sociales a los lados** (izquierda y derecha) de la figura, grandes y con interacción (glitch o katakana al pasar el ratón).
- Estética muy oscura.
- **Necesita un modelo 3D de la figura** (cabeza y hombros) con la animación de quitarse la máscara. Aún no existe: ver §8 y §10.

### 6.5 Cierre / footer

Cierre con la marca S7LVER y lo mínimo (copyright y los créditos de licencias 3D que lo exijan). Su forma queda para el constructor, siguiendo la ley anti-slop (nada de footer estándar de cuatro columnas).

## 7. Método de trabajo (decidido con s7lver)

- **Una escena cada vez**, en el proyecto real (`webpage/`), en la rama `redesign/oni`. El orden es hero → proyectos → redes → cierre, y las transiciones van con la escena que llega.
- **No se pasa a la siguiente escena hasta que s7lver diga que la actual está a la altura.** Cada escena se verifica en un navegador real (escritorio y móvil) antes de enseñársela.
- Las escenas se enseñan con los modelos reales, no con sustitutos hechos con primitivas.
- Claude orquesta: escribe planes, reparte el trabajo y revisa. La implementación puede hacerla un subagente.

## 8. Recursos 3D y licencias

| Recurso | Estado | Notas |
|---|---|---|
| iPhone 18 Pro Max negro y burdeos | En `public/models/` (zips y extraídos) | Sketchfab, autor *extraakash*, **licencia Sketchfab Standard**. El material de pantalla se llama `COLOUR_*_Screen` y se puede sustituir por una textura propia (vídeo, canvas o imagen). |
| iPhone Duo Fold (plegable, animado) | En `public/models/` | Trae la animación `open-close`. Opcional. |
| Máscara oni | **La está haciendo s7lver**, posiblemente con Modly (MCP `modly` registrado en este proyecto) a partir de la hoja de referencia | Cuando llegue con un sujeto o cabeza incluido, **hay que quitar el sujeto y dejar solo la máscara** (`@gltf-transform/cli` está disponible; no hay Blender instalado). |
| Figura sin rostro animada | **No existe** | Necesaria para §6.4. |
| Interfaz de Newpaper | No existe | Pantalla en negro por ahora. |

**Restricción de licencia:** el repositorio `s7lver2/s7lver2` es **público**. Los modelos con licencia Sketchfab Standard pueden usarse en la web, pero **no deben subirse tal cual a un repositorio público** (eso sería redistribuirlos). Los archivos de `public/models/` no se commitean: hay que servirlos desde otro sitio (por ejemplo Vercel Blob) o dejarlos fuera de git con un mecanismo de despliegue. Cómo hacerlo es decisión del constructor, pero la restricción no es negociable.

## 9. Restricciones técnicas

- **Proyecto existente:** Next.js 14.1 (App Router), React 18, TypeScript, Tailwind 3, desplegado en Vercel (plan Hobby).
- **Se permiten dependencias nuevas** para esto. Es lo que exige el nivel y lo que se usó en los prototipos: `three` (o React Three Fiber + drei), `gsap` (ScrollTrigger, SplitText) y `lenis`. La regla de v6 de "sin dependencias nuevas" no aplica a este rediseño.
- **El scroll fijado (pinning) está permitido y es necesario**, pero v6 documenta un fallo real: `body` tiene `overflow-x: hidden` (en `app/globals.css`, línea 19), y combinado con `position: sticky` y `min-height: 100vh` convierte el `body` en su propio contenedor de scroll en algunos motores, y la página parece atascada. Antes de fijar nada, hay que quitar esa causa (por ejemplo, cambiar a `overflow-x: clip`) y verificar el scroll real.
- **Datos:** proyectos y redes se siguen leyendo de la fuente actual (`getContent('projects' | 'socials')` en `app/lib/content.ts`, Upstash Redis con respaldo en `data/*.json`), para que el admin actual siga funcionando hasta su rediseño. Los campos que falten para el nuevo diseño (por ejemplo, la textura o el vídeo de la pantalla del móvil) se pueden añadir de forma compatible.
- **Rendimiento:** objetivo de 60 fps en un portátil normal. Hay que cargar el 3D de forma progresiva, pausar lo que no se ve y comprimir modelos y texturas (meshopt, Draco, KTX2 o WebP, a elección del constructor).
- **Móvil:** la web tiene que funcionar y verse bien en un teléfono. Se puede simplificar el 3D, pero no quitar los proyectos ni las redes.
- **`prefers-reduced-motion`:** versión estática bonita, con todo el contenido visible.
- **Accesibilidad mínima:** el texto real (nombre, proyectos, redes) existe en el DOM y se puede leer y navegar con teclado aunque el 3D no cargue.
- **Scripts externos:** si se cargan desde un CDN, con SRI. Mejor instalarlos con npm.
- La ley anti-slop de `webpage/.claude/CLAUDE.md` aplica completa, salvo donde s7lver ha decidido otra cosa (fondo oscuro, rojo de acento, máscara, etc.).

## 10. Abierto / pendiente de s7lver

- Qué proyectos son canales, en qué orden, y la emisión de cada uno (GIF, vídeo o componente React). Mientras tanto, canales de relleno evidentes.
- La grabación de la risa del virus (libre y que se pueda usar en la web).
- Los modelos de la sala de vigilancia **ya están** en `public/models/surveilance_room/` (zips; extraídos en `src/`, fuera de git):
  - Cinco teles distintas, que se mezclan en el muro para que no parezca copiado:
    - `TV` de carlin.chu, CC-BY.
    - `CRT TV` de Timothy Ahene, Sketchfab Standard: no se commitea.
    - `Old analog TV with antenas` de senorp3dro, CC-BY, 54k triángulos: para pocas copias o simplificada.
    - `Old TV` de tinderboxh, CC-BY.
    - `TV, Old TV, Retro TV` de fan7774, CC-BY-NC.
  - El mando: `Simple TV Remote` de Blender3D, CC-BY.
  - La cámara de seguridad: `Security Camera` de Bryan, CC-BY.
  - **Faltan la consola y los cables.** Los cables pueden reutilizar los de la habitación.
  - Todos los CC-BY van en los créditos.
- Los textos reales del escritorio (de momento, relleno).
- El modelo de la máscara (lo está haciendo s7lver).
- El modelo de la figura sin rostro y su animación. Hay dos caminos, a decidir cuando lleguemos a §6.4: vídeo prerenderizado (máxima calidad, sin interacción) o modelo animado en tiempo real (interactivo).
- Las URLs reales de las redes (las de `DEFAULT_SOCIALS` son en parte de relleno).

## 11. Decisiones de Claude (revisables)

- La portada sigue leyendo los datos del admin actual, para no romperlo antes de su rediseño.
- Tipografía display: con carácter y fuera de la estantería de Google; por ejemplo Tanker de Fontshare, que se usó en los prototipos, autoalojada con `next/font/local`. La elección final de la fuente es del constructor, y s7lver la valida en la primera escena.
- Rojo de acento alrededor de `oklch(0.62 0.245 27)`. Negro de base cálido y neutro, no el gris azulado de siempre.
- Orden del trabajo: hero primero, porque fija el lenguaje visual de todo lo demás.
- **El hero se construye para la máscara, no para el iPhone.** La máscara ya está en producción con Modly, así que la coreografía del hero se diseña para ella. Si hace falta enseñar algo antes, el iPhone sirve solo como sustituto temporal y su coreografía no se aprueba como definitiva.
- **La máscara de Modly será probablemente una sola malla con una sola textura.** Por eso los efectos del hero (escaneo, disolución, glitch, transformación) se plantean con shaders sobre una malla, sin depender de piezas separadas. El brillo de ojos y kanji se consigue con un mapa emisivo derivado de la textura (zonas rojas) o con planos emisivos añadidos. Si la máscara llega separada en piezas, se aprovecha.
- **"Interfaz real" en la pantalla del móvil significa imagen o vídeo** (capturas o grabación de pantalla de la app) como textura. Una interfaz interactiva en vivo dentro del 3D queda fuera.
- **Elegir los 3 destacados:** se añade al contenido de proyectos un orden o marca de destacado y un campo para la imagen o vídeo de pantalla, de forma compatible, y Newpaper se añade a los datos. El admin actual no se modifica en este proyecto: esos campos se editan en los datos (Redis/JSON) hasta el rediseño del admin. Mientras s7lver no nombre los proyectos 2 y 3, se muestran huecos de relleno evidentes, no proyectos existentes elegidos al azar.

## 12. Lo que queda para el constructor

Coreografía exacta de cada escena, arquitectura de componentes, cómo integrar el 3D en Next (un canvas global o uno por escena), el pipeline de compresión de modelos, el mecanismo para servir los modelos fuera del repositorio público, la estructura de rutas de `/projects` mientras no se diseñe, y los detalles de la escena de cierre.
