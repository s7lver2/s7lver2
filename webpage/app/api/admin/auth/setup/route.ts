import { NextResponse } from 'next/server';
import { getSession, createSessionToken, getSecret, COOKIE_NAME, SessionPayload } from '@/app/lib/auth';
import { completeSetup, touchLastLogin } from '@/app/lib/users';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

function cookieOpts(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true, sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge,
  };
}

export async function POST(req: Request) {
  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';
  const session = await getSession(req as Parameters<typeof getSession>[0]);

  if (!session?.setup) {
    return NextResponse.json({ error: 'No pending setup session' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    type?: 'password' | 'key'; password?: string; key?: string;
  };

  const choice = body.type === 'key'
    ? { type: 'key' as const, key: body.key ?? '' }
    : { type: 'password' as const, password: body.password ?? '' };

  const result = await completeSetup(session.uid, choice);
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const user = result.user;
  const payload: SessionPayload = {
    uid: user.id,
    u: user.username,
    r: user.isRoot ? 'root' : 'user',
    p: user.permissions,
    iat: Date.now(),
  };
  const token = createSessionToken(payload, getSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, cookieOpts());

  await touchLastLogin(user.id).catch(() => {});
  await addAuditEntry({
    action: 'setup_complete', actor: user.username, actorId: user.id,
    detail: `method: ${choice.type}`, ip, ua,
  }).catch(() => {});

  return res;
}
