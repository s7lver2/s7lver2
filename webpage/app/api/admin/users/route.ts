import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { listUsers, createUser, toSafeUser, Permission } from '@/app/lib/users';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

export async function GET(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Only root can list users
  if (session.r !== 'root') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users: users.map(toSafeUser) });
}

export async function POST(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup || session.r !== 'root') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const body = await req.json().catch(() => ({})) as {
    username?: string; name?: string; avatar?: string; permissions?: Permission[];
  };

  if (!body.username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  const result = await createUser({
    username: body.username,
    name: body.name ?? body.username,
    avatar: body.avatar,
    permissions: body.permissions ?? [],
    createdBy: session.uid,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await addAuditEntry({
    action: 'user_create', actor: session.u, actorId: session.uid,
    target: result.user!.username, targetId: result.user!.id,
    ip, ua,
  }).catch(() => {});

  return NextResponse.json({ user: toSafeUser(result.user!), otp: result.otp }, { status: 201 });
}
