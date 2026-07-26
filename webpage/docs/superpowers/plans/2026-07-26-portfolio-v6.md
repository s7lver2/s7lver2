# Portfolio v6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the Projects graph from GitHub repos selected in the admin, redesign its nodes as language donuts, add a real lines-of-code counter, layer in animations, fix two regressions, and rebuild the admin as a TUI + editorial panel with canvas-dot charts and an action-capable command palette.

**Architecture:** Phase A (public site) ships first and works with a hand-seeded `featured` list in KV. Phase B (admin) replaces the seeding with a picker and rebuilds the panel's shell, charts, navigation and configuration. The two phases share exactly one contract: the `featured` content type.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript, Upstash Redis (KV) with local-JSON fallback, Canvas 2D, IntersectionObserver, ResizeObserver. External data: GitHub REST API (authenticated) and `ghloc.ifels.dev`. **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-26-portfolio-v6-design.md`

## Testing

**There are no automated tests in this plan. The user verifies manually.** Every task ends with:

1. `npx tsc --noEmit` — must pass clean.
2. A **Manual verification** block listing exactly what the user should look at.
3. A commit.

Do not write test files. Do not run the dev server to "check" the user's app — `tsc`, `curl` against a route, and the final `npm run build` are the only automated checks in scope.

## Global Constraints

- **No new npm dependencies.** Everything is achievable with what is installed plus `fetch`.
- **Design tokens come from `app/globals.css` verbatim:** `--glass: rgba(21,21,29,.7)`, `--line: rgba(255,255,255,.08)`, `--mut: rgba(255,255,255,.5)`, `--dim: rgba(255,255,255,.4)`, surfaces `#0d0d13` and `#090a0e`, purple `#8b5cf6` as **accent only**, `.eyebrow` green `#22c55e` (the `$ ` comes from `::before`), `.h2` Sora weight 800 / `-0.015em`, `.seclabel` 11px / `0.18em` / radius 999px, teal `#5eead4` for active state.
- **`prefers-reduced-motion: reduce` disables every animation in this plan.** Final state renders immediately. This is not optional per-task — every animation you add gets a reduced-motion branch in the same commit.
- **No scroll hijacking.** Parallax is transform-only layer translation driven by scroll position. No pinning, no wheel interception.
- **Never render a raw status code or error string to a visitor.** Every external-data failure degrades to a cached value, an estimate, or a quiet empty state.
- **Caching is a correctness requirement** for anything touching GitHub or ghloc. `kvGetJSON`/`kvSetJSON` have **no TTL primitive** — store `fetchedAt` in the payload and compare against it.
- **Spanish UI copy stays Spanish; English copy stays English.** The public site's project/GitHub sections are Spanish-labelled in places and English in others — match the file you are editing, do not translate.
- **`GITHUB_TOKEN` is assumed present** but every GitHub call must still work without it.
- Existing style: the public site uses classes in `app/globals.css`; the admin uses inline style objects. Phase B changes the admin's approach deliberately (Task 8) — until then, follow the file you are in.

---

## File Structure

**Phase A — new files**

| File | Responsibility |
|---|---|
| `app/lib/featured.ts` | The `FeaturedRepo` type, the default seed, initials derivation and the deterministic accent-colour stepping. Pure — no server imports, so both the route and the admin can import it. |
| `app/lib/loc-map.ts` | Extension allowlist and extension→language mapping. Pure data plus one lookup function. |
| `app/lib/loc.ts` | `LocPayload`, the ghloc aggregation, the byte-estimate fallback and `refreshLoc()`. Lives in `lib/`, **not** in the route: a `route.ts` should export only HTTP handlers, and the admin refresh route (Task 10) has to import `refreshLoc` from somewhere legal. |
| `app/api/github/loc/route.ts` | Thin `GET`: read the 24h envelope cache, serve stale while refreshing, delegate everything else to `app/lib/loc.ts`. |
| `app/components/sections/LocCounter.tsx` | The LOC card: total count-up, stacked bar, legend. |
| `app/lib/parallax.ts` | rAF-throttled scroll→transform hook. |

**Phase A — modified**

| File | Change |
|---|---|
| `app/lib/content.ts` | `'featured'` joins `ContentType`. |
| `app/api/projects/graph/route.ts` | Builds from `featured` instead of `DEFAULT_PROJECTS`. |
| `app/api/projects/[slug]/readme/route.ts` | Resolves the repo from `featured`. |
| `app/components/graph/render.ts` | Donut nodes replace the glyph. |
| `app/components/graph/engine.ts` | `radiusFor` language multiplier; idle-oscillation phase seed. |
| `app/components/graph/useGraph.ts` | Entrance animation from centre; dash-offset tick. |
| `app/components/sections/HTB.tsx` | Visible empty state instead of `return null`. |
| `app/components/sections/GitHub.tsx` | Heatmap `--i` indices; mounts `LocCounter`. |
| `app/globals.css` | `.gcanvas` height; shimmer keyframes; expressive reveal variants; `.loc*` classes. |

**Phase B — new files**

| File | Responsibility |
|---|---|
| `app/admin/components/ui.tsx` | The shared admin UI kit: `Panel`, `Field`, `Btn`, `Kbd`, `SectionHead`, and the token constants. Replaces per-page inline style objects. |
| `app/admin/components/StatusLine.tsx` | The persistent bottom statusline. |
| `app/admin/components/charts/types.ts` | `ChartSeries`, `Renderer`, and `resample`. |
| `app/admin/components/charts/DotsChart.tsx` | Canvas 2D dot matrix — the default renderer. |
| `app/admin/components/charts/BrailleChart.tsx` | Text braille with runtime font detection and fallback. |
| `app/admin/components/charts/SvgChart.tsx` | SVG area chart. |
| `app/admin/components/charts/Chart.tsx` | The renderer-agnostic wrapper: reads the preference, measures, resamples, dispatches. |
| `app/admin/components/AdminPalette.tsx` | ⌘K with nav + actions + two-level drill-down. |
| `app/admin/config/page.tsx` | The restored Configuración section. |
| `app/admin/hooks/usePrefs.ts` | Read/write `adminPrefs`, expose `renderer`. |
| `app/api/admin/github/repos/route.ts` | Auth-gated repo list for the picker. |
| `app/api/admin/prefs/route.ts` | GET/PUT `adminPrefs`. |
| `app/api/admin/github/loc/refresh/route.ts` | Auth-gated cache warm. |

**Phase B — modified**

| File | Change |
|---|---|
| `app/admin/components/AdminSidebar.tsx` | Sliding teal indicator, retokenised, Config entry, Overview→Analytics. |
| `app/admin/page.tsx` | Becomes the tabbed Analytics page absorbing Traffic and Live. |
| `app/admin/content/projects/page.tsx` | Repo picker, save feedback, dirty guard, validation, reorder. |
| `app/admin/content/socials/page.tsx` | Absorbs Profiles. |
| `app/admin/login/page.tsx` | ASCII flow-field background. |
| `app/admin/layout.tsx` | Mounts `StatusLine` and `AdminPalette`. |
| `app/admin/{traffic,live,profiles}/page.tsx` | Deleted. |

---

# Phase A — Public site

## Task 1: The `featured` contract

**Files:**
- Create: `app/lib/featured.ts`
- Modify: `app/lib/content.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FeaturedRepo`, `DEFAULT_FEATURED`, `repoName(repo)`, `initialsFor(names)`, `accentsFor(entries, primaryLangs)`. Tasks 2, 3 and 13 all import from here.

- [ ] **Step 1: Create `app/lib/featured.ts`**

```ts
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
```

- [ ] **Step 2: Register the content type**

In `app/lib/content.ts`, add the import, extend the union, the defaults map and the guard:

```ts
import { DEFAULT_FEATURED, type FeaturedRepo } from './featured';
export { DEFAULT_FEATURED, type FeaturedRepo } from './featured';

export type ContentType = 'projects' | 'skills' | 'socials' | 'home' | 'featured';

const DEFAULTS: Record<ContentType, unknown> = {
  projects: DEFAULT_PROJECTS, skills: DEFAULT_SKILLS, socials: DEFAULT_SOCIALS,
  home: DEFAULT_HOME, featured: DEFAULT_FEATURED,
};

export function isContentType(t: string): t is ContentType {
  return t === 'projects' || t === 'skills' || t === 'socials'
    || t === 'home' || t === 'featured';
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Manual verification**

Nothing is visible yet — this task only adds the contract. Confirm the route responds:

```bash
curl -s http://localhost:3000/api/content/featured
```

Expected: the five seeded entries as JSON.

- [ ] **Step 5: Commit**

```bash
git add app/lib/featured.ts app/lib/content.ts
git commit -m "feat(featured): add the featured-repos content type and accent derivation"
```

---

## Task 2: Graph builds from `featured`

**Files:**
- Modify: `app/api/projects/graph/route.ts`
- Modify: `app/api/projects/[slug]/readme/route.ts`
- Modify: `app/lib/graph-types.ts`

**Interfaces:**
- Consumes: `FeaturedRepo`, `DEFAULT_FEATURED`, `repoName`, `initialsFor`, `accentsFor` from Task 1.
- Produces: `GraphNodeWire` gains `initials?: string`, `stars?: number`, `noLanguage?: boolean`. Task 3's renderer reads all three.

- [ ] **Step 1: Extend the wire type**

In `app/lib/graph-types.ts`, add to `GraphNodeWire` after `langs`:

```ts
  /** Two or three characters drawn in the donut's centre. Projects only. */
  initials?: string;
  /** GitHub stargazers. Projects only. */
  stars?: number;
  /** True when GitHub reports no language — the renderer dashes the ring. */
  noLanguage?: boolean;
```

- [ ] **Step 2: Rewrite the graph route's source and build**

In `app/api/projects/graph/route.ts`, replace the `ProjectC` import with the featured helpers and rewrite `buildPayload` plus the `GET` body. `fetchLanguages` and `toPercentages` stay exactly as they are.

```ts
import { getContent } from '@/lib/content';
import { repoName, initialsFor, accentsFor, type FeaturedRepo } from '@/lib/featured';
```

```ts
/** Name, description and stars for one repo. Null on any failure. */
async function fetchRepoMeta(repo: string): Promise<
  { name: string; desc: string; stars: number } | null
> {
  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      name?: string; description?: string | null; stargazers_count?: number;
    };
    return {
      name: j.name || repoName(repo),
      desc: j.description || '',
      stars: j.stargazers_count ?? 0,
    };
  } catch {
    return null;
  }
}

async function buildPayload(featured: FeaturedRepo[]): Promise<GraphPayload> {
  const nodes: GraphNodeWire[] = [];
  const links: GraphLinkWire[] = [];
  const degree: Record<string, number> = {};
  const languageNodes = new Set<string>();

  const langsByRepo: Record<string, Record<string, number>> = {};
  const metaByRepo: Record<string, { name: string; desc: string; stars: number }> = {};

  // Sequential rather than Promise.all: a handful of repos is not worth
  // burning concurrent rate-limit slots, and a partial failure is easier to
  // reason about.
  for (const f of featured) {
    const bytes = await fetchLanguages(f.repo);
    if (bytes) langsByRepo[f.repo] = toPercentages(bytes);
    const meta = await fetchRepoMeta(f.repo);
    if (meta) metaByRepo[f.repo] = meta;
  }

  const repos = featured.map((f) => f.repo);
  const primaryLangs: Record<string, string | null> = {};
  for (const repo of repos) {
    const langs = langsByRepo[repo] || {};
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
    primaryLangs[repo] = top ? top[0] : null;
  }
  const accents = accentsFor(repos, primaryLangs);
  const initials = initialsFor(repos);

  for (const f of featured) {
    const langs = langsByRepo[f.repo] || {};
    const meta = metaByRepo[f.repo];
    const slug = repoName(f.repo);
    nodes.push({
      id: slug,
      kind: 'project',
      color: accents[f.repo],
      degree: 0,
      slug,
      repo: f.repo,
      desc: f.descOverride || meta?.desc || '',
      status: f.status,
      langs,
      initials: initials[f.repo],
      stars: meta?.stars ?? 0,
      noLanguage: Object.keys(langs).length === 0,
    });
    for (const [lang, pct] of Object.entries(langs)) {
      languageNodes.add(lang);
      links.push({ source: slug, target: lang, weight: pct });
      degree[slug] = (degree[slug] || 0) + 1;
      degree[lang] = (degree[lang] || 0) + 1;
    }
  }

  for (const lang of languageNodes) {
    nodes.push({ id: lang, kind: 'language', color: colorFor(lang), degree: 0 });
  }
  for (const n of nodes) n.degree = degree[n.id] || 0;

  return { nodes, links, fetchedAt: Date.now() };
}
```

In `GET`, replace the content read:

```ts
  const featured = await getContent<FeaturedRepo[]>('featured');
```

and pass `featured` to `buildPayload`. Everything below — the freshness check, the stale-is-better-than-edgeless guard and the `kvSetJSON` — is unchanged.

- [ ] **Step 3: Resolve the readme route from `featured`**

In `app/api/projects/[slug]/readme/route.ts`, replace the `DEFAULT_PROJECTS`/`projects` lookup with:

```ts
  const featured = await getContent<FeaturedRepo[]>('featured');
  const slug = params.slug.toLowerCase();
  const entry = featured.find((f) => repoName(f.repo).toLowerCase() === slug);
  if (!entry) {
    return NextResponse.json({ status: 'none', reason: 'no_repo' }, { status: 200 });
  }
  const repo = entry.repo;
```

Keep the rest of the handler — the raw-content fetch, the branch fallback and the response shape — byte-identical. Match the existing `reason` values; the client in `ProjectsGraph.tsx` switches on `'no_repo'`.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

```bash
curl -s "http://localhost:3000/api/projects/graph" | head -c 800
```

Look for: five project nodes named from the repos, each with `initials`, `stars`, an `accent` colour that differs between same-language repos, and `noLanguage: true` on any repo GitHub reports no language for. Then open the site — the graph should show the five seeded repos rather than the old four hand-written projects, and clicking one should still load its README.

**If the graph is empty:** the cache is stale from the old shape. Delete the KV key or the local `projects-graph.json` and reload.

- [ ] **Step 6: Commit**

```bash
git add app/api/projects/graph/route.ts "app/api/projects/[slug]/readme/route.ts" app/lib/graph-types.ts
git commit -m "feat(graph): build from the featured selection with real repo metadata"
```

---

## Task 3: Donut nodes and a bigger canvas

**Files:**
- Modify: `app/components/graph/render.ts`
- Modify: `app/components/graph/engine.ts`
- Modify: `app/globals.css:1719-1723` and `:1783`

**Interfaces:**
- Consumes: `initials`, `noLanguage`, `langs` on `GraphNodeWire` (Task 2).
- Produces: `GraphNode` gains `initials: string`, `noLanguage: boolean`, `ringSegments: Array<{color: string; frac: number}>` and `phase: number`. Task 7 reads `phase`.

- [ ] **Step 1: Carry the new fields onto the simulation node**

In `app/components/graph/engine.ts`, add to the `GraphNode` interface:

```ts
  /** Drawn in the donut centre. Empty for language nodes. */
  initials: string;
  /** GitHub reported no language — the ring is dashed rather than filled. */
  noLanguage: boolean;
  /** Ring segments in descending percentage order. Projects only. */
  ringSegments: Array<{ color: string; frac: number }>;
  /** Per-node phase offset so idle oscillation is not in unison (Task 7). */
  phase: number;
```

Change `radiusFor` — the language multiplier is an explicit request, the more projects use a language the bigger its node:

```ts
function radiusFor(kind: 'project' | 'language', degree: number): number {
  return kind === 'project' ? 9 + degree * 1.4 : 6 + degree * 2.0;
}
```

In `buildGraph`, populate the new fields when constructing each node. Import `colorFor` from `@/lib/lang-colors`:

```ts
      initials: w.initials ?? '',
      noLanguage: w.noLanguage ?? false,
      ringSegments: Object.entries(w.langs ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([name, pct]) => ({ color: colorFor(name), frac: pct / 100 })),
      // Golden-ratio stride: deterministic, and adjacent nodes never share a phase.
      phase: (i * 0.618033988749895) % 1,
```

where `i` is the node's index in the payload array — change the `map` callback to `(w, i) =>` if it does not already take an index.

- [ ] **Step 2: Replace the glyph with the donut**

In `app/components/graph/render.ts`, delete the `GLYPH_PROJECT` and `GLYPH_LANGUAGE` constants and replace the per-node draw. Inside the `for (const n of ordered)` loop, keep the existing `p`, `isProject`, `on`, `dep`, `alpha` and `rr` computations, then substitute the glyph block with:

```ts
    ctx.globalAlpha = alpha;

    if (isProject) {
      const thickness = Math.max(4, rr * 0.34);
      const ringR = rr - thickness / 2;

      // Bloom behind the node on hover or selection.
      if (n === lit || n === selected) {
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rr * 1.7);
        g.addColorStop(0, n.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, rr * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }

      if (n.noLanguage) {
        // Show the missing data rather than disguising it.
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Clockwise from 12 o'clock, descending percentage.
        let a0 = -Math.PI / 2;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'butt';
        for (const seg of n.ringSegments) {
          const a1 = a0 + seg.frac * Math.PI * 2;
          ctx.strokeStyle = seg.color;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, ringR, a0, a1);
          ctx.stroke();
          a0 = a1;
        }
      }

      // Centre disc, so edges passing behind do not show through the initials.
      ctx.fillStyle = '#0b0b12';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(0, ringR - thickness / 2), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = `600 ${(rr * 0.62).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.initials, p.sx, p.sy);
    } else {
      // Language node: hollow circle, 2px ring in the language colour.
      ctx.fillStyle = '#090a0e';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
```

The `n === selected` teal ring block below it and the label block both stay. **Remove the `ctx.shadowBlur` lines** — the bloom replaces them, and a leftover `shadowBlur` bleeds into every later draw.

In the label block, change the project label colour source so it no longer relies on the glyph's shadow for contrast: leave the existing `rgba(255,255,255,.9)`.

- [ ] **Step 3: Grow the canvas**

In `app/globals.css`, `.gcanvas` at line 1719: `height: 376px` → `height: 440px`. Leave the `@media (max-width: 760px)` override at 300px — vertical space is scarce on mobile and fewer nodes fit on screen there anyway.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

Open the Projects section:

- Each project node is a **donut** whose ring segments match its language percentages, clockwise from 12 o'clock, biggest first.
- Initials are legible in the centre; no two nodes share initials.
- Two TypeScript repos are distinguishable — by ring shape if their language mixes differ, by initials regardless.
- A repo with no detected language has a **dashed grey** ring.
- Language node size visibly tracks how many projects link to it.
- Hovering blooms the node; selecting still shows the teal ring.
- The canvas is taller than before on desktop, unchanged on a narrow window.

- [ ] **Step 6: Commit**

```bash
git add app/components/graph/render.ts app/components/graph/engine.ts app/globals.css
git commit -m "feat(graph): language-donut nodes, degree-scaled language nodes, taller canvas"
```

---

## Task 4: HTB empty state

**Files:**
- Modify: `app/components/sections/HTB.tsx:82-83`
- Modify: `README.md` or `docs/DEPLOY.md` (whichever documents env vars)

- [ ] **Step 1: Replace `return null` with a visible empty state**

The v6 spec calls for an empty state; the v5 plan mistranslated that to "render nothing" and the section disappeared entirely. Replace lines 82-83:

```tsx
  // Not configured, or upstream unavailable. Show the section with an empty
  // state — never a status code, and never nothing at all.
  if (!profile || !progress) {
    return (
      <section id="htb" className="sec">
        <div className="wrap reveal" ref={reveal}>
          <span className="seclabel">HackTheBox</span>
          <div className="eyebrow mono">htb --stats</div>
          <h2 className="h2">HackTheBox</h2>
          <p className="mono" style={{ color: 'var(--dim)', marginTop: 14 }}>
            ◌ Sin datos por ahora.
          </p>
        </div>
      </section>
    );
  }
```

If the component does not already have a `reveal` ref in scope at this point, reuse the same one the success branch uses; if that ref is declared after this early return, move its declaration above.

- [ ] **Step 2: Document the deployment requirement**

Add to whichever file documents environment variables:

```markdown
- `GITHUB_USER` — **must be `s7lver2`** in Vercel. A stale `GITHUB_USERNAME=s7lver`
  points at an account with 0 public repos and every GitHub KPI reads zero.
- `HTB_API_TOKEN`, `HTB_USER_ID` — optional. Absent, the HackTheBox section
  renders its empty state instead of disappearing.
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

The HTB section is **visible** with the label, eyebrow, heading and one discreet line. No `HTTP 503`, no status code, no error text anywhere on the page. The GitHub KPIs read non-zero (28 repos / 8 stars / 7 followers / 840 commits per year locally).

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/HTB.tsx
git commit -m "fix(htb): render a visible empty state instead of nothing"
```

---

## Task 5: The LOC route

**Files:**
- Create: `app/lib/loc-map.ts`
- Create: `app/lib/loc.ts`
- Create: `app/api/github/loc/route.ts`

**Interfaces:**
- Consumes: `FeaturedRepo` (Task 1) — the counter sums the featured selection, not every repo on the account.
- Produces: `LocPayload` and `refreshLoc()`, both from `app/lib/loc.ts`. Task 6 imports the type; Task 10's admin refresh route imports the function.

**Why the logic lives in `lib/` and not in the route:** a `route.ts` is expected to export only HTTP handlers, and Task 10 needs to call `refreshLoc` from a second route. Putting it in `lib/` keeps both importers legal and keeps the route thin.

- [ ] **Step 1: Create `app/lib/loc-map.ts`**

An **allowlist**, not a denylist: `Lumi` alone has 45,495 lines of markdown and `ChessSandbox` 8,022 lines of lockfile, and a denylist needs extending every time a new generated type appears.

```ts
// Extension -> language. The keys are the allowlist: anything not here is not
// code and is excluded from the count. Fails closed by design.
const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.go': 'Go',
  '.py': 'Python',
  '.rs': 'Rust',
  '.c': 'C', '.h': 'C',
  '.cpp': 'C++', '.cc': 'C++', '.hpp': 'C++',
  '.cs': 'C#', '.java': 'Java', '.kt': 'Kotlin', '.swift': 'Swift',
  '.rb': 'Ruby', '.php': 'PHP',
  '.sh': 'Shell', '.bash': 'Shell',
  '.ps1': 'PowerShell',
  '.lua': 'Lua', '.sql': 'SQL',
  '.css': 'CSS', '.scss': 'CSS', '.less': 'CSS',
  '.html': 'HTML', '.vue': 'HTML', '.svelte': 'HTML', '.astro': 'HTML',
  '.qml': 'QML',
  '.wgsl': 'Shader', '.glsl': 'Shader',
  '.nix': 'Nix',
  '.cmake': 'Makefile', Makefile: 'Makefile',
  Dockerfile: 'Dockerfile',
};

/** Language for a ghloc key, or null when the key is not code. */
export function langForExt(key: string): string | null {
  return EXT_LANG[key] ?? null;
}

/**
 * Passed to ghloc so it skips heavy directories before counting — this both
 * removes junk and makes the request materially faster.
 */
export const GHLOC_FILTER =
  'package-lock.json,yarn.lock,pnpm-lock.yaml,poetry.lock,node_modules,dist,build,vendor,.next,target';

/**
 * Bytes-per-line divisors for the fallback estimate, measured per language.
 * Only used when ghloc is unreachable and there is no cache.
 */
export const BYTES_PER_LINE: Record<string, number> = {
  Python: 30, CSS: 25, TypeScript: 35, Rust: 32, Go: 28,
};
export const DEFAULT_BYTES_PER_LINE = 34;
```

- [ ] **Step 2: Create `app/lib/loc.ts`**

The three facts that drive this design: ghloc takes **1.1s–5.6s per repo** (so it can never run on the request path), raw counts are **51–64% junk** (so the allowlist is mandatory), and ghloc's host is explicitly unsupported (so a fallback is mandatory).

```ts
import { kvGetJSON, kvSetJSON } from '@/lib/redis';
import { getContent } from '@/lib/content';
import type { FeaturedRepo } from '@/lib/featured';
import { colorFor } from '@/lib/lang-colors';
import {
  langForExt, GHLOC_FILTER, BYTES_PER_LINE, DEFAULT_BYTES_PER_LINE,
} from '@/lib/loc-map';

export interface LocPayload {
  totalLines: number;
  byLanguage: Array<{ name: string; lines: number; pct: number; color: string }>;
  repoCount: number;
  source: 'ghloc' | 'estimate';
  fetchedAt: number;
  stale?: boolean;
}

export const LOC_CACHE_KEY = 'github:loc';
export const LOC_CACHE_FILE = 'github-loc.json';
export const LOC_TTL_MS = 24 * 60 * 60 * 1000;

function ghHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 's7lver-portfolio',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/** ghloc's per-extension line counts for one repo. Null on any failure. */
async function fetchGhloc(repo: string): Promise<Record<string, number> | null> {
  try {
    const url = `https://ghloc.ifels.dev/${repo}?filter=${encodeURIComponent(GHLOC_FILTER)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 's7lver-portfolio' } });
    if (!r.ok) return null;
    const j = (await r.json()) as { locByLangs?: Record<string, number> };
    return j.locByLangs ?? null;
  } catch {
    return null;
  }
}

async function fetchBytes(repo: string): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/languages`, {
      headers: ghHeaders(),
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, number>;
  } catch {
    return null;
  }
}

function finish(
  lines: Record<string, number>,
  repoCount: number,
  source: 'ghloc' | 'estimate'
): LocPayload {
  const total = Object.values(lines).reduce((s, v) => s + v, 0);
  const byLanguage = Object.entries(lines)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({
      name,
      lines: v,
      pct: total > 0 ? Math.round((v / total) * 1000) / 10 : 0,
      color: colorFor(name),
    }));
  return { totalLines: total, byLanguage, repoCount, source, fetchedAt: Date.now() };
}

/** Real counts from ghloc, allowlisted server-side. Null if every repo failed. */
async function buildFromGhloc(repos: string[]): Promise<LocPayload | null> {
  const lines: Record<string, number> = {};
  let ok = 0;
  // Sequential: ghloc is a small unsupported host and a cold repo takes up to
  // 5.6s. Hammering it concurrently is how we lose it.
  for (const repo of repos) {
    const byExt = await fetchGhloc(repo);
    if (!byExt) continue;
    ok++;
    for (const [key, count] of Object.entries(byExt)) {
      const lang = langForExt(key);
      if (!lang) continue; // not code — excluded by the allowlist
      lines[lang] = (lines[lang] || 0) + count;
    }
  }
  return ok > 0 ? finish(lines, ok, 'ghloc') : null;
}

/** Last resort: divide GitHub's byte counts by a per-language divisor. */
async function buildFromBytes(repos: string[]): Promise<LocPayload> {
  const lines: Record<string, number> = {};
  let ok = 0;
  for (const repo of repos) {
    const bytes = await fetchBytes(repo);
    if (!bytes) continue;
    ok++;
    for (const [lang, b] of Object.entries(bytes)) {
      const div = BYTES_PER_LINE[lang] ?? DEFAULT_BYTES_PER_LINE;
      lines[lang] = (lines[lang] || 0) + Math.round(b / div);
    }
  }
  return finish(lines, ok, 'estimate');
}

/** The cached payload, or null when there is none. */
export async function readLocCache(): Promise<LocPayload | null> {
  return kvGetJSON<LocPayload | null>(LOC_CACHE_KEY, LOC_CACHE_FILE, null);
}

/**
 * Recompute and cache. Exported so the admin's refresh action (Task 10) warms
 * the same cache through the same code path.
 */
export async function refreshLoc(): Promise<LocPayload> {
  const featured = await getContent<FeaturedRepo[]>('featured');
  const repos = featured.map((f) => f.repo);
  const built = (await buildFromGhloc(repos)) ?? (await buildFromBytes(repos));
  await kvSetJSON(LOC_CACHE_KEY, LOC_CACHE_FILE, built);
  return built;
}
```

- [ ] **Step 3: Create `app/api/github/loc/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { readLocCache, refreshLoc, LOC_TTL_MS } from '@/lib/loc';

export async function GET() {
  const cached = await readLocCache();

  if (cached) {
    const fresh = Date.now() - cached.fetchedAt < LOC_TTL_MS;
    if (fresh) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      });
    }
    // Stale: serve it immediately and refresh behind the response. A cold pass
    // over the selection costs 30-140 seconds — no visitor ever waits for it.
    void refreshLoc();
    return NextResponse.json(
      { ...cached, stale: true },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  // No cache at all. This is the only path that blocks, and only on a cold start.
  const built = await refreshLoc();
  return NextResponse.json(built, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

```bash
curl -s http://localhost:3000/api/github/loc
```

First call may take 10–30 seconds (cold ghloc pass). Check:

- `source` is `"ghloc"`.
- `byLanguage` contains **no** Markdown, JSON, YAML or lockfile entry.
- `totalLines` is materially lower than ghloc's raw `loc` for the same repos — the allowlist is doing its job.
- A second call returns **instantly** with the same `fetchedAt`.

- [ ] **Step 6: Commit**

```bash
git add app/lib/loc-map.ts app/lib/loc.ts app/api/github/loc/route.ts
git commit -m "feat(loc): real lines-of-code aggregation via ghloc with allowlist and byte fallback"
```

---

## Task 6: The LOC counter card

**Files:**
- Create: `app/components/sections/LocCounter.tsx`
- Modify: `app/components/sections/GitHub.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `LocPayload` from Task 5, `countUp` from `app/lib/countup.ts`, `useReveal` from `app/lib/reveal.ts`.
- Produces: nothing downstream.

- [ ] **Step 1: Create the component**

Read `app/lib/countup.ts` and `app/lib/reveal.ts` first and match their existing signatures rather than assuming them — the KPI tiles in `GitHub.tsx` already use both, so mirror `CountKpi`'s usage.

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { LocPayload } from '@/lib/loc';

export default function LocCounter() {
  const [data, setData] = useState<LocPayload | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/github/loc')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d as LocPayload); })
      .catch(() => { /* quiet: the card simply does not appear */ });
    return () => { alive = false; };
  }, []);

  if (!data || data.totalLines === 0) return null;

  const top = data.byLanguage.slice(0, 6);

  return (
    <div className="card locbig reveal">
      <div className="cap">Lines of code · featured repos</div>

      <div className="locnum">
        {/* `~` only when the number is a byte-derived estimate. */}
        <span className="grad">
          {data.source === 'estimate' ? '~' : ''}
          <CountTo value={data.totalLines} />
        </span>
        <em>lines</em>
      </div>

      <div className="locbar">
        {top.map((l) => (
          <span key={l.name} style={{ width: `${l.pct}%`, background: l.color }} />
        ))}
      </div>

      <div className="locleg">
        {top.map((l) => (
          <span key={l.name}>
            <i style={{ background: l.color }} />
            {l.name} <b>{l.lines.toLocaleString('en-US')}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
```

For `CountTo`, reuse the count-up already in the file — if `GitHub.tsx`'s `CountKpi` holds it inline, extract that inner counting logic into `app/lib/countup.ts` (it is already the module's purpose) and import it in both places. **Do not write a second count-up implementation.**

- [ ] **Step 2: Mount it and style it**

In `GitHub.tsx`, import `LocCounter` and render it inside the `.ghbento` grid after the `.heatbig` card.

Append to `app/globals.css`, matching the existing `.langbar` and `.card` conventions:

```css
.locbig { display: flex; flex-direction: column; gap: 12px; }

.locnum { display: flex; align-items: baseline; gap: 10px; }
.locnum > span {
  font-family: var(--font-display);
  font-size: clamp(30px, 5.5vw, 46px);
  font-weight: 800;
  letter-spacing: -.02em;
  line-height: 1;
}
.locnum em {
  font-family: var(--font-mono);
  font-style: normal;
  font-size: 12px;
  color: var(--mut);
  letter-spacing: .14em;
  text-transform: uppercase;
}

.locbar {
  display: flex; height: 8px; border-radius: 999px; overflow: hidden;
  background: rgba(255,255,255,.05);
}
.locbar > span { height: 100%; transition: width .9s cubic-bezier(.16,1,.3,1); }

.locleg {
  display: flex; flex-wrap: wrap; gap: 13px;
  font-family: var(--font-mono); font-size: 11px; color: var(--mut);
}
.locleg i {
  display: inline-block; width: 8px; height: 8px; border-radius: 2px;
  margin-right: 6px; vertical-align: middle;
}
.locleg b { color: rgba(255,255,255,.8); font-weight: 500; }

@media (prefers-reduced-motion: reduce) {
  .locbar > span { transition: none; }
}
```

Check the real `--font-display` / `--font-mono` variable names in `globals.css` before using them; if the file uses literal font stacks instead, match that.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

In the GitHub section: the total counts up from zero on reveal, the stacked bar grows from zero, the legend lists the top languages with real numbers, and there is **no** `~` prefix (there should be, only if `source` is `estimate`). No markdown or JSON in the legend.

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/LocCounter.tsx app/components/sections/GitHub.tsx app/globals.css
git commit -m "feat(github): lines-of-code counter card with count-up and language breakdown"
```

---

## Task 7: Public-site animations

**Files:**
- Create: `app/lib/parallax.ts`
- Modify: `app/components/sections/GitHub.tsx`
- Modify: `app/components/graph/useGraph.ts`
- Modify: `app/components/graph/render.ts`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `phase` on `GraphNode` (Task 3).
- Produces: nothing downstream.

Four additions. The v5 layer — staggered reveals, count-ups, growing bars — stays.

- [ ] **Step 1: Heatmap shimmer**

The grid should read as alive rather than static. One CSS rule and an inline index per cell — no JS loop.

In `GitHub.tsx`, add the index to each cell:

```tsx
                <span
                  key={i}
                  style={{
                    background: HEAT_COLORS[Math.min(intensity, 4)],
                    ['--i' as string]: i,
                  }}
                />
```

In `globals.css`:

```css
@keyframes heat-shimmer {
  0%, 100% { opacity: 1; }
  50%      { opacity: .55; }
}
/* Opacity oscillates against the cell's own colour, so intensity survives. */
.heat > span {
  animation: heat-shimmer 3.4s ease-in-out infinite;
  animation-delay: calc(var(--i, 0) * 7ms);
}
@media (prefers-reduced-motion: reduce) {
  .heat > span { animation: none; }
}
```

- [ ] **Step 2: More expressive entrances**

The current reveal is opacity plus a 20px rise. Same `IntersectionObserver` and same `.reveal` class family — this changes CSS only, not the mechanism. Append to `globals.css`:

```css
/* Cards scale up slightly as they arrive. */
.reveal .card { transform: scale(.96); transition: transform .62s cubic-bezier(.16,1,.3,1); }
.reveal.in .card { transform: scale(1); }

/* Section headings wipe in from the left. */
.reveal .h2 {
  clip-path: inset(0 100% 0 0);
  transition: clip-path .72s cubic-bezier(.16,1,.3,1);
}
.reveal.in .h2 { clip-path: inset(0 0 0 0); }

/* Body copy resolves out of a blur. */
.reveal p { filter: blur(6px); transition: filter .6s ease; }
.reveal.in p { filter: blur(0); }

@media (prefers-reduced-motion: reduce) {
  .reveal .card, .reveal.in .card { transform: none; transition: none; }
  .reveal .h2, .reveal.in .h2 { clip-path: none; transition: none; }
  .reveal p, .reveal.in p { filter: none; transition: none; }
}
```

Check the real "revealed" class name in `app/lib/reveal.ts` before writing these selectors — if it is not `.in`, use whatever it actually sets.

- [ ] **Step 3: A more alive graph**

In `render.ts`, apply the idle oscillation where `rr` is computed — ±3% on a 4s period, phase-offset per node so they do not pulse in unison:

```ts
    const osc = st.reduced
      ? 1
      : 1 + 0.03 * Math.sin((st.t / 4000) * Math.PI * 2 + n.phase * Math.PI * 2);
    const rr = n.r * osc * (mode === '3d' ? p.s * 0.9 : 1) * cam.zoom;
```

Add `t: number` and `reduced: boolean` to `RenderState` and pass them from `useGraph.ts` — `t` is the rAF timestamp the loop already receives, `reduced` is `window.matchMedia('(prefers-reduced-motion: reduce)').matches` read once on mount.

For the edges, animate the dash offset in the edge loop, low alpha so it does not distract:

```ts
    if (!st.reduced) {
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -(st.t / 90) % 12;
    }
```

and `ctx.setLineDash([])` immediately after the edge loop — a leaked dash pattern would dash the donut rings too.

Pulse the selected node's teal ring by multiplying its existing `globalAlpha` by `0.6 + 0.4 * Math.sin(st.t / 480)` when not reduced.

For the entrance, in `useGraph.ts`: on first reveal, store `t0` and for the first 700ms scale every node's rendered position toward the centre by an eased factor, so the nodes fly outward into their settled positions. Do this in the render state, **not** by mutating `n.x`/`n.y` — the simulation must not be perturbed.

- [ ] **Step 4: Parallax**

Create `app/lib/parallax.ts`:

```ts
'use client';

import { useEffect, useRef } from 'react';

/**
 * Translate a decorative layer at a fraction of scroll speed.
 *
 * Transform-only (GPU, no layout), rAF-throttled, and it never intercepts or
 * blocks scrolling — no pinning, no wheel handlers, no scroll-linked timelines.
 * Fully disabled under prefers-reduced-motion.
 */
export function useParallax(factor: number) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (el) el.style.transform = `translate3d(0, ${window.scrollY * factor}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [factor]);

  return ref;
}
```

In `app/page.tsx`, attach it to the **existing ambient blob layers only** — nothing that contains text or interactive content. Two layers at different factors (e.g. `0.08` and `0.16`) read as depth; more than that reads as drift.

Note in the commit body that parallax was rejected in v5 over motion-sickness risk and is included now because the user explicitly chose it, constrained as above.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

- Heatmap cells fade in and out in a slow travelling wave; darker cells stay darker — intensity is still readable.
- Section headings wipe in from the left, cards scale up, paragraphs resolve out of blur.
- Graph nodes breathe slightly and not in unison; edges show a slow flow; the selected node's ring pulses; on first scroll into the section the nodes fly out from the centre.
- Scrolling the page moves the background blobs slower than the content. **Scrolling itself feels completely normal** — no stickiness, no snapping, no lag.
- With OS "reduce motion" enabled: everything above is static, and the page still looks finished.

- [ ] **Step 7: Commit**

```bash
git add app/lib/parallax.ts app/components/sections/GitHub.tsx app/components/graph app/globals.css app/page.tsx
git commit -m "feat(anim): heatmap shimmer, expressive entrances, living graph, parallax layers"
```

---

# Phase B — Admin panel

Phase B may ship incrementally. Nothing in Phase A depends on it beyond the `featured` seed.

## Task 8: The admin UI kit and TUI shell

**Files:**
- Create: `app/admin/components/ui.tsx`
- Create: `app/admin/components/StatusLine.tsx`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `T` (tokens), `Panel`, `SectionHead`, `Field`, `Btn`, `Kbd`, `useDirty`. Every later Phase B task imports from here instead of re-declaring inline styles.

The admin currently uses `Space Mono` and purple-tinted cards (`rgba(5,0,10,0.97)`, `rgba(139,92,246,0.35)` borders) — a different visual language from the public site. Unify on the site's real tokens, then add the TUI layer: box-drawing rules and bracket labels instead of card shadows, editorial typography inside.

- [ ] **Step 1: Create the kit**

```tsx
'use client';

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';

/** The site's real tokens, from app/globals.css. Purple is accent only. */
export const T = {
  glass: 'rgba(21,21,29,.7)',
  surface: '#0d0d13',
  deep: '#090a0e',
  line: 'rgba(255,255,255,.08)',
  mut: 'rgba(255,255,255,.5)',
  dim: 'rgba(255,255,255,.4)',
  text: 'rgba(255,255,255,.92)',
  accent: '#8b5cf6',
  active: '#5eead4',
  green: '#22c55e',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  display: 'Sora, system-ui, sans-serif',
} as const;

/** A TUI panel: 1px rule and a bracket label, no shadow, no elevation. */
export function Panel({ label, children, style }: {
  label?: string; children: ReactNode; style?: CSSProperties;
}) {
  return (
    <section style={{
      border: `1px solid ${T.line}`, borderRadius: 12, background: T.glass,
      padding: '18px 20px 20px', position: 'relative', ...style,
    }}>
      {label && (
        <span style={{
          position: 'absolute', top: -9, left: 16, padding: '0 8px',
          background: T.surface, fontFamily: T.mono, fontSize: 10.5,
          letterSpacing: '.18em', textTransform: 'uppercase', color: T.mut,
        }}>
          [ {label} ]
        </span>
      )}
      {children}
    </section>
  );
}

/** Editorial heading inside TUI chrome: mono kicker, Sora 800 title. */
export function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.green }}>$ {kicker}</div>
      <h1 style={{
        fontFamily: T.display, fontWeight: 800, fontSize: 'clamp(26px,4vw,38px)',
        letterSpacing: '-.015em', margin: '6px 0 0', color: T.text,
      }}>
        {title}
      </h1>
    </header>
  );
}

export function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{
        display: 'block', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.16em',
        textTransform: 'uppercase', color: T.mut, marginBottom: 5,
      }}>
        {label}
      </span>
      <input
        {...rest}
        style={{
          width: '100%', padding: '8px 11px', background: T.deep,
          border: `1px solid ${T.line}`, borderRadius: 8, color: T.text,
          fontFamily: T.mono, fontSize: 12.5, outline: 'none', ...rest.style,
        }}
      />
    </label>
  );
}

export function Btn({ tone = 'ghost', children, ...rest }: {
  tone?: 'ghost' | 'accent' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const c = tone === 'accent' ? T.accent : tone === 'danger' ? '#f87171' : T.mut;
  return (
    <button
      type="button"
      {...rest}
      style={{
        padding: '7px 13px', background: 'transparent',
        border: `1px solid ${tone === 'ghost' ? T.line : c + '55'}`,
        borderRadius: 8, color: c, fontFamily: T.mono, fontSize: 11.5,
        letterSpacing: '.08em', cursor: 'pointer',
        transition: 'background .18s, color .18s, border-color .18s',
        ...rest.style,
      }}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      padding: '1px 5px', border: `1px solid ${T.line}`, borderRadius: 4,
      fontFamily: T.mono, fontSize: 10, color: T.mut,
    }}>
      {children}
    </kbd>
  );
}

/**
 * Panel-wide dirty/saved state. The statusline is the single source of truth
 * for "what state am I in", so it has to be shared rather than per-page.
 */
type Dirty = { dirty: boolean; setDirty: (d: boolean) => void };
const DirtyCtx = createContext<Dirty>({ dirty: false, setDirty: () => {} });

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return <DirtyCtx.Provider value={{ dirty, setDirty }}>{children}</DirtyCtx.Provider>;
}
export const useDirty = () => useContext(DirtyCtx);
```

- [ ] **Step 2: Create the statusline**

Persistent across the bottom: the section path, dirty/saved state, the active chart renderer, the command count, and the ⌘K hint.

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { T, Kbd, useDirty } from './ui';
import { usePrefs } from '../hooks/usePrefs';

export default function StatusLine({ commandCount }: { commandCount: number }) {
  const path = usePathname();
  const { dirty } = useDirty();
  const { renderer } = usePrefs();

  const cell: React.CSSProperties = {
    padding: '0 12px', borderRight: `1px solid ${T.line}`,
    display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 30, zIndex: 60,
      display: 'flex', alignItems: 'stretch', background: T.deep,
      borderTop: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 11,
      color: T.mut,
    }}>
      <span style={{ ...cell, color: T.active }}>~{path}</span>
      <span style={{ ...cell, color: dirty ? '#fbbf24' : T.active }}>
        {dirty ? 'SIN GUARDAR' : 'GUARDADO'}
      </span>
      <span style={cell}>renderer: {renderer}</span>
      <span style={{ flex: 1 }} />
      <span style={{ ...cell, borderRight: 'none' }}>
        {commandCount} cmds · <Kbd>⌘K</Kbd>
      </span>
    </footer>
  );
}
```

Task 10 creates `usePrefs`. If you are implementing this task first, stub `usePrefs` to return `{ renderer: 'dots' }` and Task 10 replaces the stub.

- [ ] **Step 3: Wire the shell**

In `app/admin/layout.tsx`, wrap the tree in `DirtyProvider`, mount `StatusLine`, and add `paddingBottom: 30` to the content container so the statusline never covers the last row.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

Any admin page shows the statusline pinned to the bottom with the current path, `GUARDADO`, and the ⌘K hint. Nothing is hidden behind it. The kit is not yet applied to page bodies — that happens per-task.

- [ ] **Step 6: Commit**

```bash
git add app/admin/components/ui.tsx app/admin/components/StatusLine.tsx app/admin/layout.tsx
git commit -m "feat(admin): shared UI kit on the site's real tokens plus a TUI statusline"
```

---

## Task 9: Chart renderers

**Files:**
- Create: `app/admin/components/charts/types.ts`
- Create: `app/admin/components/charts/DotsChart.tsx`
- Create: `app/admin/components/charts/BrailleChart.tsx`
- Create: `app/admin/components/charts/SvgChart.tsx`
- Create: `app/admin/components/charts/Chart.tsx`

**Interfaces:**
- Consumes: `T` from Task 8, `usePrefs` from Task 10 (stub it if Task 10 has not run).
- Produces: `<Chart series={number[]} rows={number} label?: string />` and `resample`. Tasks 10 and 15 both use `<Chart>`.

**Why dots and not braille, restated so it is not "improved" away:** JetBrains Mono has **no U+2800–U+28FF coverage**. Measured advances — `M` 9.600px vs `⣿` 12.055px — mean the browser substitutes a fallback face and the grid shears. Consolas and generic `monospace` fail identically; only Cascadia Code matched at 9.375/9.375. So: `dots` is the default, `braille` is opt-in with runtime detection, `svg` is the conventional escape hatch.

- [ ] **Step 1: Shared types and resampling**

```ts
export type Renderer = 'dots' | 'braille' | 'svg';

export interface ChartProps {
  /** Raw series, any length. The renderer resamples it to the column count. */
  series: number[];
  /** Vertical resolution in braille rows (each row is 4 dots tall). */
  rows?: number;
  label?: string;
}

/**
 * Fit `src` to exactly `n` values.
 *
 * Downsampling takes the MAX of each bucket, not the mean and not a slice: a
 * chart exists to show the spikes, and both of those hide them. Upsampling
 * interpolates linearly.
 */
export function resample(src: number[], n: number): number[] {
  if (n <= 0 || src.length === 0) return [];
  if (src.length === n) return [...src];

  if (src.length > n) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i * src.length) / n);
      const b = Math.max(a + 1, Math.floor(((i + 1) * src.length) / n));
      let m = -Infinity;
      for (let j = a; j < b && j < src.length; j++) m = Math.max(m, src[j]);
      out.push(m === -Infinity ? 0 : m);
    }
    return out;
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i * (src.length - 1)) / (n - 1);
    const lo = Math.floor(t), hi = Math.min(src.length - 1, lo + 1);
    out.push(src[lo] + (src[hi] - src[lo]) * (t - lo));
  }
  return out;
}
```

- [ ] **Step 2: The dots renderer — the default**

Canvas 2D, so the 2×4-per-cell braille look survives with no font dependency. DPR-aware and pixel-exact at any size.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { T } from '../ui';

const DOT = 2;      // dot diameter in CSS px
const PITCH_X = 4;  // horizontal dot spacing
const PITCH_Y = 4;  // vertical dot spacing

export default function DotsChart({ values, rows, animate }: {
  /** Already resampled to the column count, normalised to 0..1. */
  values: number[]; rows: number; animate: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const cols = values.length * 2;          // 2 dots wide per data column
    const dotRows = rows * 4;                // 4 dots tall per braille row
    const w = cols * PITCH_X, h = dotRows * PITCH_Y;
    const dpr = window.devicePixelRatio || 1;

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      // Columns appear left to right; the last one keeps pulsing to mark live data.
      const progress = animate ? Math.min(1, (now - t0) / 700) : 1;
      const shown = Math.ceil(values.length * progress);

      ctx.clearRect(0, 0, w, h);
      for (let c = 0; c < shown; c++) {
        const isLast = c === values.length - 1;
        const pulse = isLast && animate ? 0.65 + 0.35 * Math.sin(now / 340) : 1;
        const filled = Math.round(values[c] * dotRows);
        for (let d = 0; d < filled; d++) {
          const y = h - (d + 0.5) * PITCH_Y;
          const frac = d / Math.max(1, dotRows - 1);
          ctx.globalAlpha = (0.35 + frac * 0.65) * pulse;
          ctx.fillStyle = isLast ? T.active : T.accent;
          for (let sub = 0; sub < 2; sub++) {
            ctx.beginPath();
            ctx.arc((c * 2 + sub + 0.5) * PITCH_X, y, DOT / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (animate) raf = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [values, rows, animate]);

  return <canvas ref={ref} style={{ display: 'block' }} />;
}
```

- [ ] **Step 3: The braille renderer, with detection**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { T } from '../ui';

/**
 * True when the resolved font actually has U+2800-U+28FF.
 *
 * Measured by advance width: JetBrains Mono renders `M` at 9.600px and gets a
 * substituted 12.055px for the braille block, which shears the grid. Only a
 * covering font gives equal advances.
 *
 * Must run after document.fonts.ready — measuring earlier measures the
 * fallback face and always reports a mismatch.
 */
export async function brailleSupported(): Promise<boolean> {
  await document.fonts.ready;
  const span = document.createElement('span');
  span.style.cssText =
    `position:absolute;visibility:hidden;white-space:pre;font:12px ${T.mono}`;
  document.body.appendChild(span);
  const advance = (ch: string) => {
    span.textContent = ch.repeat(20);
    return span.getBoundingClientRect().width / 20;
  };
  const latin = advance('M');
  const braille = advance('⣿');
  span.remove();
  return Math.abs(latin - braille) < 0.05;
}

const BASE = 0x2800;
/** Dot bit positions within a 2x4 cell, [col][row]. */
const BITS = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]];

export default function BrailleChart({ values, rows }: { values: number[]; rows: number }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const dotRows = rows * 4;
    const grid: number[][] = Array.from({ length: rows }, () => Array(values.length).fill(0));
    values.forEach((v, c) => {
      const filled = Math.round(v * dotRows);
      for (let d = 0; d < filled; d++) {
        const fromTop = dotRows - 1 - d;
        const cell = Math.floor(fromTop / 4);
        const bitRow = fromTop % 4;
        grid[cell][c] |= BITS[0][bitRow] | BITS[1][bitRow];
      }
    });
    setLines(grid.map((row) => row.map((m) => String.fromCharCode(BASE + m)).join('')));
  }, [values, rows]);

  return (
    <pre style={{
      margin: 0, fontFamily: T.mono, fontSize: 12, lineHeight: '12px',
      letterSpacing: 0, color: T.accent,
    }}>
      {lines.join('\n')}
    </pre>
  );
}
```

- [ ] **Step 4: The SVG renderer**

An area chart in the accent colour with a soft gradient fill, `viewBox="0 0 100 100"` and `preserveAspectRatio="none"` so it stretches to whatever box it is given. Points come straight from `values`. Keep it under 40 lines — it is the conventional fallback, not the showpiece.

- [ ] **Step 5: The wrapper**

`Chart.tsx` owns measurement, resampling and dispatch, so the three renderers stay dumb.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { resample, type ChartProps } from './types';
import { usePrefs } from '../../hooks/usePrefs';
import DotsChart from './DotsChart';
import BrailleChart, { brailleSupported } from './BrailleChart';
import SvgChart from './SvgChart';
import { T } from '../ui';

const COL_PX = 8; // CSS px consumed per data column

export default function Chart({ series, rows = 6, label }: ChartProps) {
  const { renderer, notify } = usePrefs();
  const box = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(0);
  const [brailleOk, setBrailleOk] = useState<boolean | null>(null);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ResizeObserver, not window resize: the sidebar collapsing or a tab
  // switching changes the container without changing the window.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setCols(Math.max(8, Math.floor(e.contentRect.width / COL_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (renderer !== 'braille') return;
    let alive = true;
    brailleSupported().then((ok) => {
      if (!alive) return;
      setBrailleOk(ok);
      if (!ok) {
        notify('La fuente no tiene braille (U+2800). Usando puntos.');
      }
    });
    return () => { alive = false; };
  }, [renderer, notify]);

  const values = (() => {
    if (cols === 0) return [];
    const fitted = resample(series, cols);
    const max = Math.max(...fitted, 1);
    return fitted.map((v) => v / max);
  })();

  const active = renderer === 'braille' && brailleOk === false ? 'dots' : renderer;

  return (
    <div ref={box} style={{ width: '100%', overflow: 'hidden' }}>
      {label && (
        <div style={{
          fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.16em',
          textTransform: 'uppercase', color: T.mut, marginBottom: 8,
        }}>
          {label}
        </div>
      )}
      {values.length > 0 && (
        active === 'braille' ? <BrailleChart values={values} rows={rows} />
        : active === 'svg' ? <SvgChart values={values} rows={rows} />
        : <DotsChart values={values} rows={rows} animate={!reduced} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Manual verification**

Drop a `<Chart series={...} />` into any admin page temporarily, or wait for Task 15 which uses it for real. Check:

- At 1440px, 900px and 375px wide the chart **fills its container** — no horizontal overflow, no empty gutter on the right.
- Dragging the window narrower keeps the **peaks visible**. If a tall spike disappears as it narrows, `resample` is slicing rather than taking the max — that is a bug, not a tradeoff.
- The columns draw in left to right and the last one keeps pulsing.
- Switching renderer (Task 10) swaps them with no relayout.
- Selecting `braille` shows the fallback toast and renders dots, because JetBrains Mono has no braille coverage. **That is the correct behaviour** — do not "fix" it by removing the detection.

- [ ] **Step 8: Commit**

```bash
git add app/admin/components/charts
git commit -m "feat(admin): responsive chart renderers - canvas dots default, braille detected, svg fallback"
```

---

## Task 10: Preferences and the Configuración section

**Files:**
- Create: `app/admin/hooks/usePrefs.ts`
- Create: `app/api/admin/prefs/route.ts`
- Create: `app/api/admin/github/loc/refresh/route.ts`
- Create: `app/admin/config/page.tsx`
- Modify: `app/lib/content.ts`

**Interfaces:**
- Consumes: `Renderer` (Task 9), `refreshLoc` from `@/lib/loc` (Task 5), `Panel`/`Btn`/`SectionHead` (Task 8).
- Produces: `usePrefs() -> { renderer, setRenderer, notify }`. Tasks 8, 9 and 12 all consume it.

**The configuration section returns to the admin.** It was deleted earlier when the user asked to strip web-editing options, and that removal was correct — it held site content. It comes back holding **panel preferences**, which is where the renderer choice belongs.

- [ ] **Step 1: The `adminPrefs` content type**

Add to `app/lib/content.ts`, following the same pattern as `featured` in Task 1:

```ts
export interface AdminPrefs { renderer: 'dots' | 'braille' | 'svg'; }
export const DEFAULT_PREFS: AdminPrefs = { renderer: 'dots' };
```

Extend `ContentType` with `'adminPrefs'`, the `DEFAULTS` map and `isContentType`.

- [ ] **Step 2: The routes**

`app/api/admin/prefs/route.ts` — `GET` returns the prefs, `PUT` validates `renderer` against the three literals and rejects anything else with a 400, then `setContent`. **Both gated by the same auth check every other `/api/admin/*` route uses** — read one of them (e.g. `app/api/admin/users/route.ts`) and copy its guard exactly rather than inventing one.

`app/api/admin/github/loc/refresh/route.ts` — `POST`, same auth guard, calls `refreshLoc()` from `@/lib/loc` (Task 5) and returns the fresh payload. A cold pass takes 30–140 seconds, so this route is deliberately admin-only and deliberately never reachable from the public site.

- [ ] **Step 3: The hook**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Renderer } from '../components/charts/types';

let toastFn: ((m: string) => void) | null = null;
/** Set once by the layout's toast host, so any chart can raise a message. */
export function registerToast(fn: (m: string) => void) { toastFn = fn; }

export function usePrefs() {
  const [renderer, setR] = useState<Renderer>('dots');

  useEffect(() => {
    fetch('/api/admin/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.renderer) setR(d.renderer as Renderer); })
      .catch(() => { /* the default stands */ });
  }, []);

  const setRenderer = useCallback(async (r: Renderer) => {
    setR(r); // optimistic: the redraw should be instant
    await fetch('/api/admin/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renderer: r }),
    });
  }, []);

  const notify = useCallback((m: string) => { toastFn?.(m); }, []);

  return { renderer, setRenderer, notify };
}
```

Mount a small toast host in `app/admin/layout.tsx` that calls `registerToast` on mount — bottom-right, above the statusline, auto-dismissing after ~4s.

- [ ] **Step 4: The Configuración page**

Two blocks in `Panel`s:

**Renderer de gráficos.** Three options as radio rows, each with a **live inline `<Chart>` preview of the same short series** so the choice is made by looking rather than by reading. `dots` is labelled `recomendado`; `braille` is labelled `requiere fuente`. Selecting one calls `setRenderer`, which redraws every chart on the page immediately.

**Caché de líneas.** One `Btn tone="accent"` posting to the refresh route, with an inline spinner while it runs and the resulting `totalLines` and `source` shown on completion. Warn in the copy that it takes up to two minutes.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

- `/admin/config` exists and shows both blocks with three live previews.
- Picking a renderer changes the previews instantly and flips the statusline's `renderer:` cell.
- Reloading the page **keeps** the choice.
- Picking `braille` shows the toast and renders dots.
- The refresh button returns a real total after a wait, and the LOC card on the public site reflects it.
- Hitting `PUT /api/admin/prefs` while logged out is rejected.

- [ ] **Step 7: Commit**

```bash
git add app/admin/hooks app/api/admin/prefs app/api/admin/github app/admin/config app/lib/content.ts
git commit -m "feat(admin): restore a configuration section holding the chart renderer preference"
```

---

## Task 11: Sidebar with a sliding indicator

**Files:**
- Modify: `app/admin/components/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `T` from Task 8.
- Produces: nothing downstream.

Both sidebar and ⌘K, not either. The sidebar answers "what is in here"; ⌘K answers "get me there now".

- [ ] **Step 1: Retokenise**

Replace every `rgba(139,92,246,…)` border and `rgba(5,0,10,…)` surface with `T.line` and `T.glass`/`T.deep`. Purple survives only as the accent on the active icon. Replace `var(--font-body)` with `T.mono`. Keep the live-visitor block and the logout button — only their colours change.

- [ ] **Step 2: Rework the groups**

```ts
const GROUPS: NavGroup[] = [
  {
    title: 'Analytics',
    items: [
      { href: '/admin', label: 'Analytics', icon: '◈' },
      { href: '/admin/engagement', label: 'Engagement', icon: '⊙' },
    ]
  },
  {
    title: 'Contenido',
    items: [
      { href: '/admin/content/projects', label: 'Proyectos', icon: '◫' },
      { href: '/admin/content/socials', label: 'Redes', icon: '@' },
    ]
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/users', label: 'Users', icon: '◇' },
      { href: '/admin/audit', label: 'Audit', icon: '⊟' },
      { href: '/admin/config', label: 'Configuración', icon: '⚙' },
    ]
  }
]
```

Traffic, Live and Profiles are gone — Task 15 merges them. Replace the emoji icons (`🎭`, `👤`, `📋`) with monospace glyphs; emoji break the TUI's grid.

- [ ] **Step 3: The sliding indicator**

A single absolutely-positioned teal bar inside the nav, animating `top` and `height` over 340ms rather than cutting between entries. Give every nav `<Link>` a ref in an array, and in an effect keyed on `pathname` read the active link's `offsetTop`/`offsetHeight` and write them to the bar's style.

```tsx
  const [ind, setInd] = useState({ top: 0, height: 0, ready: false });

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el) return;
    setInd({ top: el.offsetTop, height: el.offsetHeight, ready: true });
  }, [pathname, activeIndex]);
```

```tsx
        <span aria-hidden style={{
          position: 'absolute', left: 0, width: 2,
          top: ind.top, height: ind.height,
          background: T.active, borderRadius: 2,
          boxShadow: `0 0 8px ${T.active}`,
          opacity: ind.ready ? 1 : 0,
          // No transition on the first paint, or the bar slides in from y=0.
          transition: ind.ready ? 'top .34s cubic-bezier(.16,1,.3,1), height .34s cubic-bezier(.16,1,.3,1)' : 'none',
        }} />
```

The nav container needs `position: relative`. Under `prefers-reduced-motion`, drop the transition — check the media query in JS since these are inline styles.

The active row keeps a subtle `background` tint but **loses its purple border** — the indicator now carries the active signal.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

Clicking between sections **slides** the teal bar rather than jumping it. On first load it appears already in place, not sliding down from the top. The mobile drawer still opens and closes. Nothing purple-bordered remains. With reduce-motion on, the bar jumps.

- [ ] **Step 6: Commit**

```bash
git add app/admin/components/AdminSidebar.tsx
git commit -m "feat(admin): retokenised sidebar with a sliding active indicator"
```

---

## Task 12: ⌘K that executes actions

**Files:**
- Create: `app/admin/components/AdminPalette.tsx`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: `usePrefs` (Task 10), `T` (Task 8), `GET /api/content/featured` (Task 1).
- Produces: a `flashRow(id)` helper other pages consume to highlight a mutated row.

**The palette executes, it does not only navigate.** This was explicit: actions without pressing buttons. The public site already has `app/components/CommandPalette.tsx` — **read it first and follow its keyboard handling and markup conventions.** This is the admin's sibling, not a fresh invention.

- [ ] **Step 1: The command model**

```ts
type Level = 'root' | 'repos' | 'renderers';

interface Cmd {
  group: 'Ir a' | 'Acciones';
  icon: string;
  title: string;
  /** Navigate here. */
  href?: string;
  /** Run this. */
  run?: () => void | Promise<void>;
  /** Push a second level to choose a target first. */
  push?: Level;
}
```

Root commands:

| Group | Title | Behaviour |
|---|---|---|
| Ir a | Analytics, Engagement, Proyectos, Redes, Users, Audit, Configuración | `href` |
| Acciones | `Editar proyecto…` | `push: 'repos'` |
| Acciones | `Marcar / desmarcar repo…` | `push: 'repos'` |
| Acciones | `Renderer de gráficos…` | `push: 'renderers'` |
| Acciones | `Guardar cambios` | dispatch a `admin:save` window event; the projects page listens |
| Acciones | `Refrescar caché de líneas` | `POST /api/admin/github/loc/refresh` |
| Acciones | `Nuevo usuario` | navigate to `/admin/users` with a `?new=1` query the page acts on |
| Acciones | `Exportar audit a CSV` | navigate to `/admin/audit` and dispatch `admin:export` |
| Acciones | `Cerrar sesión` | `DELETE /api/admin/auth` then replace to `/admin/login` |

The `repos` level lists the real `featured` entries fetched on palette open; the `renderers` level lists the three renderers and calls `setRenderer`.

- [ ] **Step 2: Behaviour**

- `⌘K` / `Ctrl+K` toggles. Bind on `keydown` with `preventDefault`, and **do not fire while an `<input>` or `<textarea>` has focus** unless the palette itself is open.
- `↑`/`↓` move, `↵` executes, `esc` **pops one level before it closes** — at `root`, `esc` closes.
- Filtering is case-insensitive substring match over `title`, applied within the current level.
- Results are grouped with a small mono group header. The statusline's command count comes from the root command list length.

- [ ] **Step 3: Navigate-and-flash**

Every action that mutates state must also **navigate to where the change is visible and flash the affected row in teal**. Without this, an action fired from a palette lands off-screen and the user has to go find the row to confirm it — which is slower than clicking the button, defeating the point.

```ts
/**
 * Mark a row so it flashes teal once the target page has mounted it.
 * sessionStorage rather than a query param: the flag must survive the
 * navigation but must not end up in a shareable URL.
 */
export function flashRow(id: string) {
  sessionStorage.setItem('admin:flash', id);
}
```

Consumers read and clear it on mount, add a `data-flash` attribute to the matching row for ~1.2s, and style it with a teal outline that fades. Wire `Marcar / desmarcar repo…` and `Editar proyecto…` to call `flashRow(repo)` before navigating to `/admin/content/projects`.

- [ ] **Step 4: Presentation**

Backdrop `rgba(4,4,8,.62)` with `backdrop-filter: blur(7px)`, panel on `T.glass` with a `T.line` border, radius 14, max-width 560, mono throughout, selected row tinted with a teal left edge. Mount in `app/admin/layout.tsx` and pass the root command count to `StatusLine`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

- `⌘K` (or `Ctrl+K`) opens the palette; the backdrop blurs in and the panel scales up.
- Two groups are visible: **Ir a** and **Acciones**.
- Typing `edit` surfaces `Editar proyecto…`; `↵` **drills into a list of the real featured repos**; picking one navigates to Proyectos and **flashes that row teal**.
- `Renderer de gráficos…` drills in and changing the renderer redraws charts immediately.
- `Refrescar caché de líneas` runs and reports back.
- `esc` from a second level goes **back**, not closed; `esc` at root closes.
- Typing in a page's text input does **not** trigger the palette.
- The statusline's command count matches the root list.

- [ ] **Step 7: Commit**

```bash
git add app/admin/components/AdminPalette.tsx app/admin/layout.tsx
git commit -m "feat(admin): command palette that executes actions with drill-down and flash confirmation"
```

---

## Task 13: The GitHub repo picker

**Files:**
- Create: `app/api/admin/github/repos/route.ts`
- Modify: `app/admin/content/projects/page.tsx`

**Interfaces:**
- Consumes: `FeaturedRepo` (Task 1), `Panel`/`Field`/`Btn` (Task 8), `flashRow` (Task 12).
- Produces: nothing downstream — this is the feature Phase A was waiting for.

- [ ] **Step 1: The repo list route**

`GET /api/admin/github/repos`, auth-gated with the same guard the other admin routes use. Fetches `/users/{GITHUB_USER}/repos?per_page=100&sort=updated`, filters out forks, and returns `{ name, fullName, description, language, stars, updatedAt }[]`. Use `process.env.GITHUB_USER || process.env.GITHUB_USERNAME || 's7lver2'` — the same resolution order as `app/api/github/route.ts`, so the two never disagree.

- [ ] **Step 2: The picker UI**

Replace the hand-editing of project fields in `app/admin/content/projects/page.tsx` with two panels:

**`[ repos disponibles ]`** — a search input filtering by name and language, then a scrollable checkbox list. Each row: checkbox, name, primary language chip in its `LANG_COLORS` colour, star count, relative last-updated. Checking a row appends to `featured`; unchecking removes it.

**`[ seleccionados ]`** — the ordered `featured` list. Each row exposes a `status` select (`done`/`beta`/`dev`), an optional name override, an optional description override, and drag handles. **Selection order defines graph seeding order.**

The v5 `repo` text input is now redundant — remove it.

Read `flashRow`'s sessionStorage key on mount and highlight the matching row for ~1.2s (Task 12 step 3).

Persist with `PUT /api/admin/content/featured` through the existing `[type]` route — it works for `featured` automatically now that `'featured'` is a `ContentType`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

- The repo list loads and search filters it.
- Checking a repo, saving, then reloading the public site adds that node to the graph (delete the graph cache first, or wait out the 6h TTL).
- The status dropdown persists across reload.
- Drag-reordering persists.
- Arriving here from ⌘K's `Marcar / desmarcar repo…` flashes the right row.
- Hitting the route logged out is rejected.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/github/repos app/admin/content/projects/page.tsx
git commit -m "feat(admin): GitHub repo picker driving the featured selection"
```

---

## Task 14: Editing experience

**Files:**
- Modify: `app/admin/content/projects/page.tsx`
- Modify: `app/admin/content/socials/page.tsx`

**Interfaces:**
- Consumes: `useDirty` (Task 8), `Btn` (Task 8).
- Produces: nothing downstream.

Four concrete gaps in the current panel.

- [ ] **Step 1: Save feedback**

`handleSave` currently swallows both success and failure — on a 500 the user cannot tell. Make it await the response, check `r.ok`, and set an explicit result state rendered next to the save button: teal `✓ guardado` or red `✕ no se pudo guardar` with the status text. Clear it after ~4s.

- [ ] **Step 2: Dirty state**

Call `setDirty(true)` from every field's `onChange` and `setDirty(false)` after a successful save, so the statusline (Task 8) reflects it. Add a `beforeunload` guard while dirty:

```ts
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
```

- [ ] **Step 3: Validation**

A malformed `repo` or an empty slug currently saves happily. Validate before submit and render inline field errors:

- `repo` must match `/^[\w.-]+\/[\w.-]+$/`.
- `status` must be one of the three literals.
- Socials: `url` must parse as a URL or be exactly `'#'` (several defaults use `'#'` deliberately).

Block submit while any error stands, and say which field is wrong.

- [ ] **Step 4: Reordering**

Drag-to-reorder on the selected list, using the native HTML5 drag events (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — **no new dependency**. Reorder the array on drop and mark dirty.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

- Saving shows a visible success; killing the dev server mid-save shows a visible failure.
- Editing a field flips the statusline to `SIN GUARDAR`; saving flips it back.
- Trying to close the tab while dirty prompts.
- A `repo` of `notavalidrepo` blocks submit with an inline message.
- Dragging a row reorders it, and the order survives save + reload.

- [ ] **Step 7: Commit**

```bash
git add app/admin/content
git commit -m "feat(admin): save feedback, dirty guard, validation and drag-reorder"
```

---

## Task 15: Consolidate Analytics

**Files:**
- Modify: `app/admin/page.tsx`
- Delete: `app/admin/traffic/page.tsx`, `app/admin/live/page.tsx`, `app/admin/profiles/page.tsx`
- Modify: `app/admin/content/socials/page.tsx`

**Interfaces:**
- Consumes: `<Chart>` (Task 9), `Panel`/`SectionHead` (Task 8).
- Produces: nothing downstream.

Audited by data source, not by opinion: Overview (271 lines), Traffic (242) and Live (152) are **665 lines across three pages reading one endpoint**, `/api/admin/stats`. Engagement, Users and Audit each have their own endpoint and stay.

- [ ] **Step 1: Merge into one tabbed page**

`app/admin/page.tsx` becomes the Analytics page: **one** fetch of `/api/admin/stats`, three tabs — Overview, Traffic, Live — sharing it. Tabs rather than stacked sections, because the three views show the same metrics at different granularities and stacking them would print the same numbers three times down one page.

Port each old page's content into a tab component in the same file (or a `tabs/` subfolder if the file exceeds ~300 lines). Replace their bar/spark visuals with `<Chart series={…} label="…" />` so all three get the responsive renderer. Keep every metric that exists today — this is a consolidation, not a cut.

The tab strip is TUI-style: mono labels in brackets with a teal underline on the active one, and the underline **slides** between tabs the same way the sidebar indicator does.

- [ ] **Step 2: Fold Profiles into Redes**

`app/admin/profiles/page.tsx` (131 lines) only manages social avatars via `/api/admin/settings` and `/api/admin/upload`. Move its avatar upload into `app/admin/content/socials/page.tsx` as an `[ avatares ]` panel, then delete the page. Both routes stay — only the UI moves.

- [ ] **Step 3: Delete and check for orphans**

```bash
git rm app/admin/traffic/page.tsx app/admin/live/page.tsx app/admin/profiles/page.tsx
```

Then grep for references to the deleted routes and fix any that remain:

```bash
grep -rn "admin/traffic\|admin/live\|admin/profiles" app
```

Expected after fixing: no matches.

- [ ] **Step 4: Typecheck and build**

```bash
npx tsc --noEmit
```

```bash
npm run build
```

The build must pass. **If it fails with an `<Html>` prerender error, delete `.next` and build again** — that error is a stale-cache artifact on Windows and has been confirmed spurious in this repo before.

- [ ] **Step 5: Manual verification**

- `/admin` shows one Analytics page with three working tabs and the underline slides between them.
- Every number that used to be on Traffic and Live is still there.
- The page makes **one** request to `/api/admin/stats`, not three (check the network panel).
- Engagement, Users and Audit still work.
- Avatar upload works from Redes.
- `/admin/traffic`, `/admin/live` and `/admin/profiles` 404, and nothing in the UI links to them.

- [ ] **Step 6: Commit**

```bash
git add -A app/admin
git commit -m "refactor(admin): one tabbed Analytics page replaces Overview, Traffic and Live"
```

---

## Task 16: Login background

**Files:**
- Modify: `app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `app/components/HeroBackground.tsx`.
- Produces: nothing downstream.

- [ ] **Step 1: Mount the hero's effect**

Import `HeroBackground` and render it as the login page's background layer, behind the form. **Use the existing component — do not reimplement the field function.** It already honours `prefers-reduced-motion`.

Wrap it so it sits behind the form and does not capture clicks:

```tsx
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        opacity: .45, pointerEvents: 'none',
      }}>
        <HeroBackground />
      </div>
```

and give the form container `position: relative; zIndex: 1`.

Check how `HeroBackground` sizes itself — if it measures a parent rather than the viewport, the fixed wrapper above gives it the viewport and nothing else is needed. If it hardcodes a hero-specific height, pass a size prop rather than forking the component.

Lower alpha than the hero: the login form has to stay the focus.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual verification**

The login page shows the same drifting ASCII flow field as the hero, dimmer, behind the form. The form is fully readable and every field and button still works — the background does not eat clicks. With reduce-motion on, the field is static.

- [ ] **Step 4: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat(admin): hero ASCII flow field as the login background"
```

---

## Task 17: Admin animations and polish

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/components/ui.tsx`
- Modify: the Analytics, Projects and Audit pages
- Create: `app/admin/admin.css` (or extend `globals.css` — match whichever the admin already uses)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing downstream.

The user reviewed an earlier mockup and said "me faltan animaciones". **Text animations specifically** — numbers and labels animate, not just containers. All eleven, all with a reduced-motion branch in this same commit.

| # | Animation | Where |
|---|---|---|
| 1 | Page enter: `blur(6px) scale(.985)` → sharp, 420ms | layout content wrapper, keyed on pathname |
| 2 | Sidebar indicator slide, 340ms | done in Task 11 — verify only |
| 3 | Panel stagger, 90ms cascade | `Panel` via `nth-child` transition-delay |
| 4 | Chart draw-in with a pulsing last column | done in Task 9 — verify only |
| 5 | Hero count-up from zero | reuse `app/lib/countup.ts` — **do not write a second implementation** |
| 6 | Scramble on secondary KPIs | reuse `app/components/ScrambleText.tsx` |
| 7 | Typewriter on the kicker and the statusline path | new, ~20 lines |
| 8 | Growing bars, staggered | CSS `width` transition with `nth-child` delay |
| 9 | Log-row stagger, 45ms | Audit page rows |
| 10 | Palette open: backdrop blur 0→7px, panel `scale(.965)`→1, row stagger | done in Task 12 — verify only |
| 11 | Teal row flash on a ⌘K-mutated row | done in Task 12 — verify only |

- [ ] **Step 1: Add a `▶ reanimar` control**

Bottom-right of the content area, next to the toast host. It bumps a `replayKey` in a context that every animated component includes in its React `key`, so remounting replays the entrances. This exists so the animations can be reviewed without a page reload — the user asked for it during mockup review.

- [ ] **Step 2: Wire 1, 3, 5, 6, 7, 8, 9**

Each of the seven remaining. Reuse `countup.ts` and `ScrambleText.tsx` rather than reimplementing. Gate all of them behind a single `useReducedMotion()` helper so there is one place the check lives.

- [ ] **Step 3: Skeletons and focus states**

Replace bare `loading…` text with a shimmer skeleton block matching the shape of what is loading. Give every interactive element a visible `:focus-visible` outline in teal — the palette makes keyboard navigation a first-class path, so focus has to be visible.

- [ ] **Step 4: Typecheck and build**

```bash
npx tsc --noEmit
```

```bash
npm run build
```

- [ ] **Step 5: Manual verification**

Walk every section. All eleven animations from the table are observable. `▶ reanimar` replays them. Then enable OS "reduce motion" and confirm **every one** is static and the panel still looks finished — not broken, not mid-transition.

- [ ] **Step 6: Commit**

```bash
git add -A app/admin
git commit -m "feat(admin): full animation inventory, skeletons and visible focus states"
```

---

## Final verification

Run through the spec's own list — §Verification items 1–14 in `docs/superpowers/specs/2026-07-26-portfolio-v6-design.md`. The ones most likely to have regressed by the end:

- **Chart responsiveness at 375px.** The single most fragile thing in Phase B. Resize to 375px and confirm no horizontal overflow anywhere in the admin.
- **Peaks survive downsampling.** Narrow the window slowly and watch a tall spike. If it vanishes, `resample` is slicing.
- **Reduced motion.** With it on, both the public site and the admin must be fully static and fully finished-looking.
- **Nothing purple-carded.** No admin surface should still use `rgba(5,0,10,…)` or a purple border.
- **No raw error strings.** Stop the dev server's network access and reload the public site: HTB shows its empty state, the LOC card either shows cached numbers or does not appear, the graph serves stale. No status code anywhere.
- **`npm run build` passes.** If it fails with an `<Html>` prerender error, delete `.next` and retry — that failure is a stale-cache artifact, confirmed spurious in this repo.

**Deployment note, easy to forget and it breaks production silently:** Vercel needs `GITHUB_USER=s7lver2`. If a stale `GITHUB_USERNAME=s7lver` is set there, every GitHub KPI reads zero and the graph is empty in production while working perfectly locally.
