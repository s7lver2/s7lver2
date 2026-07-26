import { NextResponse } from 'next/server';
import { getContent, type ProjectC } from '@/lib/content';

// README filenames GitHub itself recognises, in the order it resolves them.
const CANDIDATES = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README.markdown'];

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const projects = await getContent<ProjectC[]>('projects');
  const project = projects.find((p) => p.slug === params.slug);

  if (!project?.repo) {
    return NextResponse.json(
      { ok: false, reason: 'no_repo' as const },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  for (const name of CANDIDATES) {
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/${project.repo}/HEAD/${name}`,
        { headers: { 'User-Agent': 's7lver-portfolio' }, next: { revalidate: 1800 } }
      );
      if (!r.ok) continue;
      const markdown = await r.text();
      if (!markdown.trim()) continue;
      return NextResponse.json(
        { ok: true as const, markdown, repo: project.repo },
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
