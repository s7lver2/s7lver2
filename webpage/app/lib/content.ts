import { kvGetJSON, kvSetJSON } from './redis';
import {
  DEFAULT_PROJECTS,
  DEFAULT_SKILLS,
  DEFAULT_SOCIALS,
  DEFAULT_HOME,
} from './content-constants';
import { DEFAULT_FEATURED, type FeaturedRepo } from './featured';

// Re-export types and constants from content-constants for compatibility
export {
  type ConceptKey,
  type ProjectC,
  type SkillC,
  type SocialC,
  type HomeC,
  DEFAULT_PROJECTS,
  DEFAULT_SKILLS,
  DEFAULT_SOCIALS,
  DEFAULT_HOME,
} from './content-constants';
export { DEFAULT_FEATURED, type FeaturedRepo } from './featured';

export type ContentType = 'projects' | 'skills' | 'socials' | 'home' | 'featured';

const DEFAULTS: Record<ContentType, unknown> = {
  projects: DEFAULT_PROJECTS, skills: DEFAULT_SKILLS, socials: DEFAULT_SOCIALS,
  home: DEFAULT_HOME, featured: DEFAULT_FEATURED,
};

export function isContentType(t: string): t is ContentType {
  return t === 'projects' || t === 'skills' || t === 'socials'
    || t === 'home' || t === 'featured';
}

export async function getContent<T = unknown>(type: ContentType): Promise<T> {
  return kvGetJSON<T>(`content:${type}`, `content-${type}.json`, DEFAULTS[type] as T);
}
export async function setContent<T = unknown>(type: ContentType, value: T): Promise<void> {
  await kvSetJSON(`content:${type}`, `content-${type}.json`, value);
}
