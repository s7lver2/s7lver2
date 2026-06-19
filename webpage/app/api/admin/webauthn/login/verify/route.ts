import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { createSessionToken, getSecret, COOKIE_NAME, SessionPayload } from '@/app/lib/auth';
import {
  findUserByCredentialId, ensureRoot, updateWebAuthnCounter, touchLastLogin,
} from '@/app/lib/users';
import { consumeChallenge, getRpConfig } from '@/app/lib/webauthn';
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
  const { rpID, origin } = getRpConfig();

  const body = await req.json().catch(() => null) as (AuthenticationResponseJSON & { _userId?: string }) | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // Find user by credential id or by _userId hint
  let user = await findUserByCredentialId(body.id);
  if (!user && body._userId === 'root') user = await ensureRoot();
  if (!user) return NextResponse.json({ error: 'Credential not found' }, { status: 400 });

  const storedCred = user.webauthnCredentials?.find(c => c.id === body.id);
  if (!storedCred) return NextResponse.json({ error: 'Credential not registered' }, { status: 400 });

  const expectedChallenge = await consumeChallenge(user.id);
  if (!expectedChallenge) return NextResponse.json({ error: 'No pending challenge' }, { status: 400 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.id,
        publicKey: Buffer.from(storedCred.publicKey, 'base64'),
        counter: storedCred.counter,
        transports: storedCred.transports as AuthenticatorTransport[] | undefined,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
  }

  await updateWebAuthnCounter(user.id, storedCred.id, verification.authenticationInfo.newCounter);

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
  await addAuditEntry({ action: 'webauthn_login', actor: user.username, actorId: user.id, ip, ua }).catch(() => {});

  return res;
}
