import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { addAuditEntry } from '@/app/lib/audit';
import { getTrueClientIp } from '@/app/lib/settings';

export const runtime = 'nodejs';

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

async function putBlob(filename: string, file: File, token: string): Promise<string> {
  // Use Vercel Blob REST API directly to avoid bundling the SDK
  const res = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type,
      'x-api-version': '7',
      'x-add-random-suffix': 'true',
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Blob upload failed: ${res.status}`);
  const data = await res.json() as { url: string };
  return data.url;
}

export async function POST(req: Request) {
  const session = await getSession(req as Parameters<typeof getSession>[0]);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getTrueClientIp(new Headers(req.headers));
  const ua = req.headers.get('user-agent') ?? '';

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 4 MB)' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const filename = `avatars/${session.uid}-${Date.now()}.${ext}`;
      const url = await putBlob(filename, file, token);
      await addAuditEntry({
        action: 'avatar_upload', actor: session.u, actorId: session.uid,
        detail: url, ip, ua,
      }).catch(() => {});
      return NextResponse.json({ url });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // Fallback: return data URL (local dev only — not persisted across requests)
  const bytes = await file.arrayBuffer();
  const b64 = Buffer.from(bytes).toString('base64');
  const dataUrl = `data:${file.type};base64,${b64}`;
  return NextResponse.json({ url: dataUrl });
}
