import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { readVisits, computeStats } from '@/app/lib/data';

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const visits = await readVisits();
  return NextResponse.json(computeStats(visits));
}
