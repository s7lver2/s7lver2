'use client';

import { useEffect, useRef } from 'react';

/**
 * Subtle, non-pinning section transition: as a section's center passes the
 * viewport's center, it fades/blurs slightly toward the edges. Real
 * position:sticky pinning was tried for the hero->skills handoff and
 * reverted — it broke normal window scrolling on this site (see the note
 * above .amp-fade in globals.css for the exact mechanism). Every section
 * boundary now uses this same transition, deliberately tuned subtle per
 * explicit feedback rather than the first, much stronger pass (see
 * .superpowers/brainstorm/1177-1785110170/content/subtle-and-cursor.html
 * for the approved feel).
 *
 * Purely passive: reads scroll position (passive listener, never
 * preventDefault) and rAF-throttles writes of opacity/filter
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

      // Tuned down from the first pass (opacity floor was 0, blur up to
      // 14px, scale down to .86) after explicit feedback that it read as
      // too strong — this should be felt, not seen.
      const opacity = Math.max(0.75, 1 - abs * 0.25);
      const scale = 1;
      const blur = abs * 3;

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
