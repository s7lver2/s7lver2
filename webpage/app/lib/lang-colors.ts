// Single source of truth for language colours. Imported by both the GitHub
// Activity section and the projects graph — do not duplicate this map.
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Go: '#00add8',
  Python: '#3572A5',
  C: '#6b6b78',
  'C++': '#f34b7d',
  Shell: '#89e051',
  Makefile: '#427819',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Nix: '#7e7eff',
  Dockerfile: '#384d54',
  Lua: '#000080',
  Vim: '#199f4b',
  'Vim Script': '#199f4b',
  Assembly: '#6E4C13',
};

export const FALLBACK_LANG_COLOR = '#a371f7';

export function colorFor(name: string): string {
  return LANG_COLORS[name] || FALLBACK_LANG_COLOR;
}
