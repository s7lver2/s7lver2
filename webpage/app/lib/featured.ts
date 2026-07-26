// Client-safe. The graph route, the readme route and the admin picker all
// import from here — keep it free of server-only imports.
import { LANG_COLORS, FALLBACK_LANG_COLOR } from './lang-colors';

export interface FeaturedRepo {
  /** "owner/name", e.g. "s7lver2/file-meet". Primary key. */
  repo: string;
  /** Manual, because GitHub has no equivalent. */
  status: 'done' | 'beta' | 'dev';
  nameOverride?: string;
  descOverride?: string;
}

/** Seed so the graph works before the admin picker exists (Task 13). */
export const DEFAULT_FEATURED: FeaturedRepo[] = [
  { repo: 's7lver2/file-meet', status: 'done' },
  { repo: 's7lver2/ZephyrOS', status: 'beta' },
  { repo: 's7lver2/CodeDotJS', status: 'dev' },
  { repo: 's7lver2/ChessSandbox', status: 'beta' },
  { repo: 's7lver2/Lumi', status: 'dev' },
];

/** "s7lver2/file-meet" -> "file-meet". The graph's slug. */
export function repoName(repo: string): string {
  const i = repo.indexOf('/');
  return i < 0 ? repo : repo.slice(i + 1);
}

const NEUTRAL = '#6b6b78';

/**
 * Initials for one repo name, at the requested length.
 * Split on -, _ or . and take the first letter of each part; if there is no
 * separator, take the leading capitals; otherwise the leading characters.
 */
function rawInitials(name: string, len: number): string {
  const parts = name.split(/[-_.]/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, len).map((p) => p[0]).join('').toUpperCase();
  }
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= len) return caps.slice(0, len).join('');
  return name.slice(0, len).toUpperCase();
}

/**
 * Initials for a whole selection, resolving collisions by extending the
 * second colliding entry to three characters. Deterministic: the input is
 * sorted by repo string first, so a repo's initials never flip between loads.
 */
export function initialsFor(repos: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  for (const repo of [...repos].sort()) {
    const name = repoName(repo);
    let ini = rawInitials(name, 2);
    if (taken.has(ini)) ini = rawInitials(name, 3);
    // Still colliding after three characters: append a digit rather than
    // shipping two identical nodes.
    let n = 2;
    while (taken.has(ini)) ini = rawInitials(name, 3).slice(0, 2) + n++;
    taken.add(ini);
    out[repo] = ini;
  }
  return out;
}

/**
 * Accent colour per repo, derived from its primary language.
 *
 * Nine of the account's repos are TypeScript, so the base language colour
 * alone would give nine identical nodes. Repos sharing a language are sorted
 * by repo string and stepped in lightness — index 0 keeps the base colour,
 * later ones alternate ±10% clamped to L in [38, 72] so every step stays
 * legible on the dark canvas.
 *
 * @param primaryLangs repo -> primary language name, or null when GitHub
 *                     reports no language for it.
 */
export function accentsFor(
  repos: string[],
  primaryLangs: Record<string, string | null>
): Record<string, string> {
  const groups: Record<string, string[]> = {};
  for (const repo of [...repos].sort()) {
    const lang = primaryLangs[repo] ?? '__none__';
    (groups[lang] ||= []).push(repo);
  }

  const out: Record<string, string> = {};
  for (const [lang, members] of Object.entries(groups)) {
    if (lang === '__none__') {
      for (const repo of members) out[repo] = NEUTRAL;
      continue;
    }
    const base = LANG_COLORS[lang] || FALLBACK_LANG_COLOR;
    members.forEach((repo, i) => {
      out[repo] = i === 0 ? base : stepLightness(base, i);
    });
  }
  return out;
}

/** index 1 -> +10%, 2 -> -10%, 3 -> +20%, 4 -> -20%, … clamped to [38, 72]. */
function stepLightness(hex: string, index: number): string {
  const magnitude = Math.ceil(index / 2) * 10;
  const delta = index % 2 === 1 ? magnitude : -magnitude;
  const { h, s, l } = hexToHsl(hex);
  const nl = Math.max(38, Math.min(72, l + delta));
  return hslToHex(h, s, nl);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = L - c / 2;
  const to = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}
