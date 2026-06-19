import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getUser, updateUser, deleteUser, resetOtp, toSafeUser, Permission } from '@/app/lib/users';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Users can see themselves; root sees all
  if (session.r !== 'root' && session.uid !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const user = await getUser(params.id);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ user: toSafeUser(user) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isRoot = session.r === 'root';
  const isSelf = session.uid === params.id;

  if (!isRoot && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const user = await getUser(params.id);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.isRoot && !isRoot) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const body = await req.json().catch(() => ({})) as {
    name?: string; avatar?: string; permissions?: Permission[];
    suspended?: boolean; bannerUrl?: string; pronouns?: string; bio?: string;
    pendingMessage?: { text: string; from: string; at: string } | null;
  };

  // Non-root can only update their own profile fields
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.avatar !== undefined) patch.avatar = body.avatar;
  if (body.bannerUrl !== undefined) patch.bannerUrl = body.bannerUrl;
  if (body.pronouns !== undefined) patch.pronouns = body.pronouns;
  if (body.bio !== undefined) patch.bio = body.bio;

  // Root-only fields
  if (isRoot) {
    if (body.permissions !== undefined) patch.permissions = body.permissions;
    if (body.suspended !== undefined) patch.suspended = body.suspended;
    if (body.pendingMessage !== undefined) {
      patch.pendingMessage = body.pendingMessage ?? undefined;
    }
  }

  const updated = await updateUser(params.id, patch as Parameters<typeof updateUser>[1]);
  if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  let action: Parameters<typeof addAuditEntry>[0]['action'] = 'user_update';
  if (isRoot && body.suspended === true) action = 'user_suspend';
  if (isRoot && body.suspended === false) action = 'user_unsuspend';
  if (isSelf) action = 'me_update';

  await addAuditEntry({ action, actor: session.u, actorId: session.uid, target: user.username, targetId: user.id, ip, ua }).catch(() => {});

  return NextResponse.json({ user: toSafeUser(updated) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup || session.r !== 'root') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const user = await getUser(params.id);
  const result = await deleteUser(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await addAuditEntry({
    action: 'user_delete', actor: session.u, actorId: session.uid,
    target: user?.username ?? params.id, targetId: params.id, ip, ua,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: Ctx) {
  // Reset OTP action: POST /api/admin/users/[id] with { action: 'reset_otp' }
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup || session.r !== 'root') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const body = await req.json().catch(() => ({})) as { action?: string };
  if (body.action !== 'reset_otp') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const result = await resetOtp(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const user = await getUser(params.id);
  await addAuditEntry({
    action: 'otp_reset', actor: session.u, actorId: session.uid,
    target: user?.username ?? params.id, targetId: params.id, ip, ua,
  }).catch(() => {});

  return NextResponse.json({ ok: true, otp: result.otp });
}
