import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { getUser, toSafeUser } from '@/app/lib/users';

export async function GET(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.r === 'root') {
    // Root is synthetic — return a minimal safe object
    return NextResponse.json({
      user: {
        id: 'root', username: 'root', name: 'Root',
        authMethod: 'password', pendingSetup: false,
        permissions: [], isRoot: true,
        createdAt: new Date(0).toISOString(),
      },
    });
  }

  const user = await getUser(session.uid);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ user: toSafeUser(user) });
}
