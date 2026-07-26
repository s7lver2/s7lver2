import { NextResponse } from 'next/server';
import { getContent } from '@/lib/content';
import { repoName, type FeaturedRepo } from '@/lib/featured';

// README filenames GitHub itself recognises, in the order it resolves them.
const CANDIDATES = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README.markdown'];

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const featured = await getContent<FeaturedRepo[]>('featured');
  const slug = params.slug.toLowerCase();
  const entry = featured.find((f) => repoName(f.repo).toLowerCase() === slug);
  if (!entry) {
    return NextResponse.json({ status: 'none', reason: 'no_repo' }, { status: 200 });
  }
  const repo = entry.repo;

  for (const name of CANDIDATES) {
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/${repo}/HEAD/${name}`,
        { headers: { 'User-Agent': 's7lver-portfolio' }, next: { revalidate: 1800 } }
      );
      if (!r.ok) continue;
      const markdown = await r.text();
      if (!markdown.trim()) continue;
      return NextResponse.json(
        { ok: true as const, markdown, repo },
        { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' } }
      );
    } catch {
      return NextResponse.json(
        { ok: false, reason: 'fetch_failed' as const },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } }
      );
    }
  }

  return NextResponse.json(
    { ok: false, reason: 'not_found' as const },
    { headers: { 'Cache-Control': 'public, s-maxage=600' } }
  );
}
