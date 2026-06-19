import { kvGetJSON, kvSetJSON } from './redis';

// ─── Challenge store (TTL 5 min) ──────────────────────────────────────────────

interface ChallengeEntry {
  challenge: string;
  userId: string;
  expiresAt: number;
}

const KV_KEY = 's7lver:webauthn_challenges';
const FILE = 'webauthn_challenges.json';

async function readChallenges(): Promise<Record<string, ChallengeEntry>> {
  return kvGetJSON<Record<string, ChallengeEntry>>(KV_KEY, FILE, {});
}

async function writeChallenges(data: Record<string, ChallengeEntry>): Promise<void> {
  await kvSetJSON(KV_KEY, FILE, data);
}

function pruneExpired(data: Record<string, ChallengeEntry>): Record<string, ChallengeEntry> {
  const now = Date.now();
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v.expiresAt > now));
}

export async function storeChallenge(userId: string, challenge: string): Promise<void> {
  const data = pruneExpired(await readChallenges());
  data[userId] = { challenge, userId, expiresAt: Date.now() + 5 * 60 * 1000 };
  await writeChallenges(data);
}

export async function consumeChallenge(userId: string): Promise<string | null> {
  const data = pruneExpired(await readChallenges());
  const entry = data[userId];
  if (!entry) return null;
  delete data[userId];
  await writeChallenges(data);
  return entry.challenge;
}

// ─── RP configuration ─────────────────────────────────────────────────────────

export function getRpConfig(): { rpName: string; rpID: string; origin: string } {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const url = new URL(siteUrl);
  return {
    rpName: 's7lver admin',
    rpID: url.hostname,
    origin: `${url.protocol}//${url.host}`,
  };
}
