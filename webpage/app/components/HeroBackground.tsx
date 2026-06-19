'use client';

import { useRef, useEffect, useState } from 'react';

const GLYPHS = [' ', ' ', '.', '·', ':', '-', '=', '+', '/', '\\', '|', '*', '#'];
const CELL = 12;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [showWave, setShowWave] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const animFrameRef = useRef<number>();
  const timeRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Check for prefers-reduced-motion
  const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // Flow field function
  const field = (x: number, y: number, t: number): number => {
    return (
      Math.sin(x * 0.16 + t * 0.55) +
      Math.sin(y * 0.21 - t * 0.4) +
      Math.sin((x + y) * 0.085 + t * 0.32) +
      Math.sin((x - y) * 0.11 - t * 0.48)
    );
  };

  // Draw function for canvas
  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = field(i * 0.5, j * 0.5, timeRef.current);
        const n = (v + 4) / 8; // normalize to 0..1

        if (n < 0.34) continue; // dark cells = empty

        const gi = Math.min(GLYPHS.length - 1, Math.floor(n * GLYPHS.length));
        const ch = GLYPHS[gi];

        if (ch === ' ') continue;

        const a = 0.16 + n * 0.5; // subtle alpha
        ctx.fillStyle = `rgba(245, 245, 250, ${a.toFixed(3)})`;
        ctx.fillText(ch, i * CELL, j * CELL);
      }
    }

    timeRef.current += 0.016;
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setIsAnimating(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const hero = document.querySelector('.hero') as HTMLElement;

    // Initial resize
    const doResize = () => {
      if (!hero) return;
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const monoFont = getComputedStyle(document.body).getPropertyValue('--mono') || "'JetBrains Mono', monospace";
      ctx.font = `12px ${monoFont}`;
      ctx.textBaseline = 'top';
    };

    doResize();

    // Animation loop
    const animate = () => {
      if (isAnimating) {
        draw(ctx, canvas);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Intersection Observer to pause when out of viewport
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsAnimating(entry.isIntersecting);
        });
      },
      { threshold: 0 }
    );

    if (hero) {
      observerRef.current.observe(hero);
    }

    // Handle resize
    const handleResize = () => doResize();
    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Crossfade every 8 seconds
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const interval = setInterval(() => {
      setShowWave((prev) => !prev);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Apply opacity based on showWave state
  useEffect(() => {
    if (glowRef.current && canvasRef.current) {
      glowRef.current.style.opacity = showWave ? '0' : '1';
      canvasRef.current.style.opacity = showWave ? '1' : '0';
    }
  }, [showWave]);

  return (
    <>
      <div className="bg bgGlow" id="glow" ref={glowRef}>
        <div className="orb orb1"></div>
        <div className="orb orb2"></div>
      </div>
      <canvas className="bg" id="wave" ref={canvasRef}></canvas>
      <div className="veil"></div>
    </>
  );
}
