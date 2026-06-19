import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { listAuditEntries, AuditAction } from '@/app/lib/audit';

export async function GET(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const actor = url.searchParams.get('actor') ?? undefined;
  const action = (url.searchParams.get('action') ?? undefined) as AuditAction | undefined;

  const { entries, total } = await listAuditEntries({ limit, offset, actor, action });
  return NextResponse.json({ entries, total });
}
