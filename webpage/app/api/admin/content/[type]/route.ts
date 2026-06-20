import { NextResponse } from 'next/server';
import { getContent, setContent, isContentType } from '@/app/lib/content';
import { getSession } from '@/app/lib/auth';
import { addAuditEntry } from '@/app/lib/audit';

async function auth(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) return null;
  return session;
}

export async function GET(req: Request, { params }: { params: { type: string } }) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isContentType(params.type)) return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  return NextResponse.json(await getContent(params.type));
}

export async function PUT(req: Request, { params }: { params: { type: string } }) {
  const session = await auth(req);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isContentType(params.type)) return NextResponse.json({ error: 'unknown_type' }, { status: 404 });
  const body = await req.json();
  await setContent(params.type, body);
  try { await addAuditEntry({ action: 'admin_action', actor: session.u, actorId: session.uid, detail: `content: ${params.type}` }); } catch {}
  return NextResponse.json({ ok: true });
}
