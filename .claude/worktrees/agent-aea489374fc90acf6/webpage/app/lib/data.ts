import { kvGetJSON, kvSetJSON } from './redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Visit {
  id: string;
  page: string;
  timestamp: string;
  country?: string;
  countryCode?: string;
  city?: string;
  lat?: number;
  lon?: number;
  referrer?: string;
  ip?: string;
  ua?: string;
  browser?: string;
  os?: string;
  device?: string;
  sessionId?: string;
  isNew?: boolean;
  duration?: number;
  isBot?: boolean;
  botReason?: string;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  pages: string[];
  duration: number;
  device: string;
  browser: string;
  os: string;
  country: string;
  city?: string;
  isNew: boolean;
  firstSeen: string;
}

export interface Stats {
  total: number;
  unique: number;
  topPage: string;
  topCountry: string;
  topCountryCode: string;
  activeLastHour: number;
  bounceRate: number;
  avgDuration: number;
  deltaTotal: number;
  deltaUnique: number;
  byPage: { page: string; count: number }[];
  byCountry: { country: string; code: string; count: number }[];
  byDay: { date: string; count: number }[];
  byDayHour: { day: number; hour: number; count: number }[];
  byReferrer: { referrer: string; count: number }[];
  byDevice: { device: string; count: number }[];
  byBrowser: { browser: string; count: number }[];
  byOS: { os: string; count: number }[];
  sessions: SessionSummary[];
  recent: Visit[];
  botTotal?: number;
  humanTotal?: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KV_KEY = 's7lver:visits';
const FILE = 'visits.json';
const MAX_VISITS = 10000;

interface VisitsStore { visits: Visit[] }

export async function readVisits(limit?: number): Promise<Visit[]> {
  const store = await kvGetJSON<VisitsStore>(KV_KEY, FILE, { visits: [] });
  const visits = store.visits ?? [];
  return limit ? visits.slice(0, limit) : visits;
}

export async function addVisit(v: Omit<Visit, 'id'>): Promise<void> {
  const visit: Visit = { ...v, id: crypto.randomUUID() };
  const store = await kvGetJSON<VisitsStore>(KV_KEY, FILE, { visits: [] });
  const visits = [visit, ...(store.visits ?? [])];
  const trimmed = visits.slice(0, MAX_VISITS);
  await kvSetJSON(KV_KEY, FILE, { visits: trimmed });
}

export async function updateVisitDuration(sessionId: string, _page: string, duration: number): Promise<void> {
  const store = await kvGetJSON<VisitsStore>(KV_KEY, FILE, { visits: [] });
  const visits = store.visits ?? [];
  let changed = false;
  for (const v of visits) {
    if (v.sessionId === sessionId) { v.duration = duration; changed = true; }
  }
  if (changed) await kvSetJSON(KV_KEY, FILE, { visits });
}

// ─── User-agent parser ────────────────────────────────────────────────────────

export function parseUA(ua: string): { browser: string; os: string; device: 'desktop' | 'mobile' | 'tablet' } {
  const u = ua.toLowerCase();
  let browser = 'Other';
  if (u.includes('edg/'))                                  browser = 'Edge';
  else if (u.includes('opr/') || u.includes('opera'))     browser = 'Opera';
  else if (u.includes('firefox'))                          browser = 'Firefox';
  else if (u.includes('chrome'))                           browser = 'Chrome';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';

  let os = 'Other';
  if      (u.includes('windows'))                        os = 'Windows';
  else if (u.includes('iphone') || u.includes('ipad'))   os = 'iOS';
  else if (u.includes('android'))                        os = 'Android';
  else if (u.includes('mac os'))                         os = 'macOS';
  else if (u.includes('linux'))                          os = 'Linux';

  let device: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if      (u.includes('iphone') || (u.includes('android') && u.includes('mobile'))) device = 'mobile';
  else if (u.includes('ipad')   || (u.includes('android') && !u.includes('mobile'))) device = 'tablet';

  return { browser, os, device };
}

// ─── Bot detection ────────────────────────────────────────────────────────────

const BOT_UA_PATTERNS: RegExp[] = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /sogou/i, /exabot/i, /facebookexternalhit/i, /ia_archiver/i,
  /mj12bot/i, /ahrefsbot/i, /semrushbot/i, /rogerbot/i, /dotbot/i,
  /screaming.?frog/i, /applebot/i, /twitterbot/i, /linkedinbot/i,
  /discordbot/i, /slackbot/i, /telegrambot/i, /whatsapp/i,
  /\bcrawler\b/i, /\bspider\b/i, /\bscraper\b/i, /\bbot\b/i,
  /curl\//i, /wget\//i, /python-requests/i, /go-http-client/i,
  /axios\//i, /node-fetch/i, /okhttp/i, /apache-httpclient/i,
  /java\//i, /libwww-perl/i, /lwp-trivial/i, /httpclient/i,
  /undici/i, /got\//i, /superagent/i, /request\//i,
  /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i,
  /playwright/i, /cypress/i, /webdriver/i,
  /pingdom/i, /uptimerobot/i, /statuscake/i, /zabbix/i,
  /newrelic/i, /datadog/i, /site24x7/i, /hetrixtools/i,
  /monitor/i, /health.?check/i,
  /gptbot/i, /chatgpt-user/i, /claude-web/i, /anthropic/i,
  /cohere-ai/i, /perplexitybot/i, /youbot/i,
];

const ALLOW_LIST: RegExp[] = [
  /facebookexternalhit\/1\.1 \(https?:\/\/www\.facebook\.com/i,
];

const HEADLESS_SEC_CH_UA = /HeadlessChrome|Headless/i;

export function detectBot(
  ua: string,
  headers?: Headers
): { isBot: boolean; reason?: string; confidence?: 'definite' | 'likely' | 'possible' } {
  const u = ua.trim();

  if (!u || u.length < 8) {
    return { isBot: true, reason: 'empty-ua', confidence: 'definite' };
  }

  for (const pattern of ALLOW_LIST) {
    if (pattern.test(u)) return { isBot: false };
  }

  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(u)) return { isBot: true, reason: 'bot-ua', confidence: 'definite' };
  }

  if (headers) {
    const acceptLang = headers.get('accept-language');
    if (!acceptLang) {
      return { isBot: true, reason: 'no-accept-language', confidence: 'likely' };
    }

    const secCh = headers.get('sec-ch-ua');
    if (secCh && HEADLESS_SEC_CH_UA.test(secCh)) {
      return { isBot: true, reason: 'headless-chrome', confidence: 'definite' };
    }

    const accept = headers.get('accept');
    if (!accept) {
      return { isBot: true, reason: 'no-accept', confidence: 'likely' };
    }

    const secFetchMode = headers.get('sec-fetch-mode');
    const secFetchSite = headers.get('sec-fetch-site');
    const hasBrowserSec = !!(secFetchMode || secFetchSite || headers.get('sec-fetch-dest'));

    const hasMozilla = /Mozilla\/5\.0/i.test(u);
    const hasEngine  = /AppleWebKit|Gecko|Trident/i.test(u);

    if (!hasMozilla || !hasEngine) {
      if (acceptLang) {
        return { isBot: true, reason: 'non-browser-ua', confidence: 'likely' };
      }
      return { isBot: true, reason: 'non-browser-ua', confidence: 'definite' };
    }

    const chromeVersionMatch = u.match(/Chrome\/(\d+)/i);
    if (chromeVersionMatch) {
      const majorVersion = parseInt(chromeVersionMatch[1], 10);
      if (majorVersion >= 90 && !secCh && !hasBrowserSec) {
        return { isBot: true, reason: 'chrome-spoofing', confidence: 'likely' };
      }
    }
  } else {
    const hasMozilla = /Mozilla\/5\.0/i.test(u);
    const hasEngine  = /AppleWebKit|Gecko|Trident/i.test(u);
    if (!hasMozilla || !hasEngine) {
      return { isBot: true, reason: 'non-browser-ua', confidence: 'likely' };
    }
  }

  return { isBot: false };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function computeStats(visits: Visit[]): Stats {
  const humanVisits = visits.filter(v => !v.isBot);

  const pageCount    = new Map<string, number>();
  const countryCount = new Map<string, { country: string; code: string; count: number }>();
  const ipSet        = new Set<string>();
  const dayCount     = new Map<string, number>();
  const dayHourCount = new Map<string, number>();
  const refCount     = new Map<string, number>();
  const deviceCount  = new Map<string, number>();
  const browserCount = new Map<string, number>();
  const osCount      = new Map<string, number>();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneHourAgo   = new Date(now.getTime() - 60 * 60 * 1000);

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yStart     = new Date(todayStart.getTime() - 86400000);

  let todayTotal = 0, yTotal = 0;
  const todayIps = new Set<string>(), yIps = new Set<string>();
  const activeIps = new Set<string>();

  for (const v of humanVisits) {
    const ts = new Date(v.timestamp);
    pageCount.set(v.page, (pageCount.get(v.page) ?? 0) + 1);
    if (v.ip) {
      ipSet.add(v.ip);
      if (ts >= oneHourAgo) activeIps.add(v.ip);
      if (ts >= todayStart)  { todayIps.add(v.ip); todayTotal++; }
      if (ts >= yStart && ts < todayStart) { yIps.add(v.ip); yTotal++; }
    }
    if (v.country && v.countryCode) {
      const cur = countryCount.get(v.countryCode);
      countryCount.set(v.countryCode, { country: v.country, code: v.countryCode, count: (cur?.count ?? 0) + 1 });
    }
    if (v.referrer) {
      try { const ref = new URL(v.referrer).hostname; refCount.set(ref, (refCount.get(ref) ?? 0) + 1); } catch {}
    }
    if (ts >= sevenDaysAgo) {
      const day = ts.toISOString().slice(0, 10);
      dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
    }
    const dow = ts.getDay() === 0 ? 6 : ts.getDay() - 1;
    const dh = `${dow}:${ts.getHours()}`;
    dayHourCount.set(dh, (dayHourCount.get(dh) ?? 0) + 1);

    if (v.device)  deviceCount.set(v.device,  (deviceCount.get(v.device)  ?? 0) + 1);
    if (v.browser) browserCount.set(v.browser, (browserCount.get(v.browser) ?? 0) + 1);
    if (v.os)      osCount.set(v.os,          (osCount.get(v.os)          ?? 0) + 1);
  }

  const byDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const day = d.toISOString().slice(0, 10);
    byDay.push({ date: day, count: dayCount.get(day) ?? 0 });
  }

  const byDayHour = [...dayHourCount.entries()].map(([k, count]) => {
    const [day, hour] = k.split(':').map(Number);
    return { day, hour, count };
  });

  const byPage      = [...pageCount.entries()].map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  const byCountry   = [...countryCount.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const byReferrer  = [...refCount.entries()].map(([referrer, count]) => ({ referrer, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  const byDevice    = [...deviceCount.entries()].map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count);
  const byBrowser   = [...browserCount.entries()].map(([browser, count]) => ({ browser, count })).sort((a, b) => b.count - a.count);
  const byOS        = [...osCount.entries()].map(([os, count]) => ({ os, count })).sort((a, b) => b.count - a.count);

  const sessionMap = new Map<string, SessionSummary>();
  const sessionPageSets = new Map<string, Set<string>>();
  for (const v of humanVisits) {
    const sid = v.sessionId ?? v.id;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        id: sid, sessionId: sid, pages: [], duration: v.duration ?? 0,
        device: v.device ?? 'desktop', browser: v.browser ?? 'Other',
        os: v.os ?? 'Other', country: v.country ?? '—', city: v.city,
        isNew: v.isNew ?? true, firstSeen: v.timestamp,
      });
      sessionPageSets.set(sid, new Set());
    }
    const s = sessionMap.get(sid)!;
    const pSet = sessionPageSets.get(sid)!;
    if (!pSet.has(v.page)) { pSet.add(v.page); s.pages.push(v.page); }
    if (v.duration && v.duration > s.duration) s.duration = v.duration;
  }

  const sessions = [...sessionMap.values()].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
  const bounceCount = sessions.filter(s => s.pages.length === 1).length;
  const bounceRate  = sessions.length > 0 ? Math.round(bounceCount / sessions.length * 100) : 0;
  const durSessions = sessions.filter(s => s.duration > 0);
  const avgDuration = durSessions.length > 0 ? Math.round(durSessions.reduce((acc, s) => acc + s.duration, 0) / durSessions.length) : 0;

  const pct = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : Math.round((a - b) / b * 100);

  const botTotal   = visits.filter(v => v.isBot).length;
  const humanTotal = humanVisits.length;

  return {
    total: humanTotal,
    unique: ipSet.size,
    topPage: byPage[0]?.page ?? '/',
    topCountry: byCountry[0]?.country ?? '—',
    topCountryCode: byCountry[0]?.code ?? '',
    activeLastHour: activeIps.size,
    bounceRate,
    avgDuration,
    deltaTotal: pct(todayTotal, yTotal),
    deltaUnique: pct(todayIps.size, yIps.size),
    byPage, byCountry, byDay, byDayHour, byReferrer, byDevice, byBrowser, byOS,
    sessions: sessions.slice(0, 50),
    recent: [...visits].slice(0, 20),
    botTotal,
    humanTotal,
  };
}
