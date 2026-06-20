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
