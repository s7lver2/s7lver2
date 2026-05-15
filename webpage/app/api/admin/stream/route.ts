// webpage/app/api/admin/stream/route.ts
import { NextRequest } from 'next/server';
import { isAdminRequest } from '@/app/lib/auth';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      const tick = async () => {
        if (closed) return;
        try {
          const oneHourAgo = Date.now() - 3600_000;
          const todayStart = Date.now() - 86400_000;

          const [recentRaw, todayRaw] = await Promise.all([
            kv.zrange<string[]>('visits', oneHourAgo, '+inf', { byScore: true }),
            kv.zrange<string[]>('visits', todayStart, '+inf', { byScore: true }),
          ]);

          const recent = (recentRaw ?? [])
            .map(v => typeof v === 'string' ? JSON.parse(v) : v)
            .reverse()
            .slice(0, 20);

          const activeIps = new Set(recent.map((v: { ip: string }) => v.ip));

          send({
            activeLastHour: activeIps.size,
            todayTotal: todayRaw?.length ?? 0,
            recent: recent.map((v: { lat: number; lon: number; country: string; city: string; page: string; timestamp: number }) => ({
              lat: v.lat, lon: v.lon, country: v.country, city: v.city, page: v.page,
              timestamp: new Date(v.timestamp).toISOString(),
            })),
            ts: Date.now(),
          });
        } catch (e) {
          console.error('stream tick error', e);
        }

        if (!closed) setTimeout(tick, 5000);
      };

      tick();

      req.signal.addEventListener('abort', () => {
        closed = true;
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}