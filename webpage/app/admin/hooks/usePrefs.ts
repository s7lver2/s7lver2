'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Renderer } from '../components/charts/types';

let toastFn: ((m: string) => void) | null = null;
/** Set once by the layout's toast host, so any chart can raise a message. */
export function registerToast(fn: (m: string) => void) { toastFn = fn; }

export function usePrefs() {
  const [renderer, setR] = useState<Renderer>('dots');

  useEffect(() => {
    fetch('/api/admin/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.renderer) setR(d.renderer as Renderer); })
      .catch(() => { /* the default stands */ });
  }, []);

  const setRenderer = useCallback(async (r: Renderer) => {
    setR(r); // optimistic: the redraw should be instant
    await fetch('/api/admin/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renderer: r }),
    });
  }, []);

  const notify = useCallback((m: string) => { toastFn?.(m); }, []);

  return { renderer, setRenderer, notify };
}
