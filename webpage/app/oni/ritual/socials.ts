import { DEFAULT_SOCIALS, type SocialC } from '../../lib/content-constants';

/*
 * Las redes del ritual: las del panel de control (`socials`), en su orden. Cada estatua lleva dos;
 * un hueco sin red es solo el oni. Una red sin enlace todavía (vacío o '#') se enseña igual, pero
 * no se abre: en cuanto el panel tenga la URL, funciona sin tocar código.
 */
export const SLOTS = 8;

export const hasLink = (s: SocialC) => !!s.url && s.url !== '#';

/** Siempre ocho huecos: las ocho primeras redes y, si faltan, null (solo el oni). */
export const slots = (socials: SocialC[]): (SocialC | null)[] => Array.from({ length: SLOTS }, (_, i) => socials[i] ?? null);

// desarrollo: ?ritual&socials=N da N redes de relleno (para probar listas raras)
function devSocials(): SocialC[] | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const n = new URLSearchParams(location.search).get('socials');
  if (n === null) return null;
  const ks = ['github', 'discord', 'twitter', 'tiktok', 'instagram', 'htb', 'linkedin', 'myspace', 'youtube', 'twitch', 'reddit']; // myspace (sin marca), en el último hueco
  return Array.from({ length: Number(n) }, (_, i) => {
    const k = ks[i % ks.length];
    return { k, v: `@${k}`, color: '#c4221a', url: i % 3 === 1 ? '#' : `https://example.com/${k}`, initials: k.slice(0, 2).toUpperCase() };
  });
}

export async function loadSocials(): Promise<SocialC[]> {
  const dev = devSocials();
  if (dev) return dev;
  try {
    const r = await fetch('/api/content/socials');
    const s = r.ok ? ((await r.json()) as SocialC[]) : null;
    if (Array.isArray(s) && s.length) return s;
  } catch {}
  return DEFAULT_SOCIALS;
}
