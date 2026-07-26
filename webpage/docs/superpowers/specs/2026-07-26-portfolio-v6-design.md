# Portfolio v6 — Design

**Goal:** Drive the Projects graph from GitHub repos selected in the admin panel, redesign its nodes as language donuts, add a real lines-of-code counter to the GitHub section, layer in expressive and ambient animations, fix two regressions, and overhaul the admin panel.

**Architecture:** Two phases in one spec. Phase A is the public site; Phase B is the admin. They share one new data contract — the featured-repos selection in KV — which Phase A reads and Phase B writes. Phase A ships first and works with a hand-seeded selection; Phase B replaces hand-seeding with a UI.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript, Upstash Redis (KV), Canvas 2D, IntersectionObserver. External data: GitHub REST API (authenticated) and the `ghloc` line-counting service. No new npm dependencies.

**Supersedes:** parts of `2026-07-26-portfolio-v5-design.md` — specifically the hand-authored `DEFAULT_PROJECTS` list as the graph's source, and the glyph node treatment.

---

## Global Constraints

- **`GITHUB_TOKEN` is assumed present.** The user is adding a read-only PAT to `.env.local` and Vercel. Design for 5000 req/hour, but every GitHub call still degrades gracefully when the token is absent or exhausted.
- **No new npm dependencies.** Everything here is achievable with what is installed plus `fetch`.
- **Design tokens come from `app/globals.css` verbatim.** Neutral glass surfaces (`--glass: rgba(21,21,29,.7)`, `#0d0d13`, `#090a0e`), borders white at 8% (`--line`), purple `#8b5cf6` as accent only, `.eyebrow` green `#22c55e` with `$ ` from `::before`, `.h2` Sora weight 800 / `-0.015em`, `.seclabel` 11px / `0.18em` / radius 999px, teal `#5eead4` for active state.
- **`prefers-reduced-motion: reduce` disables every animation in this spec** — the graph simulation, the heatmap shimmer, parallax, expressive entrances, count-ups and growing bars all render their final state immediately and stop.
- **No scroll hijacking.** Parallax is layer translation driven by scroll position only. No pinning, no wheel interception, no scroll-linked timelines that block normal scrolling.
- **Never render a raw status code or error string to a visitor.** Every external-data failure degrades to a cached value, an estimate, or a quiet empty state.
- **Caching is a correctness requirement, not an optimisation,** for anything touching GitHub or ghloc. See §A6.
- Spanish UI copy stays Spanish; English copy stays English.

---

# Phase A — Public site

## A1 · Regression fixes

Two things broke in v5 and both are already diagnosed.

**GitHub account.** `.env.local` had `GITHUB_USERNAME=s7lver`, an account with **0 public repos**. The real account is `s7lver2` (28 repos). Before v5 the code read only `GITHUB_USER`, which was unset, so it fell through to the hardcoded `'s7lver2'` fallback and worked by accident. v5's Task 1 made the code honour `GITHUB_USERNAME`, which pointed it at the empty account. Already fixed locally by replacing that line with `GITHUB_USER=s7lver2`; verified returning 28 repos, 8 stars, 7 followers, 840 commits/yr.

Spec requirement: `.env.example` documents `GITHUB_USER` as the canonical name (done in v5), and **the deployment checklist must note that Vercel needs `GITHUB_USER=s7lver2` too** — if `GITHUB_USERNAME=s7lver` is set there, production is still broken.

**HTB section vanished.** v5's spec said "empty state"; the v5 plan translated that to "render nothing" and `HTB.tsx:83` does `return null`. Fix: render a visible empty state — the `.seclabel`, the `.eyebrow`, the `h2`, and one discreet mono line stating there is no data yet. Never a status code. The section reappears with real content once `HTB_API_TOKEN` and `HTB_USER_ID` are set.

## A2 · Projects driven by selected GitHub repos

The graph stops deriving from the hand-authored `DEFAULT_PROJECTS` list and starts deriving from a **selection of real GitHub repos**.

### A2.1 The selection contract

New KV content type `featured`, holding an ordered array:

```ts
export interface FeaturedRepo {
  /** "owner/name", e.g. "s7lver2/file-meet". Primary key. */
  repo: string;
  /** Manual, because GitHub has no equivalent. */
  status: 'done' | 'beta' | 'dev';
  /** Optional manual overrides; when absent, derived from GitHub. */
  nameOverride?: string;
  descOverride?: string;
}
```

Stored via the existing `getContent`/`setContent` helpers by adding `'featured'` to `ContentType` in `app/lib/content.ts`. Phase A seeds a default selection in `content-constants.ts` so the graph works before the admin UI exists; Phase B replaces seeding with the picker.

Everything else — display name, description, language breakdown, stars — comes from GitHub. `DEFAULT_PROJECTS` stays only as the seed for `featured` and for the `ac` colours of legacy entries; the graph no longer reads it.

### A2.2 Accent colour, and the collision that forced a design change

The chosen rule is **colour derived from the primary language**. Measured against the real account, that rule collides badly: of 25 non-fork repos, **9 are TypeScript and 7 report no language at all**, with Go 3 and one each of Python, Rust, JavaScript, QML, Makefile and Astro. Nine identical blue nodes and seven colourless ones is not usable.

Resolution, in two parts:

1. **Deterministic lightness stepping within a language group.** Sort the featured repos sharing a primary language by `repo` string, then step lightness across them: index 0 keeps the base `LANG_COLORS` value, subsequent ones shift lightness by ±10% alternating, clamped to a legible band (L between 38% and 72%). Deterministic, so a repo's colour never changes between loads.
2. **The donut node makes the hue non-load-bearing** — see §A3. Identity comes from the ring shape and the initials, not from the hue alone.

Repos with `language: null` get a neutral `#6b6b78` and a dashed ring, so the missing data is visible rather than disguised.

### A2.3 Component size

The graph canvas grows from **376px to 440px** tall on desktop. Mobile stays at 300px — vertical space is scarce there and the donuts are already legible at that scale because fewer nodes fit on screen. The donut treatment needs the extra desktop room; at 376px the rings read as mud.

## A3 · Node redesign — language donut

Replaces the v5 glyph (`◆`/`○`), which the user rejected after trying it.

**Project node.** A donut whose ring segments are the repo's real language percentages, coloured from `LANG_COLORS`, drawn clockwise from 12 o'clock in descending percentage order. Ring thickness is `max(4, r * 0.34)`. The centre is filled `#0b0b12` with the repo's **initials** in JetBrains Mono at `r * 0.62`, weight 600.

Initials rule: split on `-`, `_` or `.` and take the first letter of the first two parts (`file-meet` → `FM`); if there is no separator, take the first two capitals (`ChessSandbox` → `CS`); otherwise the first two characters uppercased (`tsuki` → `TS`).

Two featured repos can still land on the same initials (`Lumi` → `LU` and `LumiDataset` → `LD` differ, but `lumi-model-catalog` → `LM` and `lumi-manifest` would collide). When two selected repos produce identical initials, extend the second to **three** characters. Deterministic by sorted `repo` string, so it never flips between loads.

A repo with no detected language renders a **dashed** ring in `rgba(255,255,255,.16)` — the gap is shown, not hidden.

On hover or selection, a soft radial bloom in the accent colour sits behind the donut at `r * 1.7`, alpha 0.16.

**Language node.** A hollow circle, `#090a0e` fill with a 2px ring in the language colour, label below. **Radius scales with how many featured projects use it** — `6 + degree * 2.0`, raised from v5's `1.6` multiplier so the difference is legible at a glance. This was an explicit request: the more projects use a language, the bigger its node.

**Why the donut.** It solves the collision by two independent routes at once. `ChessSandbox` (TS 60 / Go 34) is instantly distinguishable from `Lumi` (TS 84 / Python 13) by ring shape alone. When two rings genuinely match — `WinPass` and `claudechichanchon` are 100% single-language — the initials break the tie. And it is the only treatment that uses the larger canvas for information rather than just scaling up.

## A4 · Lines-of-code counter in the GitHub section

A new block in the GitHub Activity section: total lines of code, broken down by language, animated.

### A4.1 GitHub cannot answer this, so we use ghloc

GitHub's `/languages` endpoint returns **bytes, not lines**. A byte-derived line count is an estimate at best. Investigation settled on `ghloc` (`github.com/subtle-byte/ghloc`), a Go service that downloads a repo and counts non-empty lines for real, exposed at `https://ghloc.ifels.dev/{owner}/{repo}`.

Measured behaviour on the real account:

| Repo | Raw `loc` | After filtering | Note |
|---|---|---|---|
| ChessSandbox | 15,648 | 7,626 | `package-lock.json` alone was 8,022 lines — 51% junk |
| Lumi | 71,542 | ~26,000 | `.md` was 45,495 lines — 64% documentation |
| WinPass | 695 | — | cold request took **5.6s** |
| bachillerato-app | 8,112 | — | 1.1s |

Three consequences drive the design:

- **Latency is 1.1s–5.6s per repo.** Twenty-five repos sequentially is 30–140 seconds. This can never run on the request path.
- **Raw counts are dominated by junk.** Lockfiles and generated files must be excluded or the number is meaningless.
- **ghloc reports by file extension** (`.ts`, `.tsx`, `.go`), not language name, and its host is explicitly unsupported — its own README says *"no any guaranty"*.

### A4.2 What counts as code

The chosen rule is **source code only**. Implemented as an **allowlist of extensions**, not a denylist, so new junk types cannot leak in:

```
.ts .tsx .js .jsx .mjs .cjs .go .py .rs .c .h .cpp .cc .hpp .cs .java .kt
.swift .rb .php .sh .bash .ps1 .lua .sql .css .scss .less .html .vue
.svelte .astro .qml .wgsl .glsl .nix .cmake  Makefile  Dockerfile
```

Explicitly excluded: `.md`, `.json`, `.yaml`, `.toml`, `.txt`, `.csv`, `.svg`, `.lock`, `.sum`, `.mod`, and anything not on the list.

Additionally, ghloc's own `filter` parameter excludes heavy directories before it counts, which also speeds the request up:
`package-lock.json,yarn.lock,pnpm-lock.yaml,poetry.lock,node_modules,dist,build,vendor,.next,target`

The allowlist is then applied **server-side in our own route** when summing `locByLangs`, so we keep full control regardless of what ghloc returns.

### A4.3 Extension → language mapping

Needed so the counter's colours match the graph's:

| Language | Extensions |
|---|---|
| TypeScript | `.ts` `.tsx` |
| JavaScript | `.js` `.jsx` `.mjs` `.cjs` |
| Go | `.go` |
| Python | `.py` |
| Rust | `.rs` |
| C | `.c` `.h` |
| C++ | `.cpp` `.cc` `.hpp` |
| CSS | `.css` `.scss` `.less` |
| HTML | `.html` `.vue` `.svelte` `.astro` |
| Shell | `.sh` `.bash` |
| PowerShell | `.ps1` |
| QML | `.qml` |
| Shader | `.wgsl` `.glsl` |
| Nix | `.nix` |
| Makefile | `Makefile` `.cmake` |
| Dockerfile | `Dockerfile` |

Anything allowlisted but unmapped falls into "Other" with the neutral colour.

### A4.4 Caching and fallback

`GET /api/github/loc` returns:

```ts
{
  totalLines: number;
  byLanguage: Array<{ name: string; lines: number; pct: number; color: string }>;
  repoCount: number;
  source: 'ghloc' | 'estimate';
  fetchedAt: number;
  stale?: boolean;
}
```

- Cached in KV under `github:loc` with a **24h TTL**, using the same stored-`fetchedAt` envelope pattern as `/api/projects/graph` (KV has no TTL primitive — see v5 §6.2).
- On a stale read, **serve the stale payload immediately and refresh in the background**. A visitor never waits 30+ seconds.
- If there is no cache at all and ghloc is unreachable, fall back to **estimating from GitHub bytes** with per-language divisors (Python 30, CSS 25, TypeScript 35, Rust 32, Go 28, default 34) and set `source: 'estimate'`. The UI renders `~` before an estimated number and omits it for a real count.
- Phase B adds a manual "refresh" button in the admin so the cache can be warmed deliberately.

### A4.5 Presentation

A card in the GitHub section: the total in `.grad` gradient at display size with a **count-up animation** on reveal, the word `lines` beside it, and below a horizontal stacked bar plus a legend of the top languages with their line counts. Bar segments grow from zero on reveal, matching the existing `.langbar` behaviour.

## A5 · Animations

Four additions. The v5 layer (staggered reveals, count-ups, growing bars) stays.

**A5.1 · Heatmap shimmer.** The GitHub contribution grid's cells fade in and out in a slow travelling wave, so the grid reads as alive rather than static. Implemented in CSS: each cell carries an inline `--i` index, and a single keyframe animation uses `animation-delay: calc(var(--i) * 7ms)` to phase-shift it. Opacity oscillates between the cell's own level and ~55% of it, so intensity information survives. Cheap — one animation rule, 371 index numbers, no JS loop. This was the user's own idea and is the only ambient (non-entrance) animation in the design.

**A5.2 · More expressive entrances.** The current reveal is opacity plus a 20px rise. Add, per element type: cards scale from `0.96`, section headings wipe in via `clip-path` from the left, and body copy fades with a 6px→0 blur. Same `IntersectionObserver` trigger and `.reveal` class family as v5 — this changes the CSS, not the mechanism.

**A5.3 · A more alive graph.** Project nodes gain a slow idle radius oscillation (±3%, 4s period, phase-offset per node so they do not pulse in unison). The selected node's teal ring pulses. Edges gain an animated dash offset so the connection reads as flow, at low alpha so it does not distract. On first reveal, nodes animate outward from the centre into their settled positions over ~700ms.

**A5.4 · Parallax.** Decorative background layers translate at a fraction of scroll speed. **Noted explicitly:** in v5 the user rejected this over motion-sickness risk and has now chosen it; it is included as requested, constrained to be safe — it moves only the existing ambient blob layers in `page.tsx`, uses `transform` only (GPU, no layout), is rAF-throttled, never intercepts or blocks scrolling, and is fully disabled under `prefers-reduced-motion`. No pinning.

## A6 · New and changed routes

| Route | Purpose |
|---|---|
| `GET /api/projects/graph` | **Modified.** Builds from `featured` selection instead of `DEFAULT_PROJECTS`; adds `stars`, `initials` and the collision-resolved accent to each project node. Keeps the 6h envelope cache. |
| `GET /api/projects/[slug]/readme` | **Modified.** Resolves the repo from `featured` rather than `DEFAULT_PROJECTS`. The `slug` is the **name portion** of `owner/name` (so `s7lver2/file-meet` is reachable at `/api/projects/file-meet/readme`); match case-insensitively against the tail of each `featured` entry's `repo`. |
| `GET /api/github/loc` | **New.** §A4. |
| `GET /api/content/featured` | **New**, via the existing `[type]` route once `'featured'` joins `ContentType`. |

All GitHub calls attach `Authorization: Bearer ${GITHUB_TOKEN}` when the variable is present.

---

# Phase B — Admin panel

Five workstreams. Phase B may ship incrementally; nothing in Phase A depends on it beyond the seeded `featured` list.

## B1 · GitHub repo picker

The feature Phase A needs. `GET /api/admin/github/repos` (auth-gated) lists the account's non-fork repos with name, description, primary language, stars and last-updated, sorted by most recent. The admin page renders them as a searchable checkbox list; checking a repo adds it to `featured`, and each selected row exposes a `status` dropdown (`done`/`beta`/`dev`) plus optional name and description overrides. Selection order is drag-reorderable and defines graph seeding order.

This replaces the current hand-editing of project fields. The existing `repo` text input from v5 becomes redundant and is removed.

## B2 · Visual redesign

The admin currently uses inline style objects with `Space Mono` and purple-tinted cards (`rgba(5,0,10,0.97)`, `rgba(139,92,246,0.35)` borders) — a different visual language from the public site, which uses neutral glass and white 8% borders.

Unify on the site's real tokens: `--glass` surfaces, `--line` borders, JetBrains Mono, purple as accent only, `.seclabel`-style section headers. Extract the repeated inline `Card`/`Input`/`Button` objects into a shared module so the styling lives in one place instead of being re-declared in every admin page.

## B3 · Editing experience

Concrete gaps in the current panel:

- **Save gives no feedback.** `handleSave` in the projects page swallows both success and failure silently — on a 500 the user cannot tell. Add explicit success/error feedback and an error message on failure.
- **No dirty state.** Nothing indicates unsaved changes; navigating away loses them without warning. Add a dirty indicator and a `beforeunload` guard while dirty.
- **No validation.** A malformed `repo` value or empty slug saves happily. Validate before submit with inline field errors.
- **No reordering.** Projects render in array order with no way to change it. Add drag-to-reorder.

## B4 · Consolidate redundant sections

Audited by data source, not by opinion:

| Page | Lines | Data source | Verdict |
|---|---|---|---|
| Overview (`/admin`) | 271 | `/api/admin/stats` | Merge into Analytics |
| Traffic | 242 | `/api/admin/stats` | Merge into Analytics |
| Live | 166 | `/api/admin/stats` | Merge into Analytics |
| Engagement | 212 | `/api/admin/engagement` | Keep — unique data (⌘K opens, terminal cmds, scroll depth, geo) |
| Users | 190 | `/api/admin/users` | Keep |
| Audit | 122 | `/api/admin/audit` | Keep — it works; an earlier grep missed its template-literal fetch |
| Profiles | 145 | `/api/admin/settings`, `/api/admin/upload` | Keep, but fold into Redes — it only manages social avatars |

Overview, Traffic and Live are **679 lines across three pages reading one endpoint**. Consolidate into a single `/admin` Analytics page with **tabs** — Overview, Traffic, Live — sharing one fetch of `/api/admin/stats` instead of three. Tabs rather than stacked sections, because the three views show the same metrics at different granularities and stacking them would repeat the same numbers three times down one page. This is the single largest simplification available in the admin.

## B5 · General polish

A "refresh LOC cache" action (§A4.4), consistent page headers, keyboard focus states, and loading skeletons instead of bare `loading…` text.

---

## Decisions and rationale

**Why the donut over the glyph.** The glyph was chosen from a live mockup in v5 and rejected on sight in the real page. The donut was validated against a collision test using the real repo distribution — nine TypeScript repos — which is the scenario the design will actually face.

**Why real lines instead of a byte estimate.** The first recommendation was byte estimation; investigating ghloc showed real counts are achievable. Estimation survives only as the fallback path.

**Why an extension allowlist rather than a denylist.** `Lumi` alone has 45,495 lines of markdown and `ChessSandbox` 8,022 lines of lockfile. A denylist would need extending every time a new generated file type appears; an allowlist fails closed.

**Why parallax is in despite the earlier objection.** Flagged in v5, rejected then, explicitly requested now. It is the user's call; the design constrains it to transform-only, reduced-motion-aware layer movement rather than anything that interferes with scrolling.

**Why `featured` is a new content type rather than a rewrite of `projects`.** The graph needs repo identity plus one manual field; the existing `projects` shape carries seven fields the graph no longer uses. A separate, smaller contract keeps the admin picker simple and leaves the old data intact during migration.

**Why the LOC cache serves stale before refreshing.** A cold ghloc pass over 25 repos costs 30–140 seconds. Any design where a visitor can trigger a synchronous refresh is a design where a visitor can wait two minutes.

---

## Verification

Phase A:

1. **Regressions** — GitHub KPIs show non-zero repos/stars/followers; the HTB section is visible with an empty-state message and no status code anywhere.
2. **Selection drives the graph** — changing the seeded `featured` list changes which nodes appear; a repo with no detected language renders a dashed ring.
3. **Nodes** — donut segments match the repo's real language percentages; initials are legible; two same-language repos are distinguishable; language node size visibly tracks how many projects use it.
4. **Size** — canvas is 440px tall on desktop.
5. **LOC counter** — total counts up on reveal; the breakdown excludes markdown and lockfiles; the number carries `~` only when `source` is `estimate`; a second load is instant (cache hit).
6. **Animations** — heatmap cells shimmer in a travelling wave; entrances scale/wipe/blur rather than just fading; graph nodes idle-pulse and edges flow; background layers parallax on scroll without blocking it. Under `prefers-reduced-motion` all of it is static.

Phase B:

7. **Picker** — repos list with search; checking one adds it to the graph after reload; status dropdown persists; drag-reorder persists.
8. **Redesign** — admin surfaces use neutral glass and white borders, not purple cards; no page re-declares its own Card/Input/Button styles.
9. **Editing** — saving shows success or failure; a dirty form warns before navigation; invalid input blocks submit with an inline message.
10. **Consolidation** — one Analytics page replaces Overview, Traffic and Live; Engagement, Users and Audit still work; Profiles is reachable from Redes.
