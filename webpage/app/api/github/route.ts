import { NextResponse } from 'next/server';

const USER = process.env.GITHUB_USER || 's7lver2';
export const revalidate = 3600; // cache 1h

// level (0-4) → rough count when per-day tooltip is unavailable
const LEVEL_APPROX = [0, 1, 3, 6, 10];

type Day = { date: string; level: number; id?: string; count: number };

async function getContributions(user: string) {
  const res = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { 'User-Agent': 'portfolio-site', Accept: 'text/html' },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`contributions ${res.status}`);
  const html = await res.text();

  // Per-day cells
  const tdTags = html.match(/<td[^>]*data-date="[^"]*"[^>]*>/g) || [];
  const days: Day[] = tdTags
    .map((tag) => {
      const date = (tag.match(/data-date="([^"]+)"/) || [])[1] || '';
      const level = parseInt((tag.match(/data-level="(\d)"/) || [])[1] || '0', 10);
      const id = (tag.match(/\sid="([^"]+)"/) || [])[1];
      return { date, level, id, count: 0 };
    })
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Tooltips carry the real count, linked to the cell by id
  const countById: Record<string, number> = {};
  const tips = html.match(/<tool-tip[^>]*>[^<]*<\/tool-tip>/g) || [];
  tips.forEach((t) => {
    const id = (t.match(/for="([^"]+)"/) || [])[1];
    const text = (t.match(/>([^<]*)</) || [])[1] || '';
    const m = text.match(/^(No|[\d,]+)\s+contribution/i);
    if (id && m) countById[id] = m[1] === 'No' ? 0 : parseInt(m[1].replace(/,/g, ''), 10);
  });

  days.forEach((d) => {
    d.count = d.id && countById[d.id] !== undefined ? countById[d.id] : LEVEL_APPROX[d.level] || 0;
  });

  if (!days.length) throw new Error('no contribution days parsed');
  return days;
}

async function getProfile(user: string) {
  try {
    const [u, repos] = await Promise.all([
      fetch(`https://api.github.com/users/${user}`, {
        headers: { 'User-Agent': 'portfolio-site' },
        next: { revalidate },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=updated`, {
        headers: { 'User-Agent': 'portfolio-site' },
        next: { revalidate },
      }).then((r) => (r.ok ? r.json() : [])),
    ]);

    const list: any[] = Array.isArray(repos) ? repos : [];
    const totalStars = list.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const langTally: Record<string, number> = {};
    list.forEach((r) => {
      if (r.language) langTally[r.language] = (langTally[r.language] || 0) + 1;
    });
    const tot = Object.values(langTally).reduce((s, n) => s + n, 0) || 1;
    const languages = Object.entries(langTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, n]) => ({ name, pct: Math.round((n / tot) * 100) }));

    return {
      publicRepos: u?.public_repos ?? list.length,
      followers: u?.followers ?? 0,
      totalStars,
      languages,
    };
  } catch {
    return { publicRepos: 0, followers: 0, totalStars: 0, languages: [] };
  }
}

export async function GET() {
  try {
    const [days, profile] = await Promise.all([getContributions(USER), getProfile(USER)]);

    const total = days.reduce((s, d) => s + d.count, 0);

    // current streak: consecutive most-recent days with activity
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) streak++;
      else break;
    }

    // sparkline: last 12 weeks (84 days) summed weekly, normalised 0-100
    const last = days.slice(-84);
    const weeks: number[] = [];
    for (let i = 0; i < last.length; i += 7) {
      weeks.push(last.slice(i, i + 7).reduce((s, d) => s + d.count, 0));
    }
    const maxWeek = Math.max(...weeks, 1);
    const spark = weeks.map((w) => Math.max(6, Math.round((w / maxWeek) * 100)));

    // heatmap: last 196 days (28 weeks) as levels 0-4
    const heatmap = days.slice(-196).map((d) => d.level);

    return NextResponse.json({
      ok: true,
      data: {
        ...profile,
        commitsPerYear: total,
        streak,
        spark,
        heatmap,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 200 });
  }
}
