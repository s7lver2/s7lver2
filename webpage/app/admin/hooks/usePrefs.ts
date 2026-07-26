'use client';

// Stub for Task 8/9 — replaced with the real implementation in Task 10.
export function usePrefs() {
  return {
    renderer: 'dots' as const,
    setRenderer: async (_r: 'dots' | 'braille' | 'svg') => {},
    notify: (_m: string) => {},
  };
}
