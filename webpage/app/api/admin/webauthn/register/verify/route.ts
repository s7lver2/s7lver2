import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { getSession } from '@/app/lib/auth';
import { getUser, ensureRoot, addWebAuthnCredential } from '@/app/lib/users';
import { consumeChallenge, getRpConfig } from '@/app/lib/webauthn';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

export async function POST(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const { rpID, origin } = getRpConfig();

  const user = session.r === 'root'
    ? await ensureRoot()
    : await getUser(session.uid);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const expectedChallenge = await consumeChallenge(user.id);
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'No pending challenge' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as RegistrationResponseJSON & { name?: string } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const credName = body.name ?? `Key ${new Date().toLocaleDateString()}`;

  await addWebAuthnCredential(user.id, {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    transports: body.response.transports as string[] | undefined,
    name: credName,
    createdAt: new Date().toISOString(),
  });

  await addAuditEntry({
    action: 'webauthn_register', actor: user.username, actorId: user.id,
    detail: credName, ip, ua,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
