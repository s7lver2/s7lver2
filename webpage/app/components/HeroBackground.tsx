'use client';

import { useRef, useEffect } from 'react';

const GLYPHS = [' ', ' ', '.', '·', ':', '-', '=', '+', '/', '\\', '|', '*', '#'];
const CELL = 12;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const timeRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Visibility as a ref, not state: the rAF loop reads it directly, so
  // toggling it never re-runs the setup effect below (which would tear down
  // and re-add the mousemove/resize listeners — the previous version used
  // state here, and that teardown/rebuild is what made the pointer tracking
  // occasionally "stop working" for a moment).
  const isAnimatingRef = useRef(true);
  // Raw client coordinates, updated on every mousemove with NO layout read —
  // getBoundingClientRect() used to run inside the mousemove handler itself,
  // which fires far more often than the 60fps draw loop and forced a
  // synchronous reflow on every single event. The canvas-relative offset is
  // now computed once per animation frame in draw() instead. Starts far
  // off-canvas so nothing avoids by default — matters for touch devices,
  // which never fire mousemove at all.
  const mouseClientRef = useRef({ x: -9999, y: -9999 });
  // Cached once per frame in draw(), not per mousemove.
  const rectRef = useRef({ left: 0, top: 0 });

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

    // Canvas-relative mouse position, computed once for this frame.
    const rect = rectRef.current;
    const mouse = {
      x: mouseClientRef.current.x - rect.left,
      y: mouseClientRef.current.y - rect.top,
    };
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
      const r = canvas.getBoundingClientRect();
      rectRef.current = { left: r.left, top: r.top };
    };

    doResize();

    // Reduced motion: draw one static frame and stop.
    if (prefersReducedMotion()) {
      isAnimatingRef.current = false;
      draw(ctx, canvas);
      const onResizeStatic = () => { doResize(); draw(ctx, canvas); };
      window.addEventListener('resize', onResizeStatic);
      return () => window.removeEventListener('resize', onResizeStatic);
    }

    let alive = true;
    const animate = () => {
      if (!alive) return;
      if (isAnimatingRef.current) draw(ctx, canvas);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => { isAnimatingRef.current = e.isIntersecting; }),
      { threshold: 0 }
    );
    if (hero) observerRef.current.observe(hero);

    // Re-cache the rect on resize AND on scroll — the hero's position
    // relative to the viewport changes as the page scrolls, and a stale
    // rect is exactly what made the avoidance effect track the mouse
    // incorrectly (or not at all) after scrolling.
    const handleResize = () => doResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, { passive: true });

    // Glyph-avoidance: mousemove only stores raw client coordinates (no
    // layout read here — that used to call getBoundingClientRect() on every
    // single mousemove event, which fires far more often than this loop's
    // 60fps and forced a synchronous reflow each time, which is what made
    // the effect feel choppy). The canvas-relative offset is computed once
    // per frame in draw() using the cached rect above. Skipped entirely
    // under reduced motion above; here it's a no-op until a real mousemove
    // fires, so touch devices never trigger it.
    const handleMouseMove = (e: MouseEvent) => {
      mouseClientRef.current.x = e.clientX;
      mouseClientRef.current.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseClientRef.current.x = -9999;
      mouseClientRef.current.y = -9999;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    animate();

    return () => {
      alive = false;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <>
      <canvas className="bg" id="wave" ref={canvasRef}></canvas>
      <div className="veil"></div>
    </>
  );
}
