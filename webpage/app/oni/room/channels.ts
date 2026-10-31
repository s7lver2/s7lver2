import { DEFAULT_PROJECTS, type Broadcast, type ProjectC } from '@/app/lib/content-constants';

export interface Channel { number: number; name: string; tagline: string; tags: string[]; web?: string; repo?: string; broadcast: Broadcast }

// cada proyecto es un canal: el número que traiga, o el siguiente libre
export function toChannels(projects: ProjectC[]): Channel[] {
  const taken = new Set<number>();
  const free = (from: number) => { let n = Math.max(1, from); while (taken.has(n)) n++; taken.add(n); return n; };
  const fixed = projects.map((p) => (p.channel && p.channel > 0 && !taken.has(p.channel) ? (taken.add(p.channel), p.channel) : null));
  return projects
    .map((p, i) => ({
      number: fixed[i] ?? free(p.channel ?? 1),
      name: p.name,
      tagline: p.tagline || p.desc,
      tags: p.tags,
      web: p.web,
      repo: p.repo ? `https://github.com/${p.repo}` : undefined,
      broadcast: p.broadcast ?? { kind: 'component' as const, id: 'card' },
    }))
    .sort((a, b) => a.number - b.number);
}

export async function loadChannels(): Promise<Channel[]> {
  try {
    const r = await fetch('/api/content/projects');
    const p = r.ok ? ((await r.json()) as ProjectC[]) : null;
    if (Array.isArray(p) && p.length) return toChannels(p);
  } catch {}
  return toChannels(DEFAULT_PROJECTS);
}
