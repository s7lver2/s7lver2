import { NextResponse } from 'next/server';
import { createSessionToken, getSecret, COOKIE_NAME, SessionPayload } from '@/app/lib/auth';
import { resolveLogin, touchLastLogin } from '@/app/lib/users';
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

  const body = await req.json().catch(() => ({})) as {
    username?: string; password?: string; method?: 'password' | 'key';
  };

  const username = (body.username ?? 'root').trim().toLowerCase() || 'root';
  const credential = body.password ?? '';
  const method = body.method ?? 'password';

  const result = await resolveLogin(username, credential, method);

  if (!result.ok) {
    await new Promise(r => setTimeout(r, 800));
    await addAuditEntry({ action: 'login_fail', actor: username, actorId: username, detail: result.error, ip, ua }).catch(() => {});
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const { user, kind } = result;

  if (kind === 'setup') {
    // Return a temporary setup token so the client can call /api/admin/auth/setup
    const setupPayload: SessionPayload = {
      uid: user.id, u: user.username, r: 'user', p: [],
      setup: true, iat: Date.now(),
    };
    const setupToken = createSessionToken(setupPayload, getSecret());
    const res = NextResponse.json({ ok: true, setup: true });
    res.cookies.set(COOKIE_NAME, setupToken, cookieOpts(60 * 15)); // 15 min for setup
    return res;
  }

  // Full session
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
  await addAuditEntry({ action: 'login', actor: user.username, actorId: user.id, ip, ua }).catch(() => {});

  return res;
}

export async function DELETE(req: Request) {
  const ip = getTrueClientIp(new Headers(req.headers));
  // Try to get actor from session for audit
  const { getSession } = await import('@/app/lib/auth');
  const session = await getSession(req as Parameters<typeof getSession>[0]).catch(() => null);
  if (session) {
    await addAuditEntry({ action: 'logout', actor: session.u, actorId: session.uid, ip }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
