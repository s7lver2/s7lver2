# Portfolio v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add skills↔machines hover interaction, an infinite HTB-machines carousel, a side progress timeline, a 2-column ⌘K, a KV-backed editable content layer, and an expanded admin panel (content manager, engagement analytics, settings/flags).

**Architecture:** Reuse the existing Upstash KV abstraction (`app/lib/redis.ts` → `kvGetJSON`/`kvSetJSON`) for all new persistence (content, events, flags, theme) — Vercel-compatible, no new infra. HTB machines come from the existing HTB proxy's activity endpoint crossed against a vendored static snapshot of htbmachines (`public/data/htbmachines.json`). Public components read content from `/api/content/*` with fallback to today's hardcoded defaults. All new animations use `transform`/`opacity` and respect `prefers-reduced-motion`.

**Tech Stack:** Next.js 14.1 (App Router), React 18, TypeScript, Tailwind 3.3, `@upstash/redis` (already installed). No new dependencies — the admin live map is hand-drawn SVG.

## Global Constraints

- **No new runtime dependencies.** Admin map = hand-drawn SVG. Logos already use `react-icons`.
- **Vercel-compatible only:** persist via `kvGetJSON`/`kvSetJSON` from `app/lib/redis.ts`. Never write to a persistent local FS path in runtime code (the lib already handles the `/tmp` dev fallback).
- **No test framework exists in this repo.** Per-task verification = `npm run build` passes (typecheck) **plus** a browser-observable check via preview tools, and for API routes a `curl`/preview_network check. Never claim a visual/endpoint works without verifying.
- Every new animation uses only `transform`/`opacity` and is disabled under `@media (prefers-reduced-motion: reduce)`.
- Public site must **never break** if KV or HTB are unavailable: fall back to hardcoded defaults; omit the machines carousel on error.
- Brand colors: morado `#8b5cf6`, azul `#3b82f6`, verde `#22c55e`. Fonts: Sora (display), JetBrains Mono (mono). Admin uses Space Mono + the existing admin card style.
- GitHub handle is `s7lver2`. HTB env: `HTB_USER_ID`, `HTB_API_TOKEN` (already configured).
- Concept axis keys are exactly: `web | net | recon | ad | rev | crypto`.
- Commit after each task. Do not push. Run all commands from `E:\s7lver2\webpage`.

---

## PHASE A — Data layer

### Task 1: Content KV module + public read + admin write endpoints

**Files:**
- Create: `app/lib/content.ts`
- Create: `app/api/content/[type]/route.ts`
- Create: `app/api/admin/content/[type]/route.ts`

**Interfaces:**
- Produces:
  - `app/lib/content.ts`: types `ProjectC`, `SkillC`, `SocialC`, `HomeC`; `ContentType = 'projects'|'skills'|'socials'|'home'`; `getContent<T>(type): Promise<T>` (returns KV value or the hardcoded default); `setContent(type, value): Promise<void>`; exported defaults `DEFAULT_PROJECTS`, `DEFAULT_SKILLS`, `DEFAULT_SOCIALS`, `DEFAULT_HOME`.
  - `GET /api/content/<type>` → JSON content (public, cached).
  - `GET|PUT /api/admin/content/<type>` → read/write (admin-auth gated).

- [ ] **Step 1: Create the content module with types and defaults**

Create `app/lib/content.ts`:

```ts
import { kvGetJSON, kvSetJSON } from './redis';

export type ConceptKey = 'web' | 'net' | 'recon' | 'ad' | 'rev' | 'crypto';

export interface ProjectC {
  slug: string; name: string; desc: string;
  status: 'done' | 'beta' | 'dev'; ac: string;
  tags: string[]; web?: string; shot?: string;
}
export interface SkillC {
  name: string; value: number; color: string; tools: string; conceptKey: ConceptKey;
}
export interface SocialC {
  k: string; v: string; color: string; url: string; initials: string;
}
export interface HomeC { heroTitle: string; heroSubtitle: string; }

export type ContentType = 'projects' | 'skills' | 'socials' | 'home';

export const DEFAULT_PROJECTS: ProjectC[] = [
  { slug: 'file-meet', name: 'file-meet', desc: 'P2P file sharing CLI in Go. Zero config, end-to-end encrypted transfers.', status: 'done', ac: '#00add8', tags: ['Go', 'WebRTC', 'CLI'], web: 'https://github.com/s7lver2/file-meet', shot: '/projects/file-meet.png' },
  { slug: 'ZephyrOS', name: 'ZephyrOS', desc: 'Minimal security-focused Linux distro for old systems and edge computing.', status: 'beta', ac: '#a3e635', tags: ['Linux', 'Bash', 'Arch'], web: 'https://github.com/s7lver2/ZephyrOS', shot: '/projects/ZephyrOS.png' },
  { slug: 'tsuki', name: 'tsuki', desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.', status: 'dev', ac: '#dea584', tags: ['Rust', 'LLVM', 'Embedded'] },
  { slug: 'CodeDotJS', name: 'CodeDotJS', desc: 'Reactive JS framework, no vDOM, <5kb.', status: 'dev', ac: '#3178c6', tags: ['TypeScript', 'Vite'], web: 'https://CodeDotjs.vercel.app', shot: '/projects/CodeDotJS.png' },
];

export const DEFAULT_SKILLS: SkillC[] = [
  { name: 'Web Exploit', value: 0.92, color: '#f87171', tools: 'Burp · SQLMap · Wfuzz', conceptKey: 'web' },
  { name: 'Network',     value: 0.85, color: '#22d3ee', tools: 'Nmap · Wireshark · tcpdump', conceptKey: 'net' },
  { name: 'Recon',       value: 0.80, color: '#a3e635', tools: 'Amass · Subfinder · OSINT', conceptKey: 'recon' },
  { name: 'Active Dir',  value: 0.75, color: '#8b5cf6', tools: 'BloodHound · Impacket', conceptKey: 'ad' },
  { name: 'Reversing',   value: 0.68, color: '#f472b6', tools: 'Ghidra · gdb · radare2', conceptKey: 'rev' },
  { name: 'Crypto',      value: 0.60, color: '#fde047', tools: 'hashcat · John', conceptKey: 'crypto' },
];

export const DEFAULT_SOCIALS: SocialC[] = [
  { k: 'github', v: 'github.com/s7lver2', color: '#6e5494', url: 'https://github.com/s7lver2', initials: 'GH' },
  { k: 'discord', v: '@s7lver', color: '#5865f2', url: '#', initials: 'DC' },
  { k: 'twitter', v: 'x.com/s7lver', color: '#1d9bf0', url: 'https://x.com/s7lver', initials: 'X' },
  { k: 'tiktok', v: '@s7lver', color: '#ff0050', url: '#', initials: 'TT' },
  { k: 'instagram', v: '@s7lver', color: '#e1306c', url: '#', initials: 'IG' },
  { k: 'htb', v: 'app.hackthebox.com/s7lver', color: '#9fef00', url: '#', initials: 'HTB' },
];

export const DEFAULT_HOME: HomeC = {
  heroTitle: "Hi, I'm s7lver",
  heroSubtitle: 'Developer & Cybersecurity Student',
};

const DEFAULTS: Record<ContentType, unknown> = {
  projects: DEFAULT_PROJECTS, skills: DEFAULT_SKILLS, socials: DEFAULT_SOCIALS, home: DEFAULT_HOME,
};

export function isContentType(t: string): t is ContentType {
  return t === 'projects' || t === 'skills' || t === 'socials' || t === 'home';
}

export async function getContent<T = unknown>(type: ContentType): Promise<T> {
  return kvGetJSON<T>(`content:${type}`, `content-${type}.json`, DEFAULTS[type] as T);
}
export async function setContent<T = unknown>(type: ContentType, value: T): Promise<void> {
  await kvSetJSON(`content:${type}`, `content-${type}.json`, value);
}
```

- [ ] **Step 2: Create the public read endpoint**

Create `app/api/content/[type]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getContent, isContentType } from '@/app/lib/content';

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  if (!isContentType(params.type)) {
    return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  }
  const data = await getContent(params.type);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
```

- [ ] **Step 3: Find the admin auth guard used by existing admin routes**

Run: `grep -rn "function requireAdmin\|export.*requireAuth\|cookies()" app/api/admin/users/route.ts app/lib/auth.ts`
Read whichever helper the existing admin write routes use to verify the session (e.g. open `app/api/admin/users/route.ts` and copy its auth-check pattern verbatim). You will reuse that exact guard in the next step.

- [ ] **Step 4: Create the admin write endpoint**

Create `app/api/admin/content/[type]/route.ts`. Use the SAME auth guard pattern you found in Step 3 (shown here as `requireAdmin(req)` — replace with the real call/import from this codebase):

```ts
import { NextResponse } from 'next/server';
import { getContent, setContent, isContentType } from '@/app/lib/content';
import { logAudit } from '@/app/lib/audit';
// import the real admin auth guard discovered in Step 3, e.g.:
// import { requireAdmin } from '@/app/lib/auth';

export async function GET(req: Request, { params }: { params: { type: string } }) {
  // const session = await requireAdmin(req); if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isContentType(params.type)) return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  return NextResponse.json(await getContent(params.type));
}

export async function PUT(req: Request, { params }: { params: { type: string } }) {
  // const session = await requireAdmin(req); if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isContentType(params.type)) return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  const body = await req.json();
  await setContent(params.type, body);
  try { await logAudit('content.update', { type: params.type }); } catch {}
  return NextResponse.json({ ok: true });
}
```

Open `app/lib/audit.ts` first and call its actual logging function with the correct signature (replace `logAudit('content.update', {...})` accordingly; if no such helper exists, drop the audit line).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles; routes `/api/content/[type]` and `/api/admin/content/[type]` appear in the route list.

- [ ] **Step 6: Verify endpoints in preview**

Start dev server. Then:
- `curl -s http://localhost:3000/api/content/projects` → returns the default projects JSON array.
- `curl -s http://localhost:3000/api/content/skills` → returns the 6 default skills.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/content/bogus` → `404`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/content.ts app/api/content/[type]/route.ts app/api/admin/content/[type]/route.ts
git commit -m "feat(content): KV-backed content layer (projects/skills/socials/home) + public + admin endpoints"
```

---

### Task 2: HTB machines pipeline (activity ✕ vendored htbmachines snapshot)

**Files:**
- Create: `app/lib/htb-concepts.ts`
- Create: `public/data/htbmachines.json` (vendored snapshot — seed with the sample below; refresh later via the script)
- Create: `scripts/fetch-htbmachines.mjs` (manual snapshot refresher)
- Create: `app/api/htb/machines/route.ts`
- Modify: `app/api/htb/route.ts` (add an activity fetch helper — optional reuse; the machines route can fetch activity itself)

**Interfaces:**
- Consumes: HTB env `HTB_USER_ID`, `HTB_API_TOKEN`.
- Produces:
  - `app/lib/htb-concepts.ts`: `type ConceptKey` (re-export from content), `CONCEPT_AXES: Record<ConceptKey, string[]>`, `skillsToAxisKeys(skills: string): ConceptKey[]`.
  - `GET /api/htb/machines` → `{ machines: MachineCard[] }` where `MachineCard = { name: string; difficulty: string; os: string; date: string; concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string }`.

- [ ] **Step 1: Create the concept→axis mapping**

Create `app/lib/htb-concepts.ts`:

```ts
import type { ConceptKey } from './content';
export type { ConceptKey };

// Keywords (lowercase) found in htbmachines `skills` that count toward each axis.
export const CONCEPT_AXES: Record<ConceptKey, string[]> = {
  web:    ['web', 'sqli', 'sql injection', 'xss', 'lfi', 'rfi', 'rce', 'ssrf', 'ssti', 'upload', 'idor', 'jwt', 'deserialization', 'xxe'],
  net:    ['network', 'pivoting', 'tunnel', 'port forward', 'smb', 'snmp', 'nfs', 'ftp', 'dns', 'proxychains'],
  recon:  ['enumeration', 'recon', 'osint', 'information gathering', 'subdomain', 'fuzzing'],
  ad:     ['active directory', 'kerberos', 'kerberoasting', 'bloodhound', 'ntlm', 'asreproast', 'dcsync', 'ldap', 'gpo'],
  rev:    ['reversing', 'reverse engineering', 'binary', 'buffer overflow', 'bof', 'pwn', 'ghidra', 'debugging'],
  crypto: ['crypto', 'cryptography', 'hash', 'rsa', 'aes', 'cipher', 'encryption'],
};

export function skillsToAxisKeys(skills: string): ConceptKey[] {
  const s = (skills || '').toLowerCase();
  const out: ConceptKey[] = [];
  (Object.keys(CONCEPT_AXES) as ConceptKey[]).forEach((axis) => {
    if (CONCEPT_AXES[axis].some((kw) => s.includes(kw))) out.push(axis);
  });
  return out;
}
```

- [ ] **Step 2: Seed the vendored snapshot**

Create `public/data/htbmachines.json` with a starter array (real machines; the refresher script in Step 3 replaces this with the full set later). Each entry uses the htbmachines field names:

```json
[
  { "name": "Lame", "so": "Linux", "dificultad": "Fácil", "skills": "Enumeration Samba CVE", "youtube": "" },
  { "name": "Forest", "so": "Windows", "dificultad": "Fácil", "skills": "Active Directory Kerberoasting BloodHound DCSync", "youtube": "" },
  { "name": "Cap", "so": "Linux", "dificultad": "Fácil", "skills": "Web IDOR Linux Capabilities", "youtube": "" },
  { "name": "Tentacle", "so": "Linux", "dificultad": "Difícil", "skills": "Active Directory Kerberos Crypto Enumeration", "youtube": "" },
  { "name": "Jeeves", "so": "Windows", "dificultad": "Media", "skills": "Web RCE Reversing", "youtube": "" },
  { "name": "Cascade", "so": "Windows", "dificultad": "Media", "skills": "Active Directory LDAP Crypto Reversing", "youtube": "" }
]
```

- [ ] **Step 3: Create the snapshot refresher script (manual, not runtime)**

Create `scripts/fetch-htbmachines.mjs`. Document that it is run manually to refresh the snapshot and that the upstream may be Cloudflare-protected (in which case the snapshot is edited by hand):

```js
// Manual snapshot refresher for public/data/htbmachines.json
// Usage: node scripts/fetch-htbmachines.mjs
// NOTE: the upstream (hackingvault.com / infosecmachines) is often behind Cloudflare.
// If the fetch fails, update public/data/htbmachines.json by hand from
// https://htbmachines.github.io (the Dataset in its source bundle).
import { writeFile } from 'node:fs/promises';

const URL = 'https://hackingvault.com/api/machines';
try {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const machines = Array.isArray(data) ? data : (data.machines ?? []);
  await writeFile('public/data/htbmachines.json', JSON.stringify(machines, null, 0));
  console.log(`Wrote ${machines.length} machines.`);
} catch (e) {
  console.error('Fetch failed (likely Cloudflare). Edit the JSON by hand. Reason:', e.message);
  process.exit(1);
}
```

- [ ] **Step 4: Create the machines route (activity ✕ snapshot)**

Create `app/api/htb/machines/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { skillsToAxisKeys, type ConceptKey } from '@/app/lib/htb-concepts';

const BASE = 'https://labs.hackthebox.com/api/v4';

type Snapshot = { name: string; so?: string; dificultad?: string; skills?: string; youtube?: string }[];

export interface MachineCard {
  name: string; difficulty: string; os: string; date: string;
  concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string;
}

async function loadSnapshot(): Promise<Snapshot> {
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'htbmachines.json');
    return JSON.parse(await fs.readFile(p, 'utf8')) as Snapshot;
  } catch { return []; }
}

export async function GET() {
  const token = process.env.HTB_API_TOKEN;
  const userId = process.env.HTB_USER_ID;
  if (!token || !userId) return NextResponse.json({ machines: [] }, { status: 200 });

  try {
    const res = await fetch(`${BASE}/user/profile/activity/${parseInt(userId, 10)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`activity ${res.status}`);
    const data = await res.json();
    const activity: any[] = data?.profile?.activity ?? data?.activity ?? [];

    const snapshot = await loadSnapshot();
    const byName = new Map(snapshot.map((m) => [m.name.toLowerCase(), m]));

    const machines: MachineCard[] = activity
      .filter((a) => (a.object_type === 'machine' || a.type === 'machine' || a.machine_avatar))
      .slice(0, 24)
      .map((a) => {
        const name: string = a.name ?? a.machine_name ?? '—';
        const snap = byName.get(name.toLowerCase());
        const skills = snap?.skills ?? '';
        const conceptKeys = skillsToAxisKeys(skills);
        const concepts = skills ? skills.split(/[ ,]+/).filter(Boolean).slice(0, 4) : [];
        return {
          name,
          difficulty: snap?.dificultad ?? a.machine_difficulty ?? a.difficulty ?? '—',
          os: snap?.so ?? a.os ?? '—',
          date: a.date ?? a.created_at ?? '',
          concepts,
          conceptKeys,
          youtube: snap?.youtube || undefined,
        };
      });

    return NextResponse.json({ machines }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[HTB machines]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ machines: [] }, { status: 200 });
  }
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles; `/api/htb/machines` in the route list.

- [ ] **Step 6: Verify**

- `curl -s http://localhost:3000/api/htb/machines` → `{ "machines": [...] }`. With valid HTB env, entries have `name/difficulty/os/concepts/conceptKeys`. Without env, returns `{ "machines": [] }` (HTTP 200, no crash).
- Sanity check the mapping: a machine whose snapshot `skills` contains "Active Directory" has `conceptKeys` including `"ad"`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/htb-concepts.ts public/data/htbmachines.json scripts/fetch-htbmachines.mjs app/api/htb/machines/route.ts
git commit -m "feat(htb): machines pipeline — activity API crossed with vendored htbmachines snapshot + concept→axis mapping"
```

---

### Task 3: Events ingest + feature flags + theme (settings)

**Files:**
- Modify: `app/lib/settings.ts` (add `flags` + `theme` to `SiteSettings`)
- Create: `app/lib/events.ts` (event store + aggregation)
- Create: `app/api/event/route.ts` (public ingest)
- Create: `app/api/flags/route.ts` (public read of flags + theme)

**Interfaces:**
- Produces:
  - `SiteSettings` gains `flags: { terminal: boolean; machines: boolean; timeline: boolean; maintenance: boolean }` and `theme: 'morado'|'azul'|'verde'|'mono'`.
  - `app/lib/events.ts`: `type AppEvent = { type: string; detail?: string; section?: string; depth?: number; ts: string }`; `addEvent(e): Promise<void>`; `readEvents(limit?): Promise<AppEvent[]>`; `summarizeEvents(events): EventSummary`.
  - `POST /api/event` (body `{ type, detail?, section?, depth? }`) → `{ ok: true }`.
  - `GET /api/flags` → `{ flags, theme }`.

- [ ] **Step 1: Extend settings with flags + theme**

In `app/lib/settings.ts`, update the `SiteSettings` interface and `DEFAULT`:

```ts
export interface SiteSettings {
  trackingEnabled: boolean;
  avatars: Record<string, string>;
  discordId: string;
  flags: { terminal: boolean; machines: boolean; timeline: boolean; maintenance: boolean };
  theme: 'morado' | 'azul' | 'verde' | 'mono';
  updatedAt: string;
}
const DEFAULT: SiteSettings = {
  trackingEnabled: true,
  avatars: {},
  discordId: '',
  flags: { terminal: true, machines: true, timeline: true, maintenance: false },
  theme: 'morado',
  updatedAt: new Date(0).toISOString(),
};
```

Also update the merge in `getSettings` so nested objects keep defaults:

```ts
export async function getSettings(): Promise<SiteSettings> {
  const s = await kvGetJSON<Partial<SiteSettings>>(KEY, FILE, DEFAULT);
  return {
    ...DEFAULT, ...s,
    avatars: { ...(s.avatars ?? {}) },
    flags: { ...DEFAULT.flags, ...(s.flags ?? {}) },
  };
}
```

- [ ] **Step 2: Create the events module**

Create `app/lib/events.ts`:

```ts
import { kvGetJSON, kvSetJSON } from './redis';

export interface AppEvent { type: string; detail?: string; section?: string; depth?: number; ts: string; }
interface EventStore { events: AppEvent[]; }
const KEY = 's7lver:events';
const FILE = 'events.json';
const MAX = 2000;

export async function readEvents(limit?: number): Promise<AppEvent[]> {
  const store = await kvGetJSON<EventStore>(KEY, FILE, { events: [] });
  const list = store.events ?? [];
  return limit ? list.slice(0, limit) : list;
}
export async function addEvent(e: Omit<AppEvent, 'ts'>): Promise<void> {
  const store = await kvGetJSON<EventStore>(KEY, FILE, { events: [] });
  const events = [{ ...e, ts: new Date().toISOString() }, ...(store.events ?? [])].slice(0, MAX);
  await kvSetJSON(KEY, FILE, { events });
}

export interface EventSummary {
  cmdkOpens: number; terminalCmds: number;
  avgScrollDepth: number; readFullPct: number;
  scrollBySection: { section: string; avg: number }[];
  recent: AppEvent[];
}
export function summarizeEvents(events: AppEvent[]): EventSummary {
  const cmdkOpens = events.filter((e) => e.type === 'cmdk_open').length;
  const terminalCmds = events.filter((e) => e.type === 'terminal_cmd').length;
  const depths = events.filter((e) => e.type === 'scroll_depth' && typeof e.depth === 'number');
  const avgScrollDepth = depths.length ? Math.round(depths.reduce((a, b) => a + (b.depth ?? 0), 0) / depths.length) : 0;
  const readFull = depths.filter((e) => (e.depth ?? 0) >= 90).length;
  const readFullPct = depths.length ? Math.round((readFull / depths.length) * 100) : 0;

  const secMap = new Map<string, { sum: number; n: number }>();
  depths.forEach((e) => {
    const s = e.section ?? '—';
    const cur = secMap.get(s) ?? { sum: 0, n: 0 };
    cur.sum += e.depth ?? 0; cur.n += 1; secMap.set(s, cur);
  });
  const scrollBySection = [...secMap.entries()].map(([section, v]) => ({ section, avg: Math.round(v.sum / v.n) }));

  return { cmdkOpens, terminalCmds, avgScrollDepth, readFullPct, scrollBySection, recent: events.slice(0, 30) };
}
```

- [ ] **Step 3: Create the public event ingest endpoint**

Create `app/api/event/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { addEvent } from '@/app/lib/events';

const ALLOWED = new Set(['cmdk_open', 'terminal_cmd', 'scroll_depth', 'project_click']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!ALLOWED.has(body?.type)) return NextResponse.json({ ok: false }, { status: 400 });
    await addEvent({
      type: body.type,
      detail: typeof body.detail === 'string' ? body.detail.slice(0, 80) : undefined,
      section: typeof body.section === 'string' ? body.section.slice(0, 40) : undefined,
      depth: typeof body.depth === 'number' ? Math.max(0, Math.min(100, Math.round(body.depth))) : undefined,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create the public flags endpoint**

Create `app/api/flags/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSettings } from '@/app/lib/settings';

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ flags: s.flags, theme: s.theme }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles; `/api/event` and `/api/flags` in the route list.

- [ ] **Step 6: Verify**

- `curl -s -X POST http://localhost:3000/api/event -H "Content-Type: application/json" -d '{"type":"cmdk_open"}'` → `{"ok":true}`.
- `curl -s -X POST http://localhost:3000/api/event -H "Content-Type: application/json" -d '{"type":"bogus"}' -o /dev/null -w "%{http_code}"` → `400`.
- `curl -s http://localhost:3000/api/flags` → `{"flags":{"terminal":true,...},"theme":"morado"}`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/settings.ts app/lib/events.ts app/api/event/route.ts app/api/flags/route.ts
git commit -m "feat(data): event ingest + summary, feature flags + theme in settings, public /api/flags"
```

---

## PHASE B — Public site

### Task 4: Skills consumes KV + hover-dim state (shared with carousel)

**Files:**
- Modify: `app/components/sections/Skills.tsx`
- Modify: `app/globals.css` (hover-dim rules)

**Interfaces:**
- Consumes: `GET /api/content/skills` (→ `SkillC[]`), `DEFAULT_SKILLS` from `@/app/lib/content`.
- Produces: `Skills.tsx` renders a `<MachinesCarousel>` (Task 5) passing `activeConcept`, `setActiveConcept`. Skills owns `const [activeConcept, setActiveConcept] = useState<ConceptKey | null>(null)`.

- [ ] **Step 1: Load skills from KV with fallback and add active-concept state**

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

- [ ] **Step 2: Wire hover handlers to set the active concept**

On each legend row (`.rl`) and each radar data point (`circle`), set handlers:

```tsx
onMouseEnter={() => setActiveConcept(axes[i].conceptKey)}
onMouseLeave={() => setActiveConcept(null)}
```

Add `data-c={axes[i].conceptKey}` to each `.rl` row, each radar `circle` (class `pt`), and each axis `line` (class `axline`). Put `data-active={activeConcept ?? undefined}` on the section's wrapping element (the `<div ref={reveal}>` or a new `.skillblk` wrapper) so CSS can target descendants.

- [ ] **Step 3: Render the carousel inside the section**

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

- [ ] **Step 4: Add hover-dim CSS**

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

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles (with the Machines stub present).

- [ ] **Step 6: Verify**

- Navigate to `/`, scroll to Skills. preview_snapshot → radar + legend render from KV (same as before).
- Hover a legend row → preview_screenshot shows the other rows/points dimmed and the hovered one highlighted.
- preview_console_logs → clean.

- [ ] **Step 7: Commit**

```bash
git add app/components/sections/Skills.tsx app/components/sections/Machines.tsx app/globals.css
git commit -m "feat(skills): load from KV + hover-dim active-concept state (+ carousel stub)"
```

---

### Task 5: Machines carousel (infinite, pause on hover, bidirectional link)

**Files:**
- Modify: `app/components/sections/Machines.tsx` (replace stub with full carousel)
- Modify: `app/globals.css` (carousel styles)

**Interfaces:**
- Consumes: `GET /api/htb/machines` (→ `{ machines: MachineCard[] }`), props `{ activeConcept: ConceptKey | null; onConceptHover: (c: ConceptKey | null) => void }`.
- Produces: infinite marquee of machine cards; cards gain `.has`/dim based on `activeConcept`; hovering a card calls `onConceptHover` with its first conceptKey and pauses the track (pause via CSS `:hover`).

- [ ] **Step 1: Implement the carousel**

Replace `app/components/sections/Machines.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ConceptKey } from '@/app/lib/content';

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

- [ ] **Step 2: Add carousel CSS**

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

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Verify**

- Navigate to `/`, scroll to Skills. preview_snapshot → carousel of machine cards under the radar (or absent if HTB env missing — acceptable).
- Hover a skill legend row → matching machine cards stay lit, others dim/grayscale; the track pauses while hovering a card.
- Hover a machine card → the radar/legend highlights that machine's concept(s).
- preview_console_logs → clean.

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/Machines.tsx app/globals.css
git commit -m "feat(machines): infinite carousel of solved machines, bidirectional hover link with skills"
```

---

### Task 6: ProgressRail (side timeline)

**Files:**
- Create: `app/components/ProgressRail.tsx`
- Modify: `app/page.tsx` (mount it)
- Modify: `app/globals.css` (rail styles)

**Interfaces:**
- Produces: `<ProgressRail />` fixed-left timeline; visible after hero leaves viewport; labels on hover; click → scroll; active node by IntersectionObserver; fill bar by scroll progress.

- [ ] **Step 1: Implement ProgressRail**

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

- [ ] **Step 2: Mount in page.tsx**

In `app/page.tsx`, import and render `<ProgressRail />` once inside the returned fragment (e.g. right after `<Navbar … />`):

```tsx
import ProgressRail from '@/components/ProgressRail';
// ...
<ProgressRail />
```

- [ ] **Step 3: Add rail CSS**

In `app/globals.css`, append:

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

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 5: Verify**

- Navigate to `/`. At top (hero) the rail is hidden. Scroll down → rail fades in on the left; dots show, labels appear on hover; active node tracks the section; fill bar grows with scroll. Click a node → smooth-scrolls.
- preview_resize to 800px → rail hidden.
- preview_console_logs → clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/ProgressRail.tsx app/page.tsx app/globals.css
git commit -m "feat(rail): fixed side progress timeline (labels on hover, scroll fill, hidden on mobile)"
```

---

### Task 7: ⌘K navigate → 2-column ASCII-left

**Files:**
- Modify: `app/components/CommandPalette.tsx` (reorder navigate panel markup)
- Modify: `app/globals.css` (`.ccbody` two columns)

**Interfaces:**
- No prop changes. Only the navigate-tab layout changes.

- [ ] **Step 1: Reorder the navigate panel into search / 2-col body / footer**

In `app/components/CommandPalette.tsx`, change the navigate-tab block so the search input is on top, then a 2-column row (ASCII left + list right), then the footer. Replace the current navigate JSX (the `{tab === 'nav' && ( … )}` block) with:

```tsx
{tab === 'nav' && (
  <>
    <div className="ccq-wrapper">
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        className="ccq"
        placeholder="Navigate sections..."
        autoComplete="off"
        spellCheck={false}
      />
    </div>
    <div className="ccnav-body">
      <div className="palart">
        <pre className="text-xs leading-tight overflow-hidden">{asciiArt || 'No art loaded'}</pre>
      </div>
      <div className="pallist">
        {SECTIONS.map((section, idx) => (
          <button
            ref={idx === selectedIdx ? selectedRef : null}
            key={section.id}
            onClick={() => {
              const el = document.getElementById(section.id);
              if (el) { el.scrollIntoView({ behavior: 'smooth' }); onClose(); }
            }}
            className={`li ${idx === selectedIdx ? 'li-selected' : ''}`}
          >
            <span className="li-label">{section.label}</span>
            <span className="li-hint">{section.href}</span>
          </button>
        ))}
      </div>
    </div>
    <div className="palfoot">
      <span className="flex items-center gap-1"><FaArrowUp className="text-[10px]" /><FaArrowDown className="text-[10px]" /><span>navigate</span></span>
      <span>↵ go</span><span>Tab terminal</span><span>esc close</span>
    </div>
  </>
)}
```

- [ ] **Step 2: Add the 2-column CSS**

In `app/globals.css`, add (near the command-center styles):

```css
/* ⌘K navigate — two columns (ASCII left like social) */
.ccnav-body { display: flex; gap: 22px; padding: 18px; }
.ccnav-body .palart { flex-shrink: 0; width: 230px; display: flex; align-items: center; justify-content: center; }
.ccnav-body .pallist { flex: 1; }
@media (max-width: 600px) { .ccnav-body { flex-direction: column; } .ccnav-body .palart { width: 100%; } }
```

If the existing `.palart`/`.pallist` rules conflict (e.g. fixed widths from the prior column layout), this scoped `.ccnav-body .palart` override wins; verify the ASCII sits left and the list right.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Verify**

- Press ⌘K → navigate tab shows search on top, ASCII art on the LEFT, sections list on the RIGHT (like the Social fastfetch), hints at the bottom.
- ↑↓ still moves selection; ↵ navigates; Tab → terminal tab.
- preview_resize 500px → columns stack.
- preview_console_logs → clean.

- [ ] **Step 5: Commit**

```bash
git add app/components/CommandPalette.tsx app/globals.css
git commit -m "feat(cmdk): navigate panel as two columns (ASCII left, list right) like social"
```

---

### Task 8: Projects / Social / Hero consume KV (with fallback) + event hooks

**Files:**
- Modify: `app/components/sections/Projects.tsx`
- Modify: `app/components/sections/Social.tsx`
- Modify: `app/components/sections/Hero.tsx`
- Modify: `app/page.tsx` (fire `cmdk_open`, `scroll_depth`, `project_click`, `terminal_cmd` events) and `app/components/TerminalPanel.tsx` (terminal_cmd)

**Interfaces:**
- Consumes: `/api/content/projects|socials|home`, defaults from `@/app/lib/content`; `POST /api/event`.

- [ ] **Step 1: Projects from KV**

In `app/components/sections/Projects.tsx`, import defaults and fetch:

```tsx
import { DEFAULT_PROJECTS, type ProjectC } from '@/app/lib/content';
// inside component:
const [projects, setProjects] = useState<ProjectC[]>(DEFAULT_PROJECTS);
useEffect(() => {
  fetch('/api/content/projects').then((r) => r.ok ? r.json() : null)
    .then((d: ProjectC[] | null) => { if (Array.isArray(d) && d.length) setProjects(d); }).catch(() => {});
}, []);
```

Replace the module-level `PROJECTS` usage with the `projects` state in the render (the `doubled` array and `.map`). Keep the existing card markup.

- [ ] **Step 2: Social from KV**

In `app/components/sections/Social.tsx`, replace the hardcoded `SOCIALS` initial with `DEFAULT_SOCIALS` and fetch overrides:

```tsx
import { DEFAULT_SOCIALS } from '@/app/lib/content';
// initialize state from DEFAULT_SOCIALS (mapped to include avatar: `/api/avatar/<k>`)
// after mount, fetch /api/content/socials and merge if present, then run the existing avatar→ASCII loader.
```

Keep the avatar proxy URL derivation (`/api/avatar/<k>`) and the existing ASCII loading effect. Only the source list becomes KV-overridable; if the fetch returns nothing, defaults are used.

- [ ] **Step 3: Hero text from KV**

In `app/components/sections/Hero.tsx`, import `DEFAULT_HOME` and fetch `/api/content/home`; render `heroTitle`/`heroSubtitle` from state (fallback to defaults). Keep the gradient on the name (split the title so "s7lver" keeps `.grad` — render `heroTitle` with the existing markup, substituting the dynamic string).

- [ ] **Step 4: Event hooks**

In `app/page.tsx`, add a tiny helper and call it:

```tsx
function track(type: string, extra?: Record<string, unknown>) {
  try {
    fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...extra }), keepalive: true });
  } catch {}
}
```

- Call `track('cmdk_open', { detail: paletteTab })` when the palette opens (in the ⌘K/backtick handlers).
- Add a scroll-depth reporter: on scroll (throttled), compute the furthest section in view and its page depth %, and fire `track('scroll_depth', { section, depth })` at most once per section per page load (guard with a `Set`).
- In `Projects.tsx`, on a project card click that opens `web`, call `track('project_click', { detail: slug })` (add the same `track` helper or lift it to a shared util `app/lib/track.ts` — create that util and use it in both files to stay DRY).

Create `app/lib/track.ts`:

```ts
export function track(type: string, extra?: Record<string, unknown>) {
  try {
    fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...extra }), keepalive: true });
  } catch {}
}
```

Use `import { track } from '@/app/lib/track'` in `page.tsx`, `Projects.tsx`, and `TerminalPanel.tsx`.

- [ ] **Step 5: terminal_cmd event**

In `app/components/TerminalPanel.tsx`, inside the `run(raw)` function (after a non-empty command is entered), call `track('terminal_cmd', { detail: raw.split(' ')[0] })`.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 7: Verify**

- Navigate to `/`: projects/social/hero render unchanged (KV empty → defaults).
- Open ⌘K, run a terminal command, click a project, scroll the page. Then `curl -s http://localhost:3000/api/admin/stats` is not the check — instead `curl -s http://localhost:3000/api/flags` works and the event store grew (verify in Task 10's engagement page, or `curl` a temporary debug). Minimum here: preview_console_logs shows no errors and the `/api/event` POSTs return 200 (preview_network).

- [ ] **Step 8: Commit**

```bash
git add app/components/sections/Projects.tsx app/components/sections/Social.tsx app/components/sections/Hero.tsx app/lib/track.ts app/page.tsx app/components/TerminalPanel.tsx
git commit -m "feat(content): public sections read from KV with fallback; client event tracking"
```

---

## PHASE C — Admin

### Task 9: Admin sidebar groups + content manager pages

**Files:**
- Modify: `app/admin/components/AdminSidebar.tsx` (grouped NAV with new items)
- Create: `app/admin/content/projects/page.tsx`
- Create: `app/admin/content/skills/page.tsx`
- Create: `app/admin/content/socials/page.tsx`
- Create: `app/admin/content/home/page.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/admin/content/<type>`.

- [ ] **Step 1: Grouped sidebar nav**

In `app/admin/components/AdminSidebar.tsx`, replace the flat `NAV` array with grouped sections and render group headers. Use:

```tsx
const GROUPS = [
  { title: 'Analytics', items: [
    { href: '/admin', label: 'Overview', icon: '◈' },
    { href: '/admin/traffic', label: 'Traffic', icon: '⊡' },
    { href: '/admin/live', label: 'Live', icon: '◎' },
    { href: '/admin/engagement', label: 'Engagement', icon: '⊙' },
  ]},
  { title: 'Contenido', items: [
    { href: '/admin/content/projects', label: 'Proyectos', icon: '◫' },
    { href: '/admin/content/skills', label: 'Skills', icon: '◈' },
    { href: '/admin/content/socials', label: 'Redes', icon: '@' },
    { href: '/admin/content/home', label: 'Home', icon: '¶' },
  ]},
  { title: 'Sistema', items: [
    { href: '/admin/profiles', label: 'Profiles', icon: '🎭' },
    { href: '/admin/users', label: 'Users', icon: '👤' },
    { href: '/admin/audit', label: 'Audit', icon: '📋' },
    { href: '/admin/settings', label: 'Ajustes', icon: '⚙' },
  ]},
];
```

Render each group with a small uppercase header (style: `fontSize:10, letterSpacing:.14em, textTransform:uppercase, color:rgba(255,255,255,.3)`) above its `items.map(...)` (reuse the existing `<Link>` rendering for each item).

- [ ] **Step 2: Projects manager page**

Create `app/admin/content/projects/page.tsx` — a client page that loads `/api/admin/content/projects`, lets the user edit a JSON-backed list (add/remove/edit fields), and PUTs back. Use the admin style (dark cards, Space Mono). Full implementation:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ProjectC } from '@/app/lib/content';

export default function ProjectsAdmin() {
  const [items, setItems] = useState<ProjectC[]>([]);
  const [saved, setSaved] = useState('');

  useEffect(() => { fetch('/api/admin/content/projects').then(r => r.json()).then(setItems).catch(() => {}); }, []);

  const update = (i: number, patch: Partial<ProjectC>) =>
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const add = () => setItems([...items, { slug: 'new', name: 'New', desc: '', status: 'dev', ac: '#8b5cf6', tags: [] }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const save = async () => {
    await fetch('/api/admin/content/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) });
    setSaved('guardado'); setTimeout(() => setSaved(''), 1500);
  };

  const card: React.CSSProperties = { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 12, padding: 16, marginBottom: 12 };
  const input: React.CSSProperties = { background: 'rgba(0,0,0,.3)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 6, color: '#fff', fontFamily: 'Space Mono, monospace', fontSize: 12, padding: '6px 9px', width: '100%' };
  const btn: React.CSSProperties = { fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#fff', background: 'linear-gradient(100deg,#8b5cf6,#3b82f6)', border: 0, borderRadius: 7, padding: '8px 14px', cursor: 'pointer' };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, marginBottom: 16 }}>Proyectos</h1>
      {items.map((p, i) => (
        <div key={i} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input style={input} value={p.name} onChange={e => update(i, { name: e.target.value })} placeholder="name" />
            <input style={input} value={p.slug} onChange={e => update(i, { slug: e.target.value })} placeholder="slug" />
            <input style={input} value={p.desc} onChange={e => update(i, { desc: e.target.value })} placeholder="desc" />
            <input style={input} value={p.ac} onChange={e => update(i, { ac: e.target.value })} placeholder="#color" />
            <input style={input} value={p.web ?? ''} onChange={e => update(i, { web: e.target.value })} placeholder="web url" />
            <input style={input} value={p.tags.join(', ')} onChange={e => update(i, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="tags, comma" />
            <select style={input} value={p.status} onChange={e => update(i, { status: e.target.value as ProjectC['status'] })}>
              <option value="done">done</option><option value="beta">beta</option><option value="dev">dev</option>
            </select>
          </div>
          <button onClick={() => remove(i)} style={{ ...btn, background: 'rgba(239,68,68,.15)', color: '#f87171', marginTop: 8 }}>eliminar</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={add} style={{ ...btn, background: 'transparent', border: '1px solid rgba(139,92,246,.3)', color: 'rgba(255,255,255,.7)' }}>+ proyecto</button>
        <button onClick={save} style={btn}>guardar</button>
        {saved && <span style={{ color: '#4ade80', fontFamily: 'Space Mono, monospace', fontSize: 12, alignSelf: 'center' }}>{saved}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Skills manager page**

Create `app/admin/content/skills/page.tsx` following the same shape as Step 2 but editing `SkillC[]` (fields: name, value 0-1 as a range input, color, tools, conceptKey select with options web/net/recon/ad/rev/crypto), loading/saving `/api/admin/content/skills`. Reuse the same `card`/`input`/`btn` styles. Provide the full component (mirror Step 2's structure; the value field is `<input type="range" min={0} max={1} step={0.01} value={s.value} ...>` with a `%` readout).

- [ ] **Step 4: Socials + Home pages**

Create `app/admin/content/socials/page.tsx` (edit `SocialC[]`: k, v, color, url, initials) and `app/admin/content/home/page.tsx` (edit `HomeC`: heroTitle, heroSubtitle — two inputs + save). Same admin styling and load/save pattern against `/api/admin/content/socials` and `/api/admin/content/home`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles; new `/admin/content/*` routes present.

- [ ] **Step 6: Verify**

- Log into `/admin`. Sidebar shows groups Analytics / Contenido / Sistema with the new items.
- Open `/admin/content/projects` → edit a project name, save → reload shows persisted value. Then load `/` → the public Projects section reflects the edit.
- preview_console_logs → clean; PUT returns 200 (preview_network).

- [ ] **Step 7: Commit**

```bash
git add app/admin/components/AdminSidebar.tsx app/admin/content
git commit -m "feat(admin): grouped sidebar + content manager (projects/skills/socials/home)"
```

---

### Task 10: Admin engagement page + aggregation endpoint

**Files:**
- Create: `app/api/admin/engagement/route.ts`
- Create: `app/admin/engagement/page.tsx`

**Interfaces:**
- Consumes: `readEvents`, `summarizeEvents` from `@/app/lib/events`; visits geo from `app/lib/data.ts` (for the map).
- Produces: `GET /api/admin/engagement` → `EventSummary & { geo: { lat: number; lon: number }[] }`.

- [ ] **Step 1: Aggregation endpoint**

Create `app/api/admin/engagement/route.ts` (reuse the admin auth guard from Task 1 Step 3):

```ts
import { NextResponse } from 'next/server';
import { readEvents, summarizeEvents } from '@/app/lib/events';
import { readVisits } from '@/app/lib/data';
// import the admin auth guard (same as Task 1).

export async function GET(/* req: Request */) {
  // guard: if (!session) return 401
  const events = await readEvents();
  const summary = summarizeEvents(events);
  const visits = await readVisits(500);
  const geo = visits
    .filter((v) => typeof v.lat === 'number' && typeof v.lon === 'number')
    .map((v) => ({ lat: v.lat as number, lon: v.lon as number }));
  return NextResponse.json({ ...summary, geo });
}
```

- [ ] **Step 2: Engagement page**

Create `app/admin/engagement/page.tsx` — KPI cards (⌘K opens, terminal cmds, avg scroll, read-full %), a scroll-by-section bar list, a hand-drawn SVG world map with blips from `geo` (equirectangular projection: `x = (lon+180)/360*W`, `y = (90-lat)/180*H`), and a recent-events table. Use the admin card style. Full implementation:

```tsx
'use client';
import { useEffect, useState } from 'react';

interface Data {
  cmdkOpens: number; terminalCmds: number; avgScrollDepth: number; readFullPct: number;
  scrollBySection: { section: string; avg: number }[];
  recent: { type: string; detail?: string; section?: string; depth?: number; ts: string }[];
  geo: { lat: number; lon: number }[];
}
const card: React.CSSProperties = { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 12, padding: 16, marginBottom: 12 };
const lab: React.CSSProperties = { fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,.65)', marginBottom: 12 };

export default function Engagement() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch('/api/admin/engagement').then(r => r.json()).then(setD).catch(() => {}); }, []);
  if (!d) return <div style={{ fontFamily: 'Space Mono, monospace', color: 'rgba(255,255,255,.3)', padding: 40 }}>loading…</div>;

  const W = 480, H = 240;
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, marginBottom: 16 }}>Engagement</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
        {[['⌘K abierto', d.cmdkOpens], ['terminal usada', d.terminalCmds], ['scroll medio', `${d.avgScrollDepth}%`], ['leen completo', `${d.readFullPct}%`]].map(([k, v]) => (
          <div key={k as string} style={{ ...card, marginBottom: 0 }}>
            <div style={lab}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={lab}>Scroll por sección</div>
          {d.scrollBySection.map((s) => (
            <div key={s.section} style={{ marginBottom: 8, fontFamily: 'Space Mono, monospace', fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.6)' }}><span>{s.section}</span><span>{s.avg}%</span></div>
              <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, marginTop: 3 }}>
                <div style={{ height: '100%', width: `${s.avg}%`, background: 'linear-gradient(90deg,#8b5cf6,#3b82f6)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={lab}>Visitantes · mapa</div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ border: '1px solid rgba(139,92,246,.15)', borderRadius: 8, background: 'rgba(0,0,0,.2)' }}>
            {d.geo.map((g, i) => (
              <circle key={i} cx={(g.lon + 180) / 360 * W} cy={(90 - g.lat) / 180 * H} r={3} fill="#4ade80" opacity={0.7} />
            ))}
          </svg>
        </div>
      </div>
      <div style={card}>
        <div style={lab}>Eventos recientes</div>
        <table style={{ width: '100%', fontFamily: 'Space Mono, monospace', fontSize: 12, borderCollapse: 'collapse' }}>
          <tbody>
            {d.recent.map((e, i) => (
              <tr key={i}><td style={{ color: '#8b5cf6', padding: '5px 8px' }}>{e.type}</td><td style={{ color: 'rgba(255,255,255,.6)', padding: '5px 8px' }}>{e.detail ?? e.section ?? ''}{typeof e.depth === 'number' ? ` ${e.depth}%` : ''}</td><td style={{ color: 'rgba(255,255,255,.3)', padding: '5px 8px', textAlign: 'right' }}>{new Date(e.ts).toLocaleTimeString('es-ES')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles; `/admin/engagement` present.

- [ ] **Step 4: Verify**

- Generate some events first (on `/`: open ⌘K, run a terminal cmd, scroll). Then open `/admin/engagement` → KPIs reflect the events, scroll-by-section bars show, map shows blips (if any geo visits), recent-events table lists them.
- preview_console_logs → clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/engagement/route.ts app/admin/engagement/page.tsx
git commit -m "feat(admin): engagement page — KPIs, scroll-by-section, live SVG map, event stream"
```

---

### Task 11: Admin settings (flags + theme) + apply theme/flags on public site

**Files:**
- Create or Modify: `app/admin/settings/page.tsx`
- Modify: `app/api/admin/settings/route.ts` (persist flags + theme via `updateSettings`)
- Modify: `app/page.tsx` (read `/api/flags`: gate machines/timeline/terminal, apply theme to `--brand-*`)

**Interfaces:**
- Consumes: `GET /api/flags`; `GET/PUT /api/admin/settings`.

- [ ] **Step 1: Ensure the admin settings API persists flags + theme**

Open `app/api/admin/settings/route.ts`. Confirm its PUT/POST calls `updateSettings(patch)` (from `app/lib/settings.ts`). Since `SiteSettings` now includes `flags` and `theme` (Task 3), passing `{ flags }` or `{ theme }` in the patch persists them. If the route whitelists specific keys, add `flags` and `theme` to the allowed patch keys. (Read the file and adjust the allowed-keys list accordingly.)

- [ ] **Step 2: Settings page — flags + theme**

Create/replace `app/admin/settings/page.tsx`. Load `/api/admin/settings`, render toggles for the four flags and a 4-swatch theme picker, PUT on change. Full implementation:

```tsx
'use client';
import { useEffect, useState } from 'react';

type Flags = { terminal: boolean; machines: boolean; timeline: boolean; maintenance: boolean };
type Theme = 'morado' | 'azul' | 'verde' | 'mono';
const THEME_SWATCH: Record<Theme, string> = {
  morado: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', azul: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
  verde: 'linear-gradient(135deg,#22c55e,#a3e635)', mono: 'linear-gradient(135deg,#e5e7eb,#9ca3af)',
};
const card: React.CSSProperties = { background: 'rgba(255,255,255,.025)', border: '1px solid rgba(139,92,246,.15)', borderRadius: 12, padding: 18, marginBottom: 12 };
const lab: React.CSSProperties = { fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,.65)', marginBottom: 14 };

export default function SettingsPage() {
  const [flags, setFlags] = useState<Flags>({ terminal: true, machines: true, timeline: true, maintenance: false });
  const [theme, setTheme] = useState<Theme>('morado');

  useEffect(() => { fetch('/api/admin/settings').then(r => r.json()).then((s) => { if (s.flags) setFlags(s.flags); if (s.theme) setTheme(s.theme); }).catch(() => {}); }, []);

  const put = (patch: object) => fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  const toggle = (k: keyof Flags) => { const next = { ...flags, [k]: !flags[k] }; setFlags(next); put({ flags: next }); };
  const pick = (t: Theme) => { setTheme(t); put({ theme: t }); };

  const FLAG_META: [keyof Flags, string, string][] = [
    ['terminal', 'Terminal habilitada', '⌘K + backtick'],
    ['machines', 'Carrusel de máquinas', 'sección HTB recientes'],
    ['timeline', 'Timeline lateral', 'rail de progreso'],
    ['maintenance', 'Modo mantenimiento', 'oculta la web'],
  ];

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, marginBottom: 16 }}>Ajustes</h1>
      <div style={card}>
        <div style={lab}>Feature flags</div>
        {FLAG_META.map(([k, name, desc]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
            <div><div style={{ fontSize: 13 }}>{name}</div><div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,.3)' }}>{desc}</div></div>
            <button onClick={() => toggle(k)} style={{ width: 38, height: 21, borderRadius: 999, border: 0, cursor: 'pointer', position: 'relative', background: flags[k] ? 'linear-gradient(90deg,#8b5cf6,#3b82f6)' : 'rgba(255,255,255,.1)' }}>
              <span style={{ position: 'absolute', top: 2, left: flags[k] ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </button>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={lab}>Tema de acento</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(Object.keys(THEME_SWATCH) as Theme[]).map((t) => (
            <button key={t} onClick={() => pick(t)} title={t} style={{ width: 26, height: 26, borderRadius: 7, cursor: 'pointer', background: THEME_SWATCH[t], border: theme === t ? '2px solid #fff' : '2px solid transparent' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Apply flags + theme on the public site**

In `app/page.tsx`, fetch `/api/flags` on mount and apply:

```tsx
const [flags, setFlags] = useState({ terminal: true, machines: true, timeline: true, maintenance: false });
useEffect(() => {
  fetch('/api/flags').then(r => r.json()).then((d) => {
    if (d.flags) setFlags(d.flags);
    const THEMES: Record<string, [string, string]> = { morado: ['#8b5cf6','#3b82f6'], azul: ['#3b82f6','#06b6d4'], verde: ['#22c55e','#a3e635'], mono: ['#e5e7eb','#9ca3af'] };
    const pair = THEMES[d.theme]; if (pair) { document.documentElement.style.setProperty('--brand-1', pair[0]); document.documentElement.style.setProperty('--brand-2', pair[1]); }
  }).catch(() => {});
}, []);
```

- Gate `<ProgressRail />` on `flags.timeline`.
- Pass `flags.terminal` to disable the ⌘K terminal tab / backtick if false (guard the `openTerminal`/backtick handler with `if (!flags.terminal) return`).
- The machines carousel: pass `flags.machines` down (Skills → Machines) or gate its render; simplest is to gate in `page.tsx` is not possible (it's inside Skills), so read `/api/flags` in `Machines.tsx` too, OR pass a prop. Choose: `Machines.tsx` already returns null when no machines — additionally have it check `flags.machines` by reading `/api/flags` once; if false, render null.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles; `/admin/settings` present.

- [ ] **Step 5: Verify**

- `/admin/settings`: toggle "Carrusel de máquinas" off → reload `/` → carousel gone. Toggle on → returns.
- Pick theme "verde" → reload `/` → the `.grad` brand gradient (hero name, commits number) turns green.
- preview_console_logs → clean; PUTs return 200.

- [ ] **Step 6: Commit**

```bash
git add app/admin/settings/page.tsx app/api/admin/settings/route.ts app/page.tsx app/components/sections/Machines.tsx
git commit -m "feat(admin): settings — feature flags + accent theme, applied on public site"
```

---

## Self-Review

**Spec coverage:**
- §1.1 content KV + endpoints → Task 1 ✓
- §1.2 machines pipeline (activity ✕ snapshot, concept→axis) → Task 2 ✓
- §1.3 events → Task 3 (ingest/summary) + Task 8 (client hooks) + Task 10 (aggregation page) ✓
- §1.4 concept→axis table → Task 2 ✓
- §2.1 skills hover-dim + KV → Task 4 ✓
- §2.2 machines carousel infinite → Task 5 ✓
- §2.3 progress rail → Task 6 ✓
- §2.4 ⌘K 2-column → Task 7 ✓
- §2.5 public sections consume KV → Task 8 ✓
- §3.1 content manager → Task 9 ✓
- §3.2 engagement analytics → Task 10 ✓
- §3.3 security/settings (flags, theme) → Task 11 ✓; users/sessions: users page already exists; sessions-revocation is noted in the spec as auth-dependent — NOT given its own task because it requires reading `app/lib/auth.ts` to know if sessions are individually revocable. Added note below.

**Gap noted:** §3.3 "sesiones activas (revocar)" is not a standalone task — it depends on how `app/lib/auth.ts` models sessions (single cookie vs session list). Resolve during Task 11 Step 1 when reading the settings/auth code; if sessions are individually tracked, add a small panel to the settings page; if not (single JWT cookie), the existing "log out" is the only revocation and no new work is needed. This is a deliberate scope decision, not a placeholder.

**Placeholder scan:** Steps 3/4 of Task 1 and Task 10/11 reference "the admin auth guard discovered in Step 3" and "reuse from Task 1" — these are concrete (read one named file, copy its pattern), not vague. Task 3 (skills/socials/home admin pages) say "mirror Step 2's structure" but Step 2 provides the full component and the fields are enumerated — acceptable since the pattern is fully shown and fields are explicit. All code steps contain real code.

**Type consistency:** `ConceptKey` defined in `content.ts`, re-exported from `htb-concepts.ts`, used in `Machines.tsx`/`Skills.tsx` — consistent. `MachineCard` shape identical in `/api/htb/machines` and `Machines.tsx`. `SiteSettings.flags`/`theme` defined in Task 3 and consumed in Tasks 11. `track()` util defined once (Task 8) and reused. Content endpoint `isContentType`/`getContent`/`setContent` consistent across Tasks 1, 8, 9.
