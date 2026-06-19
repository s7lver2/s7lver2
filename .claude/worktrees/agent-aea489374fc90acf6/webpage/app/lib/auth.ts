import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (hash.startsWith('$2')) {
    const ok = await bcrypt.compare(plain, hash);
    return { ok, needsUpgrade: false };
  }
  // Legacy SHA-256 hash with s7lver salt
  const { createHash } = await import('crypto');
  const oldHash = createHash('sha256').update(plain + 's7lver_salt').digest('hex');
  const ok = oldHash === hash;
  return { ok, needsUpgrade: ok };
}

export interface SessionPayload {
  uid: string;
  u: string;
  r: 'root' | 'user';
  p: string[] | 'all';
  setup?: boolean;
  iat: number;
}

export const COOKIE_NAME = process.env.NODE_ENV === 'development' ? 'admin_session_dev' : 'admin_session';

export function getSecret(): string {
  return process.env.ADMIN_SECRET ?? 's7lver_dev_secret_change_me';
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat'>, secret: string): string {
  const full: SessionPayload = { ...payload, iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

function readSessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    const json = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const data = JSON.parse(json) as SessionPayload;
    if (!data.uid || !data.u || !data.r) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSession(req?: Request): Promise<SessionPayload | null> {
  const secret = getSecret();
  let token: string | undefined;
  if (req) {
    token = req.headers.get('cookie')?.split(';').map(c => c.trim())
      .find(c => c.startsWith(`${COOKIE_NAME}=`))?.slice(`${COOKIE_NAME}=`.length);
  } else {
    const jar = await cookies();
    token = jar.get(COOKIE_NAME)?.value;
  }
  return readSessionToken(token, secret);
}

// Phase 3 permission helpers (added in Phase 3 Task 1)
export async function requireAuth(req?: Request): Promise<SessionPayload | null> {
  const s = await getSession(req);
  if (!s || s.setup) return null;
  return s;
}

export function isOwner(s: SessionPayload): boolean {
  return s.r === 'root' || s.p === 'all' || (Array.isArray(s.p) && s.p.includes('owner'));
}

export function isAdmin(s: SessionPayload): boolean {
  return isOwner(s) || (Array.isArray(s.p) && s.p.includes('admin'));
}
