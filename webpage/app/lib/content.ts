import { kvGetJSON, kvSetJSON } from './redis';

export type ConceptKey = 'web' | 'net' | 'recon' | 'ad' | 'rev' | 'crypto';

export interface ProjectC {
  slug: string; name: string; desc: string;
  status: 'done' | 'beta' | 'dev'; ac: string;
  tags: string[]; web?: string; shot?: string;
}
export interface SkillC {
  name: string; value: number; color: string; tools: string; conceptKey: ConceptKey;
}
export interface SocialC {
  k: string; v: string; color: string; url: string; initials: string;
}
export interface HomeC { heroTitle: string; heroSubtitle: string; }

export type ContentType = 'projects' | 'skills' | 'socials' | 'home';

export const DEFAULT_PROJECTS: ProjectC[] = [
  { slug: 'file-meet', name: 'file-meet', desc: 'P2P file sharing CLI in Go. Zero config, end-to-end encrypted transfers.', status: 'done', ac: '#00add8', tags: ['Go', 'WebRTC', 'CLI'], web: 'https://github.com/s7lver2/file-meet', shot: '/projects/file-meet.png' },
  { slug: 'ZephyrOS', name: 'ZephyrOS', desc: 'Minimal security-focused Linux distro for old systems and edge computing.', status: 'beta', ac: '#a3e635', tags: ['Linux', 'Bash', 'Arch'], web: 'https://github.com/s7lver2/ZephyrOS', shot: '/projects/ZephyrOS.png' },
  { slug: 'tsuki', name: 'tsuki', desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.', status: 'dev', ac: '#dea584', tags: ['Rust', 'LLVM', 'Embedded'] },
  { slug: 'CodeDotJS', name: 'CodeDotJS', desc: 'Reactive JS framework, no vDOM, <5kb.', status: 'dev', ac: '#3178c6', tags: ['TypeScript', 'Vite'], web: 'https://CodeDotjs.vercel.app', shot: '/projects/CodeDotJS.png' },
];

export const DEFAULT_SKILLS: SkillC[] = [
  { name: 'Web Exploit', value: 0.92, color: '#f87171', tools: 'Burp · SQLMap · Wfuzz', conceptKey: 'web' },
  { name: 'Network',     value: 0.85, color: '#22d3ee', tools: 'Nmap · Wireshark · tcpdump', conceptKey: 'net' },
  { name: 'Recon',       value: 0.80, color: '#a3e635', tools: 'Amass · Subfinder · OSINT', conceptKey: 'recon' },
  { name: 'Active Dir',  value: 0.75, color: '#8b5cf6', tools: 'BloodHound · Impacket', conceptKey: 'ad' },
  { name: 'Reversing',   value: 0.68, color: '#f472b6', tools: 'Ghidra · gdb · radare2', conceptKey: 'rev' },
  { name: 'Crypto',      value: 0.60, color: '#fde047', tools: 'hashcat · John', conceptKey: 'crypto' },
];

export const DEFAULT_SOCIALS: SocialC[] = [
  { k: 'github', v: 'github.com/s7lver2', color: '#6e5494', url: 'https://github.com/s7lver2', initials: 'GH' },
  { k: 'discord', v: '@s7lver', color: '#5865f2', url: '#', initials: 'DC' },
  { k: 'twitter', v: 'x.com/s7lver', color: '#1d9bf0', url: 'https://x.com/s7lver', initials: 'X' },
  { k: 'tiktok', v: '@s7lver', color: '#ff0050', url: '#', initials: 'TT' },
  { k: 'instagram', v: '@s7lver', color: '#e1306c', url: '#', initials: 'IG' },
  { k: 'htb', v: 'app.hackthebox.com/s7lver', color: '#9fef00', url: '#', initials: 'HTB' },
];

export const DEFAULT_HOME: HomeC = {
  heroTitle: "Hi, I'm s7lver",
  heroSubtitle: 'Developer & Cybersecurity Student',
};

const DEFAULTS: Record<ContentType, unknown> = {
  projects: DEFAULT_PROJECTS, skills: DEFAULT_SKILLS, socials: DEFAULT_SOCIALS, home: DEFAULT_HOME,
};

export function isContentType(t: string): t is ContentType {
  return t === 'projects' || t === 'skills' || t === 'socials' || t === 'home';
}

export async function getContent<T = unknown>(type: ContentType): Promise<T> {
  return kvGetJSON<T>(`content:${type}`, `content-${type}.json`, DEFAULTS[type] as T);
}
export async function setContent<T = unknown>(type: ContentType, value: T): Promise<void> {
  await kvSetJSON(`content:${type}`, `content-${type}.json`, value);
}
