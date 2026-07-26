'use client';

import { useEffect, useRef } from 'react';

/**
 * Translate a decorative layer at a fraction of scroll speed.
 *
 * Transform-only (GPU, no layout), rAF-throttled, and it never intercepts or
 * blocks scrolling — no pinning, no wheel handlers, no scroll-linked timelines.
 * Fully disabled under prefers-reduced-motion.
 */
export function useParallax(factor: number) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (el) el.style.transform = `translate3d(0, ${window.scrollY * factor}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    tick();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [factor]);

  return ref;
}
