import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.NODE_ENV === 'development' ? 'admin_session_dev' : 'admin_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Inject x-pathname so the admin layout can detect login vs dashboard
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  // Protect /admin/* — redirect to login if session cookie is absent
  // Full HMAC verification happens in each API route; this is a fast UX gate
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const session = req.cookies.get(COOKIE_NAME)?.value;
    if (!session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/admin/:path*'],
};
