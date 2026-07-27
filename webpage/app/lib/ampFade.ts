'use client';

import { useEffect, useRef } from 'react';

/**
 * Softer, non-pinning section transition: as a section's center passes the
 * viewport's center, it fades/blurs/scales down toward the edges. This is
 * the "amplified cross-fade" alternative demoed alongside real pinning
 * (see .superpowers/brainstorm/1177-1785110170/content/scroll-transitions-v3.html,
 * mode 'amplified') and chosen for every section boundary EXCEPT the
 * hero->skills handoff, which uses real position:sticky pinning instead
 * (see .pin-sec in globals.css) — chaining pinned sections back to back was
 * explicitly rejected because several could end up visually stacked at once
 * while scrolling through a run of them.
 *
 * Purely passive: reads scroll position (passive listener, never
 * preventDefault) and rAF-throttles writes of opacity/filter/transform
 * (transform+opacity+filter only — no layout properties). Never touches
 * scrollTop. No-ops entirely under prefers-reduced-motion or at narrow
 * (<=900px) viewports, matching the site's existing parallax/.prail
 * breakpoint convention.
 */
export function useAmpFade<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 900px)').matches) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const progress = (center - vh / 2) / (vh / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      const abs = Math.abs(clamped);

      const opacity = Math.max(0, 1 - Math.min(1, abs * 2.2));
      const scale = 1 - abs * 0.14;
      const blur = abs * 14;

      el.style.opacity = String(opacity);
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none';
      el.style.transform = `scale(${scale.toFixed(4)})`;
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
