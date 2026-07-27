import { kvGetJSON, kvSetJSON } from '@/lib/redis';

/** yyyy-mm-dd -> repo full_names touched that day (public events only). */
export type ActivityMap = Record<string, string[]>;

const KEY = 'github:activity-map';
const FILE = 'github-activity-map.json';

// Bounds the map's size — a year of daily entries is plenty for the heatmap,
// which itself only ever shows the last 371 days.
const MAX_DAYS = 400;

export async function readActivityMap(): Promise<ActivityMap> {
  return kvGetJSON<ActivityMap>(KEY, FILE, {});
}

/**
 * Merge freshly-seen (date -> repos) pairs into the stored map and prune
 * anything older than MAX_DAYS. Only ever ADDS repos to a date, never
 * removes ones already recorded there — a later poll seeing fewer events
 * (because GitHub's public events API only returns a rolling ~90 day / 300
 * event window) must not erase attribution collected on an earlier poll.
 */
export async function mergeActivityMap(fresh: ActivityMap): Promise<ActivityMap> {
  const current = await readActivityMap();
  const merged: ActivityMap = { ...current };

  for (const [date, repos] of Object.entries(fresh)) {
    const existing = new Set(merged[date] ?? []);
    repos.forEach((r) => existing.add(r));
    merged[date] = [...existing];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(merged)) {
    if (date < cutoffStr) delete merged[date];
  }

  await kvSetJSON(KEY, FILE, merged);
  return merged;
}
