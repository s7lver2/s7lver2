import { NextRequest, NextResponse } from 'next/server';
import { recordVisit } from '@/app/lib/analytics';

export async function POST(req: NextRequest) {
  // Validate internal secret
  const secret = req.headers.get('x-internal');
  if (secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const event = await req.json();
    await recordVisit(event);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('track error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}