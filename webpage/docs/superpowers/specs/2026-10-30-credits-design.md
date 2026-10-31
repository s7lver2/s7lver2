# Créditos bajo el agua — diseño

La última escena del portfolio oni (rama `redesign/oni`), después del ritual
(`docs/superpowers/specs/2026-10-29-ritual-design.md`). Sustituye al hueco
`.oni-next` («NEXT SCENE / CREDITS») de `app/oni/OniHome.tsx` y al corte a negro
con el que acaba hoy `RitualScene.finale()`.

## Intención

Que el final se sienta como **los créditos de una película**: la máscara oni, que
se ha soltado en el ritual, cae al agua y se hunde, y mientras baja pasan los
créditos. Solo dos: el autor (s7lver) y Claude, el que ha hecho la web con él.
Los créditos son **hologramas rojos que fallan por el agua**, la misma familia que
los estandartes del ritual.

## Lo que pasa, en orden

1. **La caída (cambia el final del ritual).** La máscara se suelta como ahora
   (cae de lado, a cámara lenta, acaba ladeada). La cámara ya no se queda en el
   plano bajo fijo: **sigue la máscara mirándola** mientras cae.
2. **El golpe → bajo el agua.** En el primer contacto con el suelo, en vez del
   negro de ahora, **corte a la cámara sumergida** en un agua **muy oscura**, casi
   negra. La máscara se ve **distorsionada por el agua**, medio flotando, quieta y
   respirando con el agua. Se queda así **hasta que el visitante hace scroll**.
   - *Decisión de Claude:* el corte es un fallo de imagen de un par de
     fotogramas, a juego con los cortes secos del final del ritual.
3. **El scroll hunde la máscara.** Con el scroll, la máscara **va bajando**,
   hundiéndose. Mientras baja **aparecen los créditos**, uno detrás del otro, como
   en una película.
4. **Los dos hologramas** (estilo «ficha del reparto», el B de los bocetos): foto
   en holograma de líneas (como los estandartes) a un lado y, al otro, el rol
   pequeño, el nombre grande y debajo las líneas de estado. Fallan con el agua:
   distorsión, cortes, bandas.
   - **s7lver:** foto de perfil de Discord y **todo lo que da Lanyard, en
     directo**: conectado / ausente / no molestar / desconectado, el estado
     personalizado, la actividad (juego o programa) y lo que suena en Spotify.
   - **Claude:** la misma ficha. Como no tiene Discord, *decisión de Claude*: en
     vez de foto, una marca propia dibujada en holograma (no el logo de
     Anthropic); su nombre y su papel en la web; y en las líneas de estado, datos
     reales en vez de Discord (el modelo, cosas hechas en el proyecto). El texto
     exacto lo escribe Claude.
5. **El final.** Cuando la máscara toca fondo y han pasado los dos créditos,
   **todo se oscurece**. La web acaba ahí, por ahora: sin enlaces ni «volver
   arriba».

### Cómo se mueve el scroll (decisiones de Claude)

- El agua **no es el suelo del ritual**: el suelo sigue siendo el pentagrama, y
  el golpe es un **corte** a un espacio bajo el agua aparte (es lo que se pidió:
  «al tocar el suelo, la cámara pasa a estar sumergida»). El ritual no cambia
  salvo la cámara de la caída y el corte final.
- Los créditos siguen en el **mismo lienzo y renderer**, como continuación del
  ritual (sin negro entre los dos), con el scroll capturado como en el ritual.
- Dentro de los créditos el scroll **es reversible**: hacia arriba la máscara
  vuelve a subir y los créditos retroceden, hasta la máscara medio flotando del
  principio. **No se vuelve al ritual** (ya ha acabado). Tras el oscurecimiento
  no hay nada más.

## Requisitos y límites

- **Solo los dos créditos** en pantalla: nada de tipografías, librerías ni
  modelos en la secuencia (ver la pregunta abierta sobre CC-BY).
- **Lanyard ya está en la web:** `settings.discordId` (admin → socials) y
  `app/api/avatar/[network]/route.ts` (avatar vía `api.lanyard.rest`). Requiere que
  el usuario esté en el servidor de Lanyard.
- **Sin Lanyard** (falla, no está en su servidor, sin red): la ficha sale igual
  con la foto y el nombre que ya tiene la web, sin las líneas en directo. Nunca
  se queda vacía ni rota. *Decisión de Claude.*
- **Movimiento reducido:** sin la cámara siguiendo la caída; corte directo al
  agua; la máscara y los créditos sin oscilar; el scroll sigue avanzando la
  escena. *Decisión de Claude.*
- **Sin WebGL:** los créditos como texto real legible (como `.ritual-socials`).
- **Accesible:** el contenido de los créditos existe como texto para lectores
  de pantalla, aunque en pantalla sea un holograma.
- Las reglas del proyecto: sin dependencias nuevas, sin tests automáticos,
  three.js r160 en el mismo renderer y lienzo que pasa el ritual (sin negro entre
  escenas), texto de la interfaz en inglés y comentarios en español, la ley
  anti-slop de `webpage/.claude/CLAUDE.md`, y atajos de desarrollo solo con
  `NODE_ENV === 'development'`.
- El rótulo común (`app/oni/Osd.tsx`) existe en las escenas anteriores; en los
  créditos *decisión de Claude*: sin rótulo, que mande la película.

## Fuera de alcance

- Lo que viene después del oscurecimiento (por ahora la web termina).
- Créditos de terceros dentro de la secuencia (van en `/credits`, más adelante).

## Lo que queda al constructor

- Cómo se hace el agua (post-proceso de refracción, partículas en suspensión,
  rayos de luz tenues, niebla), siempre muy oscura.
- El ritmo exacto del scroll (cuánto scroll por crédito, la curva de hundimiento).
- La composición y la tipografía de las fichas dentro del estilo B y del sistema
  de la web (Tanker para el nombre, mono para los datos).
- Cómo llega Lanyard al cliente (REST o WebSocket, vía una ruta propia que no
  exponga nada que no deba) y cada cuánto se refresca.

## Atribución de terceros (fuera de esta escena)

- `app/oni/credits.ts` lista 28 modelos de Sketchfab con licencia CC-BY /
  CC-BY-NC, que obliga a citar a sus autores, y hoy no salen en ninguna parte.
  **Decisión de s7lver:** se citarán en una página aparte, `/credits`, que se
  hace después y **no forma parte de este trabajo**.
- La web se trata como **no comercial** (portfolio personal, sin ventas), así que
  los dos modelos CC-BY-NC (Ceiling Lamp, Router) se quedan. *Decisión de Claude*:
  si deja de ser así, hay que cambiarlos.
