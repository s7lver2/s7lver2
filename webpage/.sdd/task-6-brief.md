# Task 6: ProgressRail (side timeline)

**Files:**
- Create: `app/components/ProgressRail.tsx`
- Modify: `app/page.tsx` (mount it)
- Modify: `app/globals.css` (rail styles)

**Interfaces:**
- Produces: `<ProgressRail />` fixed-left timeline; visible after hero leaves viewport; labels on hover; click → scroll; active node by IntersectionObserver; fill bar by scroll progress.

## Implementation

Create `app/components/ProgressRail.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';

const NODES = [
  { id: 'hero', label: 'Home' },
  { id: 'skills', label: 'Skills' },
  { id: 'languages', label: 'Languages' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb', label: 'HackTheBox' },
  { id: 'github', label: 'GitHub' },
  { id: 'contact', label: 'Contact' },
];

export default function ProgressRail() {
  const [active, setActive] = useState('hero');
  const [shown, setShown] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    NODES.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el); });

    const onScroll = () => {
      const hero = document.getElementById('hero');
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      setShown(heroBottom < 80);
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const activeIdx = NODES.findIndex((n) => n.id === active);

  return (
    <div className={`prail ${shown ? 'prail-on' : ''}`} aria-hidden="true">
      <div className="prail-line"><div className="prail-fill" style={{ height: `${progress}%` }} /></div>
      {NODES.map((n, i) => (
        <button
          key={n.id}
          className={`prnode ${i < activeIdx ? 'done' : ''} ${n.id === active ? 'active' : ''}`}
          onClick={() => document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="prdot" />
          <span className="prlabel">{n.label}</span>
        </button>
      ))}
    </div>
  );
}
```

Mount in `app/page.tsx` (inside the returned fragment, right after `<Navbar … />`):

```tsx
import ProgressRail from '@/components/ProgressRail';
// ...
<ProgressRail />
```

Add CSS in `app/globals.css`:

```css
/* Progress rail */
.prail { position: fixed; left: 22px; top: 50%; transform: translateY(-50%); z-index: 40;
  display: flex; flex-direction: column; gap: 18px; padding-left: 6px;
  opacity: 0; pointer-events: none; transition: opacity .35s; }
.prail-on { opacity: 1; pointer-events: auto; }
.prail-line { position: absolute; left: 12px; top: 6px; bottom: 6px; width: 2px; background: rgba(255,255,255,.08); }
.prail-fill { width: 2px; background: linear-gradient(180deg, #8b5cf6, #3b82f6); box-shadow: 0 0 8px #8b5cf6; transition: height .15s linear; }
.prnode { position: relative; display: flex; align-items: center; gap: 10px; background: none; border: 0; cursor: pointer; padding: 0; z-index: 2; }
.prdot { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(255,255,255,.2); background: #08080b; flex-shrink: 0; transition: .2s; }
.prnode.done .prdot { border-color: #8b5cf6; background: #8b5cf6; }
.prnode.active .prdot { border-color: #3b82f6; background: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.2); }
.prlabel { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: rgba(255,255,255,.5);
  opacity: 0; transform: translateX(-6px); transition: opacity .2s, transform .2s; white-space: nowrap; }
.prnode:hover .prlabel { opacity: 1; transform: translateX(0); }
.prnode.active .prlabel { color: #fff; }
@media (max-width: 900px) { .prail { display: none; } }
@media (prefers-reduced-motion: reduce) { .prail-fill { transition: none; } }
```

## Verification
- Build passes (`npm run build`).
- Navigate to `/`. At top (hero) rail is hidden. Scroll down → rail fades in left; dots show, labels appear on hover; active node tracks the section; fill bar grows. Click a node → smooth-scrolls.
- preview_resize to 800px → rail hidden.
- preview_console_logs → clean.

## Commit

```bash
git add app/components/ProgressRail.tsx app/page.tsx app/globals.css
git commit -m "feat(rail): fixed side progress timeline (labels on hover, scroll fill, hidden on mobile)"
```
