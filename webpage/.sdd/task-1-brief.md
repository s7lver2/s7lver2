# Task 1: Content KV module + public read + admin write endpoints

**Files:**
- Create: `app/lib/content.ts`
- Create: `app/api/content/[type]/route.ts`
- Create: `app/api/admin/content/[type]/route.ts`

**Interfaces:**
- Produces:
  - `app/lib/content.ts`: types `ProjectC`, `SkillC`, `SocialC`, `HomeC`; `ContentType = 'projects'|'skills'|'socials'|'home'`; `getContent<T>(type): Promise<T>` (returns KV value or the hardcoded default); `setContent(type, value): Promise<void>`; exported defaults `DEFAULT_PROJECTS`, `DEFAULT_SKILLS`, `DEFAULT_SOCIALS`, `DEFAULT_HOME`.
  - `GET /api/content/<type>` → JSON content (public, cached).
  - `GET|PUT /api/admin/content/<type>` → read/write (admin-auth gated).

## Step 1: Create the content module with types and defaults

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

## Step 2: Create the public read endpoint

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

## Step 3: Find the admin auth guard used by existing admin routes

Run: `grep -rn "function requireAdmin\|export.*requireAuth\|cookies()" app/api/admin/users/route.ts app/lib/auth.ts`
Read whichever helper the existing admin write routes use to verify the session (e.g. open `app/api/admin/users/route.ts` and copy its auth-check pattern verbatim). You will reuse that exact guard in the next step.

## Step 4: Create the admin write endpoint

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

## Step 5: Build

Run: `npm run build`
Expected: compiles; routes `/api/content/[type]` and `/api/admin/content/[type]` appear in the route list.

## Step 6: Verify endpoints in preview

Start dev server. Then:
- `curl -s http://localhost:3000/api/content/projects` → returns the default projects JSON array.
- `curl -s http://localhost:3000/api/content/skills` → returns the 6 default skills.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/content/bogus` → `404`.

## Step 7: Commit

```bash
git add app/lib/content.ts app/api/content/[type]/route.ts app/api/admin/content/[type]/route.ts
git commit -m "feat(content): KV-backed content layer (projects/skills/socials/home) + public + admin endpoints"
```
