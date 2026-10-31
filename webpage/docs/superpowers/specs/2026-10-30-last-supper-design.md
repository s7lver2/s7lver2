# La Última Cena — diseño

La escena final del portfolio oni (rama `redesign/oni`), después de los créditos bajo el agua
(`docs/superpowers/specs/2026-10-30-credits-design.md`). Hace a la vez de **sección de contacto** y de
**vitrina de logros**. Debajo, el footer.

Los easter eggs (Backrooms, VRChat, c0rr#pt / The Search, Minecraft y Nether, Gemini, WhatsApp) **no** entran
aquí: son proyectos aparte que vendrán después. Este diseño monta el marco en el que se enchufarán.

## Intención

Cerrar la web con una broma seria: el cuadro de Leonardo, pero con los robots enmascarados de la web. Los
doce «apóstoles» se pegan entre ellos, incluso a tiros, y el del centro, impasible, te mira. Encima, en la
pared, los logros: lo que el visitante ha encontrado y lo que le queda. En la mesa, el email: «contact me... if u dare».

## Referencia (del usuario)

El tráiler «Sparkle — Monodrama» de Honkai: Star Rail, de 1:45 a 1:56 (youtu.be/RC6wQ-75uQU?t=105). Lo que se
toma de ahí:
- **Todos sentados**, apretados a lo largo de una mesa larga; el del centro, en una silla de respaldo alto,
  recto y quieto.
- **Cámara baja, a la altura de la mesa**, frontal y simétrica. Arranca en primer plano del centro y se aleja
  despacio; en el plano final los de los extremos se salen del encuadre (no se ve la mesa entera de lejos).
- **El caos a cámara lenta:** unos tirados sobre la mesa, otros de pie en la silla, y cosas suspendidas en el
  aire girando despacio (ollas, platos, copas, una silla).
- **La mesa llena de comida en primer plano**: un asado delante del centro, bandejas, campanas, copas, velas.
- **Detrás**, pared de paneles oscuros con **abanicos de luz** art déco detrás de las figuras (aquí, en rojo).

## Lo que pasa

1. **Llegada.** Al seguir haciendo scroll después de los créditos, la mesa **simplemente aparece**: un corte,
   sin transición. La cámara arranca pegada a la mesa y hace **zoom out** hasta el encuadre del cuadro.
   - *Decisión de Claude:* el plano final copia el de Leonardo: frontal, simétrico, la mesa cruzando la
     pantalla y el del centro en el punto de fuga.
2. **Los apóstoles.** Doce robots, **todos con la máscara oni**, la misma familia que el sujeto de la
   biblioteca y el del ritual (`public/models/library/bot.glb` + máscara, animaciones Mixamo). Se están
   **peleando entre ellos, algunos con pistolas**.
   - **Todos son el mismo robot.** El usuario descarga **muchas animaciones de Mixamo** y Claude se queda con
     las que sirvan. También manda **modelos de armas, de la mesa y de comida**.
   - **Se pelean usando el entorno:** p. ej. uno agarra a otro y lo estampa contra la mesa, la comida y la
     vajilla salen volando, alguno se cubre detrás de la mesa. Las armas van en la mano (pegadas al hueso).
   - *Decisión de Claude:* mientras no lleguen los modelos, se usan el bot y los clips que ya hay solo para
     construir; no se da por terminada la escena con el relleno.
   - *Decisión de Claude:* en bucle, animados. Se mantienen los grupos de tres del cuadro para que se siga
     reconociendo la composición.
3. **El del centro.** También robot con máscara. Quieto en medio del caos: **codos en la mesa, manos en la
   barbilla, mirándote fijamente**.
   - *Decisión de Claude:* la cabeza sigue un poco al puntero.
   - *Decisión de Claude:* si entre los clips de Mixamo hay uno que valga, se usa; si no, se posa a mano
     (como `app/oni/ritual/poses.ts`), bien hecho, no de relleno.
4. **Los logros, de fondo.** En la pared del fondo, **marcos brillantes en el estilo rojo holográfico** de la
   web (la familia de los estandartes del ritual y las fichas de los créditos).
   - *Decisión de Claude:* bloqueados, apagados y con «???» en lugar del nombre, para no destripar nada;
     conseguidos, encendidos con su nombre. Van donde el cuadro tiene las ventanas y los tapices.
5. **El contacto.** Sobre la mesa aparece el email **nickespro130@outlook.es** (el de la web anterior) con el
   texto **«contact me... if u dare»**.
   - *Decisión de Claude:* es texto real (seleccionable, accesible), no solo pintado en 3D; un clic abre el
     correo (`mailto:`).
6. **Footer.** Debajo de la escena, unos pocos enlaces: **`/galery`** y **`/credits`**.
   - `/credits` todavía no existe (aparcada). El enlace va igual.

## Logros

- **El primer día solo hay uno conseguible:** **llegar al final de la web**, que se da al aparecer la mesa.
  *Decisión de Claude:* se llama «The Last Supper», con «You made it to the end.».
- Los marcos de los easter eggs futuros están ya en la pared, bloqueados: Backrooms, VRChat, LUCY, SILVER,
  Minecraft, Nether, Gemini, WhatsApp. Nueve marcos en total.
- Cualquier parte de la web puede dar un logro con una sola llamada (p. ej. `unlock('backrooms')`). Es lo
  único que tendrá que hacer cada easter egg cuando exista.
- Se recuerdan en el navegador del visitante (`localStorage`). Sin cuentas ni servidor.
- Dar un logro que ya se tiene no hace nada (ni aviso).
- *Decisión de Claude:* el sistema y el popup viven en `OniHome` (la página de inicio), que es donde están
  el ordenador y sus apps, de donde saldrán los easter eggs. Otras rutas no dan logros.

## El aviso de logro

Un **popup en la esquina inferior** con la **estética de ONI//OS**, el ordenador de la fase 2: bloques de
fósforo, píxeles tramados, ventana de los 90 (`app/oni/pc/`).

- *Decisión de Claude:* sale en cualquier fase de la web en la que se consiga el logro, con un pitido del
  ordenador, y se va solo a los pocos segundos.

## Restricciones

- Next 14, three.js r160, gsap. **Sin dependencias nuevas.**
- Firefox: compilar con `compileGently` y sombras con `shadowType` (`app/oni/compile.ts`, `quality.ts`),
  como el resto de escenas; nada de cuelgues.
- Reutilizar el renderer y el lienzo que pasa la escena anterior, como hacen ritual → créditos.
- Textos de la interfaz en inglés; comentarios del código en español.
- `prefers-reduced-motion`: sin zoom out ni peleas en bucle; el plano final quieto.
- *Decisión de Claude:* en móvil y en la calidad baja del gobernador, los apóstoles se congelan en una pose
  y casi no proyectan sombras; el del centro sigue mirando.
- Ley anti-slop de `webpage/.claude/CLAUDE.md`. Sin tests automáticos.

## Lo que queda al constructor

- Cómo se desbloquea el scroll después de los créditos y cómo se monta la escena debajo.
- La coreografía de la pelea con los clips que haya, el encuadre exacto, la luz y la mesa.
- El dibujo del popup dentro del lenguaje de ONI//OS y el sonido.
- El diseño del footer dentro del mundo de la escena.
