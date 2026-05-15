// webpage/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { signAdminToken } from '@/app/lib/auth';

const COOKIE = 'admin_session';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}