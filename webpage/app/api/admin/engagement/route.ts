import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { readEvents, summarizeEvents, AppEvent } from '@/app/lib/events';
import { readVisits, Visit } from '@/app/lib/data';

export interface EngagementResponse {
  cmdkOpens: number;
  terminalCmds: number;
  avgScrollDepth: number;
  readFullPct: number;
  scrollBySection: { section: string; avg: number }[];
  recent: AppEvent[];
  geo: { lat: number; lon: number }[];
}

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const events = await readEvents();
  const summary = summarizeEvents(events);

  // Extract geo from visits that have lat/lon
  const visits = await readVisits();
  const geo = visits
    .filter((v: Visit) => typeof v.lat === 'number' && typeof v.lon === 'number')
    .map((v: Visit) => ({ lat: v.lat!, lon: v.lon! }));

  const response: EngagementResponse = {
    cmdkOpens: summary.cmdkOpens,
    terminalCmds: summary.terminalCmds,
    avgScrollDepth: summary.avgScrollDepth,
    readFullPct: summary.readFullPct,
    scrollBySection: summary.scrollBySection,
    recent: summary.recent,
    geo,
  };

  return NextResponse.json(response);
}
