# Portfolio v5 — Design

**Goal:** Replace the Projects section with an Obsidian-style force-directed graph (2D + 3D sphere) that loads real GitHub READMEs, extend scroll animations across the whole site, fix the visible `Error: HTTP 503`, and clean up GitHub Activity and Security Skills.

**Architecture:** All work is in the public site. The existing KV content layer (`app/lib/content.ts`, `/api/content/[type]`) is extended with one new field, not replaced. The graph is a single `<canvas>` with a hand-written force simulation and hand-written perspective projection — no 3D or physics library. README rendering adds the `react-markdown` family because the READMEs contain inline SVG and HTML.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript, Upstash Redis (KV), Canvas 2D, IntersectionObserver. New deps: `react-markdown`, `remark-gfm`, `rehype-raw`, `rehype-sanitize`.

**Out of scope:** The admin panel. It gets its own spec and cycle, as agreed. The only admin change here is the input for the new `repo` field (see §6.1).

---

## Global Constraints

- **No new dependency for the 3D mode.** Perspective projection is `s = FOC / (FOC - z)` computed by hand, same approach as the existing hero canvas.
- **Design tokens come from `app/globals.css` verbatim.** Surfaces are neutral glass (`--glass: rgba(21,21,29,.7)`, `#0d0d13`, `#090a0e`), borders are white at 8% (`--line`), purple `#8b5cf6` is accent only. `.eyebrow` is green `#22c55e` with `$ ` injected by `::before` at 0.7 opacity. `.h2` is Sora weight 800, `letter-spacing: -0.015em`. `.seclabel` is 11px / `0.18em` / `border-radius: 999px` / `padding: 6px 14px`. Teal `#5eead4` marks active state (it is already `.pane.active`'s colour).
- **`prefers-reduced-motion: reduce` disables every animation added by this spec**, including the graph's simulation loop (nodes stay at their settled positions) and every reveal, counter, and growing bar (final state rendered immediately).
- **Remote HTML is always sanitized.** README content is fetched at runtime and injected as HTML; `rehype-sanitize` is mandatory, never optional.
- **No scroll hijacking.** No pinning, no parallax, no wheel-scrubbed timelines.
- **Language colours reuse the existing `LANG_COLORS` map** in `app/components/sections/GitHub.tsx`. Extract it to a shared module rather than duplicating it.
- Spanish-language UI copy stays Spanish; existing English copy stays English. This spec changes no user-facing wording except where a section's text is removed outright.

---

## 1 · Hero — remove the orb layer

**Files:** `app/components/HeroBackground.tsx`, `app/globals.css`

The hero currently crossfades two background layers every 8 seconds: `bgGlow` (two blurred `.orb` divs) and `#wave` (the ASCII flow-field canvas). Only the ASCII canvas survives.

Remove from `HeroBackground.tsx`: the `showWave` state, the `glowRef`, the `setInterval` crossfade effect, the effect that writes `style.opacity` on both layers, and the `<div className="bg bgGlow">` element with its two `.orb` children.

Remove from `globals.css`: `.bgGlow`, `.orb`, `.orb1`, `.orb2`, `@keyframes orbDrift1`, `@keyframes orbDrift2`, and the `.orb { animation: none }` line inside the `prefers-reduced-motion` block.

**Critical detail:** `#wave` is declared `opacity: 0` in CSS (globals.css ~line 212) and was raised to 1 by the crossfade JS. With the JS gone, that rule must become `opacity: 1` or the hero renders black. This is the one way this task can silently break.

Keep: the flow-field maths, the `IntersectionObserver` that pauses the loop off-screen, the DPR-aware resize, the `prefers-reduced-motion` early return, and `.veil`.

---

## 2 · Projects — Obsidian-style graph

Replaces the entire current TUI (window chrome, left list pane, `bat`-style right pane with fabricated line numbers, `statusline`, and the hardcoded `git clone git@github.com:s7lver2/{slug}.git` that was identical for every project).

### 2.1 Data model

Nodes are of two kinds, forming a bipartite graph:

- **Project nodes** — one per entry in the projects content list. Colour = the project's existing `ac` field.
- **Language nodes** — one per distinct language across all repos. Colour from the shared language-colour map.

Edges connect a project to each language it uses. There are **no hand-authored edges**: they derive from GitHub's per-repo language breakdown. This is what gives the graph real topology — the four projects share zero hand-written `tags`, but they do share languages (`file-meet`↔`ZephyrOS` via Shell, `file-meet`↔`tsuki` via Makefile, `ZephyrOS`↔`tsuki` via C).

Node radius: projects `9 + degree * 1.4`, languages `3.4 + degree * 1.3`.

### 2.2 Physics

Hand-written velocity integration, run to convergence on mount (500 steps at `alpha = 1`), then a continuous loop at `alpha = 0.5`.

Per step: pairwise repulsion `f = k / d²`; spring force along each edge `f = (d - rest) * k_spring`; a centering or radial force; then `v *= damping` and `pos += v * alpha`. A minimum-distance push-apart resolves overlap.

Parameters differ per mode — 2D needs more space so labels do not collide:

| Parameter | 2D | 3D |
|---|---|---|
| Repulsion, project↔project | 3400 | 1500 |
| Repulsion, other pairs | 1500 | 620 |
| Spring rest length | 52 | 34 |
| Spring constant | 0.05 | 0.075 |
| Centering / radial | `v -= pos * 0.011` | radial to shell `R = 88`, k = 0.1 |
| Collision padding | 9 | 5 |
| Damping | 0.8 | 0.8 |

In 2D, `z` is driven to 0 (`vz += (0 - z) * 0.14`) so switching modes is reversible. Entering 3D seeds any flat node with `z = (random - 0.5) * 70`.

The 3D radial constraint is what makes the cloud read as a solid sphere rather than a loose scatter; `R = 88` was chosen over a larger radius specifically because the looser version looked dispersed.

### 2.3 Projection

Rotate by `cam.ry` around Y, then `cam.rx` around X, then apply perspective with `FOC = 470`:

```
s  = FOC / (FOC - z_rotated)
sx = W/2 + (x_rotated * s) * zoom + px
sy = H/2 + (y_rotated * s) * zoom + py
```

`zoom` and `px`/`py` factor out of the rotation, which is what makes the fit calculation in §2.6 solvable in closed form. In 2D, `s = 1` and no rotation is applied.

Depth cueing in 3D: nodes are drawn back-to-front sorted by rotated `z`; radius, stroke width, label size and alpha all scale with `s`.

### 2.4 Node rendering — glyph mono

The node **is** a monospace character: `◆` for projects, `○` for languages, drawn with `ctx.fillText` at `radius * 2.9` (projects) and `radius * 2.5` (languages). Projects get `ctx.shadowColor = accent; ctx.shadowBlur = 13` when lit, mirroring the `text-shadow: 0 0 10px currentColor` already on `.batlogo`. Reset `shadowBlur` to 0 after each glyph or it bleeds into subsequent draws.

Selected project: a teal `#5eead4` ring at `radius * 1.55`, alpha 0.6.

Labels are drawn below the glyph. Language labels are hidden unless the node is lit or `zoom > 1.2`, so the graph stays readable when zoomed out. Project labels always show.

### 2.5 Interaction

- **Hover** — lights the node, its direct neighbours, and their edges; everything else drops to alpha 0.12. Edge colour becomes the project's accent.
- **Drag on background** — pans in 2D (`cam.px/py`), rotates in 3D (`cam.ry/rx`, with `rx` clamped to ±1.45 rad to prevent flipping).
- **Drag on a node** — repositions it, 2D only. In 3D it is disabled because dragging a projected point through a rotated space is not predictable.
- **Wheel** — zoom, clamped to 0.32–2.6, factor 1.11 per notch.
- **Click on a project node** — opens its README (§2.7).
- **Click on empty space, or `Esc`** — deselects, closes the README, and re-frames to full width.
- **Drag threshold** — a pointer that moved more than 4px is a drag, not a click, so panning never deselects by accident.
- **Controls** — `⊡ fit`, `⟲ reset` (restores default rotation), and `◐ auto-rot` (slow idle rotation in 3D, `cam.ry += 0.0022` per frame, paused while dragging). Buttons use the existing `.kbadge` style.

Hit testing is distance-to-projected-centre against `max(radius * s * zoom, 9) + 5`.

### 2.6 Re-framing when the README opens

The README panel covers the right 58% of the stage. Naively panning would push nodes off the left edge, so instead:

1. Compute the projected bounding box of all nodes at `zoom = 1, px = py = 0`, padded per node by `radius + 12`.
2. Solve the zoom that fits that box into the visible band (`W * 0.42` wide, minus 28px padding on each side) and into the full height.
3. Solve `px` so the box centre lands at the band's centre, and `py` so it is vertically centred.
4. Tween `px`, `py`, `zoom` over 460ms with `ease = 1 - (1 - k)³`.

Because step 1 runs on already-projected coordinates, this works identically with the sphere at any rotation. Closing re-frames to full width the same way. **Any user drag or wheel cancels the tween immediately** so the camera never fights the user.

### 2.7 README loading and rendering

**Source:** `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md`, fetched server-side by our own route (§6.3) — the client calls `/api/projects/{slug}/readme`, never raw.githubusercontent directly. Raw rather than the REST API because raw does not consume the 60-request/hour unauthenticated rate limit.

**Pipeline:** `react-markdown` with `remark-gfm` (tables, task lists, strikethrough), `rehype-raw` (parses the inline HTML the READMEs contain), then `rehype-sanitize`.

**Sanitize schema** — extend the default with the elements and attributes real READMEs use:

- Allow elements: `svg`, `path`, `g`, `circle`, `rect`, `line`, `polyline`, `polygon`, `defs`, `linearGradient`, `stop`, `text`, `tspan`, `use`, `picture`, `source`, `details`, `summary`, `img`, `br`, `div`, `span`, `p`, `a`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `kbd`, `sub`, `sup`.
- Allow attributes: `align`, `width`, `height`, `viewBox`, `fill`, `stroke`, `stroke-width`, `d`, `cx`, `cy`, `r`, `x`, `y`, `x1`, `y1`, `x2`, `y2`, `points`, `transform`, `xmlns`, `src`, `srcset`, `media`, `alt`, `href`, `title`, `open`, `colspan`, `rowspan`.
- Block: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, every `on*` handler, and `javascript:` / `data:` URLs except `data:image/`.

**Relative URL rewriting** — a custom rehype plugin rewrites relative `src` and `href` on `img`, `source`, `a` and `use` to `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}`. Without this, every image in every README breaks, because `./assets/logo.svg` does not exist on this domain. Absolute URLs (shields.io badges and similar) pass through untouched.

**Overflow containment** — `img`, `svg`, `pre`, and `table` inside the README pane get `max-width: 100%`, images `height: auto`, and `pre`/`table` their own `overflow-x: auto`. READMEs carry fixed `width` attributes that would otherwise break the layout.

**No CSP work needed** — `next.config.js` is empty and the app sets no Content-Security-Policy, so external badge images load as-is. This was verified, not assumed.

**Fallback when there is no repo** — the panel shows the project's `desc` plus its language breakdown. The node stays clickable. Chosen over marking the node private and non-interactive, because a dead node is worse than a thin panel. `tsuki` is the case that exercises this.

### 2.8 Section chrome

Frame the graph in the site's real vocabulary: `.seclabel` pill reading `Projects`, `.eyebrow` reading `graph ~/projects --link-by=language`, `.h2` in Sora 800 with one word wrapped in `.grad`, and the existing `.win` container (`border-radius: 16px`, `box-shadow: 0 36px 100px -55px rgba(139,92,246,.5)`) with a `.winbar` holding the traffic-light dots, the `s7lver@portfolio:~$ graph` title, and the mode buttons.

Below the canvas, a statusline reusing the vocabulary of the one already in Projects: mode badge, path `~/projects/{slug}`, zoom percentage, node and edge counts, and context-sensitive key hints on the right. The mode badge turns teal `#5eead4` while a README is open.

**Mobile** — below 760px the README panel is full-width. The graph keeps pan and zoom; node dragging is unnecessary on touch and the 4px threshold already distinguishes taps from drags.

---

## 3 · Animations

**Files:** `app/lib/reveal.ts`, every section component, `app/globals.css`

Today `useReveal()` is used only by Hero and Skills. `.reveal` already exists (`opacity: 0`, `translateY(20px)`, 0.6s ease-out → `.revealed`). Projects, GitHub, HTB, Social, Languages and Contact have no entrance animation at all.

**Extend reveal to every section.** Add a stagger variant: children receive `transition-delay` computed from their index (60ms step, capped at 8 children so long lists do not crawl). Implemented as a CSS custom property set inline (`--d: 180ms`) consumed by a `.reveal-stagger > *` rule — not per-child JS.

**Count-up numbers.** When a number enters the viewport, animate from 0 to its value with `requestAnimationFrame` over ~900ms, ease-out. Applies to the GitHub KPI tiles (repos, stars, followers, commits/yr) and the commit total. Respects `prefers-reduced-motion` by rendering the final value immediately.

**Bars that grow.** Language bars in GitHub and the radar polygon in Skills animate from 0 to their value on reveal instead of appearing complete. The Skills polygon already has a scale-in via the Web Animations API — keep that mechanism, extend the idea to the bars.

**Hover micro-interactions.** Reuse the pattern already in `.kpi:hover` (`translateY(-4px)`, accent border, long soft shadow) across cards that lack it. No new visual language, just consistent application.

`useReveal` currently has a stale-ref bug in its cleanup (`ref.current` read inside the returned closure). Fix it while touching the file: capture the node in a local before observing.

---

## 4 · GitHub Activity and Security Skills

**Files:** `app/components/sections/GitHub.tsx`, `app/components/sections/Skills.tsx`, `.env.local` / `app/api/github/route.ts`

### 4.1 GitHub — defects to fix

- **Duplicated KPI block.** The same four KPI tiles are rendered twice: once as a `.row4` row (lines 143–160) and again inside `.ghbento` (lines 223–238). Keep one placement.
- **Heatmap is wrong.** It renders 196 cells captioned "Contributions · last year". 196 is 28 weeks, not a year. Render 53 weeks × 7 days from real data, and keep the caption honest.
- **Dead error state.** `error` is declared and read (lines 111–121) but `setError` is never called. Remove the state and its branch, or wire it — removing is correct, since the route always returns 200.
- **Env var name mismatch.** `.env.local` defines `GITHUB_USERNAME`; `app/api/github/route.ts:3` reads `GITHUB_USER`. It works today only because of the `|| 's7lver2'` fallback. Align the names and document the correct one in `.env.example`.

### 4.2 Skills — light touches

- Radar axis labels are `fontSize="9"` — raise to `11` and keep the anchor logic that already handles left/right sides. The label ring radius (currently 133 against a 110 chart radius) needs to grow to about 140 so the larger text does not collide with the outer polygon.
- The six data points pulse via `<animate>` from `r=3.5` to `6.5` over 2s with `begin` values 0.14s apart, which reads as simultaneous noise. Widen the stagger to 0.33s per point and reduce the amplitude to `3.5 → 5`.
- The section mixes Tailwind utilities (`section py-24 px-4`, `text-3xl md:text-4xl font-bold mb-8`) with the site's own classes (`wrap`, `eyebrow`). Unify on the site's classes so it matches every other section.

No compositional redesign — the radar and legend layout stay.

---

## 5 · Fix `Error: HTTP 503`

**Files:** `app/api/htb/route.ts`, `app/components/sections/HTB.tsx`, `.env.example`

**Root cause:** `app/api/htb/route.ts:26` returns `{ error: 'missing_env' }` with status 503 when `HTB_API_TOKEN` or `HTB_USER_ID` is absent. Neither is in `.env.local`, and neither is documented in `.env.example` — they appear only in a code comment at the top of the route. `HTB.tsx:45` turns any non-ok response into `throw new Error(\`HTTP ${r.status}\`)`, and line 60 prints it raw. No external service is ever contacted; HackTheBox is not involved.

**Fix, three parts:**

1. `/api/htb` returns **200 with an empty payload** when the env vars are missing, matching what its sibling `app/api/htb/machines/route.ts:25` already does. The inconsistency between the two routes is why only this one broke visibly. Genuine upstream failures still return 500.
2. `HTB.tsx` stops mapping status codes into user-facing strings. Missing configuration renders an empty state, not an error. A real fetch failure may still show a message, but never a bare `HTTP <n>`.
3. `HTB_API_TOKEN` and `HTB_USER_ID` are added to `.env.example`. Undocumented variables are the reason this happened.

---

## 6 · New data and routes

### 6.1 `repo` field on projects

Add `repo?: string` to `ProjectC` in `app/lib/content-constants.ts`, format `"owner/name"` (e.g. `"s7lver2/file-meet"`). Populate the four defaults where a repo exists. Add the input to the admin projects editor (`app/admin/content/projects/page.tsx`) — the one admin change in this spec.

Why an explicit field instead of parsing `web`: only two of the four projects have `web` pointing at GitHub. `CodeDotJS` points at Vercel and `tsuki` has no `web` at all. Guessing from the URL would silently fail for half the data.

### 6.2 `GET /api/projects/graph`

Returns the graph ready to render, so the client does no fan-out:

```ts
{
  nodes: Array<{ id: string; kind: 'project' | 'language'; color: string;
                 degree: number; slug?: string; repo?: string | null;
                 desc?: string; status?: 'done'|'beta'|'dev' }>,
  links: Array<{ source: string; target: string; weight: number }>
}
```

It reads the projects list from KV, calls `GET /repos/{owner}/{repo}/languages` once per project that has a `repo`, builds language nodes from the union, and weights each link by that language's byte share of the repo.

**Caching is mandatory, not an optimisation.** One request per repo against an unauthenticated API limited to 60/hour per IP, on a platform with shared egress IPs, will fail under any real traffic. Cache the assembled response in KV with a TTL of 6 hours, serve stale on upstream error, and set `s-maxage=3600, stale-while-revalidate=86400` on the response. A project with no `repo`, or whose language fetch fails, still appears as a node with no language edges.

### 6.3 `GET /api/projects/[slug]/readme`

Fetches `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/README.md` for the project's `repo` and returns `{ ok: true, markdown: string, repo: string }`, or `{ ok: false, reason: 'no_repo' | 'not_found' | 'fetch_failed' }` with status 200 in every case — the client renders a fallback, never an error string. Cache headers `s-maxage=1800, stale-while-revalidate=86400`.

Going through our own route rather than fetching raw.githubusercontent from the browser keeps the caching in one place and avoids depending on that host's CORS headers.

### 6.4 Shared language colours

Extract the `LANG_COLORS` map and `colorFor()` helper out of `GitHub.tsx` into `app/lib/lang-colors.ts` and import it from both `GitHub.tsx` and the graph. Add the languages the graph needs that are missing today (`Makefile`, `CSS`). Do not duplicate the map.

---

## 7 · File structure

**New:**
- `app/components/sections/ProjectsGraph.tsx` — section shell: chrome, mode buttons, statusline, README panel, data fetching.
- `app/components/graph/engine.ts` — simulation and projection. Pure functions and a stepper over a node/link array; no React, no DOM.
- `app/components/graph/render.ts` — canvas drawing: glyph nodes, edges, depth cueing, labels.
- `app/components/graph/useGraph.ts` — hook wiring engine + renderer to a canvas ref, pointer events, camera, and the fit/tween logic.
- `app/components/Readme.tsx` — the `react-markdown` pipeline, sanitize schema, and relative-URL plugin.
- `app/lib/lang-colors.ts` — shared language colour map.
- `app/api/projects/graph/route.ts`
- `app/api/projects/[slug]/readme/route.ts`

**Modified:** `HeroBackground.tsx`, `Skills.tsx`, `GitHub.tsx`, `HTB.tsx`, `app/api/htb/route.ts`, `app/api/github/route.ts`, `app/lib/reveal.ts`, `app/lib/content-constants.ts`, `app/admin/content/projects/page.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example`.

**Deleted:** `app/components/sections/Projects.tsx` and its `.win`/`.tui`/`.pane`/`.prow`/`.bat`/`.statusline` CSS, unless those classes are still referenced elsewhere — check before removing, since `.win` and `.winbar` are reused by the new section.

The split matters: `engine.ts` holds the maths and is the part worth reasoning about in isolation; `render.ts` holds the drawing; the hook holds the React and browser wiring. Keeping them apart is what makes the physics parameters in §2.2 tunable without touching event handling.

---

## 8 · Decisions and rationale

**Why a graph at all, given four projects.** A shared-tag graph was the first idea and it does not work: the four projects share zero `tags`. Deriving edges from real per-repo languages produces genuine cross-links and needs no hand-maintained metadata. Obsidian's own graph looks sparse on small vaults and nobody reads that as a defect, which removes the remaining objection.

**Why hand-written 3D.** `three.js` or `react-force-graph-3d` would add hundreds of kilobytes for a sphere of ~18 nodes. The projection is a rotation matrix and a perspective divide. The hero already hand-rolls an animated canvas, so this matches the codebase rather than importing a new paradigm.

**Why canvas over SVG.** The renderer redraws every frame for depth sorting and hover state. Reordering DOM nodes per frame for z-sorting is the expensive path; canvas makes it trivial.

**Why `rehype-raw` plus `rehype-sanitize` and not one or the other.** The READMEs contain inline SVG and HTML, so raw parsing is required — which is exactly why sanitizing is also required. Rendering unsanitized remote HTML is an XSS vector regardless of who owns the repo.

**Why the raw-markdown option was dropped.** Displaying the markdown source with syntax highlighting needed no dependencies and suited the terminal aesthetic, but it cannot render inline SVG. The SVG requirement eliminated it, and eliminated the hand-rolled-parser option along with it.

**Defaults chosen without an explicit answer:** the graph opens in 2D with 3D one click away, and `auto-rot` starts off. Both were offered and not selected. The node style is a single parameter, so revisiting any of these is cheap.

---

## 9 · Verification

Each area has an observable check:

1. **Hero** — one background layer, no 8-second change, hero is not black.
2. **Projects** — graph renders; hovering a language lights exactly the projects using it; `Shell`, `C` and `Makefile` each touch two projects; clicking a project opens its README with images and badges intact; no node sits under the panel at any rotation or zoom; clicking empty space and `Esc` both deselect and re-frame; 3D reads as a compact sphere.
3. **README** — a README containing inline `<svg>`, a shields.io badge, `<p align="center">`, `<details>`, and a relative image path renders all five correctly; `tsuki` shows the fallback.
4. **Animations** — every section animates in on first scroll; KPI numbers count up; bars grow; with `prefers-reduced-motion` everything is immediately in its final state and the graph does not animate.
5. **GitHub / Skills** — KPIs appear once; heatmap is 53 weeks; radar labels legible.
6. **503** — with `HTB_API_TOKEN` and `HTB_USER_ID` unset, the HTB section shows an empty state and `Error: HTTP 503` appears nowhere; `/api/htb` returns 200.
