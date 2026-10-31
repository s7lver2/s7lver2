import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * Solo en desarrollo: la página en modo ?bake sube aquí la habitación ya montada
 * (geometría en coordenadas del mundo y luces) para que tools/bake_lighting.py la hornee.
 */

export const dynamic = 'force-dynamic';

const FILES = new Set(['scene.glb', 'meta.json']);

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const f = new URL(req.url).searchParams.get('f') ?? '';
  if (!FILES.has(f)) return new Response('bad file', { status: 400 });
  const dir = path.join(process.cwd(), 'tools', '.bake');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, f), Buffer.from(await req.arrayBuffer()));
  return Response.json({ ok: true });
}
