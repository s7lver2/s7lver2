# Clips de Mixamo para la biblioteca

Lo que hoy hace a mano el código y quedaría mejor con un clip de verdad. **Nada de esto es
necesario para que la escena funcione:** todo tiene ya una versión procedural. Es una mejora para
cuando haya tiempo.

**Descargar cada clip con estos ajustes:**
- personaje: el de `public/models/library/bot.glb`, subido a Mixamo, o el mismo esqueleto `mixamorig`;
- **Without Skin**;
- **FPS 30**;
- **Format FBX Binary**.

**Cómo usar la lista:**
- Los nombres son **los que hay que buscar** en el buscador de Mixamo. Elige el resultado que más se
  parezca a la descripción y apunta su nombre exacto al pasármelo, porque Mixamo tiene varias
  variantes de casi todo.
- Para añadirlos al modelo, pásamelos y los meto en `bot.glb` con `tools/models/build.mjs`.

Las poses del ritual **no van aquí**: se hacen a mano, como decidiste.

## Lista

| # | Buscar en Mixamo | In Place | Momento en que se usa | Qué sustituye |
|---|---|---|---|---|
| 1 | `Throw` (un lanzamiento corto de muñeca, de pie, sin paso adelante) | Sí (no se desplaza) | Saca la carta y la lanza a la cámara | El preparo y el latigazo hechos a mano de `Subject.drawAndThrow` (el brazo derecho). La carta seguiría pegada a la mano y el momento de soltarla se ajusta al fotograma del clip |
| 2 | `Pulling` / `Grab` (sacar algo de un estante a la altura del pecho, con un tirón) | Sí | El frenesí: saca un libro, lo tira y busca otro | El IK que lleva la mano al libro (`reachTo(..., true)`) sobre `searching-files-high`. El IK seguiría corrigiendo el último tramo hasta el libro exacto |
| 3 | `Look Up` o `Surprised` (levantar la cabeza de golpe hacia arriba) | Sí | Cuando se da cuenta de que la cámara le graba, antes de girarse | El giro de cabeza y torso hecho con `lookAt` sobre `nervously-look-around` |
| 4 | `Walk To Stop` (caminar y frenar, quedando de pie) | **No** (la raíz avanza, el código la sigue) | Llega a la luz de la sala de lectura y se para de frente antes de que el tiempo se pare | El corte de `walking` a la pose congelada. Ahora se congela en mitad de un paso |
| 5 | `Kneeling` o `Kneel Down` (de pie a arrodillado sobre la rodilla derecha) | Sí | **Ritual, opcional:** la quinta sombra se arrodilla en el centro | La pose `kneel` hecha a mano (Task 2 del plan del ritual). Solo si la pose a mano no convence |

## Los 10 clips que ya hay (`bot.glb`)

`idle`, `searching-files-high`, `reaching-out`, `taking-item`, `picking-up-object`,
`looking-behind`, `left-turn`, `nervously-look-around`, `rummaging` y `walking`.

Siguen sirviendo; los de arriba se suman a ellos, no los sustituyen.
