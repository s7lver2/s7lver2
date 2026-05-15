// webpage/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/app/lib/auth';
import { getStats } from '@/app/lib/analytics';

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (e) {
    console.error('stats error', e);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}