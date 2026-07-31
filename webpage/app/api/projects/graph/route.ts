import { NextResponse } from 'next/server';
import { kvGetJSON, kvSetJSON } from '@/lib/redis';
import { getContent } from '@/lib/content';
import { colorFor } from '@/lib/lang-colors';
import { repoName, initialsFor, accentsFor, type FeaturedRepo } from '@/lib/featured';
import type { GraphPayload, GraphNodeWire, GraphLinkWire } from '@/lib/graph-types';

const CACHE_KEY = 'projects:graph';
const CACHE_FILE = 'projects-graph.json';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — unauthenticated GitHub API is 60 req/h per IP.

/** Fetch the language byte counts for one repo. Returns null on any failure. */
async function fetchLanguages(repo: string): Promise<Record<string, number> | null> {
  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    // A token is optional but raises the rate limit from 60/h to 5000/h.
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}/languages`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const raw = (await r.json()) as Record<string, number>;
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

/** Bytes per language -> rounded percentages that sum to ~100. */
function toPercentages(bytes: Record<string, number>): Record<string, number> {
  const total = Object.values(bytes).reduce((s, v) => s + v, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [name, v] of Object.entries(bytes)) {
    const pct = Math.round((v / total) * 100);
    if (pct >= 1) out[name] = pct;
  }
  return out;
}

/** Name, description and stars for one repo. Null on any failure. */
async function fetchRepoMeta(repo: string): Promise<
  { name: string; desc: string; stars: number } | null
> {
  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      name?: string; description?: string | null; stargazers_count?: number;
    };
    return {
      name: j.name || repoName(repo),
      desc: j.description || '',
      stars: j.stargazers_count ?? 0,
    };
  } catch {
    return null;
  }
}

async function buildPayload(featured: FeaturedRepo[]): Promise<GraphPayload> {
  const nodes: GraphNodeWire[] = [];
  const links: GraphLinkWire[] = [];
  const degree: Record<string, number> = {};
  const languageNodes = new Set<string>();

  const langsByRepo: Record<string, Record<string, number>> = {};
  const metaByRepo: Record<string, { name: string; desc: string; stars: number }> = {};

  // Concurrent: GitHub's rate limit is a per-hour request budget, not a
  // concurrency cap, so running these in parallel costs nothing extra and
  // turns N sequential round-trips into one. Each fetch already isolates its
  // own failure (returns null), so a slow or broken repo can't stall the rest.
  await Promise.all(featured.map(async (f) => {
    const [bytes, meta] = await Promise.all([fetchLanguages(f.repo), fetchRepoMeta(f.repo)]);
    if (bytes) langsByRepo[f.repo] = toPercentages(bytes);
    if (meta) metaByRepo[f.repo] = meta;
  }));

  const repos = featured.map((f) => f.repo);
  const primaryLangs: Record<string, string | null> = {};
  for (const repo of repos) {
    const langs = langsByRepo[repo] || {};
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
    primaryLangs[repo] = top ? top[0] : null;
  }
  const accents = accentsFor(repos, primaryLangs);
  const initials = initialsFor(repos);

  for (const f of featured) {
    const langs = langsByRepo[f.repo] || {};
    const meta = metaByRepo[f.repo];
    const slug = repoName(f.repo);
    nodes.push({
      id: slug,
      kind: 'project',
      color: accents[f.repo],
      degree: 0,
      slug,
      repo: f.repo,
      desc: f.descOverride || meta?.desc || '',
      status: f.status,
      langs,
      initials: initials[f.repo],
      stars: meta?.stars ?? 0,
      noLanguage: Object.keys(langs).length === 0,
    });
    for (const [lang, pct] of Object.entries(langs)) {
      languageNodes.add(lang);
      links.push({ source: slug, target: lang, weight: pct });
      degree[slug] = (degree[slug] || 0) + 1;
      degree[lang] = (degree[lang] || 0) + 1;
    }
  }

  for (const lang of languageNodes) {
    nodes.push({ id: lang, kind: 'language', color: colorFor(lang), degree: 0 });
  }
  for (const n of nodes) n.degree = degree[n.id] || 0;

  return { nodes, links, fetchedAt: Date.now() };
}

// Igual que las otras: horneada en el build servia un grafo congelado, y el
// TTL de 6 h de aqui abajo no llegaba a usarse nunca.
export const dynamic = 'force-dynamic';

export async function GET() {
  const featured = await getContent<FeaturedRepo[]>('featured');
  const cached = await kvGetJSON<GraphPayload | null>(CACHE_KEY, CACHE_FILE, null);

  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  const built = await buildPayload(featured);

  // If every language fetch failed but we have a previous payload, that payload
  // is strictly better than an edgeless graph — serve it and mark it stale.
  const gotAnyLanguages = built.links.length > 0;
  if (!gotAnyLanguages && cached && cached.links.length > 0) {
    return NextResponse.json(
      { ...cached, stale: true },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  await kvSetJSON(CACHE_KEY, CACHE_FILE, built);
  return NextResponse.json(built, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
