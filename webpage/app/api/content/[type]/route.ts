import { NextResponse } from 'next/server';
import { getContent, isContentType } from '@/app/lib/content';

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  if (!isContentType(params.type)) {
    return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  }
  const data = await getContent(params.type);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
