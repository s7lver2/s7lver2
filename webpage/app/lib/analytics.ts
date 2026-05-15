// webpage/app/lib/analytics.ts
import { kv } from '@vercel/kv';

export interface VisitEvent {
  sessionId: string;
  ip: string;
  page: string;
  referrer: string;
  ua: string;
  country: string;
  countryCode: string;
  city: string;
  device: string;     // 'desktop' | 'mobile' | 'tablet'
  browser: string;
  os: string;
  timestamp: number;  // unix ms
  lat: number;
  lon: number;
}

export interface SessionSummary {
  sessionId: string;
  firstSeen: string;   // ISO
  pages: string[];
  duration: number;    // seconds
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  isNew: boolean;
}

export interface Stats {
  total: number;
  unique: number;
  deltaTotal: number;
  deltaUnique: number;
  activeLastHour: number;
  bounceRate: number;
  avgDuration: number;
  byDay: { date: string; count: number }[];
  byPage: { page: string; count: number }[];
  byCountry: { country: string; code: string; count: number }[];
  byReferrer: { referrer: string; count: number }[];
  byDevice: { device: string; count: number }[];
  byBrowser: { browser: string; count: number }[];
  byOS: { os: string; count: number }[];
  byDayHour: { day: number; hour: number; count: number }[];
  sessions: SessionSummary[];
  recent: { lat: number; lon: number; country: string; city: string; page: string; timestamp: string; countryCode: string }[];
}

// KV key helpers
const K = {
  visits: () => 'visits',                          // ZSET: score=ts, member=JSON
  sessions: () => 'sessions',                      // HASH: sessionId → JSON
  knownIps: () => 'known_ips',                     // SET: ip strings
};

export async function recordVisit(event: VisitEvent): Promise<void> {
  const pipe = kv.pipeline();
  // Store visit as sorted set member (score = timestamp)
  pipe.zadd(K.visits(), { score: event.timestamp, member: JSON.stringify(event) });
  // Trim to last 50k visits to avoid unbounded growth
  pipe.zremrangebyrank(K.visits(), 0, -50001);
  // Track known IPs for unique visitor count
  pipe.sadd(K.knownIps(), event.ip);
  // Upsert session
  await pipe.exec();

  // Session logic: load existing or create new
  const existingRaw = await kv.hget<string>(K.sessions(), event.sessionId);
  if (existingRaw) {
    const existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw as SessionSummary;
    const updated: SessionSummary = {
      ...existing,
      pages: existing.pages.includes(event.page) ? existing.pages : [...existing.pages, event.page],
      duration: Math.round((event.timestamp - new Date(existing.firstSeen).getTime()) / 1000),
    };
    await kv.hset(K.sessions(), { [event.sessionId]: JSON.stringify(updated) });
  } else {
    const newSession: SessionSummary = {
      sessionId: event.sessionId,
      firstSeen: new Date(event.timestamp).toISOString(),
      pages: [event.page],
      duration: 0,
      country: event.country,
      city: event.city,
      device: event.device,
      browser: event.browser,
      os: event.os,
      isNew: true,
    };
    await kv.hset(K.sessions(), { [event.sessionId]: JSON.stringify(newSession) });
  }
}

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    m.set(k, [...(m.get(k) ?? []), item]);
  }
  return m;
}

function topN<T>(map: Map<string, T[]>, n: number): [string, number][] {
  return [...map.entries()]
    .map(([k, v]) => [k, v.length] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export async function getStats(): Promise<Stats> {
  // Fetch all visits (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const yesterdayStart = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const todayStart = Date.now() - 24 * 60 * 60 * 1000;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const [rawVisits, uniqueCount, sessionsRaw] = await Promise.all([
    kv.zrange(K.visits(), thirtyDaysAgo, '+inf', { byScore: true }) as Promise<string[]>,
    kv.scard(K.knownIps()),
    kv.hgetall(K.sessions()),
  ]);

  const visits: VisitEvent[] = (rawVisits ?? []).map(v =>
    typeof v === 'string' ? JSON.parse(v) : v as VisitEvent
  );

  const sessions: SessionSummary[] = Object.values(sessionsRaw ?? {}).map(s =>
    typeof s === 'string' ? JSON.parse(s) : s as SessionSummary
  ).sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());

  const todayVisits = visits.filter(v => v.timestamp >= todayStart);
  const yesterdayVisits = visits.filter(v => v.timestamp >= yesterdayStart && v.timestamp < todayStart);
  const sevenDayVisits = visits.filter(v => v.timestamp >= sevenDaysAgo);
  const lastHourVisits = visits.filter(v => v.timestamp >= oneHourAgo);

  // Bounce rate: sessions with only 1 page
  const singlePageSessions = sessions.filter(s => s.pages.length === 1).length;
  const bounceRate = sessions.length > 0 ? Math.round((singlePageSessions / sessions.length) * 100) : 0;

  // Avg duration (exclude bounces for accuracy)
  const multiPageSessions = sessions.filter(s => s.pages.length > 1);
  const avgDuration = multiPageSessions.length > 0
    ? Math.round(multiPageSessions.reduce((s, sess) => s + sess.duration, 0) / multiPageSessions.length)
    : 0;

  // by day (last 7)
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const v of sevenDayVisits) {
    const day = new Date(v.timestamp).toISOString().slice(0, 10);
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const byDay = [...dayMap.entries()].map(([date, count]) => ({ date, count }));

  // heatmap (day of week × hour)
  const hourMap = new Map<string, number>();
  for (const v of sevenDayVisits) {
    const d = new Date(v.timestamp);
    const key = `${d.getDay()}:${d.getHours()}`;
    hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
  }
  const byDayHour = [...hourMap.entries()].map(([k, count]) => {
    const [day, hour] = k.split(':').map(Number);
    return { day, hour, count };
  });

  // by page
  const pageGroups = groupBy(visits, v => v.page);
  const byPage = topN(pageGroups, 10).map(([page, count]) => ({ page, count }));

  // by country
  const countryGroups = groupBy(visits, v => v.country || 'Unknown');
  const byCountry = [...countryGroups.entries()]
    .map(([country, vs]) => ({ country, code: vs[0]?.countryCode ?? '', count: vs.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // by referrer
  const refGroups = groupBy(visits, v => v.referrer || '(directo)');
  const byReferrer = topN(refGroups, 10).map(([referrer, count]) => ({ referrer, count }));

  // by device
  const deviceGroups = groupBy(visits, v => v.device || 'unknown');
  const byDevice = topN(deviceGroups, 5).map(([device, count]) => ({ device, count }));

  // by browser
  const browserGroups = groupBy(visits, v => v.browser || 'unknown');
  const byBrowser = topN(browserGroups, 6).map(([browser, count]) => ({ browser, count }));

  // by OS
  const osGroups = groupBy(visits, v => v.os || 'unknown');
  const byOS = topN(osGroups, 6).map(([os, count]) => ({ os, count }));

  // recent (last 20 for live feed)
  const recent = visits
    .slice(-20)
    .reverse()
    .map(v => ({ lat: v.lat, lon: v.lon, country: v.country, city: v.city, page: v.page, timestamp: new Date(v.timestamp).toISOString(), countryCode: v.countryCode }));

  return {
    total: visits.length,
    unique: uniqueCount ?? 0,
    deltaTotal: todayVisits.length - yesterdayVisits.length,
    deltaUnique: 0, // approximation
    activeLastHour: new Set(lastHourVisits.map(v => v.ip)).size,
    bounceRate,
    avgDuration,
    byDay,
    byPage,
    byCountry,
    byReferrer,
    byDevice,
    byBrowser,
    byOS,
    byDayHour,
    sessions: sessions.slice(0, 100),
    recent,
  };
}