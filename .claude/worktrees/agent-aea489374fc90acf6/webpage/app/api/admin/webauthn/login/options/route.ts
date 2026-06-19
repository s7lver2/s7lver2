import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getUserByUsername, ensureRoot } from '@/app/lib/users';
import { storeChallenge, getRpConfig } from '@/app/lib/webauthn';

export async function POST(req: Request) {
  const { rpID } = getRpConfig();

  const body = await req.json().catch(() => ({})) as { username?: string };
  const username = (body.username ?? '').trim().toLowerCase() || 'root';

  const user = username === 'root'
    ? await ensureRoot()
    : await getUserByUsername(username);

  if (!user) {
    // Return options without allowed credentials (don't leak user existence)
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: [],
    });
    return NextResponse.json(options);
  }

  const creds = (user.webauthnCredentials ?? []).map(c => ({
    id: c.id,
    type: 'public-key' as const,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  }));

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: creds,
  });

  await storeChallenge(user.id, options.challenge);
  // Encode userId in challenge response for verify step
  return NextResponse.json({ ...options, _userId: user.id });
}
