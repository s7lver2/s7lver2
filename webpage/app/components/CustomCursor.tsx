'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, summary, [onclick], [data-cursor-interactive]';

/**
 * Custom teal dot cursor for the public site — a small, bare dot (no ring,
 * no border) rather than the mockup's ring/crosshair alternatives, after
 * feedback that even the ring read as too much. Uses the same self-colored
 * teal (#5eead4) already on .prail-fill / active nav states elsewhere in
 * globals.css.
 *
 * Position AND hover-scale both live in one transform string written every
 * frame (translate3d, never top/left, so it never triggers layout) — a
 * separate CSS transform rule for the hover scale would never win against
 * that inline write, so it has to happen here, not in globals.css.
 * Disabled outright on coarse/touch pointers (no mouse to track); the
 * hover-scale step is skipped under prefers-reduced-motion.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const pos = useRef({ x: -9999, y: -9999 });
  const hoveringRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = dotRef.current;
    if (!el) return;

    document.documentElement.classList.add('custom-cursor-active');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      const scale = !reduced && hoveringRef.current ? 1.6 : 1;
      el.style.transform =
        `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      rafRef.current = requestAnimationFrame(render);
    };

    const handleMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (el.style.opacity !== '1') el.style.opacity = '1';
      const target = e.target as Element | null;
      const nowHovering = !!target?.closest(INTERACTIVE_SELECTOR);
      if (nowHovering !== hoveringRef.current) {
        hoveringRef.current = nowHovering;
        el.classList.toggle('is-hovering', nowHovering);
      }
    };

    const handleLeave = () => {
      el.style.opacity = '0';
    };

    window.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    rafRef.current = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <div ref={dotRef} className="custom-cursor" aria-hidden="true" />;
}
