# Portfolio v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Projects section with an Obsidian-style force-directed graph (2D + hand-rolled 3D sphere) that loads real GitHub READMEs, extend scroll animations across the whole site, fix the visible `Error: HTTP 503`, and clean up GitHub Activity and Security Skills.

**Architecture:** The graph is one `<canvas>` driven by three separated modules — `engine.ts` (physics + projection, pure functions, no DOM), `render.ts` (canvas drawing), `useGraph.ts` (React/browser wiring). Two new API routes supply data: one assembles the graph from GitHub's per-repo language breakdown, one proxies README markdown. The existing KV content layer is extended with a single new field, not replaced.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript, Upstash Redis (KV), Canvas 2D, IntersectionObserver. New deps: `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`.

**Source spec:** `docs/superpowers/specs/2026-07-26-portfolio-v5-design.md`

---

## Global Constraints

- **NO AUTOMATED TESTS.** The user explicitly requested manual verification only; the project has no test framework installed (`package.json` has no jest/vitest/playwright). Every task ends with manual browser verification steps, not a test suite. Do not add a test framework. Do not write `.test.ts` / `.spec.ts` files.
- **No new dependency for the 3D mode.** Perspective projection is `s = FOCAL / (FOCAL - z)` computed by hand. Do not add `three.js`, `d3-force`, `react-force-graph`, or any physics/3D library.
- **Design tokens come from `app/globals.css` verbatim.** Surfaces are neutral glass: `--glass: rgba(21,21,29,.7)`, `#0d0d13`, `#090a0e`. Borders are white at 8% (`--line: rgba(255,255,255,.08)`). Purple `#8b5cf6` is accent only. `.eyebrow` is green `#22c55e` and injects `$ ` via `::before` at 0.7 opacity — never hardcode the `$`. `.h2` is Sora weight 800, `letter-spacing: -0.015em`. `.seclabel` is 11px / `0.18em` / `border-radius: 999px` / `padding: 6px 14px`. Teal `#5eead4` marks active state.
- **`prefers-reduced-motion: reduce` disables every animation added by this plan**, including the graph simulation loop (nodes stay at settled positions, one static frame drawn) and every reveal, counter, and growing bar (final state rendered immediately).
- **Remote HTML is always sanitized.** `rehype-sanitize` is mandatory on the README pipeline, never optional or conditional.
- **No scroll hijacking.** No pinning, no parallax, no wheel-scrubbed timelines.
- **Reuse `LANG_COLORS`.** Extract it from `GitHub.tsx` to a shared module; never duplicate the map.
- **KV has no TTL primitive.** `kvGetJSON`/`kvSetJSON` in `app/lib/redis.ts` take no expiry, and `getRedis()` throws when Upstash is unconfigured (which is the case in local dev). Cache freshness must be implemented as a stored `fetchedAt` timestamp checked in code, so it works identically against Redis and the local-JSON fallback.
- Existing Spanish UI copy stays Spanish; existing English copy stays English. Change no user-facing wording except where a section's text is removed outright.
- Commit after every task. Never commit a broken build — run `npm run build` before any commit that touches more than one file.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `app/lib/lang-colors.ts` | Shared `LANG_COLORS` map + `colorFor()`. Single source of truth for language colours. |
| `app/lib/graph-types.ts` | Wire types shared between the API route and the client. No logic. |
| `app/lib/countup.ts` | `useCountUp` hook — viewport-triggered number animation. |
| `app/components/graph/engine.ts` | Physics simulation, perspective projection, fit-view solver. Pure functions, no React, no DOM. |
| `app/components/graph/render.ts` | Canvas drawing: glyph nodes, edges, depth cueing, labels. |
| `app/components/graph/useGraph.ts` | Hook wiring engine + renderer to a canvas: rAF loop, pointer events, camera, tweening. |
| `app/components/graph/Readme.tsx` | `react-markdown` pipeline, sanitize schema, relative-URL rewriting. |
| `app/components/sections/ProjectsGraph.tsx` | Section shell: chrome, mode buttons, statusline, README overlay, data fetching. |
| `app/api/projects/graph/route.ts` | Assembles graph payload from projects + per-repo languages, with staleness-checked cache. |
| `app/api/projects/[slug]/readme/route.ts` | Proxies README markdown from raw.githubusercontent. |

**Modify:** `app/components/HeroBackground.tsx`, `app/components/sections/Skills.tsx`, `app/components/sections/GitHub.tsx`, `app/components/sections/HTB.tsx`, `app/components/sections/Languages.tsx`, `app/components/sections/Social.tsx`, `app/api/htb/route.ts`, `app/api/github/route.ts`, `app/lib/reveal.ts`, `app/lib/content-constants.ts`, `app/admin/content/projects/page.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example`

**Delete:** `app/components/sections/Projects.tsx`

The three-way split of the graph is deliberate: `engine.ts` holds the maths worth reasoning about in isolation and is the only file whose numbers get tuned; `render.ts` holds drawing; the hook holds React and browser wiring. Keeping them apart is what makes the physics parameters tunable without touching event handling.

---

## Task Order Rationale

Tasks 1–2 are the quick, independent wins (the visible bug, and the hero) — they ship value immediately and cannot conflict with anything else. Tasks 3–5 build the data layer the graph consumes. Tasks 6–11 build the graph incrementally, each leaving something visible on screen. Tasks 12–13 are the cross-cutting animation work, done after the new section exists so it gets animated too. Task 14 is the isolated cleanup.

---

## Task 1: Fix the visible `Error: HTTP 503`

**Files:**
- Modify: `app/api/htb/route.ts:25-27`
- Modify: `app/components/sections/HTB.tsx:36-61`
- Modify: `app/api/github/route.ts:3`
- Modify: `.env.example`

**Interfaces:**
- Produces: `GET /api/htb` now always returns HTTP 200 on missing configuration, with body `{ profile: null, progress: null, configured: false }`. On success it returns `{ profile, progress, configured: true }`. Genuine upstream failures still return 500.

**Context:** `app/api/htb/route.ts:26` returns status 503 with `{ error: 'missing_env' }` when `HTB_API_TOKEN` or `HTB_USER_ID` is absent. Neither is in `.env.local`, and neither is documented in `.env.example` — they appear only in a comment at the top of the route file, which is why they were never set. `HTB.tsx:45` converts any non-ok response into `throw new Error(\`HTTP ${r.status}\`)` and line 60 renders it raw as `Error: HTTP 503`. No external service is contacted; HackTheBox is not involved. The sibling route `app/api/htb/machines/route.ts:25` already handles the same missing configuration gracefully, which is why only this one broke visibly.

- [ ] **Step 1: Make the route degrade instead of erroring**

In `app/api/htb/route.ts`, replace lines 25–27:

```ts
  if (!token || !userId) {
    return NextResponse.json({ error: 'missing_env' }, { status: 503 });
  }
```

with:

```ts
  // Not configured is not an error — mirror app/api/htb/machines/route.ts and
  // let the client render an empty state instead of a status code.
  if (!token || !userId) {
    return NextResponse.json(
      { profile: null, progress: null, configured: false },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }
```

- [ ] **Step 2: Mark the success response as configured**

In the same file, change the success return (currently lines 75–78) from:

```ts
    return NextResponse.json(
      { profile, progress },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
```

to:

```ts
    return NextResponse.json(
      { profile, progress, configured: true },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
```

- [ ] **Step 3: Stop the component turning status codes into user-facing text**

In `app/components/sections/HTB.tsx`, replace the `HTBResponse` type and the whole `useEffect` + guard block (lines 28–61) with:

```tsx
type HTBResponse = {
  profile: HTBProfile | null;
  progress: {
    machine_difficulties: DiffStat[];
    machine_os: OSStat[];
  } | null;
  configured?: boolean;
};

export default function HTB() {
  const [profile, setProfile] = useState<HTBProfile | null>(null);
  const [progress, setProgress] = useState<{ machine_difficulties: DiffStat[]; machine_os: OSStat[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/htb')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HTBResponse | null) => {
        if (data?.profile && data?.progress) {
          setProfile(data.profile);
          setProgress(data.progress);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="htb" className="sec">
        <div className="wrap">
          <span className="seclabel">HackTheBox</span>
          <p className="mono" style={{ color: 'var(--dim)', marginTop: 12 }}>Loading…</p>
        </div>
      </section>
    );
  }

  // Not configured, or upstream unavailable: render nothing rather than an error.
  if (!profile || !progress) return null;
```

Note what changed and why: the `error` state is gone entirely (it only ever held a status code), the non-ok branch no longer throws, and the not-configured case returns `null` so the section disappears instead of printing `No data`.

- [ ] **Step 4: Fix the GitHub env var name mismatch**

`.env.local` defines `GITHUB_USERNAME` but `app/api/github/route.ts:3` reads `GITHUB_USER`. It works today only because of the `|| 's7lver2'` fallback. Read both so either name works, and keep the fallback:

```ts
const GH_USER = process.env.GITHUB_USER || process.env.GITHUB_USERNAME || 's7lver2';
```

Update every reference to the old constant in that file to `GH_USER`.

- [ ] **Step 5: Document the undocumented variables**

Append to `.env.example`:

```
# HackTheBox stats (optional; without these the HTB section is hidden)
HTB_USER_ID=
HTB_API_TOKEN=
# GitHub profile to scrape for activity (optional; defaults to s7lver2)
GITHUB_USER=s7lver2
```

- [ ] **Step 6: Verify manually**

Confirm `HTB_API_TOKEN` and `HTB_USER_ID` are **not** set in `.env.local`, then start the dev server and open the site.

Expected:
- The HTB section is absent from the page (not an error, not "No data").
- `Error: HTTP 503` appears nowhere on the page.
- Browser console has no unhandled rejection from `/api/htb`.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/api/htb` prints `200`.
- The GitHub Activity section still renders its KPIs.

- [ ] **Step 7: Commit**

```bash
git add app/api/htb/route.ts app/components/sections/HTB.tsx app/api/github/route.ts .env.example
git commit -m "fix: HTB section degrades gracefully instead of rendering HTTP 503"
```

---

## Task 2: Hero — remove the orb layer

**Files:**
- Modify: `app/components/HeroBackground.tsx`
- Modify: `app/globals.css` (`.bgGlow`, `.orb`, `.orb1`, `.orb2`, `@keyframes orbDrift1`, `@keyframes orbDrift2`, `#wave`, and the `prefers-reduced-motion` block)

**Interfaces:**
- Produces: `HeroBackground` renders exactly one animated layer (the ASCII canvas) plus `.veil`.

**Context:** The hero currently crossfades two layers every 8 seconds: `bgGlow` (two blurred `.orb` divs) and `#wave` (the ASCII flow-field canvas). Only the ASCII canvas survives.

- [ ] **Step 1: Strip the crossfade from the component**

Replace the entire contents of `app/components/HeroBackground.tsx` with:

```tsx
'use client';

import { useRef, useEffect, useState } from 'react';

const GLYPHS = [' ', ' ', '.', '·', ':', '-', '=', '+', '/', '\\', '|', '*', '#'];
const CELL = 12;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const animFrameRef = useRef<number>();
  const timeRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const field = (x: number, y: number, t: number): number =>
    Math.sin(x * 0.16 + t * 0.55) +
    Math.sin(y * 0.21 - t * 0.4) +
    Math.sin((x + y) * 0.085 + t * 0.32) +
    Math.sin((x - y) * 0.11 - t * 0.48);

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = field(i * 0.5, j * 0.5, timeRef.current);
        const n = (v + 4) / 8;
        if (n < 0.34) continue;

        const gi = Math.min(GLYPHS.length - 1, Math.floor(n * GLYPHS.length));
        const ch = GLYPHS[gi];
        if (ch === ' ') continue;

        const a = 0.16 + n * 0.5;
        ctx.fillStyle = `rgba(245, 245, 250, ${a.toFixed(3)})`;
        ctx.fillText(ch, i * CELL, j * CELL);
      }
    }

    timeRef.current += 0.016;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const hero = document.querySelector('.hero') as HTMLElement | null;

    const doResize = () => {
      if (!hero) return;
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const monoFont =
        getComputedStyle(document.body).getPropertyValue('--mono') ||
        "'JetBrains Mono', monospace";
      ctx.font = `12px ${monoFont}`;
      ctx.textBaseline = 'top';
    };

    doResize();

    // Reduced motion: draw one static frame and stop.
    if (prefersReducedMotion()) {
      setIsAnimating(false);
      draw(ctx, canvas);
      const onResizeStatic = () => { doResize(); draw(ctx, canvas); };
      window.addEventListener('resize', onResizeStatic);
      return () => window.removeEventListener('resize', onResizeStatic);
    }

    let alive = true;
    const animate = () => {
      if (!alive) return;
      if (isAnimating) draw(ctx, canvas);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsAnimating(e.isIntersecting)),
      { threshold: 0 }
    );
    if (hero) observerRef.current.observe(hero);

    const handleResize = () => doResize();
    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      alive = false;
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [isAnimating]);

  return (
    <>
      <canvas className="bg" id="wave" ref={canvasRef}></canvas>
      <div className="veil"></div>
    </>
  );
}
```

Removed: `showWave` state, `glowRef`, the 8-second `setInterval`, the effect that wrote `style.opacity` on both layers, and the `<div className="bg bgGlow">` with its two `.orb` children. The reduced-motion path now draws one static frame instead of leaving the canvas blank.

- [ ] **Step 2: Fix the `#wave` opacity — this is the step that silently breaks the hero**

In `app/globals.css`, `#wave` is declared:

```css
  #wave {
    display: block;
    opacity: 0;
  }
```

The `0` was there because the crossfade JS raised it. With that JS gone, the hero renders **black** unless this becomes:

```css
  #wave {
    display: block;
    opacity: 1;
  }
```

- [ ] **Step 3: Delete the orb CSS**

From `app/globals.css`, delete the `.bgGlow` rule, the `.orb` rule, the `.orb1` and `.orb2` rules, `@keyframes orbDrift1`, `@keyframes orbDrift2`, and the `.orb { animation: none; }` line inside the `@media (prefers-reduced-motion: reduce)` block (leave the rest of that block, including `.scrolldown .mouse::before { animation: none; }`, intact).

Keep `.bg` — the canvas still uses it.

- [ ] **Step 4: Verify manually**

Start the dev server and open the site.

Expected:
- The hero shows the animated ASCII glyph field immediately on load, not a black rectangle.
- Watch for 20 seconds: the background never crossfades to blurred purple blobs. There is exactly one background treatment.
- No blurred orbs anywhere in the hero.
- Scroll down past the hero and back up: the animation resumes (the IntersectionObserver pause still works).
- Resize the window: the glyph field re-fits without stretching.
- Enable OS-level reduce-motion, reload: the glyph field is visible but frozen — not blank.
- `grep -n "orb" app/globals.css` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add app/components/HeroBackground.tsx app/globals.css
git commit -m "feat(hero): drop the orb layer and 8s crossfade, keep only the ASCII field"
```

---

## Task 3: Shared language colours, `repo` field, admin input

**Files:**
- Create: `app/lib/lang-colors.ts`
- Create: `app/lib/graph-types.ts`
- Modify: `app/lib/content-constants.ts`
- Modify: `app/components/sections/GitHub.tsx` (import the shared map instead of its local copy)
- Modify: `app/admin/content/projects/page.tsx`

**Interfaces:**
- Produces: `LANG_COLORS: Record<string, string>`, `colorFor(name: string): string` from `@/lib/lang-colors`.
- Produces: `GraphPayload`, `GraphNodeWire`, `GraphLinkWire` from `@/lib/graph-types`.
- Produces: `ProjectC` gains `repo?: string` in `"owner/name"` format.

**Context:** `GitHub.tsx:17-27` owns a private `LANG_COLORS` map and `colorFor` helper. The graph needs the same colours. Only two of the four default projects have `web` pointing at GitHub — `CodeDotJS` points at Vercel and `tsuki` has no `web` at all — so the repo cannot be inferred from `web` and needs an explicit field.

- [ ] **Step 1: Create the shared colour module**

Create `app/lib/lang-colors.ts`:

```ts
// Single source of truth for language colours. Imported by both the GitHub
// Activity section and the projects graph — do not duplicate this map.
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Go: '#00add8',
  Python: '#3572A5',
  C: '#6b6b78',
  'C++': '#f34b7d',
  Shell: '#89e051',
  Makefile: '#427819',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Nix: '#7e7eff',
  Dockerfile: '#384d54',
  Lua: '#000080',
  Vim: '#199f4b',
  'Vim Script': '#199f4b',
  Assembly: '#6E4C13',
};

export const FALLBACK_LANG_COLOR = '#a371f7';

export function colorFor(name: string): string {
  return LANG_COLORS[name] || FALLBACK_LANG_COLOR;
}
```

Note `C` is `#6b6b78` rather than the `#555555` currently in `GitHub.tsx` — pure dark grey is nearly invisible as a graph node on the `#090a0e` canvas.

- [ ] **Step 2: Point GitHub.tsx at the shared module**

In `app/components/sections/GitHub.tsx`, delete the local `LANG_COLORS` object and the local `colorFor` arrow function (lines 17–27) and add at the top of the imports:

```tsx
import { colorFor } from '@/lib/lang-colors';
```

Leave `HEAT_COLORS` where it is — it is heatmap-specific and not shared.

- [ ] **Step 3: Create the wire types**

Create `app/lib/graph-types.ts`:

```ts
// Wire format for GET /api/projects/graph. Shared between the route and the
// client so both sides agree on the shape. No logic lives here.
export type GraphNodeKind = 'project' | 'language';

export interface GraphNodeWire {
  id: string;
  kind: GraphNodeKind;
  color: string;
  /** Number of edges touching this node. Drives node radius. */
  degree: number;
  // Project-only fields:
  slug?: string;
  repo?: string | null;
  desc?: string;
  status?: 'done' | 'beta' | 'dev';
  /** Language name -> percentage of the repo, rounded. Projects only. */
  langs?: Record<string, number>;
}

export interface GraphLinkWire {
  source: string;
  target: string;
  /** Percentage of the project's bytes written in this language, rounded. */
  weight: number;
}

export interface GraphPayload {
  nodes: GraphNodeWire[];
  links: GraphLinkWire[];
  /** Unix ms when the upstream language data was fetched. */
  fetchedAt: number;
  /** True when language data came from cache because upstream failed. */
  stale?: boolean;
}
```

- [ ] **Step 4: Add `repo` to the project type and defaults**

In `app/lib/content-constants.ts`, change the `ProjectC` interface:

```ts
export interface ProjectC {
  slug: string; name: string; desc: string;
  status: 'done' | 'beta' | 'dev'; ac: string;
  tags: string[]; web?: string; shot?: string;
  /** GitHub repo as "owner/name". Required for README + language edges. */
  repo?: string;
}
```

Then add `repo` to the three defaults that have a GitHub repository, leaving `tsuki` without one so the no-repo fallback path stays exercised by real data:

```ts
export const DEFAULT_PROJECTS: ProjectC[] = [
  { slug: 'file-meet', name: 'file-meet', desc: 'P2P file sharing CLI in Go. Zero config, end-to-end encrypted transfers.', status: 'done', ac: '#00add8', tags: ['Go', 'WebRTC', 'CLI'], web: 'https://github.com/s7lver2/file-meet', shot: '/projects/file-meet.png', repo: 's7lver2/file-meet' },
  { slug: 'ZephyrOS', name: 'ZephyrOS', desc: 'Minimal security-focused Linux distro for old systems and edge computing.', status: 'beta', ac: '#a3e635', tags: ['Linux', 'Bash', 'Arch'], web: 'https://github.com/s7lver2/ZephyrOS', shot: '/projects/ZephyrOS.png', repo: 's7lver2/ZephyrOS' },
  { slug: 'tsuki', name: 'tsuki', desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.', status: 'dev', ac: '#dea584', tags: ['Rust', 'LLVM', 'Embedded'] },
  { slug: 'CodeDotJS', name: 'CodeDotJS', desc: 'Reactive JS framework, no vDOM, <5kb.', status: 'dev', ac: '#3178c6', tags: ['TypeScript', 'Vite'], web: 'https://CodeDotjs.vercel.app', shot: '/projects/CodeDotJS.png', repo: 's7lver2/CodeDotJS' },
];
```

- [ ] **Step 5: Add the admin input**

In `app/admin/content/projects/page.tsx`, insert this block immediately after the existing `web` field's wrapping `<div>` (the one ending around line 201). It mirrors that field's exact markup, style objects and change handler:

```tsx
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  repo (owner/name)
                </div>
                <input
                  type="text"
                  value={proj.repo ?? ''}
                  onChange={e => handleChange(idx, 'repo', e.target.value)}
                  placeholder="s7lver2/mi-proyecto"
                  style={{ width: '100%', ...Input }}
                />
              </div>
```

If `handleChange` is typed against a union of `ProjectC` keys, `'repo'` is now a valid member because Step 4 added it to the interface — no signature change is needed. If it is typed more narrowly with an explicit key list, add `'repo'` to that list.

- [ ] **Step 6: Verify manually**

```bash
npm run build
```
Expected: compiles with no TypeScript errors.

Then start the dev server:
- Open the site. The GitHub Activity language legend still shows colours (proves `colorFor` still resolves after the extraction).
- Open `/admin/content/projects`, log in. Each project row has a `repo (owner/name)` field. The three with repos show their values; `tsuki` is empty.
- Type a value into `tsuki`'s repo field, save, reload the page. The value persisted.
- Clear it again and save, so `tsuki` stays the no-repo case for later tasks.

- [ ] **Step 7: Commit**

```bash
git add app/lib/lang-colors.ts app/lib/graph-types.ts app/lib/content-constants.ts app/components/sections/GitHub.tsx app/admin/content/projects/page.tsx
git commit -m "feat(data): shared language colours, repo field on projects, admin input"
```

---

## Task 4: `GET /api/projects/graph`

**Files:**
- Create: `app/api/projects/graph/route.ts`

**Interfaces:**
- Consumes: `GraphPayload`, `GraphNodeWire`, `GraphLinkWire` from `@/lib/graph-types`; `colorFor` from `@/lib/lang-colors`; `kvGetJSON`, `kvSetJSON` from `@/lib/redis`; `DEFAULT_PROJECTS`, `ProjectC` from `@/lib/content-constants`.
- Produces: `GET /api/projects/graph` returning `GraphPayload` with HTTP 200 in all cases.

**Context:** This route makes one `GET /repos/{owner}/{repo}/languages` call per project that has a `repo`. Unauthenticated GitHub API is limited to 60 requests/hour **per IP**, and Vercel's egress IPs are shared — so without caching this route fails under any real traffic. Caching here is a correctness requirement, not an optimisation.

`app/lib/redis.ts` exposes `kvGetJSON<T>(key, file, def)` and `kvSetJSON<T>(key, file, value)` with **no TTL parameter**, and `getRedis()` **throws** when Upstash is unconfigured — which is the case in local development. So freshness is implemented by storing a `fetchedAt` timestamp inside the cached value and comparing it in code. This works identically against Redis and against the local-JSON fallback.

- [ ] **Step 1: Write the route**

Create `app/api/projects/graph/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { kvGetJSON, kvSetJSON } from '@/lib/redis';
import { getContent, type ProjectC } from '@/lib/content';
import { colorFor } from '@/lib/lang-colors';
import type { GraphPayload, GraphNodeWire, GraphLinkWire } from '@/lib/graph-types';

const CACHE_KEY = 'projects:graph';
const CACHE_FILE = 'projects-graph.json';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — see the rate-limit note above.

/** Fetch the language byte counts for one repo. Returns null on any failure. */
async function fetchLanguages(repo: string): Promise<Record<string, number> | null> {
  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    // A token is optional but raises the rate limit from 60/h to 5000/h.
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}/languages`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const raw = (await r.json()) as Record<string, number>;
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

/** Bytes per language -> rounded percentages that sum to ~100. */
function toPercentages(bytes: Record<string, number>): Record<string, number> {
  const total = Object.values(bytes).reduce((s, v) => s + v, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [name, v] of Object.entries(bytes)) {
    const pct = Math.round((v / total) * 100);
    if (pct >= 1) out[name] = pct;
  }
  return out;
}

async function buildPayload(projects: ProjectC[]): Promise<GraphPayload> {
  const nodes: GraphNodeWire[] = [];
  const links: GraphLinkWire[] = [];
  const degree: Record<string, number> = {};
  const languageNodes = new Set<string>();

  const langsBySlug: Record<string, Record<string, number>> = {};

  // Sequential rather than Promise.all: four repos is not worth burning four
  // concurrent rate-limit slots, and a partial failure is easier to reason about.
  for (const p of projects) {
    if (!p.repo) continue;
    const bytes = await fetchLanguages(p.repo);
    if (bytes) langsBySlug[p.slug] = toPercentages(bytes);
  }

  for (const p of projects) {
    const langs = langsBySlug[p.slug] || {};
    nodes.push({
      id: p.slug,
      kind: 'project',
      color: p.ac,
      degree: 0,
      slug: p.slug,
      repo: p.repo ?? null,
      desc: p.desc,
      status: p.status,
      langs,
    });
    for (const [lang, pct] of Object.entries(langs)) {
      languageNodes.add(lang);
      links.push({ source: p.slug, target: lang, weight: pct });
      degree[p.slug] = (degree[p.slug] || 0) + 1;
      degree[lang] = (degree[lang] || 0) + 1;
    }
  }

  for (const lang of languageNodes) {
    nodes.push({ id: lang, kind: 'language', color: colorFor(lang), degree: 0 });
  }

  for (const n of nodes) n.degree = degree[n.id] || 0;

  return { nodes, links, fetchedAt: Date.now() };
}

export async function GET() {
  // getContent owns the `content:projects` / `content-projects.json` key pair —
  // do not re-derive those strings here, they would drift.
  const projects = await getContent<ProjectC[]>('projects');
  const cached = await kvGetJSON<GraphPayload | null>(CACHE_KEY, CACHE_FILE, null);

  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  const built = await buildPayload(projects);

  // If every language fetch failed but we have a previous payload, that payload
  // is strictly better than an edgeless graph — serve it and mark it stale.
  const gotAnyLanguages = built.links.length > 0;
  if (!gotAnyLanguages && cached && cached.links.length > 0) {
    return NextResponse.json(
      { ...cached, stale: true },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  await kvSetJSON(CACHE_KEY, CACHE_FILE, built);
  return NextResponse.json(built, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
```

Note: a project with no `repo`, or whose language fetch failed, still appears as a node — it simply has no language edges. `tsuki` is that case.

- [ ] **Step 2: Verify manually**

Start the dev server, then:

```bash
curl -s http://localhost:<port>/api/projects/graph | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('nodes',j.nodes.length,'links',j.links.length);console.log('projects',j.nodes.filter(n=>n.kind==='project').map(n=>n.id).join(','));console.log('languages',j.nodes.filter(n=>n.kind==='language').map(n=>n.id).join(','));const shared=j.nodes.filter(n=>n.kind==='language'&&n.degree>1).map(n=>n.id);console.log('shared languages',shared.join(',')||'NONE');})"
```

Expected:
- HTTP 200, four project nodes (`file-meet`, `ZephyrOS`, `tsuki`, `CodeDotJS`).
- Several language nodes.
- **At least one language with `degree > 1`** — this is the whole point of the design. If `shared languages` prints `NONE`, the graph will have no project-to-project connectivity; investigate before moving on (most likely cause: language fetches all failed, check for a rate-limit response).
- `tsuki` appears with `repo: null` and `langs: {}`.

Run the same curl a second time and confirm it returns instantly and `fetchedAt` is unchanged — proving the cache is being read.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/graph/route.ts
git commit -m "feat(api): projects graph endpoint with staleness-checked KV cache"
```

---

## Task 5: `GET /api/projects/[slug]/readme`

**Files:**
- Create: `app/api/projects/[slug]/readme/route.ts`

**Interfaces:**
- Produces: `GET /api/projects/{slug}/readme` returning, always with HTTP 200, either `{ ok: true, markdown: string, repo: string }` or `{ ok: false, reason: 'no_repo' | 'not_found' | 'fetch_failed' }`.

**Context:** Fetching server-side rather than from the browser keeps caching in one place and avoids depending on raw.githubusercontent's CORS headers. `raw.githubusercontent.com` is used instead of the REST API because raw does not consume the 60-requests/hour unauthenticated limit. The route never returns a non-200 status — the client renders a fallback, never an error string. This is the same principle applied in Task 1.

- [ ] **Step 1: Write the route**

Create `app/api/projects/[slug]/readme/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getContent, type ProjectC } from '@/lib/content';

// README filenames GitHub itself recognises, in the order it resolves them.
const CANDIDATES = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README.markdown'];

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const projects = await getContent<ProjectC[]>('projects');
  const project = projects.find((p) => p.slug === params.slug);

  if (!project?.repo) {
    return NextResponse.json(
      { ok: false, reason: 'no_repo' as const },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  for (const name of CANDIDATES) {
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/${project.repo}/HEAD/${name}`,
        { headers: { 'User-Agent': 's7lver-portfolio' }, next: { revalidate: 1800 } }
      );
      if (!r.ok) continue;
      const markdown = await r.text();
      if (!markdown.trim()) continue;
      return NextResponse.json(
        { ok: true as const, markdown, repo: project.repo },
        { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' } }
      );
    } catch {
      return NextResponse.json(
        { ok: false, reason: 'fetch_failed' as const },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } }
      );
    }
  }

  return NextResponse.json(
    { ok: false, reason: 'not_found' as const },
    { headers: { 'Cache-Control': 'public, s-maxage=600' } }
  );
}
```

- [ ] **Step 2: Verify manually**

With the dev server running:

```bash
curl -s http://localhost:<port>/api/projects/file-meet/readme | head -c 400
curl -s http://localhost:<port>/api/projects/tsuki/readme
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:<port>/api/projects/does-not-exist/readme
```

Expected:
- `file-meet` returns `{"ok":true,"markdown":"...","repo":"s7lver2/file-meet"}` with real markdown content. (If that repo has no README, `{"ok":false,"reason":"not_found"}` is also a correct result — note which and move on.)
- `tsuki` returns `{"ok":false,"reason":"no_repo"}`.
- The nonexistent slug returns status `200` (not 404) with `{"ok":false,"reason":"no_repo"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/\[slug\]/readme/route.ts
git commit -m "feat(api): README proxy for project repos"
```

---

## Task 6: Graph engine, renderer, and a visible 2D graph

**Files:**
- Create: `app/components/graph/engine.ts`
- Create: `app/components/graph/render.ts`
- Create: `app/components/graph/useGraph.ts`
- Create: `app/components/sections/ProjectsGraph.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GraphPayload` from `@/lib/graph-types`; `GET /api/projects/graph`.
- Produces, from `engine.ts`: types `Mode`, `GraphNode`, `GraphLink`, `Camera`, `Projected`, `Graph`; constants `FOCAL`, `SPHERE_R`, `ZOOM_MIN`, `ZOOM_MAX`, `DEFAULT_CAMERA`, `PHYSICS`; functions `buildGraph(payload)`, `seedSphere(nodes, radius)`, `step(graph, mode, alpha, held)`, `settle(graph, mode, iterations)`, `baseProject(node, mode, cam)`, `project(node, mode, cam, w, h)`, `fitView(graph, mode, cam, w, h, bandFraction)`.
- Produces, from `render.ts`: `drawGraph(ctx, state)` where `state` is `RenderState`.
- Produces, from `useGraph.ts`: `useGraph(options)` returning exactly `{ canvasRef, ready, mode, setMode, hovered, selected, setSelected, autoRotate, setAutoRotate, fit, reset }`.

This task's deliverable is a **visible, settled 2D graph with glyph nodes and language edges, mounted on the page**. Interactions come in Task 7.

- [ ] **Step 1: Write the engine**

Create `app/components/graph/engine.ts`:

```ts
import type { GraphPayload } from '@/lib/graph-types';

export type Mode = '2d' | '3d';

export interface GraphNode {
  id: string;
  kind: 'project' | 'language';
  color: string;
  degree: number;
  slug?: string;
  repo?: string | null;
  desc?: string;
  status?: 'done' | 'beta' | 'dev';
  langs?: Record<string, number>;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Layout radius in model units. Drives collision, hit testing and glyph size. */
  r: number;
}

export interface GraphLink { s: GraphNode; t: GraphNode; weight: number; }

export interface Camera { rx: number; ry: number; zoom: number; px: number; py: number; }

export interface Projected { sx: number; sy: number; s: number; z: number; }

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  byId: Record<string, GraphNode>;
  /** adjacency[a][b] is true when a and b share an edge. */
  adjacency: Record<string, Record<string, true>>;
}

export const FOCAL = 470;
export const SPHERE_R = 88;
export const ZOOM_MIN = 0.32;
export const ZOOM_MAX = 2.6;
export const SEED_RADIUS = 80;

export const DEFAULT_CAMERA: Camera = { rx: -0.3, ry: 0.6, zoom: 1, px: 0, py: 0 };

interface PhysicsParams {
  repulseProject: number;
  repulseOther: number;
  springRest: number;
  springK: number;
  collisionPad: number;
  damping: number;
}

// 2D needs more space so labels do not collide; 3D is deliberately tighter so
// the cloud reads as a solid sphere rather than a loose scatter.
export const PHYSICS: Record<Mode, PhysicsParams> = {
  '2d': { repulseProject: 3400, repulseOther: 1500, springRest: 52, springK: 0.05,  collisionPad: 9, damping: 0.8 },
  '3d': { repulseProject: 1500, repulseOther: 620,  springRest: 34, springK: 0.075, collisionPad: 5, damping: 0.8 },
};

const CENTER_K_2D = 0.011;
const RADIAL_K_3D = 0.1;
const FLATTEN_K_2D = 0.14;
const COLLISION_PUSH = 0.42;

function radiusFor(kind: 'project' | 'language', degree: number): number {
  return kind === 'project' ? 9 + degree * 1.4 : 3.4 + degree * 1.3;
}

/** Distribute nodes over a sphere using a golden-angle spiral. Deterministic. */
export function seedSphere(nodes: GraphNode[], radius: number): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    nodes[i].x = Math.cos(theta) * Math.sin(phi) * radius;
    nodes[i].y = Math.sin(theta) * Math.sin(phi) * radius;
    nodes[i].z = Math.cos(phi) * radius;
  }
}

export function buildGraph(payload: GraphPayload): Graph {
  const byId: Record<string, GraphNode> = {};
  const nodes: GraphNode[] = payload.nodes.map((w) => {
    const n: GraphNode = {
      id: w.id,
      kind: w.kind,
      color: w.color,
      degree: w.degree,
      slug: w.slug,
      repo: w.repo,
      desc: w.desc,
      status: w.status,
      langs: w.langs,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      r: radiusFor(w.kind, w.degree),
    };
    byId[n.id] = n;
    return n;
  });

  const links: GraphLink[] = [];
  const adjacency: Record<string, Record<string, true>> = {};
  for (const n of nodes) adjacency[n.id] = {};

  for (const l of payload.links) {
    const s = byId[l.source];
    const t = byId[l.target];
    if (!s || !t) continue;
    links.push({ s, t, weight: l.weight });
    adjacency[s.id][t.id] = true;
    adjacency[t.id][s.id] = true;
  }

  seedSphere(nodes, SEED_RADIUS);
  return { nodes, links, byId, adjacency };
}

/** One integration step. `held` is pinned (used while dragging a node). */
export function step(g: Graph, mode: Mode, alpha: number, held: GraphNode | null): void {
  const P = PHYSICS[mode];
  const is3d = mode === '3d';
  const n = g.nodes;

  for (let i = 0; i < n.length; i++) {
    for (let j = i + 1; j < n.length; j++) {
      const a = n[i], b = n[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = is3d ? b.z - a.z : 0;
      const d2 = dx * dx + dy * dy + dz * dz || 0.01;
      const d = Math.sqrt(d2);

      const bothProjects = a.kind === 'project' && b.kind === 'project';
      const f = (bothProjects ? P.repulseProject : P.repulseOther) / d2;
      a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
      b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      if (is3d) { a.vz -= (dz / d) * f; b.vz += (dz / d) * f; }

      const min = a.r + b.r + P.collisionPad;
      if (d < min) {
        const push = (min - d) * COLLISION_PUSH;
        a.vx -= (dx / d) * push; a.vy -= (dy / d) * push;
        b.vx += (dx / d) * push; b.vy += (dy / d) * push;
        if (is3d) { a.vz -= (dz / d) * push; b.vz += (dz / d) * push; }
      }
    }
  }

  for (const l of g.links) {
    const dx = l.t.x - l.s.x;
    const dy = l.t.y - l.s.y;
    const dz = is3d ? l.t.z - l.s.z : 0;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
    const f = (d - P.springRest) * P.springK;
    l.s.vx += (dx / d) * f; l.s.vy += (dy / d) * f;
    l.t.vx -= (dx / d) * f; l.t.vy -= (dy / d) * f;
    if (is3d) { l.s.vz += (dz / d) * f; l.t.vz -= (dz / d) * f; }
  }

  for (const node of g.nodes) {
    if (is3d) {
      // Radial constraint: pull every node onto a shell of radius SPHERE_R.
      const d = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z) || 0.01;
      const f = (d - SPHERE_R) * RADIAL_K_3D;
      node.vx -= (node.x / d) * f;
      node.vy -= (node.y / d) * f;
      node.vz -= (node.z / d) * f;
    } else {
      node.vx -= node.x * CENTER_K_2D;
      node.vy -= node.y * CENTER_K_2D;
      node.vz += (0 - node.z) * FLATTEN_K_2D; // flatten so mode switches reverse cleanly
    }

    if (node === held) { node.vx = 0; node.vy = 0; node.vz = 0; continue; }

    node.vx *= P.damping; node.vy *= P.damping; node.vz *= P.damping;
    node.x += node.vx * alpha;
    node.y += node.vy * alpha;
    node.z += node.vz * alpha;
  }
}

export function settle(g: Graph, mode: Mode, iterations: number): void {
  for (let i = 0; i < iterations; i++) step(g, mode, 1, null);
}

/**
 * Rotation + perspective, with zoom and pan deliberately factored out so
 * fitView can solve for them in closed form.
 */
export function baseProject(n: GraphNode, mode: Mode, cam: Camera): { x: number; y: number; s: number; z: number } {
  if (mode === '3d') {
    const cy = Math.cos(cam.ry), sy = Math.sin(cam.ry);
    const x1 = n.x * cy - n.z * sy;
    const z1 = n.x * sy + n.z * cy;
    const cx = Math.cos(cam.rx), sx = Math.sin(cam.rx);
    const y1 = n.y * cx - z1 * sx;
    const z2 = n.y * sx + z1 * cx;
    const s = FOCAL / (FOCAL - z2);
    return { x: x1 * s, y: y1 * s, s, z: z2 };
  }
  return { x: n.x, y: n.y, s: 1, z: 0 };
}

export function project(n: GraphNode, mode: Mode, cam: Camera, w: number, h: number): Projected {
  const b = baseProject(n, mode, cam);
  return {
    sx: w / 2 + b.x * cam.zoom + cam.px,
    sy: h / 2 + b.y * cam.zoom + cam.py,
    s: b.s,
    z: b.z,
  };
}

const FIT_PAD = 28;

/**
 * Solve zoom/pan so the whole graph fits inside a band `bandFraction` of the
 * canvas width, measured from the left edge. Operates on already-projected
 * coordinates, so it works with the sphere at any rotation.
 */
export function fitView(
  g: Graph, mode: Mode, cam: Camera, w: number, h: number, bandFraction: number
): Pick<Camera, 'zoom' | 'px' | 'py'> {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of g.nodes) {
    const b = baseProject(n, mode, cam);
    const pad = n.r + 12;
    if (b.x - pad < minX) minX = b.x - pad;
    if (b.x + pad > maxX) maxX = b.x + pad;
    if (b.y - pad < minY) minY = b.y - pad;
    if (b.y + pad > maxY) maxY = b.y + pad;
  }
  if (!Number.isFinite(minX)) return { zoom: cam.zoom, px: cam.px, py: cam.py };

  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const bandW = w * bandFraction;

  const zoom = Math.min(
    ZOOM_MAX,
    Math.max(ZOOM_MIN, Math.min((bandW - FIT_PAD * 2) / bw, (h - FIT_PAD * 2) / bh))
  );

  const bcx = (minX + maxX) / 2;
  const bcy = (minY + maxY) / 2;

  return {
    zoom,
    px: bandW / 2 - (w / 2 + bcx * zoom),
    py: -(bcy * zoom),
  };
}
```

- [ ] **Step 2: Write the renderer**

Create `app/components/graph/render.ts`:

```ts
import { baseProject, type Camera, type Graph, type GraphNode, type Mode } from './engine';

export interface RenderState {
  graph: Graph;
  mode: Mode;
  cam: Camera;
  w: number;
  h: number;
  /** Node driving the highlight (hover takes precedence over selection). */
  lit: GraphNode | null;
  selected: GraphNode | null;
}

const GLYPH_PROJECT = '◆';
const GLYPH_LANGUAGE = '○';
const TEAL = '#5eead4';
const LABEL_ZOOM_THRESHOLD = 1.2;
const DIM_ALPHA = 0.12;

function depthFactor(mode: Mode, s: number): number {
  return mode === '3d' ? Math.max(0.24, Math.min(1, s - 0.36)) : 1;
}

export function drawGraph(ctx: CanvasRenderingContext2D, st: RenderState): void {
  const { graph, mode, cam, w, h, lit, selected } = st;
  ctx.clearRect(0, 0, w, h);

  // Project once; reused by edges, nodes and depth sorting.
  const P = new Map<string, { sx: number; sy: number; s: number; z: number }>();
  for (const n of graph.nodes) {
    const b = baseProject(n, mode, cam);
    P.set(n.id, {
      sx: w / 2 + b.x * cam.zoom + cam.px,
      sy: h / 2 + b.y * cam.zoom + cam.py,
      s: b.s,
      z: b.z,
    });
  }

  // ── edges ──
  for (const l of graph.links) {
    const a = P.get(l.s.id)!;
    const b = P.get(l.t.id)!;
    const on = !lit || l.s === lit || l.t === lit;
    const dep = mode === '3d' ? Math.max(0.14, Math.min(1, (a.s + b.s) / 2 - 0.42)) : 1;

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = on && lit ? (l.s.kind === 'project' ? l.s.color : l.t.color) : '#ffffff';
    ctx.globalAlpha = (on ? (lit ? 0.68 : 0.12) : 0.03) * dep;
    ctx.lineWidth = (on && lit ? 1.6 : 1) * (mode === '3d' ? Math.max(0.55, a.s * 0.85) : 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── nodes, painted back to front so nearer glyphs win ──
  const ordered = [...graph.nodes].sort((p, q) => P.get(p.id)!.z - P.get(q.id)!.z);

  for (const n of ordered) {
    const p = P.get(n.id)!;
    const isProject = n.kind === 'project';
    const on = !lit || n === lit || graph.adjacency[lit.id][n.id];
    const dep = depthFactor(mode, p.s);
    const alpha = (on ? 1 : DIM_ALPHA) * dep;
    const rr = n.r * (mode === '3d' ? p.s * 0.9 : 1) * cam.zoom;

    // The node IS the glyph — mirrors the text-shadow already on .batlogo.
    ctx.globalAlpha = alpha;
    ctx.font = `${(rr * (isProject ? 2.9 : 2.5)).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isProject ? n.color : 'rgba(255,255,255,.42)';
    if (isProject && on) {
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 13;
    }
    ctx.fillText(isProject ? GLYPH_PROJECT : GLYPH_LANGUAGE, p.sx, p.sy);
    ctx.shadowBlur = 0; // must reset or it bleeds into every later draw

    if (n === selected && isProject) {
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr * 1.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Language labels stay hidden when zoomed out so the graph reads cleanly.
    const showLabel = isProject || on || cam.zoom > LABEL_ZOOM_THRESHOLD;
    if (showLabel) {
      ctx.globalAlpha = alpha * (on ? 1 : 0.5);
      const size = (isProject ? 11 : 9.6) * (mode === '3d' ? Math.max(0.76, p.s * 0.88) : 1);
      ctx.font = `${size}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isProject
        ? 'rgba(255,255,255,.9)'
        : on && lit ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.38)';
      ctx.fillText(n.id, p.sx, p.sy + rr * 1.35 + 3);
    }
  }

  ctx.globalAlpha = 1;
}
```

- [ ] **Step 3: Write the hook (render loop and sizing only — interactions come in Task 7)**

Create `app/components/graph/useGraph.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildGraph, settle, step, fitView,
  DEFAULT_CAMERA, type Camera, type Graph, type GraphNode, type Mode,
} from './engine';
import { drawGraph } from './render';
import type { GraphPayload } from '@/lib/graph-types';

const SETTLE_ITERATIONS = 500;
const LOOP_ALPHA = 0.5;

export interface UseGraphOptions {
  payload: GraphPayload | null;
  /** Fraction of canvas width the graph should occupy (1 = full, 0.42 = left band). */
  bandFraction: number;
  /** Element whose textContent receives the zoom percentage, updated per frame
   *  without triggering React re-renders. */
  zoomLabelRef?: React.RefObject<HTMLElement>;
}

export interface UseGraphResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  hovered: GraphNode | null;
  selected: GraphNode | null;
  setSelected: (n: GraphNode | null) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  fit: () => void;
  reset: () => void;
}

export function useGraph({ payload, bandFraction, zoomLabelRef }: UseGraphOptions): UseGraphResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const camRef = useRef<Camera>({ ...DEFAULT_CAMERA });
  const modeRef = useRef<Mode>('2d');
  const sizeRef = useRef({ w: 0, h: 0 });
  const heldRef = useRef<GraphNode | null>(null);
  const litRef = useRef<GraphNode | null>(null);
  const selRef = useRef<GraphNode | null>(null);
  const bandRef = useRef(bandFraction);
  const tweenRef = useRef<{
    from: Pick<Camera, 'zoom' | 'px' | 'py'>;
    to: Pick<Camera, 'zoom' | 'px' | 'py'>;
    ms: number; t0: number;
  } | null>(null);

  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<Mode>('2d');
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [selected, setSelectedState] = useState<GraphNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotRef = useRef(false);
  const reduced = useRef(false);

  useEffect(() => { bandRef.current = bandFraction; }, [bandFraction]);
  useEffect(() => { autoRotRef.current = autoRotate; }, [autoRotate]);

  // Refs drive the render loop; React state drives the UI. Task 7's pointer
  // handling lives in this same file and writes litRef/selRef directly, so no
  // setter needs to be exported for it.
  const setSelected = useCallback((n: GraphNode | null) => { selRef.current = n; setSelectedState(n); }, []);

  const applyView = useCallback((frac: number, animate: boolean) => {
    const g = graphRef.current;
    const { w, h } = sizeRef.current;
    if (!g || !w || !h) return;
    const target = fitView(g, modeRef.current, camRef.current, w, h, frac);
    if (animate) {
      tweenRef.current = {
        from: { zoom: camRef.current.zoom, px: camRef.current.px, py: camRef.current.py },
        to: target, ms: 460, t0: performance.now(),
      };
    } else {
      camRef.current.zoom = target.zoom;
      camRef.current.px = target.px;
      camRef.current.py = target.py;
    }
  }, []);

  // Build the graph when data arrives.
  useEffect(() => {
    if (!payload) return;
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = buildGraph(payload);
    settle(g, '2d', SETTLE_ITERATIONS);
    graphRef.current = g;
    setReady(true);
  }, [payload]);

  // Size the canvas to its box, DPR-aware.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!tweenRef.current) applyView(bandRef.current, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [applyView, ready]);

  // Render loop.
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let alive = true;

    const frame = () => {
      if (!alive) return;
      const g = graphRef.current;
      if (g) {
        if (!reduced.current) {
          if (autoRotRef.current && modeRef.current === '3d' && !heldRef.current) {
            camRef.current.ry += 0.0022;
          }
          step(g, modeRef.current, LOOP_ALPHA, heldRef.current);
        }

        const tw = tweenRef.current;
        if (tw) {
          const k = Math.min(1, (performance.now() - tw.t0) / tw.ms);
          const e = 1 - Math.pow(1 - k, 3);
          camRef.current.zoom = tw.from.zoom + (tw.to.zoom - tw.from.zoom) * e;
          camRef.current.px = tw.from.px + (tw.to.px - tw.from.px) * e;
          camRef.current.py = tw.from.py + (tw.to.py - tw.from.py) * e;
          if (k >= 1) tweenRef.current = null;
        }

        const { w, h } = sizeRef.current;
        drawGraph(ctx, {
          graph: g, mode: modeRef.current, cam: camRef.current, w, h,
          lit: litRef.current, selected: selRef.current,
        });

        if (zoomLabelRef?.current) {
          zoomLabelRef.current.textContent = `${Math.round(camRef.current.zoom * 100)}%`;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    frame();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [ready, zoomLabelRef]);

  const setMode = useCallback((m: Mode) => {
    const g = graphRef.current;
    if (!g) return;
    modeRef.current = m;
    setModeState(m);
    if (m === '3d') {
      // Nodes flattened by 2D need a z nudge or the sphere never inflates.
      for (const n of g.nodes) if (Math.abs(n.z) < 1) n.z = (Math.random() - 0.5) * 70;
    }
    settle(g, m, 380);
    applyView(bandRef.current, true);
  }, [applyView]);

  const fit = useCallback(() => applyView(bandRef.current, true), [applyView]);
  const reset = useCallback(() => {
    camRef.current.rx = DEFAULT_CAMERA.rx;
    camRef.current.ry = DEFAULT_CAMERA.ry;
    applyView(bandRef.current, true);
  }, [applyView]);

  // Re-frame whenever the available band changes (README opening/closing).
  useEffect(() => {
    if (ready) applyView(bandFraction, true);
  }, [bandFraction, ready, applyView]);

  return {
    canvasRef, ready, mode, setMode,
    hovered, selected, setSelected,
    autoRotate, setAutoRotate, fit, reset,
  };
}
```

**Note for the implementer:** `heldRef` is written only by Task 7's pointer handling. Until then it stays `null`, which is the correct no-drag state — the hook is complete and functional as written.

- [ ] **Step 4: Write the section shell**

Create `app/components/sections/ProjectsGraph.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useGraph } from '@/components/graph/useGraph';
import type { GraphPayload } from '@/lib/graph-types';

export default function ProjectsGraph() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    fetch('/api/projects/graph')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphPayload | null) => {
        if (d?.nodes?.length) setPayload(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const { canvasRef, ready, mode, setMode, fit, reset } = useGraph({
    payload,
    bandFraction: 1,
    zoomLabelRef,
  });

  return (
    <section id="projects" className="sec">
      <div className="wrap">
        <span className="seclabel">Projects</span>
        <div className="eyebrow">graph ~/projects --link-by=language</div>
        <h2 className="h2">Selected <span className="grad">work</span></h2>

        <div className="win" style={{ marginTop: 24, position: 'relative' }}>
          <div className="winbar">
            <div className="dots"><i className="r" /><i className="y" /><i className="g" /></div>
            <div className="wintitle"><b>s7lver@portfolio</b>:~$ graph</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="kbadge gbtn" data-on={mode === '2d'} onClick={() => setMode('2d')}>2D</button>
              <button type="button" className="kbadge gbtn" data-on={mode === '3d'} onClick={() => setMode('3d')}>3D esfera</button>
              <button type="button" className="kbadge gbtn" onClick={fit}>⊡ fit</button>
              <button type="button" className="kbadge gbtn" onClick={reset}>⟲ reset</button>
            </div>
          </div>

          <div className="gstage">
            <canvas ref={canvasRef} className="gcanvas" />
            {!ready && !failed && <div className="gmsg mono">Loading graph…</div>}
            {failed && <div className="gmsg mono">Graph unavailable.</div>}
          </div>

          <div className="gsl">
            <span className="m">NORMAL</span>
            <span className="c">~/projects</span>
            <span className="c" ref={zoomLabelRef}>100%</span>
            <span className="sp" />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add the section CSS**

Append to `app/globals.css` (outside any `@layer`, alongside the other `.win` rules):

```css
/* ── Projects graph ── */
.gstage {
  position: relative;
  background: #090a0e;
}

.gcanvas {
  display: block;
  width: 100%;
  height: 376px;
  cursor: grab;
  touch-action: none;
}

.gcanvas.grabbing { cursor: grabbing; }

.gmsg {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

.gbtn {
  cursor: pointer;
  transition: 0.16s;
  background: rgba(255, 255, 255, 0.03);
}

.gbtn:hover {
  border-color: rgba(255, 255, 255, 0.32);
  color: rgba(255, 255, 255, 0.82);
}

.gbtn[data-on='true'] {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.55);
  color: #c4b5fd;
}

.gsl {
  display: flex;
  align-items: center;
  font-family: var(--mono);
  font-size: 10.5px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #0d0d13;
  color: rgba(255, 255, 255, 0.4);
}

.gsl .m {
  background: #8b5cf6;
  color: #fff;
  padding: 5px 11px;
  letter-spacing: 0.1em;
  font-weight: 600;
}

.gsl .c {
  padding: 5px 11px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.gsl .sp { flex: 1; }

@media (max-width: 760px) {
  .gcanvas { height: 300px; }
}
```

- [ ] **Step 6: Mount it on the page**

In `app/page.tsx`, change the import on line 8:

```tsx
import ProjectsSection from '@/components/sections/Projects';
```

to:

```tsx
import ProjectsGraphSection from '@/components/sections/ProjectsGraph';
```

and the usage on line 170 from `<ProjectsSection />` to `<ProjectsGraphSection />`.

Leave `app/components/sections/Projects.tsx` on disk for now — it is deleted in Task 11, once the replacement is fully built.

- [ ] **Step 7: Verify manually**

```bash
npm run build
```
Expected: compiles clean.

Start the dev server and scroll to the Projects section.

Expected:
- A dark canvas shows `◆` glyphs for the four projects in their accent colours, and `○` glyphs for languages, connected by faint white lines.
- Project names are labelled below their glyphs; language names are also visible (nothing is dimmed yet since no hover exists).
- The layout is settled and stable — nodes are not drifting wildly or piled on top of each other.
- Reload three times: the layout is identical each time (deterministic seeding).
- The statusline shows `NORMAL`, `~/projects`, `100%`.
- Clicking `3D esfera` visibly changes the arrangement into a rounder, tighter cloud; `2D` returns it to a flat spread.
- `⊡ fit` re-frames with a smooth ~half-second animation.
- Console has no errors and no React warnings.
- Resize the browser: the graph re-fits without stretching or blurring.

- [ ] **Step 8: Commit**

```bash
git add app/components/graph/engine.ts app/components/graph/render.ts app/components/graph/useGraph.ts app/components/sections/ProjectsGraph.tsx app/globals.css app/page.tsx
git commit -m "feat(projects): graph engine, glyph renderer, and 2D/3D layout on canvas"
```

---

## Task 7: Graph interactions

**Files:**
- Modify: `app/components/graph/useGraph.ts`
- Modify: `app/components/sections/ProjectsGraph.tsx`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces: `useGraph` gains `onOpenProject` in its options and drops the `__`-prefixed internal seam. Hover state, pan/rotate, zoom, node dragging, hit testing, empty-space deselection and `Esc` all work.

- [ ] **Step 1: Add hit testing and pointer handling to the hook**

In `app/components/graph/useGraph.ts`, add `project` to the engine import list, extend `UseGraphOptions` with:

```ts
  /** Called when a project node is clicked (not dragged). */
  onOpenProject?: (n: GraphNode) => void;
```

then add this effect after the render-loop effect, and **delete the `...({ __setHov: ... } as unknown as {})` spread** from the return object:

```ts
  // ── pointer interaction ──
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DRAG_THRESHOLD = 4;
    let drag: {
      mx: number; my: number;
      px: number; py: number; rx: number; ry: number;
      nx: number; ny: number;
      node: GraphNode | null;
    } | null = null;

    const rel = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    const pick = (mx: number, my: number): GraphNode | null => {
      const g = graphRef.current;
      const { w, h } = sizeRef.current;
      if (!g) return null;
      let best: GraphNode | null = null;
      let bestD = Infinity;
      for (const n of g.nodes) {
        const p = project(n, modeRef.current, camRef.current, w, h);
        const rr = Math.max(n.r * (modeRef.current === '3d' ? p.s : 1) * camRef.current.zoom, 9) + 5;
        const d = Math.hypot(mx - p.sx, my - p.sy);
        if (d < rr && d < bestD) { bestD = d; best = n; }
      }
      return best;
    };

    const onMove = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      if (drag) {
        const dx = mx - drag.mx;
        const dy = my - drag.my;
        if (drag.node && modeRef.current === '2d') {
          drag.node.x = drag.nx + dx / camRef.current.zoom;
          drag.node.y = drag.ny + dy / camRef.current.zoom;
        } else if (modeRef.current === '3d') {
          camRef.current.ry = drag.ry + dx * 0.0088;
          camRef.current.rx = Math.max(-1.45, Math.min(1.45, drag.rx + dy * 0.0088));
        } else {
          camRef.current.px = drag.px + dx;
          camRef.current.py = drag.py + dy;
        }
        tweenRef.current = null; // any gesture cancels an in-flight re-frame
        return;
      }
      const n = pick(mx, my);
      if (n !== litRef.current) {
        litRef.current = n;
        setHovered(n);
        canvas.style.cursor = n && n.kind === 'project' ? 'pointer' : 'grab';
      }
    };

    const onDown = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      const n = pick(mx, my);
      // Node dragging is 2D only — dragging a projected point through a rotated
      // space is not predictable.
      heldRef.current = n && modeRef.current === '2d' ? n : null;
      drag = {
        mx, my,
        px: camRef.current.px, py: camRef.current.py,
        rx: camRef.current.rx, ry: camRef.current.ry,
        nx: n?.x ?? 0, ny: n?.y ?? 0,
        node: n,
      };
      canvas.classList.add('grabbing');
      canvas.setPointerCapture(e.pointerId);
    };

    const onUp = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      const moved = !!drag && (Math.abs(mx - drag.mx) > DRAG_THRESHOLD || Math.abs(my - drag.my) > DRAG_THRESHOLD);
      const n = drag?.node ?? null;
      if (!moved) {
        if (n && n.kind === 'project') {
          selRef.current = n;
          setSelectedState(n);
          onOpenProjectRef.current?.(n);
        } else if (!n) {
          selRef.current = null;
          setSelectedState(null);
        }
      }
      heldRef.current = null;
      drag = null;
      canvas.classList.remove('grabbing');
    };

    const onLeave = () => {
      litRef.current = null;
      setHovered(null);
      heldRef.current = null;
      drag = null;
      canvas.classList.remove('grabbing');
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tweenRef.current = null;
      const next = camRef.current.zoom * (e.deltaY > 0 ? 0.9 : 1.11);
      camRef.current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [ready]);
```

Add `ZOOM_MIN`, `ZOOM_MAX` and `project` to the engine import. Add near the other refs:

```ts
  const onOpenProjectRef = useRef(onOpenProject);
  useEffect(() => { onOpenProjectRef.current = onOpenProject; }, [onOpenProject]);
```

The ref indirection keeps the pointer effect from re-subscribing every render when the parent passes a fresh closure.

- [ ] **Step 2: Add `Esc` to deselect**

Add to the hook:

```ts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      selRef.current = null;
      setSelectedState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

- [ ] **Step 3: Show hover context in the statusline**

In `ProjectsGraph.tsx`, take `hovered` and `selected` from the hook and add a key-hints segment before the closing `</div>` of `.gsl`:

```tsx
            <span className="k">
              {hovered ? (
                hovered.kind === 'project' ? (
                  <>
                    <span><b>{hovered.id}</b></span>
                    <span>{hovered.degree} lenguajes</span>
                    <span><b>click</b> README</span>
                  </>
                ) : (
                  <>
                    <span><b>{hovered.id}</b></span>
                    <span>en {hovered.degree} proyecto{hovered.degree > 1 ? 's' : ''}</span>
                  </>
                )
              ) : (
                <>
                  <span><b>drag</b> {mode === '3d' ? 'rotar' : 'pan'}</span>
                  <span><b>scroll</b> zoom</span>
                  <span><b>click vacío</b> deselect</span>
                </>
              )}
            </span>
```

and update the path segment to reflect selection:

```tsx
            <span className="c">{selected ? `~/projects/${selected.id}` : '~/projects'}</span>
```

Add to `app/globals.css`:

```css
.gsl .k {
  padding: 5px 11px;
  display: flex;
  gap: 12px;
}

.gsl .k b { color: rgba(255, 255, 255, 0.62); font-weight: 600; }

@media (max-width: 760px) {
  .gsl .k span:nth-child(n + 3) { display: none; }
}
```

- [ ] **Step 4: Verify manually**

Start the dev server and scroll to Projects.

Expected:
- Hovering a project glyph lights it and its languages; everything else drops to near-invisible; the connecting edges take the project's accent colour.
- Hovering a **language** lights it and every project using it. Find a language with `degree > 1` (from Task 4's verification — likely `Shell`, `C` or `Makefile`) and confirm **two** projects light up. This is the connectivity the whole design rests on.
- The statusline updates on hover: project shows `N lenguajes`, language shows `en N proyectos`.
- Dragging the background pans in 2D; switch to 3D and dragging rotates the sphere.
- Wheel zooms; the percentage in the statusline changes; it stops at 32% and 260%.
- In 2D, dragging a node moves it and the graph re-settles around it. In 3D, dragging a node rotates the view instead (expected).
- Clicking a project glyph draws a teal ring around it and the path segment becomes `~/projects/{id}`.
- Clicking empty canvas removes the ring and resets the path.
- `Esc` also removes the ring.
- Pan the canvas with a long drag that ends over empty space: selection is **not** cleared (the 4px threshold distinguishes drag from click).
- Console has no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/graph/useGraph.ts app/components/sections/ProjectsGraph.tsx app/globals.css
git commit -m "feat(projects): graph hover highlight, pan, zoom, node drag, deselect"
```

---

## Task 8: 3D sphere polish and auto-rotation

**Files:**
- Modify: `app/components/sections/ProjectsGraph.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `autoRotate` / `setAutoRotate` already returned by `useGraph` from Task 6.

The physics, radial constraint, depth cueing and rotation were built in Tasks 6–7. This task exposes the auto-rotate control, adds the legend, and verifies the sphere reads correctly.

- [ ] **Step 1: Add the auto-rotate button and legend**

In `ProjectsGraph.tsx`, destructure `autoRotate, setAutoRotate` from `useGraph`, and add a fifth button to the winbar group:

```tsx
              <button
                type="button"
                className="kbadge gbtn"
                data-on={autoRotate}
                onClick={() => setAutoRotate(!autoRotate)}
                disabled={mode !== '3d'}
                title={mode === '3d' ? 'rotación automática' : 'solo en modo 3D'}
              >
                ◐ auto-rot
              </button>
```

Add a legend inside `.gstage`, after the canvas:

```tsx
            <div className="gleg mono">
              <span><i style={{ background: '#00add8' }} />proyecto</span>
              <span><i style={{ background: 'rgba(255,255,255,.3)' }} />lenguaje</span>
            </div>
```

- [ ] **Step 2: Style the legend and the disabled button**

Append to `app/globals.css`:

```css
.gleg {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

.gleg i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.gbtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.gbtn:disabled:hover {
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.5);
}
```

- [ ] **Step 3: Verify manually**

Expected in `3D esfera` mode:
- The cloud reads as a **compact, roughly spherical** volume — not a loose scatter. If it looks dispersed, `SPHERE_R` in `engine.ts` is the knob (it is deliberately 88, not 130).
- Glyphs at the back are visibly smaller and dimmer than those at the front; edges to far nodes are thinner and fainter.
- Dragging rotates smoothly; vertical rotation stops before flipping over the pole.
- `◐ auto-rot` is disabled and dimmed in 2D, enabled in 3D. Turn it on: the sphere rotates slowly on its own. Start dragging: it stops while you hold and resumes on release.
- Hover highlighting still works while rotating, including on nodes at the back.
- Switch 3D → 2D → 3D repeatedly: the graph flattens and re-inflates each time without nodes escaping the canvas or collapsing to a point.
- Enable OS reduce-motion and reload: the graph renders one static settled frame, nothing moves, and auto-rotate does nothing.

- [ ] **Step 4: Commit**

```bash
git add app/components/sections/ProjectsGraph.tsx app/globals.css
git commit -m "feat(projects): 3D sphere controls, legend, and reduced-motion static frame"
```

---

## Task 9: README overlay panel and camera re-framing

**Files:**
- Modify: `app/components/sections/ProjectsGraph.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `GET /api/projects/{slug}/readme` from Task 5; `bandFraction` and `onOpenProject` on `useGraph`.
- Produces: the panel renders raw markdown in a `<pre>` as a placeholder; Task 10 replaces that with the rendered pipeline.

**Context:** The panel covers the right 58% of the stage. Naive panning would push nodes off the left edge, so the camera solves for a zoom and pan that fit the whole graph into the remaining 42% band — that is what `fitView(..., bandFraction)` from Task 6 does, and it is already wired to re-run whenever `bandFraction` changes.

- [ ] **Step 1: Add README state and the panel**

Keep the imports from previous tasks, add `useCallback` to the React import, and add the node type:

```tsx
import type { GraphNode } from '@/components/graph/engine';
```

Then add this discriminated union above the component:

```tsx
type ReadmeState =
  | { status: 'idle' }
  | { status: 'loading'; slug: string }
  | { status: 'ok'; slug: string; markdown: string; repo: string }
  | { status: 'none'; slug: string; reason: 'no_repo' | 'not_found' | 'fetch_failed' };
```

Add inside the component:

```tsx
  const [readme, setReadme] = useState<ReadmeState>({ status: 'idle' });
  const open = readme.status !== 'idle';

  const onOpenProject = useCallback((n: GraphNode) => {
    const slug = n.slug ?? n.id;
    setReadme({ status: 'loading', slug });
    fetch(`/api/projects/${encodeURIComponent(slug)}/readme`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setReadme({ status: 'ok', slug, markdown: d.markdown, repo: d.repo });
        else setReadme({ status: 'none', slug, reason: d?.reason ?? 'fetch_failed' });
      })
      .catch(() => setReadme({ status: 'none', slug, reason: 'fetch_failed' }));
  }, []);

  const closeReadme = useCallback(() => setReadme({ status: 'idle' }), []);
```

Pass to the hook:

```tsx
  const { canvasRef, ready, mode, setMode, hovered, selected, setSelected,
          autoRotate, setAutoRotate, fit, reset } = useGraph({
    payload,
    bandFraction: open ? 0.42 : 1,
    zoomLabelRef,
    onOpenProject,
  });
```

Clear the README when the selection is cleared from the canvas (empty click or `Esc`):

```tsx
  useEffect(() => {
    if (!selected) setReadme({ status: 'idle' });
  }, [selected]);
```

Render the panel as the last child of `.gstage`:

```tsx
            <aside className={`grd${open ? ' open' : ''}`} aria-hidden={!open}>
              {readme.status !== 'idle' && (
                <>
                  <div className="grdbar">
                    <span className="dot" style={{ background: selected?.color ?? '#8b5cf6' }} />
                    <span className="fn">
                      {readme.slug}{readme.status === 'ok' ? '/README.md' : ''}
                    </span>
                    <span className="src">
                      {readme.status === 'ok' ? 'raw.githubusercontent.com'
                        : readme.status === 'loading' ? 'cargando…'
                        : readme.reason === 'no_repo' ? 'sin repo público' : 'no disponible'}
                    </span>
                    <button
                      type="button"
                      className="kbadge gbtn x"
                      onClick={() => { setSelected(null); closeReadme(); }}
                    >
                      ✕ esc
                    </button>
                  </div>

                  {readme.status === 'loading' && <div className="grdempty mono">Cargando README…</div>}

                  {readme.status === 'none' && (
                    <div className="grdempty mono">
                      <span className="big">◌</span>
                      {readme.reason === 'no_repo'
                        ? <>Este proyecto no tiene repositorio público.</>
                        : <>No se pudo cargar el <code>README.md</code>.</>}
                      {selected?.desc && <p className="fb">{selected.desc}</p>}
                    </div>
                  )}

                  {readme.status === 'ok' && (
                    <div className="grdbody">
                      <pre>{readme.markdown}</pre>
                    </div>
                  )}
                </>
              )}
            </aside>
```

- [ ] **Step 2: Style the panel**

Append to `app/globals.css`:

```css
.grd {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 58%;
  z-index: 6;
  display: flex;
  flex-direction: column;
  background: rgba(13, 13, 19, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  transform: translateX(101%);
  transition: transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.grd.open { transform: none; }

.grdbar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  background: #0d0d13;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  font-family: var(--mono);
}

.grdbar .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.grdbar .fn { font-size: 11.5px; color: rgba(255, 255, 255, 0.85); }
.grdbar .src { font-size: 10px; color: rgba(255, 255, 255, 0.4); }
.grdbar .x { margin-left: auto; }

.grdbody {
  padding: 16px 18px 20px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.62);
}

.grdbody pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--mono);
  font-size: 11px;
}

.grdempty {
  padding: 30px 18px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  line-height: 1.8;
}

.grdempty .big {
  display: block;
  font-size: 26px;
  color: rgba(139, 92, 246, 0.35);
  margin-bottom: 10px;
}

.grdempty .fb {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11.5px;
}

@media (max-width: 760px) {
  .grd { width: 100%; }
}
```

- [ ] **Step 3: Turn the statusline badge teal while open**

In `ProjectsGraph.tsx`, make the mode badge reflect the panel:

```tsx
            <span className="m" data-readme={open}>{open ? 'README' : 'NORMAL'}</span>
```

and add to `app/globals.css`:

```css
.gsl .m[data-readme='true'] {
  background: #5eead4;
  color: #04120f;
}
```

- [ ] **Step 4: Verify manually**

Expected:
- Click `file-meet`: the panel slides in from the right with a blur backdrop, showing raw markdown in a monospace block.
- **The graph re-frames**: it animates left and scales down so the entire graph sits in the visible strip. **Verify no node is hidden under the panel** — pan is not enough on its own, the zoom must have changed too.
- Switch to 3D, rotate the sphere, then open a README: the re-frame still fits everything, because the bounding box is recomputed from projected coordinates.
- The statusline badge turns teal and reads `README`; the path shows `~/projects/file-meet`.
- Click `✕ esc`, `Esc`, or empty canvas: the panel slides out and the graph re-frames back to full width.
- While the panel is open, drag the graph — the tween cancels immediately and the graph follows your pointer.
- Click `tsuki`: the panel opens with `sin repo público`, the `◌` glyph, and `tsuki`'s description as fallback text.
- At a viewport under 760px the panel is full-width.
- Console has no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/ProjectsGraph.tsx app/globals.css
git commit -m "feat(projects): README overlay panel with fit-preserving camera re-frame"
```

---

## Task 10: Render the README markdown, with SVG and inline HTML

**Files:**
- Create: `app/components/graph/Readme.tsx`
- Modify: `app/components/sections/ProjectsGraph.tsx`
- Modify: `app/globals.css`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Produces: `<Readme markdown={string} repo={string} accent={string} />`.

**Context:** The user's READMEs contain inline SVG and HTML (centred logos, shields.io badges, `<details>` blocks, `<picture>` for dark mode). That requirement is why the raw-markdown and hand-rolled-parser options were rejected in the spec — neither can render SVG. `rehype-raw` is needed to parse the inline HTML, and precisely because of that, `rehype-sanitize` is mandatory: this injects remote HTML into the page.

Relative paths must be rewritten. A README's `./assets/logo.svg` does not exist on this domain; without rewriting, every image breaks.

`next.config.js` is empty and the app sets no Content-Security-Policy (verified), so external badge images load without configuration.

- [ ] **Step 1: Install the dependencies**

```bash
npm install react-markdown remark-gfm rehype-raw rehype-sanitize
```

Expected: four packages added, no peer-dependency errors against React 18.

- [ ] **Step 2: Write the component**

Create `app/components/graph/Readme.tsx`:

```tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Elements real READMEs use that the default schema strips. SVG is here because
 * the author embeds inline SVG; `picture`/`source` because GitHub's dark-mode
 * image trick relies on them; `details`/`summary` for collapsible sections.
 */
const EXTRA_TAGS = [
  'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan', 'use',
  'clipPath', 'mask', 'title',
  'picture', 'source', 'details', 'summary',
  'kbd', 'sub', 'sup', 'ins', 'del',
];

const SVG_ATTRS = [
  'viewBox', 'xmlns', 'xmlnsXlink', 'width', 'height', 'fill', 'stroke',
  'strokeWidth', 'stroke-width', 'strokeLinecap', 'stroke-linecap',
  'strokeLinejoin', 'stroke-linejoin', 'strokeDasharray', 'stroke-dasharray',
  'fillRule', 'fill-rule', 'clipRule', 'clip-rule', 'clipPath', 'clip-path',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'transform', 'offset', 'stopColor', 'stop-color',
  'stopOpacity', 'stop-opacity', 'opacity', 'gradientUnits', 'preserveAspectRatio',
];

// NOTE: `style` and `script` are deliberately absent. Never add them — this
// tree is built from remote HTML.
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...EXTRA_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'align', 'width', 'height', 'className'],
    svg: SVG_ATTRS,
    path: SVG_ATTRS,
    g: SVG_ATTRS,
    circle: SVG_ATTRS,
    rect: SVG_ATTRS,
    line: SVG_ATTRS,
    polyline: SVG_ATTRS,
    polygon: SVG_ATTRS,
    linearGradient: SVG_ATTRS,
    radialGradient: SVG_ATTRS,
    stop: SVG_ATTRS,
    text: SVG_ATTRS,
    tspan: SVG_ATTRS,
    use: [...SVG_ATTRS, 'href', 'xlinkHref'],
    img: ['src', 'alt', 'title', 'width', 'height', 'align', 'loading'],
    source: ['src', 'srcSet', 'srcset', 'media', 'type'],
    a: ['href', 'title', 'target', 'rel'],
    details: ['open'],
    td: ['colSpan', 'rowSpan', 'align'],
    th: ['colSpan', 'rowSpan', 'align'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
    href: ['http', 'https', 'mailto'],
  },
};

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function isRelative(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !ABSOLUTE.test(v) && !v.startsWith('#');
}

/**
 * Rewrite relative src/href to raw.githubusercontent so images in READMEs
 * resolve. Hand-rolled tree walk rather than pulling in unist-util-visit.
 */
function rehypeRelativeUrls(repo: string) {
  const base = `https://raw.githubusercontent.com/${repo}/HEAD/`;
  const walk = (node: any): void => {
    if (node && node.type === 'element' && node.properties) {
      for (const attr of ['src', 'href'] as const) {
        const v = node.properties[attr];
        if (isRelative(v)) {
          node.properties[attr] = base + v.replace(/^\.?\//, '');
        }
      }
      const srcSet = node.properties.srcSet ?? node.properties.srcset;
      if (isRelative(srcSet)) {
        node.properties.srcSet = base + srcSet.replace(/^\.?\//, '');
      }
    }
    if (Array.isArray(node?.children)) node.children.forEach(walk);
  };
  return () => (tree: any) => { walk(tree); };
}

export default function Readme({
  markdown, repo, accent,
}: { markdown: string; repo: string; accent: string }) {
  return (
    <div className="grdbody md" style={{ ['--ac' as string]: accent }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeRelativeUrls(repo),
          [rehypeSanitize, schema],
        ]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow" />
          ),
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ node, ...props }) => <img {...props} loading="lazy" alt={props.alt ?? ''} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
```

**Plugin order matters:** `rehypeRaw` first so inline HTML becomes real nodes, then the URL rewrite so it sees those nodes, then `rehypeSanitize` last so nothing the earlier plugins produced escapes sanitisation.

- [ ] **Step 3: Use it in the panel**

In `ProjectsGraph.tsx`, add the import:

```tsx
import Readme from '@/components/graph/Readme';
```

and replace the `readme.status === 'ok'` branch:

```tsx
                  {readme.status === 'ok' && (
                    <Readme
                      markdown={readme.markdown}
                      repo={readme.repo}
                      accent={selected?.color ?? '#8b5cf6'}
                    />
                  )}
```

- [ ] **Step 4: Style the rendered markdown, with overflow containment**

Append to `app/globals.css`:

```css
.grdbody.md h1 {
  font-family: 'Sora', sans-serif;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: #fff;
  margin: 0 0 6px;
}

.grdbody.md h2 {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin: 18px 0 7px;
  font-weight: 400;
}

.grdbody.md h3 { font-size: 13px; color: rgba(255, 255, 255, 0.82); margin: 14px 0 6px; }
.grdbody.md p { margin: 0 0 9px; }
.grdbody.md ul, .grdbody.md ol { margin: 0 0 10px; padding-left: 17px; }
.grdbody.md li { margin-bottom: 3px; }

.grdbody.md code {
  font-family: var(--mono);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 11px;
  color: #c4b5fd;
}

.grdbody.md pre {
  font-family: var(--mono);
  background: #090a0e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 2px solid var(--ac, #8b5cf6);
  border-radius: 8px;
  padding: 11px 13px;
  margin: 0 0 10px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.72);
  white-space: pre;
  word-break: normal;
}

.grdbody.md pre code {
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
}

.grdbody.md a {
  color: #8b5cf6;
  text-decoration: none;
  border-bottom: 1px solid rgba(139, 92, 246, 0.35);
}

.grdbody.md blockquote {
  margin: 0 0 10px;
  padding: 2px 0 2px 12px;
  border-left: 2px solid rgba(139, 92, 246, 0.4);
  color: rgba(255, 255, 255, 0.5);
}

/* READMEs carry fixed width attributes and oversized SVG; contain them or
   they break the panel layout. */
.grdbody.md img,
.grdbody.md svg {
  max-width: 100%;
  height: auto;
}

.grdbody.md table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 0 0 10px;
  font-size: 11px;
  max-width: 100%;
}

.grdbody.md th,
.grdbody.md td {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 5px 9px;
  text-align: left;
}

.grdbody.md th { color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.03); }

.grdbody.md details {
  margin: 0 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 11px;
}

.grdbody.md summary { cursor: pointer; color: rgba(255, 255, 255, 0.8); }

.grdbody.md hr {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 14px 0;
}
```

- [ ] **Step 5: Verify manually with a torture-test README**

First check a real one: click `file-meet` and confirm the markdown renders as formatted HTML — headings styled, code blocks with the purple left border, links purple.

Then verify the hard cases. Temporarily point a project's `repo` at a repository whose README is known to contain badges and HTML (or temporarily hardcode a test markdown string in `ProjectsGraph.tsx` containing all five constructs below) and confirm each renders:

```markdown
<p align="center">
  <img src="https://img.shields.io/badge/go-1.22-00ADD8" alt="go">
  <img src="./assets/logo.svg" width="120" alt="logo">
</p>

<svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="none" stroke="#8b5cf6" stroke-width="3"/></svg>

<details><summary>Click me</summary>Hidden content here.</details>

| flag | meaning |
|---|---|
| `--relay` | force TURN |

<script>alert('xss')</script>
```

Expected:
- The shields.io badge (absolute URL) loads.
- The relative `./assets/logo.svg` has been rewritten — inspect it in devtools and confirm `src` starts with `https://raw.githubusercontent.com/`. It may 404 if the file does not exist in that repo; what matters is the rewrite happened.
- The inline `<svg>` renders as a visible purple circle.
- `<details>` is collapsible and clicking `Click me` expands it.
- The table renders with borders and scrolls horizontally if narrow.
- **The `<script>` tag does not execute and does not appear in the DOM.** Confirm no `alert` fires and devtools shows no `<script>` inside the panel. If an alert fires, `rehypeSanitize` is not last in the plugin array — fix the order.
- Nothing overflows the panel horizontally; the page body never gains a horizontal scrollbar.
- Remove any temporary test markdown before committing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/components/graph/Readme.tsx app/components/sections/ProjectsGraph.tsx app/globals.css
git commit -m "feat(projects): render README markdown with sanitized inline SVG and HTML"
```

---

## Task 11: Retire the old Projects section

**Files:**
- Delete: `app/components/sections/Projects.tsx`
- Modify: `app/globals.css`
- Modify: `app/components/CommandPalette.tsx` (only if it references the old section)

**Context:** The new section has been live since Task 6; the old file has been dead code since then. Its CSS is a different matter — `.win` and `.winbar` are **reused by the new section** and must not be removed.

- [ ] **Step 1: Confirm nothing imports it**

```bash
grep -rn "sections/Projects'" app/ --include=*.tsx
grep -rn "ProjectsSection" app/ --include=*.tsx
```

Expected: no results. If either returns a hit, fix that import to `ProjectsGraph` before continuing.

- [ ] **Step 2: Delete the component**

```bash
git rm app/components/sections/Projects.tsx
```

- [ ] **Step 3: Find which CSS is now orphaned**

The old section used `.tui`, `.tui-grid`, `.pane`, `.pane-t`, `.lhdr`, `.prow`, `.bat`, `.bl`, `.bln`, `.bc`, `.batlogo`, `.batcur`, `.statusline`, `.sl-mode`, `.sl-ctx`, `.sl-keys`, `.mdh1`, `.mdh2`, `.blk`, `.commits`, `.cblock`, `.spark`, `.kbadge`, `.win`, `.winbar`, `.wintitle`.

For each, check whether anything still uses it:

```bash
for c in tui tui-grid pane pane-t lhdr prow bat bl bln bc batlogo batcur statusline sl-mode sl-ctx sl-keys mdh1 mdh2 blk commits cblock spark kbadge win winbar wintitle; do
  n=$(grep -rl "\"[^\"]*\b$c\b" app/ --include=*.tsx 2>/dev/null | wc -l)
  echo "$c: $n"
done
```

Delete from `app/globals.css` only the rules whose class reports `0`. **`kbadge`, `win`, `winbar` and `wintitle` will report non-zero — keep them**, they are used by the new graph section and elsewhere.

- [ ] **Step 4: Check the command palette**

```bash
grep -n "projects" app/components/CommandPalette.tsx
```

The palette navigates by element id. The new section keeps `id="projects"`, so navigation should already work — but confirm the entry exists and its label still makes sense. If it describes the old TUI (for example mentioning "lazygit"), update the wording.

- [ ] **Step 5: Verify manually**

```bash
npm run build
```
Expected: compiles clean with no unused-import or missing-module errors.

Then:
- Load the site. The Projects section shows the graph. No duplicate or leftover TUI is visible anywhere.
- Press `⌘K`, choose Projects: the page scrolls to the graph section.
- Scroll the whole page top to bottom looking for visual regressions — the deleted CSS must not have been shared with a section you did not check. Pay attention to the HTB and GitHub sections, which use `.card`, `.kpi` and `.bar`.
- `git status` shows only the intended deletions.

- [ ] **Step 6: Commit**

```bash
git add -A app/components/sections/Projects.tsx app/globals.css app/components/CommandPalette.tsx
git commit -m "refactor(projects): remove the superseded TUI section and its orphaned CSS"
```

---

## Task 12: Site-wide reveals with stagger

**Files:**
- Modify: `app/lib/reveal.ts`
- Modify: `app/globals.css`
- Modify: `app/components/sections/Languages.tsx`, `app/components/sections/Social.tsx`, `app/components/sections/GitHub.tsx`, `app/components/sections/HTB.tsx`, `app/components/sections/ProjectsGraph.tsx`

**Interfaces:**
- Produces: `useReveal()` (existing signature, bug fixed) and a `.reveal-stagger` CSS class that delays direct children by index with no per-child JavaScript.

**Context:** `useReveal()` exists and works but is only used by Hero and Skills. `.reveal` already exists in `globals.css` (`opacity: 0`, `translateY(20px)`, 0.6s ease-out → `.revealed`). Projects, GitHub, HTB, Social and Languages have no entrance animation at all.

`app/lib/reveal.ts` also has a stale-ref bug: its cleanup reads `ref.current` inside the returned closure, which React may have already nulled.

- [ ] **Step 1: Fix the hook and add reduced-motion handling**

Replace `app/lib/reveal.ts` with:

```ts
'use client';

import { useRef, useEffect } from 'react';

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    // Capture the node — reading ref.current in cleanup is a stale-ref bug,
    // React may have nulled it by then.
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);

  return ref;
}
```

The generic parameter lets sections attach it to a `<section>` rather than only a `<div>`, which is what makes step 3 possible.

- [ ] **Step 2: Add the stagger CSS**

Append to `app/globals.css`:

```css
/* Stagger direct children on reveal. Pure CSS — capped at 8 so long lists
   do not crawl; anything beyond the 8th shares the last delay. */
.reveal-stagger > * {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.55s ease-out, transform 0.55s ease-out;
  transition-delay: 420ms;
}

.reveal-stagger.revealed > * {
  opacity: 1;
  transform: none;
}

.reveal-stagger > *:nth-child(1) { transition-delay: 0ms; }
.reveal-stagger > *:nth-child(2) { transition-delay: 60ms; }
.reveal-stagger > *:nth-child(3) { transition-delay: 120ms; }
.reveal-stagger > *:nth-child(4) { transition-delay: 180ms; }
.reveal-stagger > *:nth-child(5) { transition-delay: 240ms; }
.reveal-stagger > *:nth-child(6) { transition-delay: 300ms; }
.reveal-stagger > *:nth-child(7) { transition-delay: 360ms; }

@media (prefers-reduced-motion: reduce) {
  .reveal,
  .reveal-stagger > * {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    transition-delay: 0ms !important;
  }
}
```

- [ ] **Step 3: Apply reveal to every section that lacks it**

For each of `Languages.tsx`, `Social.tsx`, `GitHub.tsx`, `HTB.tsx` and `ProjectsGraph.tsx`:

1. Add the import: `import { useReveal } from '@/lib/reveal';`
2. Inside the component: `const reveal = useReveal<HTMLDivElement>();`
3. Put `ref={reveal}` and `className="reveal"` on the section's `.wrap` div.

Then add `reveal-stagger` to the specific multi-child containers so their children cascade rather than appearing together:

- `GitHub.tsx` — the `.row4` KPI row and the `.ghbento` grid.
- `HTB.tsx` — the `.row4` KPI row and the `.row2` card row.
- `Social.tsx` — the container holding the social links.
- `Languages.tsx` — leave alone. It is an infinite marquee; staggering its children fights the animation.

Example for the GitHub KPI row:

```tsx
        <div className="row4 reveal-stagger">
```

The `reveal-stagger` class only activates once an ancestor with `.reveal` gains `.revealed`, so no extra observer is needed per row — but note the stagger rule targets `.reveal-stagger.revealed > *`, meaning the element needs `.revealed` itself. Put `reveal-stagger` together with `reveal` and its own `ref` where a row should cascade independently:

```tsx
  const kpiReveal = useReveal<HTMLDivElement>();
  ...
        <div className="row4 reveal reveal-stagger" ref={kpiReveal}>
```

Use one `useReveal()` call per element that needs its own trigger.

- [ ] **Step 4: Verify manually**

Hard-reload the page and scroll slowly from top to bottom.

Expected:
- Every section fades and slides up as it enters the viewport: Skills, Projects, HTB, GitHub, Social. None of them just pop in fully formed.
- The GitHub and HTB KPI tiles arrive one after another, roughly 60ms apart — not all at once.
- The Languages marquee still scrolls smoothly and its items are not individually delayed.
- Scroll back up and down again: revealed sections stay revealed and do not re-animate.
- Enable OS reduce-motion, hard-reload: everything is immediately visible in its final position with no movement at all. Nothing is stuck invisible.
- Console has no errors.

- [ ] **Step 5: Commit**

```bash
git add app/lib/reveal.ts app/globals.css app/components/sections/
git commit -m "feat(anim): reveal every section on scroll with CSS-only stagger"
```

---

## Task 13: Count-up numbers and growing bars

**Files:**
- Create: `app/lib/countup.ts`
- Modify: `app/components/sections/GitHub.tsx`
- Modify: `app/components/sections/HTB.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `useCountUp(target: number, durationMs?: number)` returning `{ ref, value }` where `ref` attaches to the element to observe and `value` is the number to render.

- [ ] **Step 1: Write the hook**

Create `app/lib/countup.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION = 900;

/**
 * Animate a number from 0 to `target` the first time the element enters the
 * viewport. Returns the ref to attach and the value to render.
 */
export function useCountUp(target: number, durationMs: number = DEFAULT_DURATION) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!Number.isFinite(target) || target === 0) {
      setValue(target || 0);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    // Re-animate when the target changes (data arrives after mount).
    doneRef.current = false;
    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !doneRef.current) {
          doneRef.current = true;
          raf = requestAnimationFrame(tick);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => {
      observer.unobserve(node);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, durationMs]);

  return { ref, value };
}
```

- [ ] **Step 2: Apply to the GitHub KPI tiles**

In `app/components/sections/GitHub.tsx`, add the import:

```tsx
import { useCountUp } from '@/lib/countup';
```

Extract a small local component so each tile owns its own observer — hooks cannot go inside a `.map`:

```tsx
function CountKpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="kpi" ref={ref}>
      <div className="lab">{label}</div>
      <div className={accent ? 'val g' : 'val'}>{shown.toLocaleString()}</div>
    </div>
  );
}
```

Replace the four hand-written KPI tiles in the surviving KPI block with:

```tsx
          <CountKpi label="Repos" value={data.repos} />
          <CountKpi label="Stars" value={data.stars} accent />
          <CountKpi label="Followers" value={data.followers} />
          <CountKpi label="Commits/yr" value={data.commitsPerYear} />
```

Which block survives is decided in Task 14 (the tiles are currently duplicated). If Task 14 has not run yet, apply this to **both** blocks so the section stays consistent; Task 14 will delete one.

- [ ] **Step 3: Apply to the HTB KPI tiles**

In `app/components/sections/HTB.tsx`, add the same import and a matching local component (`rank` is a string and stays as-is; `user_owns`, `system_owns` and `points` are numbers and count up):

```tsx
function CountKpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="kpi" ref={ref}>
      <div className="lab">{label}</div>
      <div className="val">{shown.toLocaleString()}</div>
      {sub && <div className="dd">{sub}</div>}
    </div>
  );
}
```

Use it for User owns, System owns and Points. Leave the Rank tile unchanged.

- [ ] **Step 4: Make bars grow on reveal**

The HTB bars already use a `--w` custom property on `.fill`. Make the fill animate from zero width to `--w` when its section reveals, by adding to `app/globals.css`:

```css
.bar .track .fill {
  width: 0;
  transition: width 0.85s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.reveal.revealed .bar .track .fill,
.reveal-stagger.revealed .bar .track .fill {
  width: var(--w, 0%);
}

.langbar span {
  width: 0;
  transition: width 0.85s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .bar .track .fill,
  .reveal.revealed .bar .track .fill,
  .reveal-stagger.revealed .bar .track .fill { transition: none; width: var(--w, 0%); }
  .langbar span { transition: none; }
}
```

For the GitHub language bar, the width is set inline via `style`, which cannot be delayed by CSS alone. Set the inline width only once the section has revealed: add a reveal ref to the language-bar container and gate the width:

```tsx
  const langReveal = useReveal<HTMLDivElement>();
  const [langsIn, setLangsIn] = useState(false);

  useEffect(() => {
    const node = langReveal.current;
    if (!node) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setLangsIn(true); obs.unobserve(e.target); }
    }, { threshold: 0.25 });
    obs.observe(node);
    return () => obs.unobserve(node);
  }, [langReveal]);
```

then render:

```tsx
            <div className="langbar" ref={langReveal}>
              {data.languages.map((lang) => (
                <span
                  key={lang.name}
                  style={{ width: langsIn ? `${lang.percentage}%` : 0, background: lang.color }}
                />
              ))}
            </div>
```

- [ ] **Step 5: Verify manually**

Hard-reload and scroll down slowly.

Expected:
- The GitHub KPI numbers visibly count up from 0 to their values over roughly a second, each starting as its tile enters view — they do not snap.
- The HTB `User owns`, `System owns` and `Points` numbers count up. `Rank` does not animate (it is a string).
- HTB difficulty and OS bars grow from zero width rather than appearing full.
- The GitHub language bar grows from zero.
- Scroll away and back: numbers stay at their final values and do not restart.
- Enable OS reduce-motion, hard-reload: every number shows its final value instantly and every bar is full width immediately.
- With HTB unconfigured (from Task 1) the HTB section is absent and nothing errors.
- Console has no errors.

- [ ] **Step 6: Commit**

```bash
git add app/lib/countup.ts app/components/sections/GitHub.tsx app/components/sections/HTB.tsx app/globals.css
git commit -m "feat(anim): count-up KPI numbers and bars that grow on reveal"
```

---

## Task 14: GitHub Activity and Security Skills cleanup

**Files:**
- Modify: `app/components/sections/GitHub.tsx`
- Modify: `app/api/github/route.ts`
- Modify: `app/components/sections/Skills.tsx`

**Context — four concrete defects in `GitHub.tsx`:**

1. The same four KPI tiles are rendered **twice**: as a `.row4` row (originally lines 143–160) and again inside `.ghbento` (originally lines 223–238).
2. The heatmap renders **196 cells** captioned `Contributions · last year`. 196 is 28 weeks, not a year.
3. `error` state is declared and read (originally lines 111–121) but `setError` is never called — dead code. The route always returns 200, so the branch is unreachable.
4. `generateHeatmap` fills the demo heatmap with `Math.random()` inside a `useMemo`, which produces a different pattern on server and client.

- [ ] **Step 1: Remove the duplicated KPI block**

Keep the `.row4` row above the bento (it reads as a summary row) and delete the four `.kpi` tiles nested inside `.ghbento`, leaving `.card.heatbig` as its only child.

`.ghbento` now wraps a single element, so its grid would leave empty tracks where the tiles used to be. Replace whatever the current `.ghbento` rule is in `app/globals.css` with:

```css
.ghbento {
  display: block;
  margin-top: 18px;
}
```

Do not delete the wrapper — `.heatbig` and the reveal classes hang off it.

- [ ] **Step 2: Remove the dead error state**

Delete the `error` state declaration and the entire `if (error) { ... }` block. Nothing sets it.

- [ ] **Step 3: Make the heatmap a real year**

Replace the constant and the demo generator so the grid is 53 weeks × 7 days = 371 cells, and make the demo data deterministic so server and client agree:

```tsx
const HEATMAP_WEEKS = 53;
const HEATMAP_CELLS = HEATMAP_WEEKS * 7; // 371 — a real year, unlike the old 196

// Deterministic pseudo-random so SSR and the client produce the same grid.
function demoHeatmap(): number[] {
  const out: number[] = [];
  let seed = 1337;
  for (let i = 0; i < HEATMAP_CELLS; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out.push(seed % 5);
  }
  return out;
}
```

Delete the `generateHeatmap` `useMemo` and its `[generateHeatmap]` dependency, using `demoHeatmap()` where it was referenced.

Then normalise the real data's length **in the component** rather than changing the route — the route scrapes an upstream page whose day count varies, so clamping at the point of use is the robust place to do it:

```tsx
function toYear(cells: number[]): number[] {
  if (cells.length >= HEATMAP_CELLS) return cells.slice(cells.length - HEATMAP_CELLS);
  return [...Array(HEATMAP_CELLS - cells.length).fill(0), ...cells];
}
```

Use `toYear(apiData.heatmap)` when real data is present. Update the CSS grid for `.heat` so 53 columns of 7 fit — set `grid-template-rows: repeat(7, 1fr)` with `grid-auto-flow: column` so weeks read as columns, matching how GitHub renders it.

Keep the caption `Contributions · last year` — it is now accurate.

- [ ] **Step 4: Skills — make the radar labels legible**

In `app/components/sections/Skills.tsx`, the axis label group is `fontSize="9"`. Change it to `fontSize="11"`, and move the label ring outward from `133` to `140` so the larger text clears the outer polygon (the chart radius is `110`):

```tsx
              <g fontFamily="monospace" fontSize="11" fill="#9ca3af">
                {axes.map((axis, i) => {
                  const [x, y] = polarToCartesian(i, 140, axes.length);
```

- [ ] **Step 5: Skills — calm the point pulse**

The six data points animate `r` from `3.5` to `6.5` over 2s with `begin` values `0.6 + i * 0.14` — 0.14s apart reads as simultaneous noise. Widen the stagger and reduce the amplitude:

```tsx
                  <animate
                    attributeName="r"
                    values="3.5;5;3.5"
                    dur="2s"
                    begin={`${0.6 + i * 0.33}s`}
                    repeatCount="indefinite"
                  />
```

- [ ] **Step 6: Skills — unify the class vocabulary**

The section element is `className="section py-24 px-4"` and the heading is `className="text-3xl md:text-4xl font-bold mb-8"` — Tailwind utilities in a section whose siblings all use the site's own classes. Change to match every other section:

```tsx
    <section id="skills" className="sec">
      <div className="wrap">
        <div ref={reveal} className="reveal skillblk" data-active={activeConcept ?? undefined}>
          <span className="seclabel">Skills</span>
          <div className="eyebrow">cat skills.md</div>
          <h2 className="h2"><ScrambleText text="Security skills" /></h2>
```

Note the `.eyebrow` no longer needs a literal `$` — the CSS `::before` supplies it. Check the current markup does not already hardcode one; if it does, remove it.

- [ ] **Step 7: Verify manually**

```bash
npm run build
```
Expected: compiles clean, and **no hydration warning** in the console on load (that is what step 3's deterministic demo data fixes).

Then in the browser:
- The GitHub section shows the four KPI tiles **once**. Count them.
- The heatmap is a wide grid of 7 rows reading as ~53 columns, visually proportioned like GitHub's own contribution graph rather than a short block.
- No layout hole where the removed bento tiles used to be.
- The Skills radar axis labels are comfortably readable and none of them overlap the outer polygon ring.
- Watch the radar points for 5 seconds: they pulse in a visible travelling sequence, not all together, and the pulse is subtle rather than a large jump.
- The Skills section now has a `Skills` pill above the eyebrow, matching HTB and GitHub, and its heading size matches the other sections.
- The eyebrow reads `$ cat skills.md` with exactly one `$`.
- The skills-to-machines hover-dim still works: hovering a legend row or radar point still highlights matching HTB machines in the carousel below.
- Console has no errors or warnings.

- [ ] **Step 8: Commit**

```bash
git add app/components/sections/GitHub.tsx app/api/github/route.ts app/components/sections/Skills.tsx app/globals.css
git commit -m "fix(github,skills): de-duplicate KPIs, real 53-week heatmap, legible radar, unified classes"
```

---

## Final verification

After Task 14, run the spec's six observable checks end to end:

1. **Hero** — one background layer, no 8-second change, not black.
2. **Projects** — graph renders; hovering a language lights exactly the projects using it, and at least one language lights two; clicking a project opens its README with images and badges intact; no node sits under the panel at any rotation or zoom; empty click and `Esc` both deselect and re-frame; 3D reads as a compact sphere.
3. **README** — inline `<svg>`, a shields.io badge, `<p align="center">`, `<details>` and a relative image path all render; a `<script>` in the source does not execute; `tsuki` shows the fallback.
4. **Animations** — every section animates in on first scroll; KPI numbers count up; bars grow; with `prefers-reduced-motion` everything is immediately final and the graph does not animate.
5. **GitHub / Skills** — KPIs appear once; heatmap is 53 weeks; radar labels legible.
6. **503** — with `HTB_API_TOKEN` and `HTB_USER_ID` unset, the HTB section shows no error and `Error: HTTP 503` appears nowhere; `/api/htb` returns 200.

Then a production build and a mobile pass:

```bash
rm -rf .next && npm run build
```

Expected: clean build. On Windows a stale `.next` cache can produce a spurious `<Html> should not be imported outside of pages/_document` error on the error pages — the `rm -rf .next` is what rules that out.

At a 375px viewport: the graph canvas is 300px tall, the README panel is full width, the statusline drops its extra hints, and the page body never scrolls horizontally.
