/**
 * HTB API Proxy — app/api/htb/route.ts
 *
 * .env.local:
 *   HTB_USER_ID=1584434
 *   HTB_API_TOKEN=eyJ0eXA...
 */

import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://labs.hackthebox.com/api/v4';
// The recent-activity feed lives under v5, not v4 - confirmed by reading
// app.hackthebox.com's own frontend bundle (its activity call sets
// enableV5Api). There is no v4 equivalent.
const BASE_V5 = 'https://labs.hackthebox.com/api/v5';

function h(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
    'User-Agent':  'Mozilla/5.0',
  };
}

// Proxy en vivo: si Next la hornea (salia como `○`), sirve para siempre la
// respuesta del build — que es cuando aparecia el `[HTB machines] activity 404`
// del log, porque se ejecutaba sin las credenciales de runtime.
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const token  = process.env.HTB_API_TOKEN;
  const userId = process.env.HTB_USER_ID;

  // Not configured is not an error — mirror app/api/htb/machines/route.ts and
  // let the client render an empty state instead of a status code.
  if (!token || !userId) {
    return NextResponse.json(
      { profile: null, progress: null, configured: false },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }

  // HTB_USER_ID must be the plain numeric account id (find it via the API's
  // own /user/info, or the "sub" claim of the API token's JWT) — NOT the SSO
  // UUID some account pages show. parseInt(uuid) used to silently truncate
  // "019ca455-..." down to 19, quietly pointing every request at a
  // completely different account for months. Fail loudly instead.
  if (!/^\d+$/.test(userId)) {
    console.error(`[HTB] HTB_USER_ID is not a plain integer: "${userId}"`);
    return NextResponse.json(
      { profile: null, progress: null, configured: false },
      { headers: { 'Cache-Control': 'public, s-maxage=300' } }
    );
  }
  const id = parseInt(userId, 10);

  try {
    // ── Perfil básico ──────────────────────────────────────────────
    const profRes = await fetch(`${BASE}/user/profile/basic/${id}`, {
      headers: h(token), next: { revalidate: 3600 },
    });
    if (!profRes.ok) throw new Error(`Profile: ${profRes.status}`);

    const profData = await profRes.json();
    const p = profData?.profile ?? profData;

    const profile = {
      id,
      name:        p.name        ?? `user_${id}`,
      rank:        p.rank        ?? p.ranking?.rank   ?? '—',
      points:      p.points      ?? p.ranking?.points ?? 0,
      user_owns:   p.user_owns   ?? p.userOwns        ?? 0,
      system_owns: p.system_owns ?? p.systemOwns      ?? 0,
      avatar:      p.avatar      ?? null,
    };

    // ── Progreso de máquinas (stats por dificultad y OS) ──────────
    const progRes = await fetch(
      `${BASE}/user/profile/progress/machines/${id}`,
      { headers: h(token), next: { revalidate: 1800 } }
    );

    let progress: {
      solved_tasks:         number;
      machine_owns:         { solved: number; total: number; completion_percentage: number };
      machine_difficulties: { name: string; owned_machines: number; total_machines: number; completion_percentage: number }[];
      machine_os:           { name: string; owned_machines: number; total_machines: number; completion_percentage: number }[];
    } | null = null;

    if (progRes.ok) {
      const d = await progRes.json();
      const prof = d?.profile ?? d;
      progress = {
        solved_tasks:         prof.solved_tasks         ?? 0,
        machine_owns:         prof.machine_owns         ?? { solved: 0, total: 0, completion_percentage: 0 },
        machine_difficulties: prof.machine_difficulties ?? [],
        machine_os:           prof.machine_os           ?? [],
      };
    }

    // ── Actividad reciente (para el feed estilo terminal) ─────────
    // Best-effort: the widget works fine without it, so a failure here never
    // throws — recentOwns just comes back empty.
    type ActivityEntry = { type: 'root' | 'user'; id: number; name: string; ownDate: string };
    let recentOwns: { name: string; kind: 'user' | 'system' | 'both'; when: string }[] = [];
    try {
      const actRes = await fetch(`${BASE_V5}/user/profile/activity/${id}`, {
        headers: h(token), next: { revalidate: 1800 },
      });
      if (actRes.ok) {
        const actData = await actRes.json();
        const entries: ActivityEntry[] = Array.isArray(actData?.data) ? actData.data : [];
        // Machine root+user owns arrive as two separate entries with the same
        // id/name; merge same-day pairs into one "both" row instead of
        // showing the same machine twice in a row.
        const byMachine = new Map<number, { name: string; kinds: Set<'user' | 'system'>; when: string }>();
        for (const e of entries) {
          const kind = e.type === 'root' ? 'system' : 'user';
          const existing = byMachine.get(e.id);
          if (existing) {
            existing.kinds.add(kind);
            if (e.ownDate > existing.when) existing.when = e.ownDate;
          } else {
            byMachine.set(e.id, { name: e.name, kinds: new Set([kind]), when: e.ownDate });
          }
        }
        recentOwns = [...byMachine.values()]
          .sort((a, b) => b.when.localeCompare(a.when))
          .slice(0, 6)
          .map((m) => ({
            name: m.name,
            kind: m.kinds.size === 2 ? 'both' : m.kinds.has('system') ? 'system' : 'user',
            when: m.when,
          }));
      }
    } catch {
      // recentOwns stays empty
    }

    return NextResponse.json(
      { profile, progress, recentOwns, configured: true },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HTB]', msg);
    return NextResponse.json({ error: 'fetch_failed', message: msg }, { status: 500 });
  }
}