import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

async function auth(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) return null;
  return session;
}

// Same resolution order as app/api/github/route.ts, so the two never disagree.
const GH_USER = process.env.GITHUB_USER || process.env.GITHUB_USERNAME || 's7lver2';

interface GhRepo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
}

export interface AdminRepo {
  name: string;
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  updatedAt: string;
}

export async function GET(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const r = await fetch(
      `https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=updated`,
      { headers, next: { revalidate: 0 } }
    );
    if (!r.ok) return NextResponse.json({ repos: [] }, { status: 200 });
    const j = (await r.json()) as GhRepo[];
    const repos: AdminRepo[] = j
      .filter((repo) => !repo.fork)
      .map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description ?? '',
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
      }));
    return NextResponse.json({ repos });
  } catch {
    return NextResponse.json({ repos: [] }, { status: 200 });
  }
}
