import { NextResponse } from 'next/server';
import { getContent, setContent, type AdminPrefs } from '@/app/lib/content';
import { getSession } from '@/app/lib/auth';

async function auth(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) return null;
  return session;
}

export async function GET(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await getContent<AdminPrefs>('adminPrefs'));
}

export async function PUT(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { renderer?: string };
  if (body.renderer !== 'dots' && body.renderer !== 'braille' && body.renderer !== 'svg') {
    return NextResponse.json({ error: 'invalid_renderer' }, { status: 400 });
  }
  const prefs: AdminPrefs = { renderer: body.renderer };
  await setContent('adminPrefs', prefs);
  return NextResponse.json({ ok: true });
}
