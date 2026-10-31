import { forwardRef } from 'react';

/*
 * El indicador de scroll del inicio (la cuenta roja que cae por su carril) para las escenas a
 * pantalla completa. Empieza oculto: cada escena lo enciende con `data-on` desde su propio
 * fotograma (sin pasar por React) mientras está esperando a que hagas scroll.
 */
const ScrollCue = forwardRef<HTMLDivElement>(function ScrollCue(_, ref) {
  return (
    <div ref={ref} className="oni-hint oni-cue" aria-hidden="true">
      scroll
      <i />
    </div>
  );
});
export default ScrollCue;

/** Enciende o apaga el indicador (solo toca el DOM si cambia). */
export const cue = (el: HTMLElement | null, on: boolean) => {
  if (el && on !== el.hasAttribute('data-on')) el.toggleAttribute('data-on', on);
};
