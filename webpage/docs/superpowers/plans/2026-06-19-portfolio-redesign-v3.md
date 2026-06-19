# Portfolio Redesign v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix performance and redesign concrete pieces of the portfolio: hero (100vh + scroll indicator + animated orbs), a new infinite languages marquee, projects as a uniform-card marquee (no canvas/`:has()`), real social avatars via a server proxy, and a unified ⌘K command center with an integrated, improved terminal.

**Architecture:** Next.js 14.1 App Router, all client components except the new avatar proxy (a Route Handler). The terminal command engine is extracted to a shared pure module (`app/lib/terminal.ts`) and consumed inside the ⌘K command center; the standalone `Terminal.tsx` overlay is removed. All new animations use compositor-only properties (`transform`/`opacity`) and respect `prefers-reduced-motion`.

**Tech Stack:** Next.js 14.1, React 18, TypeScript, Tailwind 3.3, plain CSS in `app/globals.css`. Brand logos via `react-icons/si` (already a dependency — `react-icons`). No new runtime dependencies.

## Global Constraints

- **No new runtime dependencies.** Use `react-icons` (already installed) for language logos.
- **Hero character wave is untouched** — only the glow/orb layer changes.
- Every new animation must use only `transform`/`opacity` and be disabled under `@media (prefers-reduced-motion: reduce)`.
- **No test framework exists in this repo.** Per-task verification = `npm run build` passes (typecheck) **plus** a browser-observable check via the preview tools. Never claim a visual works without a preview check.
- Brand colors: morado `#8b5cf6`, azul `#3b82f6`, verde `#22c55e` (prompts only). Fonts: Sora (display), JetBrains Mono (mono/data).
- GitHub handle is **`s7lver2`** (per Navbar and project URLs).
- Commit after each task. Do not push.
- Run all commands from `E:\s7lver2\webpage`.

---

### Task 1: Server-side avatar proxy + Social wiring

**Files:**
- Create: `app/api/avatar/[network]/route.ts`
- Modify: `app/components/sections/Social.tsx:7-14` (avatar URLs)

**Interfaces:**
- Produces: `GET /api/avatar/<network>` → image bytes (200) or 404 when no remote URL configured. Networks: `github`, `discord`, `twitter`, `tiktok`, `instagram`, `htb`.

- [ ] **Step 1: Create the avatar proxy route handler**

Create `app/api/avatar/[network]/route.ts`:

```ts
import { NextRequest } from 'next/server';

// Remote avatar source per network. '' = not configured yet → 404 → client falls
// back to the generated-initials avatar. GitHub is auto-derived from the handle.
const AVATARS: Record<string, string> = {
  github: 'https://github.com/s7lver2.png',
  discord: '',
  twitter: '',
  tiktok: '',
  instagram: '',
  htb: '',
};

export const revalidate = 86400; // cache upstream fetch for 1 day

export async function GET(
  _req: NextRequest,
  { params }: { params: { network: string } }
) {
  const src = AVATARS[params.network];
  if (!src) {
    return new Response('avatar not configured', { status: 404 });
  }
  try {
    const res = await fetch(src, { next: { revalidate: 86400 } });
    if (!res.ok) return new Response('upstream error', { status: 502 });
    const buf = await res.arrayBuffer();
    const type = res.headers.get('content-type') || 'image/png';
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
```

- [ ] **Step 2: Point Social avatars at the proxy**

In `app/components/sections/Social.tsx`, replace the `SOCIALS` array (lines 7-14) so each `avatar` uses the proxy route:

```tsx
const SOCIALS = [
  { k: 'github', v: 'github.com/s7lver2', color: '#6e5494', avatar: '/api/avatar/github', url: 'https://github.com/s7lver2', initials: 'GH' },
  { k: 'discord', v: '@s7lver', color: '#5865f2', avatar: '/api/avatar/discord', url: '#', initials: 'DC' },
  { k: 'twitter', v: 'x.com/s7lver', color: '#1d9bf0', avatar: '/api/avatar/twitter', url: 'https://x.com/s7lver', initials: 'X' },
  { k: 'tiktok', v: '@s7lver', color: '#ff0050', avatar: '/api/avatar/tiktok', url: '#', initials: 'TT' },
  { k: 'instagram', v: '@s7lver', color: '#e1306c', avatar: '/api/avatar/instagram', url: '#', initials: 'IG' },
  { k: 'htb', v: 'app.hackthebox.com/s7lver', color: '#9fef00', avatar: '/api/avatar/htb', url: '#', initials: 'HTB' },
];
```

The existing `loadAvatars` effect already falls back to `generateAvatarCanvas(color, initials)` when `loadImageToCanvas` rejects (404), so unconfigured networks render the initials ASCII. No other change needed in Social.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles successfully; route `/api/avatar/[network]` appears in the route list.

- [ ] **Step 4: Verify in preview**

Start/ensure dev server (preview_start). Then:
- preview_network or navigate to `/api/avatar/github` → expect a 200 image response (GitHub avatar bytes).
- preview_snapshot of the Social section → the GitHub entry's ASCII art should resemble the real avatar; other networks show the initials fallback (no broken/empty art).

- [ ] **Step 5: Commit**

```bash
git add app/api/avatar/[network]/route.ts app/components/sections/Social.tsx
git commit -m "feat(social): real avatars via server-side proxy (/api/avatar/[network])"
```

---

### Task 2: Hero — 100vh, scroll indicator, animated orbs, remove chips

**Files:**
- Modify: `app/components/sections/Hero.tsx:38-46` (remove chips), add scroll indicator
- Modify: `app/components/HeroBackground.tsx:150-156` (orb markup)
- Modify: `app/globals.css:125` (`.hero` height), `:147` (`.bgGlow`), add orb + scroll-indicator styles

**Interfaces:**
- Consumes: nothing new.
- Produces: `.bgGlow` now contains `.orb.orb1`/`.orb.orb2`; `.hero` has a `.scrolldown` child.

- [ ] **Step 1: Remove tech chips from Hero, add scroll indicator**

In `app/components/sections/Hero.tsx`, delete the chips block (lines 38-46):

```tsx
          <div className="chips">
            <span className="chip">TypeScript</span>
            <span className="chip">Next.js</span>
            <span className="chip">Rust</span>
            <span className="chip">Go</span>
            <span className="chip">Python</span>
            <span className="chip">Linux</span>
            <span className="chip">Docker</span>
          </div>
```

Then add a scroll indicator just before the closing `</section>` (after the `.wrap` div closes):

```tsx
        <div className="scrolldown" aria-hidden="true">
          <span>scroll</span>
          <div className="mouse"></div>
        </div>
```

- [ ] **Step 2: Replace the static glow with two animated orbs**

In `app/components/HeroBackground.tsx`, change the returned glow `<div>` (lines 152) to contain two orb children:

```tsx
      <div className="bg bgGlow" id="glow" ref={glowRef}>
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
      </div>
```

(Leave `<canvas className="bg" id="wave">` and `<div className="veil">` exactly as they are.)

- [ ] **Step 3: Update hero CSS — height, orbs, scroll indicator**

In `app/globals.css`, change the `.hero` `min-height` (line 125 block) from its current value to `100vh`:

```css
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
```

Replace the `.bgGlow` rule (line 147 block) so the gradient now comes from orbs, and append orb + scroll-indicator rules immediately after it:

```css
  .bgGlow {
    background: transparent;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    will-change: transform;
    pointer-events: none;
  }
  .orb1 {
    width: 62vw; height: 54vw; left: -6%; top: -8%;
    background: radial-gradient(circle, rgba(139,92,246,.30), transparent 62%);
    animation: orbDrift1 36s ease-in-out infinite;
  }
  .orb2 {
    width: 56vw; height: 52vw; right: -8%; top: 12%;
    background: radial-gradient(circle, rgba(59,130,246,.26), transparent 64%);
    animation: orbDrift2 44s ease-in-out infinite;
  }
  @keyframes orbDrift1 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(48px,36px) scale(1.10); }
  }
  @keyframes orbDrift2 {
    0%,100% { transform: translate(0,0) scale(1.05); }
    50%     { transform: translate(-44px,28px) scale(.94); }
  }

  .scrolldown {
    position: absolute;
    left: 50%; bottom: 26px;
    transform: translateX(-50%);
    z-index: 3;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
    color: rgba(255,255,255,.4);
  }
  .scrolldown .mouse {
    width: 24px; height: 38px;
    border: 1.5px solid rgba(255,255,255,.3);
    border-radius: 13px; position: relative;
  }
  .scrolldown .mouse::before {
    content: ""; position: absolute; left: 50%; top: 7px;
    width: 3px; height: 7px; border-radius: 3px; background: #8b5cf6;
    transform: translateX(-50%);
    animation: scrollWheel 1.6s ease-in-out infinite;
  }
  @keyframes scrollWheel {
    0%   { opacity: 0; transform: translate(-50%, 0); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, 12px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .orb { animation: none; }
    .scrolldown .mouse::before { animation: none; }
  }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles successfully, no TypeScript errors.

- [ ] **Step 5: Verify in preview**

- preview_resize to a desktop viewport, navigate to `/`.
- preview_screenshot → hero fills the viewport (100vh), the scroll indicator (mouse) is visible at the bottom-center, and no tech chips remain.
- preview_console_logs → no errors.
- (Motion check) preview_eval `getComputedStyle(document.querySelector('.orb1')).animationName` → expect `orbDrift1` (not `none`) when reduced-motion is off.

- [ ] **Step 6: Commit**

```bash
git add app/components/sections/Hero.tsx app/components/HeroBackground.tsx app/globals.css
git commit -m "feat(hero): 100vh, scroll indicator, animated orbs (V3), remove chips"
```

---

### Task 3: Languages — infinite marquee section

**Files:**
- Create: `app/components/sections/Languages.tsx`
- Modify: `app/page.tsx:8` (import) and `:73` (mount after Skills)
- Modify: `app/globals.css` (append marquee styles before `/* Command Palette Styles */`)

**Interfaces:**
- Produces: `<LanguagesSection />` default export; rendered between Skills and Projects.

- [ ] **Step 1: Create the Languages component**

Create `app/components/sections/Languages.tsx`:

```tsx
'use client';

import {
  SiTypescript, SiNextdotjs, SiRust, SiGo, SiPython, SiJavascript,
  SiReact, SiCss3, SiDocker, SiLinux, SiGit, SiPostgresql,
} from 'react-icons/si';
import { useReveal } from '@/lib/reveal';

type Lang = { name: string; Icon: React.ComponentType<{ className?: string }>; color: string };

const ROW_A: Lang[] = [
  { name: 'TypeScript', Icon: SiTypescript, color: '#3178c6' },
  { name: 'Next.js', Icon: SiNextdotjs, color: '#ffffff' },
  { name: 'Rust', Icon: SiRust, color: '#dea584' },
  { name: 'Go', Icon: SiGo, color: '#00add8' },
  { name: 'Python', Icon: SiPython, color: '#3776ab' },
  { name: 'JavaScript', Icon: SiJavascript, color: '#f7df1e' },
];

const ROW_B: Lang[] = [
  { name: 'React', Icon: SiReact, color: '#61dafb' },
  { name: 'CSS3', Icon: SiCss3, color: '#1572b6' },
  { name: 'Docker', Icon: SiDocker, color: '#2496ed' },
  { name: 'Linux', Icon: SiLinux, color: '#fcc624' },
  { name: 'Git', Icon: SiGit, color: '#f05032' },
  { name: 'PostgreSQL', Icon: SiPostgresql, color: '#4169e1' },
];

function Track({ items }: { items: Lang[] }) {
  // Duplicate the list so translateX(-50%) loops seamlessly.
  const doubled = [...items, ...items];
  return (
    <div className="mtrack">
      {doubled.map((l, i) => (
        <span className="lang" key={`${l.name}-${i}`} style={{ ['--lc' as string]: l.color }}>
          <l.Icon className="lic" />
          {l.name}
        </span>
      ))}
    </div>
  );
}

export default function LanguagesSection() {
  const reveal = useReveal();
  return (
    <section id="languages" className="sec">
      <div className="wrap" ref={reveal}>
        <span className="seclabel">Languages</span>
        <div className="eyebrow mono">cat ~/.stack</div>
        <h2 className="h2">Tech stack</h2>
        <div className="marq">
          <div className="mrow"><Track items={ROW_A} /></div>
          <div className="mrow"><Track items={ROW_B} /></div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount Languages after Skills in page.tsx**

In `app/page.tsx`, add the import after the Skills import (line 6):

```tsx
import LanguagesSection from '@/components/sections/Languages';
```

Then render it between `<SkillsSection />` and `<ProjectsSection />` (line 73):

```tsx
          <SkillsSection   />
          <LanguagesSection />
          <ProjectsSection />
```

- [ ] **Step 3: Add marquee CSS**

In `app/globals.css`, immediately before the `/* Command Palette Styles */` comment (line 724), append:

```css
/* Languages marquee */
.marq {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mrow {
  position: relative;
  overflow: hidden;
  -webkit-mask: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  mask: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}
.mtrack {
  display: flex;
  gap: 42px;
  width: max-content;
  align-items: center;
  animation: marqScroll 32s linear infinite;
}
.mrow:nth-child(even) .mtrack { animation-direction: reverse; }
.mrow:hover .mtrack { animation-play-state: paused; }
@keyframes marqScroll { to { transform: translateX(-50%); } }
.lang {
  display: flex; align-items: center; gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px; font-weight: 600;
  color: rgba(255,255,255,.55); white-space: nowrap;
  transition: color .2s;
}
.lang:hover { color: #fff; }
.lang .lic { width: 24px; height: 24px; color: var(--lc); }
@media (prefers-reduced-motion: reduce) {
  .mtrack { animation: none; flex-wrap: wrap; }
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles successfully; no errors importing `react-icons/si`.

- [ ] **Step 5: Verify in preview**

- Navigate to `/`, preview_snapshot → a "Tech stack" section exists between Skills and Projects with two rows of language logos+names.
- preview_screenshot → logos render in brand colors; rows visibly offset.
- preview_eval `getComputedStyle(document.querySelector('.mtrack')).animationName` → `marqScroll`.
- Hover a row (preview_eval dispatch or just confirm CSS present); console clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/sections/Languages.tsx app/page.tsx app/globals.css
git commit -m "feat(languages): infinite logo marquee section after Skills"
```

---

### Task 4: Projects — uniform cards + infinite marquee (remove canvas + :has())

**Files:**
- Modify: `app/components/sections/Projects.tsx` (full rewrite)
- Modify: `app/globals.css:362-555` (replace `.bento`/`:has()`/`.tile`… block with card + marquee styles)

**Interfaces:**
- Consumes: optional images at `public/projects/<slug>.png` (user-provided; gradient fallback when missing).
- Produces: `<ProjectsSection />` default export (unchanged name).

- [ ] **Step 1: Rewrite Projects.tsx (cards + marquee, no canvas, no :has())**

Replace the entire contents of `app/components/sections/Projects.tsx` with:

```tsx
'use client';
import React, { useState } from 'react';
import { useReveal } from '@/lib/reveal';

type Project = {
  slug: string;
  name: string;
  desc: string;
  status: 'done' | 'beta' | 'dev';
  ac: string;
  tags: string[];
  web?: string;
  shot?: string;
};

const PROJECTS: Project[] = [
  { slug: 'file-meet', name: 'file-meet', desc: 'P2P file sharing CLI in Go. Zero config, end-to-end encrypted transfers.', status: 'done', ac: '#00add8', tags: ['Go', 'WebRTC', 'CLI'], web: 'https://github.com/s7lver2/file-meet', shot: '/projects/file-meet.png' },
  { slug: 'ZephyrOS', name: 'ZephyrOS', desc: 'Minimal security-focused Linux distro for old systems and edge computing.', status: 'beta', ac: '#a3e635', tags: ['Linux', 'Bash', 'Arch'], web: 'https://github.com/s7lver2/ZephyrOS', shot: '/projects/ZephyrOS.png' },
  { slug: 'tsuki', name: 'tsuki', desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.', status: 'dev', ac: '#dea584', tags: ['Rust', 'LLVM', 'Embedded'] },
  { slug: 'CodeDotJS', name: 'CodeDotJS', desc: 'Reactive JS framework, no vDOM, <5kb.', status: 'dev', ac: '#3178c6', tags: ['TypeScript', 'Vite'], web: 'https://CodeDotjs.vercel.app', shot: '/projects/CodeDotJS.png' },
];

function Card({ p }: { p: Project }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="pcard" style={{ '--ac': p.ac } as React.CSSProperties}>
      <div className="pthumb">
        {p.shot && imgOk && (
          <img src={p.shot} alt={`${p.name} preview`} loading="lazy" onError={() => setImgOk(false)} />
        )}
        <div className="pwin"><i></i><i></i><i></i></div>
        {p.web && <span className="plive">↗ live</span>}
      </div>
      <div className="pbody">
        <span className={`st2 s-${p.status}`}>{p.status}</span>
        <div className="path mono">~/projects/<b>{p.slug}</b></div>
        <div className="nm">{p.name}</div>
        <div className="de">{p.desc}</div>
        <div className="tw">
          {p.tags.map((t) => <span key={t} className="tg">{t}</span>)}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsSection() {
  const reveal = useReveal();
  const doubled = [...PROJECTS, ...PROJECTS]; // seamless loop

  return (
    <section id="projects" className="sec">
      <div className="wrap" ref={reveal}>
        <span className="seclabel">Projects</span>
        <div className="eyebrow mono">ls ~/projects</div>
        <h2 className="h2">Selected work</h2>

        <div className="pmarq">
          <div className="ptrack">
            {doubled.map((p, i) => <Card key={`${p.slug}-${i}`} p={p} />)}
          </div>
        </div>

        <div className="commits">
          <div>
            <div className="path mono">~/<b>commits</b> --year</div>
            <div className="big grad">1,204</div>
            <div className="streak mono">🔥 12-day streak</div>
          </div>
          <div className="spark">
            {[38, 60, 46, 78, 54, 92, 66, 100, 58, 84, 72, 88].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }}></i>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace the Projects CSS block**

In `app/globals.css`, replace the entire region from `.bento {` (line 362) through the closing `}` of the projects media query (line 555 — the block containing `.bento:hover .tile:not(:hover) { opacity: 1; }`) with:

```css
  /* Projects — uniform cards in an infinite marquee */
  .pmarq {
    margin-top: 24px;
    position: relative;
    overflow: hidden;
    -webkit-mask: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
    mask: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
  }
  .ptrack {
    display: flex;
    gap: 16px;
    width: max-content;
    animation: projScroll 40s linear infinite;
  }
  .pmarq:hover .ptrack { animation-play-state: paused; }
  @keyframes projScroll { to { transform: translateX(-50%); } }

  .pcard {
    --ac: #8b5cf6;
    flex: 0 0 320px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(21,21,29,.7);
    display: flex; flex-direction: column;
    transition: transform .22s, border-color .22s, box-shadow .22s;
  }
  .pcard:hover {
    transform: translateY(-4px);
    border-color: var(--ac);
    box-shadow: 0 22px 50px -34px var(--ac);
  }
  .pthumb {
    position: relative;
    height: 132px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--ac) 65%, #0c0c12), #0c0c12);
    border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .pthumb img {
    position: absolute; inset: 0;
    width: 100%; height: 100%; object-fit: cover;
  }
  .pwin {
    position: absolute; top: 0; left: 0; right: 0; height: 24px;
    background: rgba(0,0,0,.3);
    display: flex; align-items: center; gap: 5px; padding: 0 10px;
  }
  .pwin i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); }
  .plive {
    position: absolute; right: 9px; bottom: 9px;
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: #22c55e; background: rgba(0,0,0,.45);
    border: 1px solid rgba(34,197,94,.4); border-radius: 6px; padding: 3px 7px;
  }
  .pbody { padding: 15px 16px 17px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .path { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: rgba(255,255,255,.4); }
  .path b { color: var(--ac); }
  .nm { font-family: 'JetBrains Mono', monospace; font-size: 17px; font-weight: 800; }
  .de { color: rgba(255,255,255,.5); font-size: 12.5px; flex: 1; }
  .tw { display: flex; flex-wrap: wrap; gap: 6px; }
  .tg {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(255,255,255,.5);
    border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 3px 7px;
    background: rgba(8,8,11,.5);
  }
  .st2 {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase;
    letter-spacing: .05em; padding: 2px 6px; border-radius: 4px; align-self: flex-start;
  }
  .s-done { background: rgba(34,197,94,.15); color: #22c55e; }
  .s-beta { background: rgba(59,130,246,.15); color: #3b82f6; }
  .s-dev  { background: rgba(139,92,246,.15); color: #8b5cf6; }

  .commits {
    margin-top: 18px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px; background: rgba(21,21,29,.7);
    padding: 18px;
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .commits .big { font-size: 30px; font-weight: 800; }
  .commits .streak { font-size: 11px; color: rgba(255,255,255,.4); }
  .spark { display: flex; align-items: flex-end; gap: 5px; height: 60px; flex: 1; max-width: 520px; }
  .spark i { flex: 1; background: linear-gradient(180deg, #8b5cf6, #3b82f6); border-radius: 3px; opacity: .6; }

  @media (max-width: 760px), (prefers-reduced-motion: reduce) {
    .pmarq { -webkit-mask: none; mask: none; overflow: visible; }
    .ptrack { animation: none; flex-wrap: wrap; width: auto; }
    .pcard { flex: 1 1 280px; }
  }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles successfully. (Note: `color-mix` is CSS — no TS impact.)

- [ ] **Step 4: Verify in preview**

- Navigate to `/`, scroll to Projects. preview_snapshot → uniform cards, no overlapping badges, no cut-off tags.
- preview_eval `getComputedStyle(document.querySelector('.ptrack')).animationName` → `projScroll`.
- preview_eval `document.querySelectorAll('.bento, [class*="p1"], canvas#proj').length` is not relevant — instead confirm no `.bento` exists: `document.querySelector('.bento')` → `null`.
- preview_console_logs → clean (no canvas errors).
- preview_resize to 700px wide → cards wrap into a static grid (no horizontal scroll on body).

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/Projects.tsx app/globals.css
git commit -m "perf(projects): uniform card marquee, remove canvas screenshots and :has() reorg"
```

---

### Task 5: Extract terminal engine to `app/lib/terminal.ts` (+ new commands)

**Files:**
- Create: `app/lib/terminal.ts`
- Modify: `app/components/Terminal.tsx` (import from lib instead of local defs — temporary; component removed in Task 7)

**Interfaces:**
- Produces:
  - `BANNER: string`
  - `COMMANDS: string[]`
  - `processCommand(raw: string, onNavigate?: (section: string) => void): string` — returns output text or a sentinel: `__CLEAR__`, `__EXIT__`, `__NAVIGATE__`, `__NEOFETCH__`, `__MATRIX__`, `__THEME__:<name>`.
  - `THEMES: Record<string, [string, string]>` — accent name → `[brand1, brand2]` hex pair.

- [ ] **Step 1: Create the shared terminal module**

Create `app/lib/terminal.ts`. Move the existing `BANNER`, `processCommand`, and `COMMANDS` out of `Terminal.tsx` verbatim, then extend the `switch` with the new commands and add `THEMES`. Full file:

```ts
export const BANNER = `
 _____ _____
|   __|___  |___ _ _ ___ ___
|__   |_  | | -_| | | -_|  _|
|_____|___|_|___|___| _|_|
               |_|

s7lver@portfolio ~ zsh
Type 'help' for available commands.
`;

export const THEMES: Record<string, [string, string]> = {
  morado: ['#8b5cf6', '#3b82f6'],
  azul: ['#3b82f6', '#06b6d4'],
  verde: ['#22c55e', '#a3e635'],
  mono: ['#e5e7eb', '#9ca3af'],
};

export function processCommand(
  raw: string,
  onNavgate?: (section: string) => void
): string {
  const input = raw.trim();
  const lower = input.toLowerCase();
  const [cmd, ...args] = lower.split(' ');

  switch (cmd) {
    case 'help':
      return `
Available commands:
  whoami          → Operator profile
  ls [-la]        → List sections
  cat <file>      → Read a file
  nmap localhost  → Scan this host
  ping <host>     → Ping a host
  skills          → Cybersecurity skills
  neofetch        → System info + ASCII art
  banner          → Reprint the banner
  date / uptime   → Date and uptime
  echo <text>     → Print text
  curl <section>  → Navigate (hacker style)
  exploit         → Run an exploit (gag)
  matrix          → Enter the matrix
  theme <name>    → Change accent color
  sudo <cmd>      → Try your luck
  hack            → Initialize hack sequence
  uname -a        → System info
  history         → Command history
  github          → GitHub summary
  htb             → HackTheBox stats
  open <section>  → Navigate to section
  clear           → Clear terminal
  exit            → Close terminal
      `;
    case 'whoami':
      return `s7lver
uid=1337(s7lver) gid=1337(hackers) groups=1337(hackers),0(root)
Role:   Developer & Cybersecurity Student
Focus:  Pentesting · CTF · Red Team
HTB:    Hacker Rank | user s7lver
`;
    case 'ls':
      return args[0] === '-la' || args[0] === '-l'
        ? `total 6
drwxr-xr-x  s7lver  s7lver  about/
drwxr-xr-x  s7lver  s7lver  skills/
drwxr-xr-x  s7lver  s7lver  languages/
drwxr-xr-x  s7lver  s7lver  projects/
drwxr-xr-x  s7lver  s7lver  htb/
drwxr-xr-x  s7lver  s7lver  contact/`
        : 'about/  skills/  languages/  projects/  htb/  contact/';

    case 'cat':
      if (!args[0]) return 'cat: missing file operand. Try: cat flag.txt, cat about.txt';
      if (args[0] === 'flag.txt') return `
Congrats. You found it.

HTB{y0u_f0und_th3_s3cr3t_t3rm1n4l_3gg}

Keep hacking. 🚩`;
      if (args[0] === 'about.txt') return `Name:     s7lver
Role:     Developer & Cybersec Student
Stack:    Go · Rust · TypeScript · Python
Projects: ZephyrOS · tsuki · file-meet · CodeDotJS
Contact:  nickespro130@outlook.es`;
      if (args[0] === '/etc/passwd') return `root:x:0:0:root:/root:/bin/bash
s7lver:x:1337:1337::/home/s7lver:/bin/zsh
visitor:x:9999:9999::/dev/null:/bin/false`;
      if (args[0] === '/etc/shadow') return 'Permission denied: you wish 😂';
      return `cat: ${args[0]}: No such file or directory`;

    case 'nmap':
      return `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for s7lver.dev
Host is up (0.0001s latency).

PORT     STATE  SERVICE  VERSION
22/tcp   open   ssh      OpenSSH 9.0
80/tcp   open   http     Next.js 15
443/tcp  open   https    Next.js 15
3000/tcp closed dev-mode

OS: Portfolio Linux 6.6-s7lver
Scanned in 2.13 seconds`;

    case 'ping': {
      const host = args[0] || 'localhost';
      return `PING ${host}: 56 bytes
64 bytes: icmp_seq=0 ttl=63 time=42.0 ms
64 bytes: icmp_seq=1 ttl=63 time=41.8 ms
64 bytes: icmp_seq=2 ttl=63 time=42.3 ms
3 packets transmitted, 3 received, 0% packet loss`;
    }

    case 'skills':
      return `[RED TEAM]  Metasploit · Burp Suite · SQLMap · Hydra · Mimikatz
[CTF]       Buffer Overflow · Rev Eng · Web Exploitation · Ghidra
[RECON]     Nmap · Wireshark · Gobuster · Subfinder · Responder`;

    case 'neofetch':
      return '__NEOFETCH__';

    case 'banner':
      return BANNER;

    case 'date':
    case 'uptime':
      return `up ∞ days, load average: 13.37, 0.42, 0.07
(time is a construct on s7lver.dev)`;

    case 'echo':
      return input.slice(input.toLowerCase().indexOf('echo') + 4).trim() || '';

    case 'curl': {
      const section = args[0];
      const valid = ['hero', 'skills', 'languages', 'projects', 'htb', 'github', 'contact'];
      if (!section || !valid.includes(section)) {
        return `Usage: curl <section>\nSections: ${valid.join(', ')}`;
      }
      if (onNavgate) onNavgate(section === 'hero' ? 'hero' : section);
      return '__NAVIGATE__';
    }

    case 'exploit':
    case 'ssh':
      return `[*] Connecting to s7lver@box ...
[████████████████████] 100%
[+] Shell obtained... just kidding 😏
Connection closed by remote host.`;

    case 'matrix':
      return '__MATRIX__';

    case 'theme': {
      const name = args[0];
      if (!name) return `Usage: theme <name>\nThemes: ${Object.keys(THEMES).join(', ')}`;
      if (!THEMES[name]) return `Unknown theme: ${name}\nThemes: ${Object.keys(THEMES).join(', ')}`;
      return `__THEME__:${name}`;
    }

    case 'sudo':
      if (args.join(' ') === 'make me a sandwich') return 'Okay. 🥪';
      if (args[0] === 'su') return 'root access denied. nice try, visitor 😏';
      if (args.join(' ') === 'rm -rf /' || args.join(' ') === 'rm -rf /*')
        return '[ NICE TRY ] Portfolio is read-only 😏';
      return `[sudo] password for visitor: 
Sorry, try again.
[sudo] password for visitor: 
sudo: 3 incorrect password attempts`;

    case 'hack':
      return `Initializing hack sequence...
[████████████████████] 100%

ERROR: Target is s7lver himself.
Recursion detected. Cannot hack the hacker. Aborting.`;

    case 'uname':
      return `Linux portfolio 6.6.0-s7lver #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux
Built with Next.js 15 & pure chaos`;

    case 'history':
      return `    1  whoami
    2  ls -la
    3  cat flag.txt
    4  sudo rm -rf /
    5  nmap localhost
    6  hack`;

    case 'github':
      return `Fetching GitHub summary…
See GitHub section or: open github`;

    case 'htb':
      return `HackTheBox stats in #htb section. Try: open htb`;

    case 'open': {
      const section = args[0];
      const validSections = ['hero', 'skills', 'languages', 'projects', 'htb', 'github', 'contact'];
      if (!section) {
        return `Usage: open <section>\nValid sections: ${validSections.join(', ')}`;
      }
      if (!validSections.includes(section)) {
        return `Invalid section: ${section}\nValid sections: ${validSections.join(', ')}`;
      }
      if (onNavgate) onNavgate(section);
      return '__NAVIGATE__';
    }

    case 'clear':
      return '__CLEAR__';
    case 'exit':
      return '__EXIT__';
    case '':
      return '';
    default:
      return `bash: ${cmd}: command not found\nType 'help' for available commands.`;
  }
}

export const COMMANDS = [
  'whoami', 'ls', 'cat', 'nmap', 'ping', 'skills', 'neofetch', 'banner',
  'date', 'uptime', 'echo', 'curl', 'exploit', 'ssh', 'matrix', 'theme',
  'sudo', 'hack', 'uname', 'history', 'github', 'htb', 'open', 'help',
  'clear', 'exit',
];
```

- [ ] **Step 2: Make Terminal.tsx import from the lib (keep it working until Task 7)**

In `app/components/Terminal.tsx`, delete the local `BANNER`, `processCommand`, and `COMMANDS` definitions (lines 5-168) and replace with an import at the top (after the existing React import):

```tsx
import { BANNER, processCommand, COMMANDS } from '@/lib/terminal';
```

Leave the rest of `Terminal.tsx` (the component) unchanged for now. (It still won't handle the new `__NEOFETCH__`/`__MATRIX__`/`__THEME__` sentinels — that's fine; those land in the command center in Task 7. `Terminal.tsx` is removed in Task 7.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles successfully; no duplicate-identifier or missing-import errors.

- [ ] **Step 4: Verify in preview**

- Open the terminal (backtick) and run `whoami`, `ls -la`, `theme` → outputs match. `neofetch` prints the literal `__NEOFETCH__` for now (expected; wired in Task 7).
- preview_console_logs → clean.

- [ ] **Step 5: Commit**

```bash
git add app/lib/terminal.ts app/components/Terminal.tsx
git commit -m "refactor(terminal): extract engine to lib/terminal.ts, add neofetch/banner/date/echo/curl/exploit/matrix/theme/sandwich"
```

---

### Task 6: ⌘K Command Center — window redesign + tabs + navigate panel

**Files:**
- Modify: `app/components/CommandPalette.tsx` (rewrite: add tab state + redesigned shell; navigate panel keeps fastfetch behavior)
- Modify: `app/globals.css:724-895` (replace Command Palette styles with command-center styles)

**Interfaces:**
- Consumes: `open: boolean`, `onClose: () => void`, and new optional `initialTab?: 'nav' | 'term'`, `onNavigate?: (section: string) => void`.
- Produces: command center with two tabs; the `term` panel is filled in Task 7 (render a placeholder `<TerminalPanel>` mount point here).

- [ ] **Step 1: Rewrite CommandPalette.tsx shell with tabs + navigate panel**

Replace the entire contents of `app/components/CommandPalette.tsx` with the following. (The terminal panel is a separate component imported from `./TerminalPanel`, created in Task 7; for this task, also create a minimal stub so the build passes — see Step 2.)

```tsx
'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { toAscii, loadImageToCanvas } from '@/lib/ascii';
import TerminalPanel from './TerminalPanel';

const ART_IMAGES: string[] = ['/art/1.png', '/art/2.png', '/art/3.png'];

const SECTIONS = [
  { label: 'Home', href: '#hero', id: 'hero' },
  { label: 'Skills', href: '#skills', id: 'skills' },
  { label: 'Languages', href: '#languages', id: 'languages' },
  { label: 'Projects', href: '#projects', id: 'projects' },
  { label: 'HackTheBox', href: '#htb', id: 'htb' },
  { label: 'GitHub', href: '#github', id: 'github' },
  { label: 'Contact', href: '#contact', id: 'contact' },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'nav' | 'term';
  onNavigate?: (section: string) => void;
}

export default function CommandPalette({ open, onClose, initialTab = 'nav', onNavigate }: CommandPaletteProps) {
  const [tab, setTab] = useState<'nav' | 'term'>(initialTab);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [asciiArt, setAsciiArt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  useEffect(() => {
    if (open && ART_IMAGES.length > 0) {
      const pick = ART_IMAGES[Math.floor(Math.random() * ART_IMAGES.length)];
      loadImageToCanvas(pick, 120, 60)
        .then((canvas) => setAsciiArt(toAscii(canvas, 30, 15)))
        .catch(() => setAsciiArt(''));
    }
    setSelectedIdx(0);
  }, [open]);

  useEffect(() => {
    if (open && tab === 'nav') setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, tab]);

  const go = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); onClose(); }
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, SECTIONS.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(SECTIONS[selectedIdx].id); }
    if (e.key === 'Tab') { e.preventDefault(); setTab('term'); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }, [selectedIdx, go, onClose]);

  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedIdx]);

  return (
    <>
      {open && <div className="ov" onClick={onClose} />}
      <div className={`cc ${open ? 'cc-open' : ''}`}>
        <div className="ccbar">
          <span className="dots"><i className="r" /><i className="y" /><i className="g" /></span>
          <span className="cctitle">s7lver@portfolio — command center</span>
          <button onClick={onClose} className="ccx"><FaTimes /></button>
        </div>

        <div className="cctabs">
          <button className={`cctab ${tab === 'nav' ? 'on' : ''}`} onClick={() => setTab('nav')}>
            <span className="k">❯</span> navigate
          </button>
          <button className={`cctab ${tab === 'term' ? 'on' : ''}`} onClick={() => setTab('term')}>
            <span className="k">$</span> terminal
          </button>
        </div>

        {tab === 'nav' && (
          <div className="ccpanel">
            <div className="ccq">
              <span className="pr">❯</span>
              <input ref={inputRef} onKeyDown={handleKeyDown} className="palq" placeholder="Jump to a section…" autoComplete="off" spellCheck={false} />
              <span className="modechip mc-nav">nav</span>
            </div>
            <div className="ccbody">
              <div className="palart"><pre>{asciiArt || ' '}</pre></div>
              <div className="pallist">
                {SECTIONS.map((s, idx) => (
                  <button
                    ref={idx === selectedIdx ? selectedRef : null}
                    key={s.id}
                    onClick={() => go(s.id)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`li ${idx === selectedIdx ? 'li-selected' : ''}`}
                  >
                    <span className="li-label">{s.label}</span>
                    <span className="li-hint">{s.href}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="palfoot">
              <span className="flex items-center gap-1"><FaArrowUp className="text-[10px]" /><FaArrowDown className="text-[10px]" /> navigate</span>
              <span>↵ go</span><span>Tab terminal</span><span>esc close</span>
            </div>
          </div>
        )}

        {tab === 'term' && (
          <TerminalPanel active={open && tab === 'term'} onClose={onClose} onNavigate={onNavigate} onBackToNav={() => setTab('nav')} />
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create a temporary TerminalPanel stub (replaced in Task 7)**

Create `app/components/TerminalPanel.tsx` with a minimal stub so this task builds independently:

```tsx
'use client';
interface Props { active: boolean; onClose: () => void; onNavigate?: (s: string) => void; onBackToNav: () => void; }
export default function TerminalPanel(_props: Props) {
  return <div className="ccterm-stub">terminal loading…</div>;
}
```

- [ ] **Step 3: Replace Command Palette CSS with command-center CSS**

In `app/globals.css`, replace the region from `/* Command Palette Styles */` (line 724) through the end of its media query (line 895, closing `}` of `@media (max-width: 768px)`) with:

```css
/* ⌘K Command Center */
.ov {
  position: fixed; inset: 0; z-index: 95;
  background: rgba(0,0,0,.5);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.cc {
  position: fixed; top: 8vh; left: 50%; transform: translateX(-50%) scale(.96);
  z-index: 100; width: 92%; max-width: 720px;
  background: rgba(12,12,18,.97);
  border: 1px solid rgba(255,255,255,.08); border-radius: 16px;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 40px 90px -50px #000;
  overflow: hidden; opacity: 0; pointer-events: none;
  transition: opacity .2s ease-out, transform .2s ease-out;
}
.cc::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #8b5cf6, #3b82f6); z-index: 5;
}
.cc-open { opacity: 1; transform: translateX(-50%) scale(1); pointer-events: auto; }
.ccbar { display: flex; align-items: center; gap: 8px; padding: 11px 15px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.02); }
.ccbar .dots { display: flex; gap: 6px; }
.ccbar .dots i { width: 11px; height: 11px; border-radius: 50%; }
.ccbar .dots .r { background: #ff5f56; } .ccbar .dots .y { background: #ffbd2e; } .ccbar .dots .g { background: #27c93f; }
.cctitle { flex: 1; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: rgba(255,255,255,.5); }
.ccx { color: rgba(255,255,255,.4); background: none; border: 0; cursor: pointer; }
.ccx:hover { color: #fff; }
.cctabs { display: flex; gap: 4px; padding: 10px 12px 0; }
.cctab { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: rgba(255,255,255,.5); background: transparent; border: 1px solid transparent; border-bottom: none; border-radius: 9px 9px 0 0; padding: 9px 16px; cursor: pointer; }
.cctab:hover { color: #fff; }
.cctab.on { color: #fff; background: rgba(139,92,246,.1); border-color: rgba(255,255,255,.08); }
.cctab .k { color: #22c55e; } .cctab.on .k { color: #8b5cf6; }
.ccq { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-top: 1px solid rgba(255,255,255,.08); border-bottom: 1px solid rgba(255,255,255,.08); }
.ccq .pr { color: #22c55e; font-family: 'JetBrains Mono', monospace; font-size: 14px; }
.palq { flex: 1; background: transparent; color: #fff; font-size: 14px; outline: none; border: none; font-family: 'JetBrains Mono', monospace; caret-color: #8b5cf6; }
.palq::placeholder { color: #5b6270; }
.modechip { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 4px 9px; border-radius: 6px; }
.mc-nav { color: #8b5cf6; background: rgba(139,92,246,.14); border: 1px solid rgba(139,92,246,.3); }
.mc-term { color: #22c55e; background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); }
.ccbody { display: flex; gap: 22px; padding: 18px; }
.palart { flex-shrink: 0; width: 220px; background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 12px; overflow: hidden; }
.palart pre { font-family: 'JetBrains Mono', monospace; font-size: 7.5px; line-height: 1; color: #8b5cf6; margin: 0; white-space: pre; }
.pallist { flex: 1; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; max-height: 320px; }
.li { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; text-align: left; font-size: 14px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: rgba(255,255,255,.6); cursor: pointer; transition: all .15s; }
.li:hover { background: rgba(255,255,255,.04); color: #fff; }
.li.li-selected { background: linear-gradient(90deg, rgba(139,92,246,.16), rgba(59,130,246,.05)); border-color: rgba(139,92,246,.3); color: #fff; }
.li-label { font-weight: 600; }
.li-hint { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5b6270; }
.li.li-selected .li-hint { color: #8b5cf6; }
.palfoot { display: flex; gap: 18px; padding: 11px 16px; border-top: 1px solid rgba(255,255,255,.08); font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5b6270; }
.ccterm-stub { padding: 30px; font-family: 'JetBrains Mono', monospace; color: #5b6270; }
@media (max-width: 768px) {
  .ccbody { flex-direction: column; }
  .palart { width: 100%; }
  .pallist { max-height: 220px; }
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles successfully (TerminalPanel stub resolves).

- [ ] **Step 5: Verify in preview**

- Press ⌘K/Ctrl+K → command center opens with the gradient hairline, mac dots, two tabs (`navigate` selected).
- Navigate tab: ASCII art panel (random) + section list incl. "Languages"; ↑↓ moves selection (gradient highlight), ↵ scrolls + closes.
- Click the `terminal` tab (or press Tab) → shows the stub "terminal loading…".
- preview_console_logs → clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/CommandPalette.tsx app/components/TerminalPanel.tsx app/globals.css
git commit -m "feat(cmdk): command center shell with tabs + redesigned navigate panel"
```

---

### Task 7: Terminal panel inside ⌘K + wiring + remove standalone Terminal

**Files:**
- Modify: `app/components/TerminalPanel.tsx` (replace stub with full terminal)
- Modify: `app/page.tsx` (open palette in terminal tab; remove `<Terminal>`)
- Modify: `app/globals.css` (append terminal-panel styles)
- Delete: `app/components/Terminal.tsx`

**Interfaces:**
- Consumes: `BANNER`, `processCommand`, `COMMANDS`, `THEMES` from `@/lib/terminal`; `toAscii`, `loadImageToCanvas` from `@/lib/ascii`.
- Props: `active: boolean`, `onClose: () => void`, `onNavigate?: (s: string) => void`, `onBackToNav: () => void`.

- [ ] **Step 1: Implement the full TerminalPanel**

Replace the contents of `app/components/TerminalPanel.tsx` with:

```tsx
'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { BANNER, processCommand, COMMANDS, THEMES } from '@/lib/terminal';
import { toAscii, loadImageToCanvas } from '@/lib/ascii';

const ART_IMAGES = ['/art/1.png', '/art/2.png', '/art/3.png'];
const QUICK = ['whoami', 'ls -la', 'cat flag.txt', 'nmap localhost', 'skills', 'neofetch', 'hack', 'help'];

type Entry = { type: 'input' | 'output' | 'banner'; text: string };

// Heuristic colorizer: wraps known tokens in colored spans for output lines.
function renderOutput(text: string) {
  return text.split('\n').map((line, i) => {
    let cls = 'out';
    if (/(open|Congrats|received, 0% packet loss|100%)/.test(line)) cls = 'out ok';
    else if (/(denied|not found|Permission|incorrect|Invalid|ERROR|closed)/i.test(line)) cls = 'out err';
    else if (/(Sorry, try again|NICE TRY|wish)/i.test(line)) cls = 'out warn';
    else if (/HTB\{|Portfolio Linux|s7lver/.test(line)) cls = 'out acc';
    return <div key={i} className={cls}>{line || ' '}</div>;
  });
}

interface Props { active: boolean; onClose: () => void; onNavigate?: (s: string) => void; onBackToNav: () => void; }

export default function TerminalPanel({ active, onClose, onNavigate, onBackToNav }: Props) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Entry[]>([{ type: 'banner', text: BANNER }]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [matrix, setMatrix] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (active) setTimeout(() => inputRef.current?.focus(), 120); }, [active]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [history]);

  // Ghost autocomplete suggestion
  const ghost = (() => {
    const cur = input.trim().toLowerCase();
    if (!cur) return '';
    const m = COMMANDS.find((c) => c.startsWith(cur) && c !== cur);
    return m ? m.slice(cur.length) : '';
  })();

  const run = useCallback((raw: string) => {
    const result = processCommand(raw, onNavigate);

    if (result === '__CLEAR__') { setHistory([{ type: 'banner', text: BANNER }]); }
    else if (result === '__EXIT__') { onClose(); }
    else if (result === '__NAVIGATE__') {
      setHistory((h) => [...h, { type: 'input', text: raw }]);
      setTimeout(() => onClose(), 250);
    }
    else if (result === '__MATRIX__') {
      setHistory((h) => [...h, { type: 'input', text: raw }]);
      setMatrix(true);
      setTimeout(() => setMatrix(false), 2600);
    }
    else if (result.startsWith('__THEME__:')) {
      const name = result.split(':')[1];
      const pair = THEMES[name];
      if (pair) {
        document.documentElement.style.setProperty('--brand-1', pair[0]);
        document.documentElement.style.setProperty('--brand-2', pair[1]);
      }
      setHistory((h) => [...h, { type: 'input', text: raw }, { type: 'output', text: `theme set to ${name}` }]);
    }
    else if (result === '__NEOFETCH__') {
      setHistory((h) => [...h, { type: 'input', text: raw }]);
      const pick = ART_IMAGES[Math.floor(Math.random() * ART_IMAGES.length)];
      loadImageToCanvas(pick, 100, 50)
        .then((c) => toAscii(c, 26, 13))
        .catch(() => '')
        .then((art) => {
          const specs = `OS:      Portfolio Linux 6.6-s7lver
Host:    s7lver.dev
Shell:   zsh
Uptime:  ∞
Editor:  nvim btw
Stack:   Go · Rust · TS · Python
HTB:     Hacker Rank`;
          const merged = (art || '').split('\n').map((l, i) => {
            const s = specs.split('\n')[i] || '';
            return l.padEnd(28) + s;
          }).join('\n');
          setHistory((h) => [...h, { type: 'output', text: merged }]);
        });
    }
    else {
      setHistory((h) => [
        ...h,
        { type: 'input', text: raw },
        ...(result ? [{ type: 'output' as const, text: result }] : []),
      ]);
    }

    if (raw) setCmdHistory((h) => [raw, ...h]);
    setHistoryIdx(-1);
    setInput('');
  }, [onClose, onNavigate]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); run(input.trim()); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryIdx((i) => { const n = Math.min(i + 1, cmdHistory.length - 1); setInput(cmdHistory[n] ?? ''); return n; });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryIdx((i) => { const n = Math.max(i - 1, -1); setInput(n === -1 ? '' : (cmdHistory[n] ?? '')); return n; });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (ghost) setInput(input + ghost + ' ');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onBackToNav();
    }
  };

  return (
    <div className="ccterm">
      <div className="term">
        {history.map((entry, i) => {
          if (entry.type === 'banner') return <pre key={i} className="ban">{entry.text}</pre>;
          if (entry.type === 'input') return (
            <div key={i}><span className="pr">s7lver@portfolio:<span className="pth">~</span>$</span> <span className="in">{entry.text}</span></div>
          );
          return <div key={i} className="outwrap">{renderOutput(entry.text)}</div>;
        })}
        {matrix && <pre className="matrix">{Array.from({ length: 8 }).map(() => Array.from({ length: 48 }).map(() => '01'[Math.floor(Math.random() * 2)]).join('')).join('\n')}</pre>}
        <div ref={endRef} />
      </div>

      <div className="chips">
        {QUICK.map((q) => <button key={q} className="qc" onClick={() => run(q)}>{q}</button>)}
      </div>

      <form onSubmit={handleSubmit} className="termin">
        <span className="pr">s7lver@portfolio:~$</span>
        <span className="inwrap">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
            className="terminput" placeholder="type a command…" autoComplete="off" spellCheck={false} />
          {ghost && <span className="ghost">{input}<b>{ghost}</b></span>}
        </span>
      </form>
      <div className="palfoot">
        <span>Tab autocomplete</span><span>↑↓ history</span><span>open htb → navigate</span><span>esc back</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append terminal-panel CSS**

In `app/globals.css`, immediately after the `.ccterm-stub` rule (or anywhere within the command-center block), append:

```css
.ccterm { display: flex; flex-direction: column; }
.term { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; line-height: 1.55; padding: 14px 16px; height: 300px; overflow-y: auto; background: rgba(0,0,0,.25); }
.term .ban { color: rgba(34,197,94,.7); font-size: 10px; line-height: 1.2; white-space: pre; margin-bottom: 8px; }
.term .pr { color: #22c55e; } .term .pr .pth { color: #3b82f6; }
.term .in { color: #fff; }
.term .out { color: rgba(255,255,255,.55); white-space: pre-wrap; }
.term .out.ok { color: #22c55e; } .term .out.err { color: #f87171; }
.term .out.warn { color: #fde047; } .term .out.acc { color: #8b5cf6; }
.term .matrix { color: #22c55e; opacity: .7; font-size: 11px; line-height: 1.1; }
.chips { display: flex; gap: 7px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,.055); }
.qc { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: rgba(255,255,255,.55); background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 7px; padding: 5px 10px; cursor: pointer; }
.qc:hover { color: #fff; border-color: #8b5cf6; }
.termin { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.02); }
.termin .pr { color: #22c55e; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; flex-shrink: 0; }
.inwrap { position: relative; flex: 1; display: flex; }
.terminput { flex: 1; background: transparent; border: 0; outline: 0; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; position: relative; z-index: 2; }
.terminput::placeholder { color: #5b6270; }
.ghost { position: absolute; left: 0; top: 0; font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: transparent; pointer-events: none; z-index: 1; white-space: pre; }
.ghost b { color: #5b6270; font-weight: 400; }
```

- [ ] **Step 3: Wire page.tsx — palette opens in terminal tab; remove standalone Terminal**

In `app/page.tsx`:

1. Remove the `Terminal` import (line 12) and its render block (lines 83-87).
2. Add palette tab state and route the terminal triggers to the palette. Replace the state + keyboard effect + render so it reads:

```tsx
export default function Home() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState<'nav' | 'term'>('nav');

  const handleNavigateToSection = (section: string) => {
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const openTerminal = () => { setPaletteTab('term'); setPaletteOpen(true); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteTab('nav');
        setPaletteOpen((o) => !o);
      }
      if (e.key === '`') { e.preventDefault(); openTerminal(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Navbar onOpenTerminal={openTerminal} />
      <main className="min-h-screen">
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/4  left-1/4  w-96 h-96 bg-primary-purple/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-blue/10  rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10">
          <HeroSection     onOpenTerminal={openTerminal} />
          <SkillsSection   />
          <LanguagesSection />
          <ProjectsSection />
          <HTBSection      />
          <GitHubSection   />
          <SocialSection   />
        </div>
      </main>
      <Footer />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialTab={paletteTab}
        onNavigate={handleNavigateToSection}
      />
    </>
  );
}
```

- [ ] **Step 4: Delete the standalone Terminal component**

```bash
git rm app/components/Terminal.tsx
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles successfully; no references to `@/components/Terminal` remain.

- [ ] **Step 6: Verify in preview**

- Press backtick (`` ` ``) → command center opens directly on the **terminal** tab.
- Run `whoami` (colored output), `nmap localhost` (`open` lines green), `cat flag.txt` (HTB flag purple), `neofetch` (ASCII art + specs side by side), `matrix` (green rain ~2.6s), `theme verde` then check brand vars, `open htb` (navigates + closes).
- Type `nm` → ghost shows `nmap`; Tab completes it.
- Click a quick chip (e.g. `skills`) → runs.
- Esc from terminal → returns to navigate tab. ⌘K still opens navigate.
- Click "$ start hacking" in hero → opens terminal tab.
- preview_console_logs → clean.

- [ ] **Step 7: Commit**

```bash
git add app/components/TerminalPanel.tsx app/page.tsx app/globals.css
git commit -m "feat(cmdk): integrated terminal panel (colorized, chips, ghost, neofetch/matrix/theme); remove standalone Terminal"
```

---

### Task 8: Integration, theme vars, and final verification

**Files:**
- Modify: `app/globals.css` (introduce `--brand-1`/`--brand-2` and apply to the brand gradient so `theme` is visible)
- Verify only: all sections, responsive, reduced-motion, build.

- [ ] **Step 1: Add brand CSS variables and use them in the gradient**

In `app/globals.css`, at the top `:root` (or the existing `:root`/`@layer base` where globals live — search for `:root {`), add:

```css
:root {
  --brand-1: #8b5cf6;
  --brand-2: #3b82f6;
}
```

Then update the `.grad` / `.text-gradient` helper (search for the existing gradient text rule near line 720, `@apply bg-gradient-to-r from-primary-purple to-primary-blue …`) by adding a plain-CSS `.grad` rule that uses the vars (so the terminal `theme` command visibly changes the hero name + commits number):

```css
.grad {
  background: linear-gradient(100deg, var(--brand-1), var(--brand-2));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
```

(If a `.grad` rule already exists, modify it to use the vars instead of hardcoded hex.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Full preview checklist**

Navigate to `/` and verify each:
- [ ] Hero 100vh, scroll indicator, orbs drifting, wave still crossfades, no chips.
- [ ] Languages marquee: two rows, opposite directions, pause on hover, brand-colored logos.
- [ ] Projects: uniform card marquee, real/lazy images with gradient fallback, no overlap/cut-off, pauses on hover; at ≤760px wraps to static grid; no `.bento` in DOM.
- [ ] HTB + GitHub: unchanged, still render real data.
- [ ] Social: real GitHub avatar ASCII via proxy; others fallback to initials.
- [ ] ⌘K: navigate tab (fastfetch + Languages entry) and terminal tab; Tab/Esc switch; backtick + "$ start hacking" open terminal; theme command recolors the hero name gradient.
- [ ] preview_resize 375px: no horizontal body scroll anywhere.
- [ ] preview_console_logs across the page: no errors.

- [ ] **Step 4: Reduced-motion check**

preview_eval to emulate (or set Windows reduced-motion) and confirm: orbs static, scroll wheel static, language + project marquees static (wrapped). No layout breakage.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): brand CSS variables driving gradient; final v3 integration"
```

---

## Self-Review

**Spec coverage:**
- Hero 100vh + scroll + orbs V3 + remove chips → Task 2 ✓
- Languages infinite marquee, 2 rows, real logos, reduced-motion wrap → Task 3 ✓
- Projects Option B + marquee, remove canvas/`:has()`, lazy images, mobile/reduced-motion static, commits block static → Task 4 ✓
- Social avatars via proxy → Task 1 ✓
- ⌘K redesign + tabs (navigate fastfetch intact) → Task 6 ✓
- Terminal integrated + improvements (colorize, chips, ghost, banner/status via neofetch, open integration, new commands) → Tasks 5 + 7 ✓
- Performance (no canvas/`:has()`, transform-only animations) → Tasks 2, 4 ✓
- Acceptance criteria 1–7 → covered across tasks; final sweep Task 8 ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The TerminalPanel stub in Task 6 is intentional and explicitly replaced in Task 7.

**Type consistency:** `processCommand(raw, onNavigate?)` signature identical in lib and all callers. Sentinels (`__NEOFETCH__`, `__MATRIX__`, `__THEME__:`, `__NAVIGATE__`, `__CLEAR__`, `__EXIT__`) defined in Task 5 and all handled in Task 7. `CommandPalette` props (`open`, `onClose`, `initialTab`, `onNavigate`) consistent between Task 6 definition and Task 7 page.tsx usage. `TerminalPanel` props consistent between Task 6 stub, Task 7 impl, and CommandPalette call site. `SECTIONS` includes `languages` (Task 6) matching the new section id (Task 3) and terminal `open`/`curl` valid lists (Task 5).
