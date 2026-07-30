import { NextResponse } from 'next/server';
import { readLocCache, refreshLoc, LOC_TTL_MS } from '@/lib/loc';

// Nunca estatica: en el build no hay cache que leer, asi que caeria por el
// camino que bloquea (refreshLoc, 30-140 s) y ademas horneria el resultado.
export const dynamic = 'force-dynamic';

export async function GET() {
  const cached = await readLocCache();

  if (cached) {
    const fresh = Date.now() - cached.fetchedAt < LOC_TTL_MS;
    if (fresh) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      });
    }
    // Stale: serve it immediately and refresh behind the response. A cold pass
    // over the selection costs 30-140 seconds — no visitor ever waits for it.
    void refreshLoc();
    return NextResponse.json(
      { ...cached, stale: true },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  // No cache at all. This is the only path that blocks, and only on a cold start.
  const built = await refreshLoc();
  return NextResponse.json(built, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
