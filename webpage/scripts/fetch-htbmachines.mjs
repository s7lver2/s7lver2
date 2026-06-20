// Manual snapshot refresher for public/data/htbmachines.json
// Usage: node scripts/fetch-htbmachines.mjs
// NOTE: the upstream (hackingvault.com / infosecmachines) is often behind Cloudflare.
// If the fetch fails, update public/data/htbmachines.json by hand from
// https://htbmachines.github.io (the Dataset in its source bundle).
import { writeFile } from 'node:fs/promises';

const URL = 'https://hackingvault.com/api/machines';
try {
  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const machines = Array.isArray(data) ? data : (data.machines ?? []);
  await writeFile('public/data/htbmachines.json', JSON.stringify(machines, null, 0));
  console.log(`Wrote ${machines.length} machines.`);
} catch (e) {
  console.error('Fetch failed (likely Cloudflare). Edit the JSON by hand. Reason:', e.message);
  process.exit(1);
}
