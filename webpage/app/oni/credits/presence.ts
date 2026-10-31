/** Lo que se ve de Discord en la ficha de s7lver (lo que falta, `null`). */
export interface Presence {
  name: string;
  status: 'online' | 'idle' | 'dnd' | 'offline' | null;
  custom: string | null;
  activity: string | null;
  spotify: { song: string; artist: string } | null;
}

/**
 * Pide el estado al montar y luego cada 30 s, solo con la pestaña visible (al volver, en el
 * momento). Un error de red se ignora: se queda el último valor. Devuelve con qué pararlo.
 */
export function watchPresence(cb: (p: Presence) => void) {
  let alive = true, id = 0;
  const ask = () =>
    fetch('/api/presence')
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Presence | null) => alive && p && cb(p))
      .catch(() => {});
  const loop = () => {
    clearTimeout(id);
    if (!alive || document.hidden) return;
    ask();
    id = window.setTimeout(loop, 30_000);
  };
  document.addEventListener('visibilitychange', loop);
  loop();
  return () => {
    alive = false;
    clearTimeout(id);
    document.removeEventListener('visibilitychange', loop);
  };
}
