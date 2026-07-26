'use client';

import type { Renderer } from '../components/charts/types';

// Stub for Task 8/9 — replaced with the real implementation in Task 10.
export function usePrefs() {
  return {
    renderer: 'dots' as Renderer,
    setRenderer: async (_r: Renderer) => {},
    notify: (_m: string) => {},
  };
}
