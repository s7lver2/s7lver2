import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getUser, ensureRoot, removeWebAuthnCredential } from '@/app/lib/users';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

type Ctx = { params: { id: string } };

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  // Decode the credential id from URL param (may be base64url encoded)
  const credId = decodeURIComponent(params.id);

  const user = session.r === 'root'
    ? await ensureRoot()
    : await getUser(session.uid);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const cred = user.webauthnCredentials?.find(c => c.id === credId);
  if (!cred) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

  await removeWebAuthnCredential(user.id, credId);

  await addAuditEntry({
    action: 'webauthn_remove', actor: session.u, actorId: session.uid,
    detail: cred.name, ip, ua,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credId = decodeURIComponent(params.id);

  const user = session.r === 'root'
    ? await ensureRoot()
    : await getUser(session.uid);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { name?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const creds = (user.webauthnCredentials ?? []).map(c =>
    c.id === credId ? { ...c, name: body.name!.trim() } : c
  );
  if (!creds.some(c => c.id === credId)) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

  const { updateUser } = await import('@/app/lib/users');
  await updateUser(user.id, { webauthnCredentials: creds });

  return NextResponse.json({ ok: true });
}
