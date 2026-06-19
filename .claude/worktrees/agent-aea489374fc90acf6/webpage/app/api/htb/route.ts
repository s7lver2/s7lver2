/**
 * HTB API Proxy — app/api/htb/route.ts
 *
 * .env.local:
 *   HTB_USER_ID=1584434
 *   HTB_API_TOKEN=eyJ0eXA...
 */

import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://labs.hackthebox.com/api/v4';

function h(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
    'User-Agent':  'Mozilla/5.0',
  };
}

export async function GET(_req: NextRequest) {
  const token  = process.env.HTB_API_TOKEN;
  const userId = process.env.HTB_USER_ID;

  if (!token || !userId) {
    return NextResponse.json({ error: 'missing_env' }, { status: 503 });
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

    return NextResponse.json(
      { profile, progress },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[HTB]', msg);
    return NextResponse.json({ error: 'fetch_failed', message: msg }, { status: 500 });
  }
}