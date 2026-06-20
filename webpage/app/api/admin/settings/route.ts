import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getSettings, updateSettings } from '@/app/lib/settings';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

export const runtime = 'nodejs';

async function auth(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) return null;
  return session;
}

export async function GET(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await getSettings();
  return NextResponse.json({
    avatars: s.avatars,
    discordId: s.discordId,
    trackingEnabled: s.trackingEnabled,
  });
}

export async function PATCH(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.avatars && typeof body.avatars === 'object') {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.avatars)) {
      if (typeof v === 'string') clean[k.replace(/[^a-z0-9_-]/gi, '')] = v.trim();
    }
    patch.avatars = clean;
  }
  if (typeof body.discordId === 'string') patch.discordId = body.discordId.replace(/[^0-9]/g, '');
  if (typeof body.trackingEnabled === 'boolean') patch.trackingEnabled = body.trackingEnabled;

  const next = await updateSettings(patch);

  const ip = getTrueClientIp(new Headers(req.headers));
  await addAuditEntry({
    action: 'admin_action', actor: session.u, actorId: session.uid,
    detail: `settings: ${Object.keys(patch).join(',')}`, ip, ua: req.headers.get('user-agent') ?? '',
  }).catch(() => {});

  return NextResponse.json({
    avatars: next.avatars,
    discordId: next.discordId,
    trackingEnabled: next.trackingEnabled,
  });
}
