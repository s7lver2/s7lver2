import { NextResponse } from 'next/server';
import { getSettings } from '@/app/lib/settings';
import type { Presence } from '@/app/oni/credits/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK: Presence = { name: 's7lver', status: null, custom: null, activity: null, spotify: null };

interface LanyardActivity { type: number; name: string; state?: string; details?: string }

// El estado de Discord en directo, vía Lanyard (el usuario tiene que estar en su servidor). Siempre
// responde 200: sin id, con error o sin datos, el respaldo (el nombre y nada en directo).
export async function GET() {
  const id = (await getSettings().catch(() => null))?.discordId || process.env.DISCORD_ID || '';
  let out = FALLBACK;
  // un id de Discord son 17-20 cifras: nada más entra en la URL
  if (/^\d{17,20}$/.test(id)) {
    try {
      const r = await fetch(`https://api.lanyard.rest/v1/users/${id}`, { headers: { 'User-Agent': 'portfolio-site' }, cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      const d = j?.success ? j.data : null;
      if (d) {
        const acts: LanyardActivity[] = d.activities ?? [];
        const custom = acts.find((a) => a.type === 4)?.state || null;
        const act = acts.find((a) => a.type !== 4 && a.name !== 'Spotify');
        out = {
          name: d.discord_user?.global_name || d.discord_user?.username || FALLBACK.name,
          status: d.discord_status ?? null,
          custom,
          activity: act ? act.name + (act.details ? ` · ${act.details}` : '') : null,
          spotify: d.listening_to_spotify && d.spotify ? { song: d.spotify.song, artist: d.spotify.artist } : null,
        };
      }
    } catch {
      /* el respaldo */
    }
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15' } });
}
