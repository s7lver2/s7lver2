import { NextRequest } from 'next/server';

// Remote avatar source per network. '' = not configured yet → 404 → client falls
// back to the generated-initials avatar. GitHub is auto-derived from the handle.
const AVATARS: Record<string, string> = {
  github: 'https://github.com/s7lver2.png',
  discord: '',
  twitter: '',
  tiktok: '',
  instagram: '',
  htb: '',
};

export const revalidate = 86400; // cache upstream fetch for 1 day

export async function GET(
  _req: NextRequest,
  { params }: { params: { network: string } }
) {
  const src = AVATARS[params.network];
  if (!src) {
    return new Response('avatar not configured', { status: 404 });
  }
  try {
    const res = await fetch(src, { next: { revalidate: 86400 } });
    if (!res.ok) return new Response('upstream error', { status: 502 });
    const buf = await res.arrayBuffer();
    const type = res.headers.get('content-type') || 'image/png';
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
