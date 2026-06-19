import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { readVisits, computeStats } from '@/app/lib/data';
import { getOnlineSessions } from '@/app/lib/presence';

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [visits, online] = await Promise.all([readVisits(), getOnlineSessions()]);
  const stats = computeStats(visits);
  return NextResponse.json({ ...stats, online });
}
