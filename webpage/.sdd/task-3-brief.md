# Task 3: Events ingest + feature flags + theme (settings)

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

## Step 1: Extend settings with flags + theme

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

## Step 2: Create the events module

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

## Step 3: Create the public event ingest endpoint

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

## Step 4: Create the public flags endpoint

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

## Step 5: Build

Run: `npm run build`
Expected: compiles; `/api/event` and `/api/flags` in the route list.

## Step 6: Verify

- `curl -s -X POST http://localhost:3000/api/event -H "Content-Type: application/json" -d '{"type":"cmdk_open"}'` → `{"ok":true}`.
- `curl -s -X POST http://localhost:3000/api/event -H "Content-Type: application/json" -d '{"type":"bogus"}' -o /dev/null -w "%{http_code}"` → `400`.
- `curl -s http://localhost:3000/api/flags` → `{"flags":{"terminal":true,...},"theme":"morado"}`.

## Step 7: Commit

```bash
git add app/lib/settings.ts app/lib/events.ts app/api/event/route.ts app/api/flags/route.ts
git commit -m "feat(data): event ingest + summary, feature flags + theme in settings, public /api/flags"
```
