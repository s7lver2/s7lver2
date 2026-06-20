# Task 2: HTB machines pipeline (activity ✕ vendored htbmachines snapshot)

**Files:**
- Create: `app/lib/htb-concepts.ts`
- Create: `public/data/htbmachines.json` (vendored snapshot)
- Create: `scripts/fetch-htbmachines.mjs` (manual snapshot refresher)
- Create: `app/api/htb/machines/route.ts`
- Modify: `app/api/htb/route.ts` (optional reuse; machines route can fetch activity itself)

**Interfaces:**
- Consumes: HTB env `HTB_USER_ID`, `HTB_API_TOKEN`.
- Produces:
  - `app/lib/htb-concepts.ts`: `type ConceptKey` (re-export from content), `CONCEPT_AXES: Record<ConceptKey, string[]>`, `skillsToAxisKeys(skills: string): ConceptKey[]`.
  - `GET /api/htb/machines` → `{ machines: MachineCard[] }` where `MachineCard = { name: string; difficulty: string; os: string; date: string; concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string }`.

## Step 1: Create the concept→axis mapping

Create `app/lib/htb-concepts.ts`:

```ts
import type { ConceptKey } from './content';
export type { ConceptKey };

// Keywords (lowercase) found in htbmachines `skills` that count toward each axis.
export const CONCEPT_AXES: Record<ConceptKey, string[]> = {
  web:    ['web', 'sqli', 'sql injection', 'xss', 'lfi', 'rfi', 'rce', 'ssrf', 'ssti', 'upload', 'idor', 'jwt', 'deserialization', 'xxe'],
  net:    ['network', 'pivoting', 'tunnel', 'port forward', 'smb', 'snmp', 'nfs', 'ftp', 'dns', 'proxychains'],
  recon:  ['enumeration', 'recon', 'osint', 'information gathering', 'subdomain', 'fuzzing'],
  ad:     ['active directory', 'kerberos', 'kerberoasting', 'bloodhound', 'ntlm', 'asreproast', 'dcsync', 'ldap', 'gpo'],
  rev:    ['reversing', 'reverse engineering', 'binary', 'buffer overflow', 'bof', 'pwn', 'ghidra', 'debugging'],
  crypto: ['crypto', 'cryptography', 'hash', 'rsa', 'aes', 'cipher', 'encryption'],
};

export function skillsToAxisKeys(skills: string): ConceptKey[] {
  const s = (skills || '').toLowerCase();
  const out: ConceptKey[] = [];
  (Object.keys(CONCEPT_AXES) as ConceptKey[]).forEach((axis) => {
    if (CONCEPT_AXES[axis].some((kw) => s.includes(kw))) out.push(axis);
  });
  return out;
}
```

## Step 2: Seed the vendored snapshot

Create `public/data/htbmachines.json` with a starter array (real machines; the refresher script in Step 3 replaces this with the full set later). Each entry uses the htbmachines field names:

```json
[
  { "name": "Lame", "so": "Linux", "dificultad": "Fácil", "skills": "Enumeration Samba CVE", "youtube": "" },
  { "name": "Forest", "so": "Windows", "dificultad": "Fácil", "skills": "Active Directory Kerberoasting BloodHound DCSync", "youtube": "" },
  { "name": "Cap", "so": "Linux", "dificultad": "Fácil", "skills": "Web IDOR Linux Capabilities", "youtube": "" },
  { "name": "Tentacle", "so": "Linux", "dificultad": "Difícil", "skills": "Active Directory Kerberos Crypto Enumeration", "youtube": "" },
  { "name": "Jeeves", "so": "Windows", "dificultad": "Media", "skills": "Web RCE Reversing", "youtube": "" },
  { "name": "Cascade", "so": "Windows", "dificultad": "Media", "skills": "Active Directory LDAP Crypto Reversing", "youtube": "" }
]
```

## Step 3: Create the snapshot refresher script (manual, not runtime)

Create `scripts/fetch-htbmachines.mjs`. Document that it is run manually to refresh the snapshot and that the upstream may be Cloudflare-protected (in which case the snapshot is edited by hand):

```js
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
```

## Step 4: Create the machines route (activity ✕ snapshot)

Create `app/api/htb/machines/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { skillsToAxisKeys, type ConceptKey } from '@/app/lib/htb-concepts';

const BASE = 'https://labs.hackthebox.com/api/v4';

type Snapshot = { name: string; so?: string; dificultad?: string; skills?: string; youtube?: string }[];

export interface MachineCard {
  name: string; difficulty: string; os: string; date: string;
  concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string;
}

async function loadSnapshot(): Promise<Snapshot> {
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'htbmachines.json');
    return JSON.parse(await fs.readFile(p, 'utf8')) as Snapshot;
  } catch { return []; }
}

export async function GET() {
  const token = process.env.HTB_API_TOKEN;
  const userId = process.env.HTB_USER_ID;
  if (!token || !userId) return NextResponse.json({ machines: [] }, { status: 200 });

  try {
    const res = await fetch(`${BASE}/user/profile/activity/${parseInt(userId, 10)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`activity ${res.status}`);
    const data = await res.json();
    const activity: any[] = data?.profile?.activity ?? data?.activity ?? [];

    const snapshot = await loadSnapshot();
    const byName = new Map(snapshot.map((m) => [m.name.toLowerCase(), m]));

    const machines: MachineCard[] = activity
      .filter((a) => (a.object_type === 'machine' || a.type === 'machine' || a.machine_avatar))
      .slice(0, 24)
      .map((a) => {
        const name: string = a.name ?? a.machine_name ?? '—';
        const snap = byName.get(name.toLowerCase());
        const skills = snap?.skills ?? '';
        const conceptKeys = skillsToAxisKeys(skills);
        const concepts = skills ? skills.split(/[ ,]+/).filter(Boolean).slice(0, 4) : [];
        return {
          name,
          difficulty: snap?.dificultad ?? a.machine_difficulty ?? a.difficulty ?? '—',
          os: snap?.so ?? a.os ?? '—',
          date: a.date ?? a.created_at ?? '',
          concepts,
          conceptKeys,
          youtube: snap?.youtube || undefined,
        };
      });

    return NextResponse.json({ machines }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[HTB machines]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ machines: [] }, { status: 200 });
  }
}
```

## Step 5: Build

Run: `npm run build`
Expected: compiles; `/api/htb/machines` in the route list.

## Step 6: Verify

- `curl -s http://localhost:3000/api/htb/machines` → `{ "machines": [...] }`. With valid HTB env, entries have `name/difficulty/os/concepts/conceptKeys`. Without env, returns `{ "machines": [] }` (HTTP 200, no crash).
- Sanity check the mapping: a machine whose snapshot `skills` contains "Active Directory" has `conceptKeys` including `"ad"`.

## Step 7: Commit

```bash
git add app/lib/htb-concepts.ts public/data/htbmachines.json scripts/fetch-htbmachines.mjs app/api/htb/machines/route.ts
git commit -m "feat(htb): machines pipeline — activity API crossed with vendored htbmachines snapshot + concept→axis mapping"
```
