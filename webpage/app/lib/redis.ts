import { Redis } from '@upstash/redis';
import { promises as fs } from 'fs';
import path from 'path';

const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function useKV() { return Boolean(URL && TOKEN); }

if (process.env.VERCEL && !useKV()) {
  console.error(
    '\n[s7lver] ⚠️  DATA IN DANGER: running on Vercel without Upstash Redis.' +
    '\nAll data goes to /tmp and WILL be lost on every cold start / new deployment.' +
    '\nFix: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel → Settings → Environment Variables.\n'
  );
}

const redis = useKV() ? new Redis({ url: URL!, token: TOKEN! }) : null;

export const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');

async function readFile<T>(file: string, def: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8')) as T; }
  catch { return def; }
}

async function writeFile<T>(file: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(value), 'utf8');
}

export async function kvGetJSON<T>(key: string, file: string, def: T): Promise<T> {
  if (redis) { const v = await redis.get<T>(key); return (v ?? def); }
  return readFile<T>(file, def);
}

export async function kvSetJSON<T>(key: string, file: string, value: T): Promise<void> {
  if (redis) { await redis.set(key, value); return; }
  await writeFile<T>(file, value);
}

// Redis instance accessor (for advanced list/hash operations)
export async function getRedis(): Promise<Redis> {
  if (!redis) throw new Error('Redis not configured');
  return redis;
}

export const USE_KV = useKV();
