'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, summary, [onclick], [data-cursor-interactive]';

/**
 * Custom teal ring cursor for the public site. Picked over the mockup's
 * crosshair/dot alternatives because it echoes what's already on the page:
 * a thin, self-colored teal (#5eead4) stroke — the same treatment used on
 * .prail-fill / active nav states / focus carets elsewhere in globals.css —
 * rather than a hard crosshair or a glowing dot, neither of which has any
 * precedent in this UI language.
 *
 * Position is driven purely by transform (translate3d), never top/left, so
 * it never triggers layout. Disabled outright on coarse/touch pointers
 * (no mouse to track) and its own hover-scale transition is gated behind
 * prefers-reduced-motion; the 1:1 follow itself is not treated as "motion"
 * since it carries no independent animation, same as a native cursor.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const pos = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = dotRef.current;
    if (!el) return;

    document.documentElement.classList.add('custom-cursor-active');

    let hovering = false;

    const render = () => {
      // Position only, never top/left — keeps this off the layout pass.
      el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      rafRef.current = requestAnimationFrame(render);
    };

    const handleMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (el.style.opacity !== '1') el.style.opacity = '1';
      const target = e.target as Element | null;
      const nowHovering = !!target?.closest(INTERACTIVE_SELECTOR);
      if (nowHovering !== hovering) {
        hovering = nowHovering;
        el.classList.toggle('is-hovering', hovering);
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
