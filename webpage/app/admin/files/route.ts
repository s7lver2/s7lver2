import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';
import { isAdminRequest } from '@/app/lib/auth';

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { blobs } = await list({ prefix: 'uploads/' });
  return NextResponse.json(blobs.map(b => ({
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    uploadedAt: b.uploadedAt,
  })));
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

  await del(url);
  return NextResponse.json({ ok: true });
}