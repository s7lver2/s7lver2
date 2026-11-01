/*
 * Los logros: casi todos salen de easter eggs (que todavía no existen) y el primero, de llegar al
 * final. Se recuerdan en el navegador del visitante; sin cuentas ni servidor. Cualquier parte de la
 * web da uno con `unlock(id)`; el aviso y la pared de la cena se enteran con `onUnlock`.
 */

export type AchievementId = 'end' | 'backrooms' | 'idiot' | 'vrchat' | 'lucy' | 'silver' | 'minecraft' | 'nether' | 'gemini' | 'whatsapp';
export interface Achievement {
  id: AchievementId;
  name: string;
  desc: string;
}

// los de los easter eggs llevan nombre provisional: bloqueados se ven como «???»
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'end', name: 'The Last Supper', desc: 'You made it to the end.' },
  { id: 'backrooms', name: 'Noclip', desc: 'Got out of the Backrooms.' },
  { id: 'idiot', name: 'Good job idiot, now what?', desc: 'Killed something in the Backrooms.' },
  { id: 'vrchat', name: 'Trust Rank', desc: 'Took the tour of VRChat.' },
  { id: 'lucy', name: 'L U C Y', desc: 'Found Silver.' },
  { id: 'silver', name: 'S I L V E R', desc: 'Found Lucy.' },
  { id: 'minecraft', name: 'Punch a Tree', desc: 'Opened Minecraft.' },
  { id: 'nether', name: 'We Need to Go Deeper', desc: 'Reached the Nether.' },
  { id: 'gemini', name: 'Never Again', desc: 'Opened Gemini.' },
  { id: 'whatsapp', name: 'Seen', desc: 'Read the chat.' },
];

const KEY = 'oni.achievements';
// cada logro conseguido, con cuándo (ms desde 1970)
let got: Map<AchievementId, number> | undefined;
const subs = new Set<(a: Achievement) => void>();
// lo conseguido sin nadie escuchando (antes de montar el aviso) se entrega al primero que llegue
let queue: Achievement[] = [];

// sin almacenamiento (ventana privada, bloqueado) los logros duran lo que la pestaña
function load() {
  if (got) return got;
  try {
    if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('resetach')) localStorage.removeItem(KEY);
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    // la primera versión guardaba solo la lista, sin fecha
    got = new Map(Array.isArray(v) ? v.map((id: AchievementId) => [id, Date.now()]) : (Object.entries(v) as [AchievementId, number][]));
  } catch {
    got = new Map();
  }
  return got;
}

export const has = (id: AchievementId) => load().has(id);
/** Cuándo se consiguió (ms), o undefined. */
export const when = (id: AchievementId) => load().get(id);

export function unlock(id: AchievementId) {
  const g = load();
  if (g.has(id)) return;
  g.set(id, Date.now());
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(g)));
  } catch {}
  const a = ACHIEVEMENTS.find((x) => x.id === id)!;
  if (subs.size) for (const f of subs) f(a);
  else queue.push(a);
}

export function onUnlock(fn: (a: Achievement) => void) {
  subs.add(fn);
  const q = queue;
  queue = [];
  q.forEach(fn);
  return () => void subs.delete(fn);
}

// desarrollo: __unlock('gemini') en la consola
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') Object.assign(window, { __unlock: unlock });
