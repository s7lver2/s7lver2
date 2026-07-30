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
 * Position tracks the real pointer 1:1, every frame, with zero easing — an
 * earlier version lerped the displayed position toward the target (0.35 per
 * frame), meant to read as a soft trail. In practice it read as latency: the
 * hero's mouse-avoidance canvas reacts to the raw pointer instantly, so the
 * lagging dot visibly fell behind the ASCII field it was supposed to be
 * causing, looking broken rather than smooth. The hover pop is still
 * animated, but as a CSS transition on `scale` (declared once in
 * globals.css), decoupled from the position write.
 * Disabled outright on coarse/touch pointers (no mouse to track).
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const target = useRef({ x: -9999, y: -9999 });
  const hoveringRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const el = dotRef.current;
    if (!el) return;

    document.documentElement.classList.add('custom-cursor-active');

    const render = () => {
      el.style.transform =
        `translate3d(${target.current.x}px, ${target.current.y}px, 0) translate(-50%, -50%)`;
      rafRef.current = requestAnimationFrame(render);
    };

    const handleMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (el.style.opacity !== '1') el.style.opacity = '1';
      const targetEl = e.target as Element | null;
      const nowHovering = !!targetEl?.closest(INTERACTIVE_SELECTOR);
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
