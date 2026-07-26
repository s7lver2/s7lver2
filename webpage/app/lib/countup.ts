'use client';

import { useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION = 900;

/**
 * Animate a number from 0 to `target` the first time the element enters the
 * viewport. Returns the ref to attach and the value to render.
 */
export function useCountUp(target: number, durationMs: number = DEFAULT_DURATION) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!Number.isFinite(target) || target === 0) {
      setValue(target || 0);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    // Re-animate when the target changes (data arrives after mount).
    doneRef.current = false;
    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !doneRef.current) {
          doneRef.current = true;
          raf = requestAnimationFrame(tick);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => {
      observer.unobserve(node);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, durationMs]);

  return { ref, value };
}
