import { randomBytes } from 'crypto';
import { kvGetJSON, kvSetJSON } from './redis';
import { hashPassword, verifyPassword } from './auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export const PERMISSIONS = ['admin', 'owner'] as const;
export type Permission = typeof PERMISSIONS[number];

export const SECTIONS = PERMISSIONS;
export type Section = Permission;
export const ALL_PERMISSIONS = PERMISSIONS;

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  name: string;
  createdAt: string;
}

export interface PendingMessage {
  text: string;
  from: string;
  at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  passwordHash?: string;
  securityKeyHash?: string;
  otpHash?: string;
  authMethod: 'password' | 'key' | 'webauthn';
  pendingSetup: boolean;
  permissions: Permission[];
  isRoot?: boolean;
  suspended?: boolean;
  pendingMessage?: PendingMessage;
  createdAt: string;
  createdBy?: string;
  lastLogin?: string;
  lastActive?: string;
  webauthnCredentials?: WebAuthnCredential[];
  pronouns?: string;
  bio?: string;
  bannerUrl?: string;
}

export interface SafeUser {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  authMethod: 'password' | 'key' | 'webauthn';
  pendingSetup: boolean;
  permissions: Permission[];
  isRoot?: boolean;
  suspended?: boolean;
  pendingMessage?: PendingMessage;
  createdAt: string;
  lastLogin?: string;
  lastActive?: string;
  webauthnCredentials?: { id: string; name: string; createdAt: string; transports?: string[] }[];
  pronouns?: string;
  bio?: string;
  bannerUrl?: string;
}

export function toSafeUser(u: AdminUser): SafeUser {
  return {
    id: u.id, username: u.username, name: u.name, avatar: u.avatar,
    authMethod: u.authMethod, pendingSetup: u.pendingSetup,
    permissions: u.permissions, isRoot: u.isRoot,
    suspended: u.suspended,
    pendingMessage: u.pendingMessage,
    createdAt: u.createdAt, lastLogin: u.lastLogin, lastActive: u.lastActive,
    webauthnCredentials: u.webauthnCredentials?.map(c => ({
      id: c.id, name: c.name, createdAt: c.createdAt, transports: c.transports,
    })),
    pronouns: u.pronouns, bio: u.bio, bannerUrl: u.bannerUrl,
  };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KV_KEY = 's7lver:users';
const FILE = 'users.json';
const ROOT_ID = 'root';

async function readAll(): Promise<AdminUser[]> {
  return kvGetJSON<AdminUser[]>(KV_KEY, FILE, []);
}

async function writeAll(users: AdminUser[]): Promise<void> {
  await kvSetJSON(KV_KEY, FILE, users);
}

async function writeOne(user: AdminUser): Promise<void> {
  const users = await readAll();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) users.push(user); else users[idx] = user;
  await writeAll(users);
}

async function removeOne(id: string): Promise<void> {
  const users = await readAll();
  await writeAll(users.filter(u => u.id !== id));
}

// ─── Root seeding ─────────────────────────────────────────────────────────────

let cachedRootBcrypt: string | null = null;

async function getRootBcryptHash(): Promise<string> {
  if (cachedRootBcrypt) return cachedRootBcrypt;
  const plain = process.env.ROOT_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 's7lver_admin';
  cachedRootBcrypt = await hashPassword(plain);
  return cachedRootBcrypt;
}

function rootPassword(): string {
  return process.env.ROOT_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 's7lver_admin';
}

export async function ensureRoot(): Promise<AdminUser> {
  const all = await readAll();
  let root = all.find(u => u.id === ROOT_ID);
  if (!root) {
    root = {
      id: ROOT_ID, username: 'root', name: 'Root', authMethod: 'password',
      pendingSetup: false, permissions: ['owner'] as Permission[], isRoot: true,
      createdAt: new Date().toISOString(),
    };
    await writeOne(root);
  }
  return root;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listUsers(): Promise<AdminUser[]> {
  await ensureRoot();
  const all = await readAll();
  return all.sort((a, b) => (a.isRoot ? -1 : b.isRoot ? 1 : a.createdAt.localeCompare(b.createdAt)));
}

export async function getUser(id: string): Promise<AdminUser | null> {
  return (await readAll()).find(u => u.id === id) ?? null;
}

export async function getUserByUsername(username: string): Promise<AdminUser | null> {
  const u = username.trim().toLowerCase();
  return (await readAll()).find(x => x.username.toLowerCase() === u) ?? null;
}

function genCode(groups = 2, len = 4): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(groups * len);
  let out = '';
  for (let g = 0; g < groups; g++) {
    if (g) out += '-';
    for (let i = 0; i < len; i++) out += alpha[bytes[g * len + i] % alpha.length];
  }
  return out;
}

export function genSecurityKey(): string {
  return genCode(5, 4);
}

export async function createUser(
  input: { username: string; name: string; avatar?: string; permissions: Permission[]; createdBy?: string }
): Promise<{ ok: boolean; user?: AdminUser; otp?: string; error?: string }> {
  const username = input.username.trim().toLowerCase();
  if (!username || !/^[a-z0-9_.-]{2,24}$/.test(username)) {
    return { ok: false, error: 'Username must be 2-24 chars (a-z, 0-9, . _ -)' };
  }
  if (username === 'root') return { ok: false, error: 'Reserved username' };
  if (await getUserByUsername(username)) return { ok: false, error: 'Username already taken' };

  const otp = genCode(2, 4);
  const user: AdminUser = {
    id: crypto.randomUUID(),
    username,
    name: input.name.trim() || username,
    avatar: input.avatar,
    otpHash: await hashPassword(otp),
    authMethod: 'password',
    pendingSetup: true,
    permissions: input.permissions.filter(p => (ALL_PERMISSIONS as readonly string[]).includes(p)) as Permission[],
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  await writeOne(user);
  return { ok: true, user, otp };
}

export async function updateUser(id: string, patch: Partial<AdminUser>): Promise<AdminUser | null> {
  const user = await getUser(id);
  if (!user) return null;
  // Don't allow patching immutable fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, isRoot: _r, createdAt: _c, ...safe } = patch;
  const updated = { ...user, ...safe };
  await writeOne(updated);
  return updated;
}

export async function deleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
  if (id === ROOT_ID) return { ok: false, error: 'Cannot delete root' };
  const user = await getUser(id);
  if (!user) return { ok: false, error: 'User not found' };
  if (user.isRoot) return { ok: false, error: 'Cannot delete root' };
  await removeOne(id);
  return { ok: true };
}

export async function resetOtp(id: string): Promise<{ ok: boolean; otp?: string; error?: string }> {
  const user = await getUser(id);
  if (!user || user.isRoot) return { ok: false, error: 'User not found' };
  const otp = genCode(2, 4);
  await writeOne({ ...user, otpHash: await hashPassword(otp), pendingSetup: true });
  return { ok: true, otp };
}

// ─── Login resolution ─────────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; kind: 'session'; user: AdminUser }
  | { ok: true; kind: 'setup'; user: AdminUser }
  | { ok: false; error: string };

export async function resolveLogin(
  username: string,
  credential: string,
  method: 'password' | 'key',
): Promise<LoginResult> {
  const uname = username.trim().toLowerCase();

  if (uname === 'root') {
    const root = await ensureRoot();
    if (method === 'password') {
      const plain = rootPassword();
      if (credential === plain) return { ok: true, kind: 'session', user: root };
    } else if (root.securityKeyHash) {
      const { ok } = await verifyPassword(credential, root.securityKeyHash);
      if (ok) return { ok: true, kind: 'session', user: root };
    }
    return { ok: false, error: 'Invalid credentials' };
  }

  const user = await getUserByUsername(uname);
  if (!user) return { ok: false, error: 'Invalid credentials' };
  if (user.suspended) return { ok: false, error: 'Account suspended' };

  if (user.pendingSetup) {
    if (method !== 'password' || !user.otpHash) {
      return { ok: false, error: 'Use your one-time password to set up your account' };
    }
    const { ok } = await verifyPassword(credential, user.otpHash);
    if (!ok) return { ok: false, error: 'Invalid one-time password' };
    return { ok: true, kind: 'setup', user };
  }

  const field = method === 'password' ? 'passwordHash' : 'securityKeyHash';
  const storedHash = user[field];
  if (!storedHash) return { ok: false, error: 'Invalid credentials' };

  const { ok } = await verifyPassword(credential, storedHash);
  if (!ok) return { ok: false, error: 'Invalid credentials' };
  return { ok: true, kind: 'session', user };
}

export async function completeSetup(
  id: string,
  choice: { type: 'password'; password: string } | { type: 'key'; key: string },
): Promise<{ ok: boolean; user?: AdminUser; error?: string }> {
  const user = await getUser(id);
  if (!user) return { ok: false, error: 'User not found' };

  if (choice.type === 'password') {
    if (!choice.password || choice.password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters' };
    }
    const updated: AdminUser = {
      ...user,
      passwordHash: await hashPassword(choice.password),
      authMethod: 'password',
      pendingSetup: false,
      otpHash: undefined,
    };
    await writeOne(updated);
    return { ok: true, user: updated };
  }

  if (!choice.key || choice.key.length < 8) {
    return { ok: false, error: 'Invalid security key' };
  }
  const updated: AdminUser = {
    ...user,
    securityKeyHash: await hashPassword(choice.key),
    authMethod: 'key',
    pendingSetup: false,
    otpHash: undefined,
  };
  await writeOne(updated);
  return { ok: true, user: updated };
}

export async function touchLastLogin(id: string): Promise<void> {
  const user = await getUser(id);
  if (user) await writeOne({ ...user, lastLogin: new Date().toISOString() });
}

export async function touchLastActive(id: string): Promise<void> {
  const user = await getUser(id);
  if (user) await writeOne({ ...user, lastActive: new Date().toISOString() });
}

// ─── WebAuthn credential management ──────────────────────────────────────────

export async function addWebAuthnCredential(userId: string, cred: WebAuthnCredential): Promise<void> {
  const user = userId === ROOT_ID ? await ensureRoot() : await getUser(userId);
  if (!user) return;
  const existing = user.webauthnCredentials ?? [];
  if (existing.some(c => c.id === cred.id)) return;
  await updateUser(userId, { webauthnCredentials: [...existing, cred] });
}

export async function updateWebAuthnCounter(userId: string, credId: string, newCounter: number): Promise<void> {
  const user = userId === ROOT_ID ? await ensureRoot() : await getUser(userId);
  if (!user) return;
  const creds = (user.webauthnCredentials ?? []).map(c =>
    c.id === credId ? { ...c, counter: newCounter } : c
  );
  await updateUser(userId, { webauthnCredentials: creds });
}

export async function removeWebAuthnCredential(userId: string, credId: string): Promise<void> {
  const user = userId === ROOT_ID ? await ensureRoot() : await getUser(userId);
  if (!user) return;
  await updateUser(userId, {
    webauthnCredentials: (user.webauthnCredentials ?? []).filter(c => c.id !== credId),
  });
}

export async function findUserByCredentialId(credId: string): Promise<AdminUser | null> {
  const all = await listUsers();
  for (const u of all) {
    if (u.webauthnCredentials?.some(c => c.id === credId)) return u;
  }
  return null;
}
