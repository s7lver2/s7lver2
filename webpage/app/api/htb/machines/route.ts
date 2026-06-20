import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { skillsToAxisKeys, type ConceptKey } from '@/app/lib/htb-concepts';

const BASE = 'https://labs.hackthebox.com/api/v4';

type Snapshot = { name: string; so?: string; dificultad?: string; skills?: string; youtube?: string }[];

export interface MachineCard {
  name: string; difficulty: string; os: string; date: string;
  concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string;
}

async function loadSnapshot(): Promise<Snapshot> {
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'htbmachines.json');
    return JSON.parse(await fs.readFile(p, 'utf8')) as Snapshot;
  } catch { return []; }
}

export async function GET() {
  const token = process.env.HTB_API_TOKEN;
  const userId = process.env.HTB_USER_ID;
  if (!token || !userId) return NextResponse.json({ machines: [] }, { status: 200 });

  try {
    const res = await fetch(`${BASE}/user/profile/activity/${parseInt(userId, 10)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`activity ${res.status}`);
    const data = await res.json();
    const activity: any[] = data?.profile?.activity ?? data?.activity ?? [];

    const snapshot = await loadSnapshot();
    const byName = new Map(snapshot.map((m) => [m.name.toLowerCase(), m]));

    const machines: MachineCard[] = activity
      .filter((a) => (a.object_type === 'machine' || a.type === 'machine' || a.machine_avatar))
      .slice(0, 24)
      .map((a) => {
        const name: string = a.name ?? a.machine_name ?? '—';
        const snap = byName.get(name.toLowerCase());
        const skills = snap?.skills ?? '';
        const conceptKeys = skillsToAxisKeys(skills);
        const concepts = skills ? skills.split(/[ ,]+/).filter(Boolean).slice(0, 4) : [];
        return {
          name,
          difficulty: snap?.dificultad ?? a.machine_difficulty ?? a.difficulty ?? '—',
          os: snap?.so ?? a.os ?? '—',
          date: a.date ?? a.created_at ?? '',
          concepts,
          conceptKeys,
          youtube: snap?.youtube || undefined,
        };
      });

    return NextResponse.json({ machines }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[HTB machines]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ machines: [] }, { status: 200 });
  }
}
