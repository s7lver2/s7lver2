// webpage/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { UAParser } from 'ua-parser-js';

// We don't import recordVisit directly because middleware runs in Edge runtime.
// Instead, we fire-and-forget a fetch to our own API.

const TRACK_API = '/api/track';

// Skip tracking for these paths
function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Admin route protection ---
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminToken = req.cookies.get('admin_session')?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    // Verify token
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-dev-secret-change-in-prod');
      await jwtVerify(adminToken, secret);
    } catch {
      const res = NextResponse.redirect(new URL('/admin/login', req.url));
      res.cookies.delete('admin_session');
      return res;
    }
  }

  // --- Tracking logic (only if not skipped) ---
  if (!shouldSkip(pathname)) {
    // Get or create session ID
    let sessionId = req.cookies.get('sid')?.value;
    const isNew = !sessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Parse UA
    const ua = req.headers.get('user-agent') ?? '';
    const parser = new UAParser(ua);
    const device = parser.getDevice().type ?? 'desktop';
    const browser = parser.getBrowser().name ?? 'unknown';
    const os = parser.getOS().name ?? 'unknown';

    // Vercel provides geo headers
    const country = req.headers.get('x-vercel-ip-country') ?? '';
    const countryCode = req.headers.get('x-vercel-ip-country') ?? '';
    const city = req.headers.get('x-vercel-ip-city') ?? '';
    const latStr = req.headers.get('x-vercel-ip-latitude') ?? '0';
    const lonStr = req.headers.get('x-vercel-ip-longitude') ?? '0';

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '0.0.0.0';

    const referrer = req.headers.get('referer') ?? '';

    const event = {
      sessionId,
      ip,
      page: pathname,
      referrer,
      ua,
      country,
      countryCode,
      city,
      device,
      browser,
      os,
      timestamp: Date.now(),
      lat: parseFloat(latStr),
      lon: parseFloat(lonStr),
    };

    // Fire-and-forget to internal track API
    const trackUrl = new URL(TRACK_API, req.url);
    fetch(trackUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': process.env.JWT_SECRET ?? '' },
      body: JSON.stringify(event),
    }).catch(() => {});
  }

  // --- Response handling and session cookie ---
  const res = NextResponse.next();

  // Set session cookie if new
  if (!req.cookies.get('sid')) {
    res.cookies.set('sid', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};