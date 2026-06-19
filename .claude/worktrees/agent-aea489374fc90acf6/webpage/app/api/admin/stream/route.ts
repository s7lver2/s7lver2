import { NextRequest } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { readVisits } from '@/app/lib/data';
import { getOnlineSessions, type PresenceEntry } from '@/app/lib/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.setup) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };
      let prevOnline = new Map<string, PresenceEntry>();
      let firstTick = true;

      const tick = async () => {
        try {
          const [visits, online] = await Promise.all([readVisits(), getOnlineSessions()]);
          const now = Date.now();
          const oneHourAgo = now - 60 * 60 * 1000;
          const oneDayAgo = now - 24 * 60 * 60 * 1000;
          const activeLastHour = visits.filter(v => new Date(v.timestamp).getTime() >= oneHourAgo).length;
          const todayTotal = visits.filter(v => new Date(v.timestamp).getTime() >= oneDayAgo).length;
          const recent = [...visits]
            .filter(v => v.lat != null && v.lon != null)
            .slice(0, 8)
            .map(v => ({ lat: v.lat!, lon: v.lon!, country: v.country ?? '', city: v.city ?? '', page: v.page, timestamp: v.timestamp }));

          const onlineMap = new Map(online.map(p => [p.sessionId, p]));
          const events: {
            type: 'connect' | 'disconnect'; sessionId: string; city: string; country: string;
            page: string; lat?: number; lon?: number; ts: number;
          }[] = [];
          if (!firstTick) {
            for (const [sid, p] of onlineMap) {
              if (!prevOnline.has(sid)) events.push({ type: 'connect', sessionId: sid, city: p.city ?? '', country: p.country ?? '', page: p.page, lat: p.lat, lon: p.lon, ts: now });
            }
            for (const [sid, p] of prevOnline) {
              if (!onlineMap.has(sid)) events.push({ type: 'disconnect', sessionId: sid, city: p.city ?? '', country: p.country ?? '', page: p.page, lat: p.lat, lon: p.lon, ts: now });
            }
          }
          prevOnline = onlineMap;
          firstTick = false;

          const onlinePublic = online.map(p => ({
            sessionId: p.sessionId, page: p.page, city: p.city ?? '', country: p.country ?? '',
            countryCode: p.countryCode ?? '', lat: p.lat, lon: p.lon,
            connectedAt: p.connectedAt, lastSeen: p.lastSeen,
          }));

          send({ activeLastHour, todayTotal, recent, online: onlinePublic, events, ts: now });
        } catch {
          send({ activeLastHour: 0, todayTotal: 0, recent: [], online: [], events: [], ts: Date.now() });
        }
      };
      tick();
      const interval = setInterval(tick, 3000);
      req.signal.addEventListener('abort', () => { clearInterval(interval); try { controller.close(); } catch {} });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
