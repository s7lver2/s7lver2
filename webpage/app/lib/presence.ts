import { kvGetJSON, kvSetJSON } from './redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresenceEntry {
  sessionId: string;
  lastSeen: number;       // epoch ms
  connectedAt: number;    // epoch ms
  page: string;
  country?: string;
  countryCode?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

// A session is "online" if it sent a heartbeat within this window.
// The client heartbeats every 15s, so 40s tolerates two missed beats.
const ONLINE_TTL = 40_000;
// Entries older than this get pruned from storage entirely.
const PRUNE_TTL = 10 * 60_000;

// ─── Storage ──────────────────────────────────────────────────────────────────

const KV_KEY = 's7lver:presence';
const FILE = 'presence.json';

type PresenceMap = Record<string, PresenceEntry>;

function prune(map: PresenceMap): PresenceMap {
  const now = Date.now();
  const out: PresenceMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (now - v.lastSeen < PRUNE_TTL) out[k] = v;
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function touchPresence(
  sessionId: string,
  info: { page?: string; country?: string; countryCode?: string; city?: string; lat?: number; lon?: number },
): Promise<void> {
  const now = Date.now();
  const map = prune(await kvGetJSON<PresenceMap>(KV_KEY, FILE, {}));
  const existing = map[sessionId];
  map[sessionId] = {
    sessionId,
    connectedAt: existing && now - existing.lastSeen < ONLINE_TTL ? existing.connectedAt : now,
    lastSeen: now,
    page: info.page ?? existing?.page ?? '/',
    country: info.country ?? existing?.country,
    countryCode: info.countryCode ?? existing?.countryCode,
    city: info.city ?? existing?.city,
    lat: info.lat ?? existing?.lat,
    lon: info.lon ?? existing?.lon,
  };
  await kvSetJSON(KV_KEY, FILE, map);
}

export async function dropPresence(sessionId: string): Promise<void> {
  const map = await kvGetJSON<PresenceMap>(KV_KEY, FILE, {});
  if (map[sessionId]) {
    delete map[sessionId];
    await kvSetJSON(KV_KEY, FILE, map);
  }
}

/** Sessions seen within ONLINE_TTL. Also prunes long-dead entries from storage. */
export async function getOnlineSessions(): Promise<PresenceEntry[]> {
  const now = Date.now();
  const map = await kvGetJSON<PresenceMap>(KV_KEY, FILE, {});
  const online: PresenceEntry[] = [];
  const stale: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (now - v.lastSeen < ONLINE_TTL) online.push(v);
    else if (now - v.lastSeen > PRUNE_TTL) stale.push(k);
  }
  if (stale.length) {
    const next = { ...map };
    for (const k of stale) delete next[k];
    await kvSetJSON(KV_KEY, FILE, next);
  }
  return online.sort((a, b) => b.connectedAt - a.connectedAt);
}
