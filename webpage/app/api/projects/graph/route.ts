import { NextResponse } from 'next/server';
import { kvGetJSON, kvSetJSON } from '@/lib/redis';
import { getContent, type ProjectC } from '@/lib/content';
import { colorFor } from '@/lib/lang-colors';
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

async function buildPayload(projects: ProjectC[]): Promise<GraphPayload> {
  const nodes: GraphNodeWire[] = [];
  const links: GraphLinkWire[] = [];
  const degree: Record<string, number> = {};
  const languageNodes = new Set<string>();

  const langsBySlug: Record<string, Record<string, number>> = {};

  // Sequential rather than Promise.all: four repos is not worth burning four
  // concurrent rate-limit slots, and a partial failure is easier to reason about.
  for (const p of projects) {
    if (!p.repo) continue;
    const bytes = await fetchLanguages(p.repo);
    if (bytes) langsBySlug[p.slug] = toPercentages(bytes);
  }

  for (const p of projects) {
    const langs = langsBySlug[p.slug] || {};
    nodes.push({
      id: p.slug,
      kind: 'project',
      color: p.ac,
      degree: 0,
      slug: p.slug,
      repo: p.repo ?? null,
      desc: p.desc,
      status: p.status,
      langs,
    });
    for (const [lang, pct] of Object.entries(langs)) {
      languageNodes.add(lang);
      links.push({ source: p.slug, target: lang, weight: pct });
      degree[p.slug] = (degree[p.slug] || 0) + 1;
      degree[lang] = (degree[lang] || 0) + 1;
    }
  }

  for (const lang of languageNodes) {
    nodes.push({ id: lang, kind: 'language', color: colorFor(lang), degree: 0 });
  }

  for (const n of nodes) n.degree = degree[n.id] || 0;

  return { nodes, links, fetchedAt: Date.now() };
}

export async function GET() {
  // getContent owns the `content:projects` / `content-projects.json` key pair —
  // do not re-derive those strings here, they would drift.
  const projects = await getContent<ProjectC[]>('projects');
  const cached = await kvGetJSON<GraphPayload | null>(CACHE_KEY, CACHE_FILE, null);

  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  }

  const built = await buildPayload(projects);

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
