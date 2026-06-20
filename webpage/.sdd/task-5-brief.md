# Task 5: Machines carousel (infinite, pause on hover, bidirectional link)

**Files:**
- Modify: `app/components/sections/Machines.tsx` (replace stub with full carousel)
- Modify: `app/globals.css` (carousel styles)

**Interfaces:**
- Consumes: `GET /api/htb/machines` (→ `{ machines: MachineCard[] }`), props `{ activeConcept: ConceptKey | null; onConceptHover: (c: ConceptKey | null) => void }`.
- Produces: infinite marquee of machine cards; cards gain `.has`/dim based on `activeConcept`; hovering a card calls `onConceptHover` with its first conceptKey and pauses the track (pause via CSS `:hover`).

## Step 1: Implement the carousel

Replace `app/components/sections/Machines.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ConceptKey } from '@/app/lib/content-constants';

interface MachineCard {
  name: string; difficulty: string; os: string; date: string;
  concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string;
}
interface Props { activeConcept: ConceptKey | null; onConceptHover: (c: ConceptKey | null) => void; }

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x.includes('fácil') || x.includes('easy')) return 'd-easy';
  if (x.includes('media') || x.includes('medium')) return 'd-med';
  if (x.includes('difícil') || x.includes('hard')) return 'd-hard';
  if (x.includes('insane')) return 'd-ins';
  return 'd-med';
}
function osIcon(os: string) {
  const x = os.toLowerCase();
  if (x.includes('win')) return '🪟';
  if (x.includes('linux')) return '🐧';
  return '💻';
}

export default function MachinesCarousel({ activeConcept, onConceptHover }: Props) {
  const [machines, setMachines] = useState<MachineCard[]>([]);

  useEffect(() => {
    fetch('/api/htb/machines')
      .then((r) => r.ok ? r.json() : { machines: [] })
      .then((d) => setMachines(Array.isArray(d.machines) ? d.machines : []))
      .catch(() => setMachines([]));
  }, []);

  if (machines.length === 0) return null;
  const doubled = [...machines, ...machines];

  return (
    <div className="mcaro" data-active={activeConcept ?? undefined}>
      <div className="eyebrow mono" style={{ marginTop: 30 }}>htb --recent</div>
      <div className="mcaro-mask">
        <div className="mtrack2">
          {doubled.map((m, i) => {
            const has = activeConcept ? m.conceptKeys.includes(activeConcept) : false;
            return (
              <div
                key={`${m.name}-${i}`}
                className={`mcard ${has ? 'has' : ''}`}
                onMouseEnter={() => onConceptHover(m.conceptKeys[0] ?? null)}
                onMouseLeave={() => onConceptHover(null)}
              >
                <div className="mtop">
                  <span className="mname">{m.name}</span>
                  <span className={`diff ${diffClass(m.difficulty)}`}>{m.difficulty}</span>
                </div>
                <div className="mos">{osIcon(m.os)} {m.os}</div>
                <div className="mtags">
                  {m.concepts.map((c) => <span key={c} className="mtag">{c}</span>)}
                </div>
                <div className="mfoot">
                  <span className="pwn">✓ pwned{m.date ? ` · ${new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}</span>
                  {m.youtube && <a href={m.youtube} target="_blank" rel="noopener noreferrer">▶ writeup</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

## Step 2: Add carousel CSS

In `app/globals.css`, append:

```css
/* Machines carousel */
.mcaro-mask { position: relative; overflow: hidden; margin-top: 12px;
  -webkit-mask: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
  mask: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
.mtrack2 { display: flex; gap: 14px; width: max-content; animation: machScroll 48s linear infinite; }
.mcaro-mask:hover .mtrack2 { animation-play-state: paused; }
@keyframes machScroll { to { transform: translateX(-50%); } }
.mcard { flex: 0 0 250px; border: 1px solid rgba(255,255,255,.08); border-top: 2px solid var(--ac, #8b5cf6);
  border-radius: 14px; background: rgba(21,21,29,.7); padding: 15px 16px; transition: transform .2s, box-shadow .2s, opacity .2s, filter .2s; }
.mcard:hover { transform: translateY(-4px); box-shadow: 0 20px 45px -32px rgba(139,92,246,.8); }
.mcaro[data-active] .mcard:not(.has) { opacity: .2; filter: grayscale(.6); }
.mcaro[data-active] .mcard.has { box-shadow: 0 0 0 1px #8b5cf6; }
.mtop { display: flex; align-items: center; justify-content: space-between; }
.mname { font-weight: 800; font-size: 17px; }
.mos { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(255,255,255,.55); margin-top: 6px; }
.diff { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; padding: 3px 7px; border-radius: 5px; }
.d-easy { color: #22c55e; background: rgba(34,197,94,.13); }
.d-med { color: #eab308; background: rgba(234,179,8,.13); }
.d-hard { color: #f97316; background: rgba(249,115,22,.13); }
.d-ins { color: #ef4444; background: rgba(239,68,68,.13); }
.mtags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.mtag { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 2px 7px; }
.mfoot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: rgba(255,255,255,.4); }
.mfoot .pwn { color: #22c55e; }
.mfoot a { color: #3b82f6; text-decoration: none; }
@media (prefers-reduced-motion: reduce), (max-width: 760px) {
  .mcaro-mask { -webkit-mask: none; mask: none; overflow-x: auto; }
  .mtrack2 { animation: none; }
}
```

## Step 3: Build

Run: `npm run build`
Expected: compiles.

## Step 4: Verify

- Navigate to `/`, scroll to Skills. preview_snapshot → carousel of machine cards under the radar (or absent if HTB env missing — acceptable).
- Hover a skill legend row → matching machine cards stay lit, others dim/grayscale; the track pauses while hovering a card.
- Hover a machine card → the radar/legend highlights that machine's concept(s).
- preview_console_logs → clean.

## Step 5: Commit

```bash
git add app/components/sections/Machines.tsx app/globals.css
git commit -m "feat(machines): infinite carousel of solved machines, bidirectional hover link with skills"
```
