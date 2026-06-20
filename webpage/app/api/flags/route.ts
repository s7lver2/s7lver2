import { NextResponse } from 'next/server';
import { getSettings } from '@/app/lib/settings';

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ flags: s.flags, theme: s.theme }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
}
