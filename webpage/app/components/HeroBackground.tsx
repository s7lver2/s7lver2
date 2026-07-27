'use client';

import { useRef, useEffect, useState } from 'react';

const GLYPHS = [' ', ' ', '.', '·', ':', '-', '=', '+', '/', '\\', '|', '*', '#'];
const CELL = 12;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const animFrameRef = useRef<number>();
  const timeRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Mouse position in the same CSS-pixel space the draw loop uses. Kept in a
  // ref (never React state) so pointer movement never triggers a re-render
  // inside this rAF loop. Starts far off-canvas so nothing avoids by default
  // — matters for touch devices, which never fire mousemove at all.
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const field = (x: number, y: number, t: number): number =>
    Math.sin(x * 0.16 + t * 0.55) +
    Math.sin(y * 0.21 - t * 0.4) +
    Math.sin((x + y) * 0.085 + t * 0.32) +
    Math.sin((x - y) * 0.11 - t * 0.48);

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);

    const mouse = mouseRef.current;
    const AVOID_R = 90;
    const AVOID_PUSH = 22;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = field(i * 0.5, j * 0.5, timeRef.current);
        const n = (v + 4) / 8;
        if (n < 0.34) continue;

        const gi = Math.min(GLYPHS.length - 1, Math.floor(n * GLYPHS.length));
        const ch = GLYPHS[gi];
        if (ch === ' ') continue;

        let px = i * CELL;
        let py = j * CELL;
        let avoid = 1;

        const cx = px + CELL / 2;
        const cy = py + CELL / 2;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < AVOID_R) {
          const push = 1 - dist / AVOID_R;
          const ang = Math.atan2(dy, dx);
          px += Math.cos(ang) * push * AVOID_PUSH;
          py += Math.sin(ang) * push * AVOID_PUSH;
          avoid = 1 - push * 0.85;
        }

        const a = (0.16 + n * 0.5) * Math.max(0.1, avoid);
        ctx.fillStyle = `rgba(245, 245, 250, ${a.toFixed(3)})`;
        ctx.fillText(ch, px, py);
      }
    }

    timeRef.current += 0.016;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const hero = document.querySelector('.hero') as HTMLElement | null;

    const doResize = () => {
      if (!hero) return;
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const monoFont =
        getComputedStyle(document.body).getPropertyValue('--mono') ||
        "'JetBrains Mono', monospace";
      ctx.font = `12px ${monoFont}`;
      ctx.textBaseline = 'top';
    };

    doResize();

    // Reduced motion: draw one static frame and stop.
    if (prefersReducedMotion()) {
      setIsAnimating(false);
      draw(ctx, canvas);
      const onResizeStatic = () => { doResize(); draw(ctx, canvas); };
      window.addEventListener('resize', onResizeStatic);
      return () => window.removeEventListener('resize', onResizeStatic);
    }

    let alive = true;
    const animate = () => {
      if (!alive) return;
      if (isAnimating) draw(ctx, canvas);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => setIsAnimating(e.isIntersecting)),
      { threshold: 0 }
    );
    if (hero) observerRef.current.observe(hero);

    const handleResize = () => doResize();
    window.addEventListener('resize', handleResize);

    // Glyph-avoidance: track the pointer in CSS-pixel canvas space (matches
    // the draw loop's coordinate system since ctx is already dpr-scaled).
    // Skipped entirely under reduced motion above; here it's a no-op until
    // a real mousemove fires, so touch devices never trigger it.
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    animate();

    return () => {
      alive = false;
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [isAnimating]);

  return (
    <>
      <canvas className="bg" id="wave" ref={canvasRef}></canvas>
      <div className="veil"></div>
    </>
  );
}
