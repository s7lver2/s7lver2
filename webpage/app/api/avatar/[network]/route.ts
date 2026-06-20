import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getSettings } from '@/app/lib/settings';

export const runtime = 'nodejs';
export const revalidate = 3600; // 1h

// Built-in auto sources (public, no auth). Others come from admin settings / local files.
const DEFAULTS: Record<string, string> = {
  github: 'https://github.com/s7lver2.png',
};

const LOCAL_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const CACHE = 'public, max-age=3600, s-maxage=3600';

// Resolve the Discord avatar via Lanyard (needs the user to be in the Lanyard server)
async function discordViaLanyard(id: string): Promise<string> {
  if (!id) return '';
  try {
    const r = await fetch(`https://api.lanyard.rest/v1/users/${id}`, {
      headers: { 'User-Agent': 'portfolio-site' },
      next: { revalidate },
    });
    if (!r.ok) return '';
    const j = await r.json();
    const du = j?.data?.discord_user;
    if (du?.avatar) return `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png?size=256`;
    // user exists but no custom avatar → Discord default
    if (du?.id) return `https://cdn.discordapp.com/embed/avatars/${(Number(du.id) >> 22) % 6}.png`;
  } catch {
    /* ignore */
  }
  return '';
}

function imageResponse(buf: ArrayBuffer | Buffer, type: string) {
  return new Response(buf as any, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': CACHE } });
}

export async function GET(_req: NextRequest, { params }: { params: { network: string } }) {
  const network = params.network.replace(/[^a-z0-9_-]/gi, '');
  const settings = await getSettings().catch(() => null);

  // 1) Admin-configured source (uploaded blob URL, pasted URL, or data:)
  let src = settings?.avatars?.[network]?.trim() || '';

  // 2) Discord → Lanyard auto
  if (!src && network === 'discord') {
    src = await discordViaLanyard(settings?.discordId || process.env.DISCORD_ID || '');
  }

  // 3) Built-in default (github)
  if (!src) src = DEFAULTS[network] || '';

  // Resolve src → image bytes
  if (src.startsWith('data:')) {
    const m = src.match(/^data:([^;]+);base64,(.+)$/);
    if (m) return imageResponse(Buffer.from(m[2], 'base64'), m[1]);
  } else if (/^https?:\/\//.test(src)) {
    try {
      const res = await fetch(src, { headers: { 'User-Agent': 'portfolio-site' }, next: { revalidate } });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return imageResponse(buf, res.headers.get('content-type') || 'image/png');
      }
    } catch {
      /* fall through to local */
    }
  }

  // 4) Local file in /public/avatars/<network>.<ext>
  for (const ext of LOCAL_EXTS) {
    try {
      const file = path.join(process.cwd(), 'public', 'avatars', `${network}.${ext}`);
      const buf = await readFile(file);
      return imageResponse(buf, MIME[ext]);
    } catch {
      /* try next */
    }
  }

  // 5) Nothing → 404 → client renders generated-initials ASCII
  return new Response('avatar not configured', { status: 404 });
}
