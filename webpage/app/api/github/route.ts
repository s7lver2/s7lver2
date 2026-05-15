// app/api/github/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 3600; // 1 hour cache on Vercel

interface GithubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  topics: string[];
}

export interface RepoData {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  updatedAt: string;
  topics: string[];
}

export async function GET(req: NextRequest) {
  const repos = req.nextUrl.searchParams.get('repos');
  if (!repos) {
    return NextResponse.json({ error: 'Missing repos param' }, { status: 400 });
  }

  const slugs = repos.split(',').map((s) => s.trim()).filter(Boolean);

  const results = await Promise.allSettled(
    slugs.map((slug) =>
      fetch(`https://api.github.com/repos/${slug}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          // No token needed for public repos (60 req/h unauthenticated)
        },
        next: { revalidate: 3600 },
      }).then((r) => r.json() as Promise<GithubRepo>)
    )
  );

  const data: RepoData[] = results
    .filter((r): r is PromiseFulfilledResult<GithubRepo> => r.status === 'fulfilled' && !('message' in r.value))
    .map((r) => ({
      name: r.value.name,
      fullName: r.value.full_name,
      description: r.value.description ?? 'No description',
      url: r.value.html_url,
      stars: r.value.stargazers_count,
      forks: r.value.forks_count,
      language: r.value.language,
      updatedAt: r.value.updated_at,
      topics: r.value.topics ?? [],
    }));

  return NextResponse.json(data);
}