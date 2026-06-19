import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getSession } from '@/app/lib/auth';
import { getUser, ensureRoot } from '@/app/lib/users';
import { storeChallenge, getRpConfig } from '@/app/lib/webauthn';

export async function POST(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rpName, rpID } = getRpConfig();

  const user = session.r === 'root'
    ? await ensureRoot()
    : await getUser(session.uid);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existingCredIds = (user.webauthnCredentials ?? []).map(c => ({
    id: c.id,
    type: 'public-key' as const,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingCredIds,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await storeChallenge(user.id, options.challenge);

  return NextResponse.json(options);
}
