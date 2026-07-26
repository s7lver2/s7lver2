// Extension -> language. The keys are the allowlist: anything not here is not
// code and is excluded from the count. Fails closed by design.
const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.go': 'Go',
  '.py': 'Python',
  '.rs': 'Rust',
  '.c': 'C', '.h': 'C',
  '.cpp': 'C++', '.cc': 'C++', '.hpp': 'C++',
  '.cs': 'C#', '.java': 'Java', '.kt': 'Kotlin', '.swift': 'Swift',
  '.rb': 'Ruby', '.php': 'PHP',
  '.sh': 'Shell', '.bash': 'Shell',
  '.ps1': 'PowerShell',
  '.lua': 'Lua', '.sql': 'SQL',
  '.css': 'CSS', '.scss': 'CSS', '.less': 'CSS',
  '.html': 'HTML', '.vue': 'HTML', '.svelte': 'HTML', '.astro': 'HTML',
  '.qml': 'QML',
  '.wgsl': 'Shader', '.glsl': 'Shader',
  '.nix': 'Nix',
  '.cmake': 'Makefile', Makefile: 'Makefile',
  Dockerfile: 'Dockerfile',
};

/** Language for a ghloc key, or null when the key is not code. */
export function langForExt(key: string): string | null {
  return EXT_LANG[key] ?? null;
}

/**
 * Passed to ghloc so it skips heavy directories before counting — this both
 * removes junk and makes the request materially faster.
 */
export const GHLOC_FILTER =
  'package-lock.json,yarn.lock,pnpm-lock.yaml,poetry.lock,node_modules,dist,build,vendor,.next,target';

/**
 * Bytes-per-line divisors for the fallback estimate, measured per language.
 * Only used when ghloc is unreachable and there is no cache.
 */
export const BYTES_PER_LINE: Record<string, number> = {
  Python: 30, CSS: 25, TypeScript: 35, Rust: 32, Go: 28,
};
export const DEFAULT_BYTES_PER_LINE = 34;
