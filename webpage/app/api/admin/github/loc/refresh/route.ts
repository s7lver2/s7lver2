import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { refreshLoc } from '@/app/lib/loc';

async function auth(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) return null;
  return session;
}

// A cold pass takes 30-140 seconds, so this route is deliberately admin-only
// and deliberately never reachable from the public site.
export async function POST(req: Request) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const payload = await refreshLoc();
  return NextResponse.json(payload);
}
