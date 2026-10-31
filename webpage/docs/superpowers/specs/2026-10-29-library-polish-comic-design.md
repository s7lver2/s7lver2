# Biblioteca: acabado, carta joker y toque cómic — diseño

Continúa `2026-10-26-library-papers-design.md` (la escena ya existe y funciona de punta a punta).
Rama `redesign/oni`, código en `webpage/app/oni/library/` y `webpage/app/oni/room/`.

## Por qué

s7lver ve la biblioteca entera y "se siente inacabada". Lo que le saca de la escena, todo
confirmado por él sobre capturas reales:

- **Animaciones:** clips de Mixamo pegados, sin intención ni peso, y **mal encadenados**: saltos
  de pose y cambios de ritmo entre gesto y gesto que rompen la experiencia.
- **Luz:** plana y oscura, sin un foco que mande.
- **Personaje:** negro lacado que se funde con el fondo; la máscara apenas destaca.
- **Decorado:** vacío y repetido (estanterías clonadas, nada vivo).
- **Cámara:** planos fijos y cortes bruscos.
- **Cada momento:**
  1. La grabación se siente vacía; él es una mancha de pocos píxeles.
  2. La carta casi no se ve llegar, y la estática y la grieta tapan el golpe.
  3. El plano de dentro es confuso: la silueta de la cámara ocupa media pantalla, y no se ven
     ni la carta ni él.
  4. Las hojas en vuelo se leen como rectángulos blancos.
  5. En el tiempo parado se le ve de espaldas: la máscara no aparece. Hay losas blancas raras en
     el suelo y media pantalla vacía.
  6. El rayo tiñe todo de rojo como un filtro, y después no hay cierre.
- **La carta:** el diseño actual (as de picas / 鬼) no es suyo.

## Objetivos

1. **Toque cómic, en dosis pequeñas (estilo Spider-Verse, "dosis 2").** Solo cuando la máscara
   hace acto de presencia; el resto de la web sigue siendo 3D normal. La dosis 2, aprobada sobre
   maqueta (`.superpowers/brainstorm/…/content/estilo-a-dosis.html`), lleva:
   - la máscara (o quien la lleva) **a saltos, a 12 fps**, mientras el resto de la imagen sigue
     fluida;
   - un contorno fino de tinta;
   - una trama de puntos solo en las sombras;
   - un descuadre de color de 1–1,5 px.

   Nada de rayos de fondo ni tinte fuerte; nunca a pantalla completa ni permanente.

   **Dentro de la grabación (decisión de s7lver):** el cómic y el filtro de cámara de seguridad
   **se fusionan un poco**. Sobre él, el grano y las líneas siguen ahí pero ceden algo, y la
   trama, el contorno y el descuadre asoman a través. No es un parche limpio que tapa la
   grabación ni algo enterrado bajo el grano: se mezclan.

   Momentos en la biblioteca:
   - cuando se gira hacia la cámara y lanza la carta;
   - el tiempo parado entero.

   En el resto de la web, allí donde la máscara se impone (la entrada de la máscara en el hero,
   y en el futuro el desenmascaramiento §6.4).
2. **La carta: un joker de dos caras** (aprobado: `carta-joker.html`, opción 3).
   - **Cara:** partida en diagonal.
     - Arriba, papel claro con la máscara en tinta negra (ojos rojos).
     - Abajo, negro con la máscara en trama roja, reflejada como figura de naipe.
     - "JOKER" en vertical en las dos esquinas.
     - La máscara de abajo no debe quedar cortada por la diagonal (en la maqueta lo está).
   - **Dorso:** negro con máscaras pequeñas en trama roja y un marco rojo.
   - La máscara de la carta sale del modelo real `oni-mask.glb` con el mismo tratamiento cómic,
     no de un dibujo aparte.
3. **El lanzamiento:**
   - **Gesto:** de tahúr, rápido y seco. Se gira, mira a la cámara y saca la carta entre dos
     dedos. Ahí entra el cómic.
   - **Vuelo:** la lanza **con efecto**: la carta gira sobre sí misma y hace una curva visible.
   - **Llegada:** el tiempo se estira un instante para que se lea el joker antes del golpe.
   - **Impacto:** la estática ya no tapa el golpe de inmediato.
   - **Después:** en el plano siguiente la carta clavada y legible, sin la silueta de la cámara
     tapando el plano.
4. **Encadenado de animaciones sin cortes.** Ninguna transición visible:
   - sin saltos de pose;
   - sin pies que patinan;
   - sin cambios de orientación de golpe (hoy `turnLeft` termina con un fundido 0);
   - sin parones de ritmo entre gestos.

   Va antes que los clips nuevos y vale también para los que lleguen.
5. **Luz y atmósfera:**
   - un foco que mande en cada plano;
   - haces de luna con polvo en suspensión;
   - más contraste;
   - el personaje recortado del fondo (un perfil de luz que separe su negro).
6. **Decorado con vida.** Romper la repetición de estanterías y meter desorden y detalle:
   - libros fuera de sitio y pilas;
   - polvo, alguna lámpara que parpadea;
   - algo que se mueva en segundo plano.
7. **Cámara de cine.** Planos que respiran y acompañan la acción, con transiciones con ritmo en
   vez de cortes secos. La grabación deja de ser un plano muerto: pasa algo además de él.
8. **Cada momento, arreglado:**
   - el tiempo parado **de frente**, con la máscara y el cómic, sin losas blancas ni media
     pantalla vacía;
   - las hojas en vuelo se leen como papel;
   - el rayo deja de ser un tinte rojo global y el final tiene cierre;
   - de paso, los avisos pendientes de la revisión anterior:
     - las hojas se recolocan si cambia el tamaño o la orientación de la pantalla;
     - las hojas del suelo se pueden pulsar, o no se ponen ahí;
     - un solo golpe de trackpad no llena el indicador.

## No-objetivos

- Clips de Mixamo nuevos: s7lver los descargará después, con una lista que se le pasará. Ahora se
  trabaja con los 10 clips de `public/models/library/bot.glb`, y todo lo demás no los espera.
- Cambiar la historia de la escena, el flujo sala → biblioteca → papers → salida, o el contenido
  de los papers.
- El estilo cómic en escenas sin la máscara (la sala, el PC, el scroll de la home).

## Anti-objetivos (fracaso aunque funcione)

- Que el cómic se note siempre o a tope: rayos, tinte, trama en toda la pantalla.
- Volver a congelar el navegador en las transiciones. El arreglo del 29-10 (shaders compilados
  una vez, con las luces fijas desde la carga) se mantiene: nada de luces nuevas a mitad de
  escena, y nada que recompile a mitad de un momento.
- Más oscuridad como sustituto de atmósfera.
- Slop: todo pasa la ley anti-slop de `webpage/.claude/CLAUDE.md`.

## Restricciones

- three.js r160, Next 14, sin dependencias nuevas.
- Sin tests automáticos (convención del proyecto); se verifica en el navegador, momento a momento.
- Revisión **por etapas** (decisión de s7lver), cada una enseñable en el navegador y aprobada
  antes de pasar a la siguiente:
  1. el encadenado de animaciones y la luz;
  2. el cómic y la carta (diseño y lanzamiento);
  3. la cámara, el decorado y cada momento.

  Un solo commit cuando s7lver apruebe la última.
- `prefers-reduced-motion`: sin destellos, sin animación a saltos y sin cámara en movimiento
  brusco.
- Móvil: tiene que verse y poder usarse en 375×812.
- Rendimiento: ninguna tarea larga de más de unos 300 ms en la secuencia (medido como el 29-10).

## Lo que queda para quien lo construya

- Cómo se implementa el cómic (pasada de postproceso con máscara de objeto, materiales propios,
  capa aparte…), siempre que cumpla la dosis 2 y salga solo en sus momentos.
- La planificación nueva de planos y tiempos de cada momento.
- Qué gestos se sacan de los 10 clips actuales con capas por código (mirada, manos, respiración,
  peso), y la técnica de encadenado.
- Cómo se resuelve la atmósfera (volumétrica falsa con planos, partículas, niebla…).
- La lista de clips de Mixamo que se le pedirá a s7lver: se entrega al final, con nombre exacto
  y para qué momento es cada uno.

## Decisiones mías (Claude), no de s7lver

- En el hero, el cómic va en la entrada de la máscara. s7lver dijo "cuando la máscara haga su
  presencia"; los momentos exactos del hero los propongo yo.
- La carta clavada ya no se ve desde detrás de la cámara: el plano de dentro se rehace. Desde
  dentro se lee la **cara del joker**: el giro del vuelo se coreografía para que llegue así.
- Decorado: vale reutilizar cualquier pieza del paquete de la biblioteca que ya está en el repo
  (`environment_-_library.zip`, ya acreditado) y todo lo procedural que haga falta. No se bajan
  modelos nuevos de fuera sin preguntar. Todo material nuevo se compila en la carga.
- Nada vivo nuevo en la escena (ni gatos ni segundas figuras): la vida de la grabación y del
  fondo sale del entorno (polvo, cortinas, lámparas que parpadean, un libro que cae…).
- El cierre: el rayo se queda, pero deja de ser un tinte rojo global (luz y rayo con forma, que
  iluminan de verdad). Tras desaparecer él, un plano corto de cierre antes de salir: la carta
  joker cae de la lente al suelo, boca arriba.
