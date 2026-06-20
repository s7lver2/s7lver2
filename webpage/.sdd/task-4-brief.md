# Task 4: Skills consumes KV + hover-dim state (shared with carousel)

**Files:**
- Modify: `app/components/sections/Skills.tsx`
- Modify: `app/globals.css` (hover-dim rules)
- Create: `app/components/sections/Machines.tsx` (stub — Task 5 replaces it)

**Interfaces:**
- Consumes: `GET /api/content/skills` (→ `SkillC[]`), `DEFAULT_SKILLS` from `@/app/lib/content`.
- Produces: `Skills.tsx` renders a `<MachinesCarousel>` (Task 5) passing `activeConcept`, `setActiveConcept`. Skills owns `const [activeConcept, setActiveConcept] = useState<ConceptKey | null>(null)`.

## Step 1: Load skills from KV with fallback and add active-concept state

In `app/components/sections/Skills.tsx`, replace the hardcoded `AXES` usage: keep `DEFAULT_SKILLS`-style array as initial state, then fetch. Add at the top of the component:

```tsx
import { DEFAULT_SKILLS, type SkillC, type ConceptKey } from '@/app/lib/content';
import MachinesCarousel from './Machines';
// ...
const [axes, setAxes] = React.useState<SkillC[]>(DEFAULT_SKILLS);
const [activeConcept, setActiveConcept] = React.useState<ConceptKey | null>(null);

React.useEffect(() => {
  fetch('/api/content/skills')
    .then((r) => r.ok ? r.json() : null)
    .then((d: SkillC[] | null) => { if (Array.isArray(d) && d.length) setAxes(d); })
    .catch(() => {});
}, []);
```

Replace all references to the old module-level `AXES` constant with the `axes` state variable (the polar/polygon helpers must take `axes` as a parameter or read it from closure — update `polarToCartesian`/`generatePolygonPoints`/`generateDataPoints` to accept the axes array, or inline them inside the component using `axes`).

## Step 2: Wire hover handlers to set the active concept

On each legend row (`.rl`) and each radar data point (`circle`), set handlers:

```tsx
onMouseEnter={() => setActiveConcept(axes[i].conceptKey)}
onMouseLeave={() => setActiveConcept(null)}
```

Add `data-c={axes[i].conceptKey}` to each `.rl` row, each radar `circle` (class `pt`), and each axis `line` (class `axline`). Put `data-active={activeConcept ?? undefined}` on the section's wrapping element (the `<div ref={reveal}>` or a new `.skillblk` wrapper) so CSS can target descendants.

## Step 3: Render the carousel inside the section

After the `.radarwrap` div (still inside the section), render:

```tsx
<MachinesCarousel activeConcept={activeConcept} onConceptHover={setActiveConcept} />
```

(Task 5 creates `Machines.tsx`. Until then the build will fail to import — that is expected; this task and Task 5 are adjacent. If implementing strictly task-by-task, create a 1-line stub `app/components/sections/Machines.tsx` exporting a no-op default component so this task builds, and Task 5 replaces it.)

Create the stub now to keep this task independently buildable:

```tsx
'use client';
import type { ConceptKey } from '@/app/lib/content';
export default function MachinesCarousel(_p: { activeConcept: ConceptKey | null; onConceptHover: (c: ConceptKey | null) => void }) {
  return null;
}
```

## Step 4: Add hover-dim CSS

In `app/globals.css`, append:

```css
/* Skills hover-dim */
.skillblk[data-active] .rl:not(.on) { opacity: .22; }
.skillblk[data-active] .rl.on { background: linear-gradient(90deg, rgba(139,92,246,.16), transparent); border-radius: 8px; }
.skillblk[data-active] svg .pt:not(.on) { opacity: .15; }
.skillblk[data-active] svg .axline:not(.on) { opacity: .15; }
.rl, .pt, .axline { transition: opacity .18s, background .18s; }
@media (prefers-reduced-motion: reduce) { .rl, .pt, .axline { transition: none; } }
```

The `.on` class is toggled per element by comparing its `data-c` to `activeConcept`. Implement that with a small derived helper in the component: add `className={\`rl ${activeConcept === axes[i].conceptKey ? 'on' : ''}\`}` (and same for `pt`/`axline`).

## Step 5: Build

Run: `npm run build`
Expected: compiles (with the Machines stub present).

## Step 6: Verify

- Navigate to `/`, scroll to Skills. preview_snapshot → radar + legend render from KV (same as before).
- Hover a legend row → preview_screenshot shows the other rows/points dimmed and the hovered one highlighted.
- preview_console_logs → clean.

## Step 7: Commit

```bash
git add app/components/sections/Skills.tsx app/components/sections/Machines.tsx app/globals.css
git commit -m "feat(skills): load from KV + hover-dim active-concept state (+ carousel stub)"
```
