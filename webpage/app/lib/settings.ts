import { kvGetJSON, kvSetJSON } from './redis';

export interface SiteSettings { trackingEnabled: boolean; updatedAt: string }
const DEFAULT: SiteSettings = { trackingEnabled: true, updatedAt: new Date(0).toISOString() };
const KEY = 's7lver:settings';
const FILE = 'settings.json';

export async function getSettings(): Promise<SiteSettings> {
  return kvGetJSON<SiteSettings>(KEY, FILE, DEFAULT);
}

export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await kvSetJSON(KEY, FILE, next);
  return next;
}

// Helper to get client IP from request headers
export function getTrueClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) return last;
  }
  return '';
}
