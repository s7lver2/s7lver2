# El ritual: silencio, estatuas y pentagrama: diseño

Escena siguiente a la biblioteca. **Sustituye a §6.4 (el desenmascaramiento)** de
`2026-10-25-portfolio-oni-redesign-design.md`: las redes sociales viven aquí, y el
desenmascaramiento pasa a ser la máscara que cae al final. Detrás viene la escena de créditos
(aún sin diseñar). Rama `redesign/oni`, código nuevo en `webpage/app/oni/ritual/`.

Storyboard de referencia (boceto 2D, solo el orden de las cosas):
`.superpowers/brainstorm/860-1793285489/content/storyboard.html`.

## Por qué

Es la escena de las redes sociales, pero s7lver no la quiere como una lista de enlaces: quiere un
momento de "wow" que cierre el arco de la máscara. La sombra que ha atravesado la web nos manda
callar, nos enseña sus redes desde cuatro estatuas de sí misma y se arrodilla en un pentagrama
que se activa; la máscara cae y la web pasa a los créditos.

## Lo que pasa, en orden (decidido con s7lver)

1. **Silencio.** Cuando el sujeto desaparece al final de la biblioteca, todo se vuelve negro. La
   sombra aparece en primer plano y hace el gesto de silencio: el dedo delante de la máscara.
2. **Las cuatro estatuas.** Cuatro copias de la sombra, en 3D, quietas como estatuas y puestas
   en círculo. Cada una con su pose:
   1. tocándose la máscara a la altura de la nariz, colocándosela (como quien se sube las gafas);
   2. de brazos cruzados;
   3. pensando;
   4. señalando a alguien.

   Cada estatua tiene **dos hologramas** a los lados (ver "Los hologramas").
3. **La cámara gira alrededor del círculo, desde fuera y mirando hacia dentro**, y se para en
   cada estatua. Se mueve **con el scroll**, pero **no a velocidad lineal**: en cada estatua se
   queda quieta (con un leve empuje) durante un tramo de scroll, y el paso a la siguiente es un
   giro rápido con entrada y salida fuertes, casi un salto, para conservar el efecto. Hacia atrás
   se recorre igual. Si el scroll se para a mitad de un giro, se asienta en la estatua más
   cercana: nunca se queda entre dos.
4. **Vista superior** tras la última estatua: las cuatro y, en el suelo, el pentagrama apagado.
5. **Una quinta sombra camina hacia el centro.** Primero en vista superior; luego la cámara va a
   su lado mientras camina; se **arrodilla en el centro**; y la cámara vuelve a la vista superior.
6. **El pentagrama se activa.** Es un pentagrama satánico (estrella de cinco puntas invertida
   dentro de un doble círculo) en versión **cyberpunk y con la estética de la web**.
7. **La máscara cae al suelo** (la de la sombra arrodillada, se le desprende de la cara), y
   **justo en ese momento** entra la transición a la escena siguiente (los créditos).

**El scroll manda hasta la vista superior** (silencio y giro por las estatuas, en los dos
sentidos). **El final (5–7) se reproduce como una pieza**, sin scroll: al llegar a la vista
superior arranca y llega hasta la máscara en el suelo. (s7lver respondió "yes" a "¿como una
pieza, o con el scroll?"; leído como lo primero.)

## Los hologramas (decidido con s7lver)

- En 3D, **surgen del oni**: son hologramas de la máscara oni.
- **Animación en bucle que va cambiando entre el oni y el icono de la red social** asignada.
- **Con el ratón encima: solo el icono de la red**, con efecto holográfico y del oni.
- **Clic: abre la red en una pestaña nueva.** En móvil, donde no hay hover: **el primer toque
  lo fija en el icono y el segundo lo abre.**
- **Las redes se configuran desde el panel de control:** se leen de `getContent('socials')`
  (`SocialC`: `k`, `v`, `color`, `url`, `initials`), hoy seis. Se reparten **en el orden del
  panel, dos por estatua**. Un hueco sin red es **solo un holograma del oni**: así las cuatro
  estatuas siempre están completas. (Con más de ocho redes, ver "Decisiones mías".)
- **Redes sin enlace todavía** (`url` vacía o `'#'`, hoy Discord, TikTok, Instagram y HTB):
  s7lver lo deja para el panel. Se muestran igual (oni ↔ icono, hover), pero el clic no hace
  nada y en el DOM salen como texto, no como enlace. En cuanto el panel tenga la URL, funcionan
  sin tocar código.

## Poses y animación (decidido con s7lver)

- **Todas las poses a mano**, sobre el esqueleto del sujeto de la biblioteca
  (`public/models/library/bot.glb`, huesos `mixamorig*`, cargado en `library/subject.ts`): el
  gesto de silencio, las cuatro estatuas y el arrodillarse. **No se descargan clips nuevos.**
- El caminar de la quinta sombra usa el clip `walking` que ya trae `bot.glb`.
- Las estatuas y la quinta sombra son el mismo personaje: silueta negra (`subjectMaterial`) y la
  máscara oni (`public/models/oni-mask.glb`).

## Objetivos

1. Las redes se ven, se entienden y se pueden abrir, también en móvil y con teclado.
2. Hasta la vista superior, el recorrido se maneja con el scroll, en los dos sentidos, sin
   quedarse a medias; el final corre solo.
3. El cierre (arrodillarse, pentagrama, máscara que cae) se siente como el final de la máscara,
   no como otro efecto más.

## No objetivos

- La escena de créditos: se diseñará aparte. Aquí basta con entregar el paso a ella (hoy, el
  hueco `.oni-next` de `OniHome.tsx`).
- Cambiar el panel de control o el formato de `SocialC`.
- Animaciones de Mixamo nuevas.

## Anti-objetivos (fracaso aunque funcione)

- Una fila de iconos con brillo: los hologramas tienen que ser objetos 3D de la escena.
- Logos inventados o iconos genéricos de un pack: van **las marcas reales** de cada red.
- El pentagrama como filtro rojo a pantalla completa o con halo de brillo (la ley anti-slop y el
  rayo de la biblioteca ya enseñaron eso). La luz entra por las líneas.
- La cámara a velocidad constante pegada al scroll: es justo lo que s7lver no quiere.
- Poses rígidas de maniquí: tienen que leerse como gestos con intención.
- Una red con enlace que en algún momento no se puede abrir (el enlace existe en el DOM aunque
  el 3D falle).

## Restricciones

- Las de §9 de la spec del rediseño: three.js r160, 60 fps en un portátil normal, móvil
  funcional, `prefers-reduced-motion` con una versión estática bonita, el texto real de las redes
  en el DOM y navegable con teclado aunque el 3D no cargue.
- Sin dependencias nuevas. Sin tests automáticos (convenciones del proyecto).
- Textos de interfaz en inglés; comentarios del código en español.
- Atajos de desarrollo solo con `NODE_ENV === 'development'` (como `?library&from=…`).
- La ley anti-slop de `webpage/.claude/CLAUDE.md`.

## Lo que queda para quien lo construya

- Cómo se engancha a la biblioteca: lo natural es lo que ya hace la biblioteca (toma la pantalla
  en un portal, reutiliza el renderer de la sala, captura la rueda y el dedo, y al acabar llama a
  `onDone`).
- La geometría y el material de los hologramas, el morph oni ↔ icono y cómo se consiguen los
  logos reales en 3D (SVG de la marca extruido o en un plano, por ejemplo).
- El diseño exacto del pentagrama cyberpunk y su encendido, dentro de lo de arriba.
- Duraciones, curvas y cuánto scroll vale cada tramo.
- El sonido (hay `libraryAudio.ts` y `roomAudio.ts` de referencia).

## Decisiones mías (Claude), no de s7lver

- **Las estatuas en cuatro de las cinco puntas de la estrella**, no en un círculo cualquiera: así
  la quinta sombra entra por la punta libre y al arrodillarse "completa" el pentagrama.
- **Estatuas mirando hacia fuera**, para que la cámara, que gira por fuera, las vea de frente.
- **Encendido del pentagrama:** las líneas son pistas de circuito grabadas en el suelo; con el
  encendido corre por ellas una corriente roja (el rojo de los ojos del oni) del centro a las
  puntas. Entre los dos círculos, glifos medio corruptos en lugar de los símbolos clásicos.
- **Hologramas:** la máscara oni hecha de luz roja (líneas de escaneo, parpadeo leve). El cambio
  oni ↔ icono se hace rompiéndose en líneas y recomponiéndose, no con un fundido.
- **Qué viene detrás:** los créditos, como dijo s7lver. El "final con persecución o explosión"
  del orden antiguo queda fuera. El hueco `.oni-next` se etiqueta como lo que será (créditos).
  La entrada es de un solo sentido, como la biblioteca: no se vuelve a ella con scroll hacia arriba.
- **Hologramas clicables solo cuando la cámara está parada en su estatua** (los otros se ven pero
  no responden). Con teclado, siempre, por la lista del DOM.
- **Más de ocho redes:** se muestran las ocho primeras en 3D y todas siguen en el DOM accesible.
- **Movimiento reducido:** sin giros ni caminata; cortes entre planos fijos (estatua a estatua y
  vista superior), el pentagrama ya encendido y la máscara en el suelo como plano final.
- El gesto del sujeto en la estatua 1 ("tocándose la máscara con la nariz") lo he leído como
  colocársela con dos dedos en el puente de la nariz; s7lver no lo ha corregido.
