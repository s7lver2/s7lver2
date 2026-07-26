import { kvGetJSON, kvSetJSON } from '@/lib/redis';
import { getContent } from '@/lib/content';
import type { FeaturedRepo } from '@/lib/featured';
import { colorFor } from '@/lib/lang-colors';
import {
  langForExt, GHLOC_FILTER, BYTES_PER_LINE, DEFAULT_BYTES_PER_LINE,
} from '@/lib/loc-map';

export interface LocPayload {
  totalLines: number;
  byLanguage: Array<{ name: string; lines: number; pct: number; color: string }>;
  repoCount: number;
  source: 'ghloc' | 'estimate';
  fetchedAt: number;
  stale?: boolean;
}

export const LOC_CACHE_KEY = 'github:loc';
export const LOC_CACHE_FILE = 'github-loc.json';
export const LOC_TTL_MS = 24 * 60 * 60 * 1000;

function ghHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 's7lver-portfolio',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/** ghloc's per-extension line counts for one repo. Null on any failure. */
async function fetchGhloc(repo: string): Promise<Record<string, number> | null> {
  try {
    const url = `https://ghloc.ifels.dev/${repo}?filter=${encodeURIComponent(GHLOC_FILTER)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 's7lver-portfolio' } });
    if (!r.ok) return null;
    const j = (await r.json()) as { locByLangs?: Record<string, number> };
    return j.locByLangs ?? null;
  } catch {
    return null;
  }
}

async function fetchBytes(repo: string): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/languages`, {
      headers: ghHeaders(),
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, number>;
  } catch {
    return null;
  }
}

function finish(
  lines: Record<string, number>,
  repoCount: number,
  source: 'ghloc' | 'estimate'
): LocPayload {
  const total = Object.values(lines).reduce((s, v) => s + v, 0);
  const byLanguage = Object.entries(lines)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({
      name,
      lines: v,
      pct: total > 0 ? Math.round((v / total) * 1000) / 10 : 0,
      color: colorFor(name),
    }));
  return { totalLines: total, byLanguage, repoCount, source, fetchedAt: Date.now() };
}

/** Real counts from ghloc, allowlisted server-side. Null if every repo failed. */
async function buildFromGhloc(repos: string[]): Promise<LocPayload | null> {
  const lines: Record<string, number> = {};
  let ok = 0;
  // Sequential: ghloc is a small unsupported host and a cold repo takes up to
  // 5.6s. Hammering it concurrently is how we lose it.
  for (const repo of repos) {
    const byExt = await fetchGhloc(repo);
    if (!byExt) continue;
    ok++;
    for (const [key, count] of Object.entries(byExt)) {
      const lang = langForExt(key);
      if (!lang) continue; // not code — excluded by the allowlist
      lines[lang] = (lines[lang] || 0) + count;
    }
  }
  return ok > 0 ? finish(lines, ok, 'ghloc') : null;
}

/** Last resort: divide GitHub's byte counts by a per-language divisor. */
async function buildFromBytes(repos: string[]): Promise<LocPayload> {
  const lines: Record<string, number> = {};
  let ok = 0;
  for (const repo of repos) {
    const bytes = await fetchBytes(repo);
    if (!bytes) continue;
    ok++;
    for (const [lang, b] of Object.entries(bytes)) {
      const div = BYTES_PER_LINE[lang] ?? DEFAULT_BYTES_PER_LINE;
      lines[lang] = (lines[lang] || 0) + Math.round(b / div);
    }
  }
  return finish(lines, ok, 'estimate');
}

/** The cached payload, or null when there is none. */
export async function readLocCache(): Promise<LocPayload | null> {
  return kvGetJSON<LocPayload | null>(LOC_CACHE_KEY, LOC_CACHE_FILE, null);
}

/**
 * Recompute and cache. Exported so the admin's refresh action (Task 10) warms
 * the same cache through the same code path.
 */
export async function refreshLoc(): Promise<LocPayload> {
  const featured = await getContent<FeaturedRepo[]>('featured');
  const repos = featured.map((f) => f.repo);
  const built = (await buildFromGhloc(repos)) ?? (await buildFromBytes(repos));
  await kvSetJSON(LOC_CACHE_KEY, LOC_CACHE_FILE, built);
  return built;
}
