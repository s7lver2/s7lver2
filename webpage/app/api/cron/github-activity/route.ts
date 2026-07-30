import { NextRequest, NextResponse } from 'next/server';
import { mergeActivityMap, type ActivityMap } from '@/lib/activity-map';

const GH_USER = process.env.GITHUB_USER || process.env.GITHUB_USERNAME || 's7lver2';

type GhEvent = {
  type: string;
  repo?: { name: string };
  created_at: string;
};

/**
 * Polls GitHub's public events feed and accumulates which repos were
 * touched on which day, so the GitHub Activity heatmap can eventually
 * attribute (most) cells to real repos on hover.
 *
 * Real, unavoidable limitation: the events API only ever returns the last
 * ~90 days / 300 events, and only PUBLIC repos. Every poll only ever adds
 * to what's already stored (see mergeActivityMap) — this can never
 * backfill days further in the past than whatever the API returned the
 * *first* time it was polled after this feature shipped. Cells from before
 * that stay "sin datos" forever; that's the accepted tradeoff, not a bug.
 *
 * Triggered by Vercel Cron (see vercel.json), una vez al dia: el plan Hobby
 * no admite mas de una ejecucion diaria por cron. No importa aqui porque cada
 * poll solo acumula, y la API devuelve los ultimos ~300 eventos — muy por
 * encima de lo que este usuario genera en 24 h.
 *
 * Vercel signs cron requests
 * with `Authorization: Bearer $CRON_SECRET` when that env var is set —
 * verify it here so this route can't be hit by anyone else to burn rate
 * limit or write garbage into the map.
 */
// Critico: sin esto Next la prerenderiza (salia como `○` en la tabla del
// build) y el cron se vuelve un no-op — Vercel llamaria a la URL y recibiria
// la respuesta horneada sin ejecutar nada de lo de abajo.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 's7lver-portfolio',
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const r = await fetch(
      `https://api.github.com/users/${GH_USER}/events/public?per_page=100`,
      { headers, cache: 'no-store' }
    );
    if (!r.ok) {
      return NextResponse.json({ ok: false, status: r.status }, { status: 200 });
    }

    const events = (await r.json()) as GhEvent[];
    const fresh: ActivityMap = {};
    for (const e of events) {
      if (!e.repo?.name || !e.created_at) continue;
      const date = e.created_at.slice(0, 10);
      (fresh[date] ||= []);
      if (!fresh[date].includes(e.repo.name)) fresh[date].push(e.repo.name);
    }

    const merged = await mergeActivityMap(fresh);
    return NextResponse.json({ ok: true, daysSeen: Object.keys(fresh).length, daysStored: Object.keys(merged).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
