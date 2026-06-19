import { kvGetJSON, kvSetJSON } from './redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login' | 'logout' | 'login_fail'
  | 'user_create' | 'user_update' | 'user_delete' | 'user_suspend' | 'user_unsuspend'
  | 'otp_reset' | 'setup_complete'
  | 'webauthn_register' | 'webauthn_remove' | 'webauthn_login'
  | 'avatar_upload' | 'me_update'
  | 'admin_action';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: string;       // username of who did it
  actorId: string;
  target?: string;     // username affected (if different)
  targetId?: string;
  detail?: string;
  ip?: string;
  ua?: string;
  ts: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KV_KEY = 's7lver:audit';
const FILE = 'audit.json';
const MAX = 2000;

async function readAll(): Promise<AuditEntry[]> {
  return kvGetJSON<AuditEntry[]>(KV_KEY, FILE, []);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function addAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'ts'>
): Promise<AuditEntry> {
  const all = await readAll();
  const record: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
  };
  // Circular buffer — keep newest MAX entries
  const next = [...all, record];
  if (next.length > MAX) next.splice(0, next.length - MAX);
  await kvSetJSON(KV_KEY, FILE, next);
  return record;
}

export async function listAuditEntries(opts?: {
  limit?: number;
  offset?: number;
  actor?: string;
  action?: AuditAction;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  let all = (await readAll()).slice().reverse(); // newest first
  if (opts?.actor) all = all.filter(e => e.actor === opts.actor || e.actorId === opts.actor);
  if (opts?.action) all = all.filter(e => e.action === opts.action);
  const total = all.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  return { entries: all.slice(offset, offset + limit), total };
}
