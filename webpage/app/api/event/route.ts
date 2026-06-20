import { NextResponse } from 'next/server';
import { addEvent } from '@/app/lib/events';

const ALLOWED = new Set(['cmdk_open', 'terminal_cmd', 'scroll_depth', 'project_click']);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!ALLOWED.has(body?.type)) return NextResponse.json({ ok: false }, { status: 400 });
    await addEvent({
      type: body.type,
      detail: typeof body.detail === 'string' ? body.detail.slice(0, 80) : undefined,
      section: typeof body.section === 'string' ? body.section.slice(0, 40) : undefined,
      depth: typeof body.depth === 'number' ? Math.max(0, Math.min(100, Math.round(body.depth))) : undefined,
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
