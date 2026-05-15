'use client';
import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  parallaxFactor: number; // 0-1: 0=sin movimiento, 1=máximo parallax
}

/** Número de estrellas por capa */
const COUNTS = { dust: 280, medium: 90, bright: 22 };

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    let raf: number;
    let scrollY = 0;
    let t = 0;

    // ── Setup canvas
    const resize = () => {
      canvas.width  = Math.round(window.innerWidth  * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      buildStars();
    };

    let stars: Star[] = [];

    const buildStars = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      stars = [];

      // Polvo de fondo (sin parallax)
      for (let i = 0; i < COUNTS.dust; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * 0.7 + 0.2,
          opacity: Math.random() * 0.3 + 0.05,
          twinkleSpeed: Math.random() * 0.008 + 0.002,
          twinklePhase: Math.random() * Math.PI * 2,
          parallaxFactor: 0,
        });
      }

      // Estrellas medias (parallax leve)
      for (let i = 0; i < COUNTS.medium; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * 1.2 + 0.6,
          opacity: Math.random() * 0.45 + 0.15,
          twinkleSpeed: Math.random() * 0.012 + 0.003,
          twinklePhase: Math.random() * Math.PI * 2,
          parallaxFactor: Math.random() * 0.04,
        });
      }

      // Estrellas brillantes (parallax más marcado)
      for (let i = 0; i < COUNTS.bright; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * 1.8 + 1.2,
          opacity: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.018 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
          parallaxFactor: Math.random() * 0.08 + 0.02,
        });
      }
    };

    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      t += 0.016;

      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        const twinkle = Math.sin(t * s.twinkleSpeed * 60 + s.twinklePhase);
        const alpha = Math.max(0, s.opacity + twinkle * s.opacity * 0.4);
        const offsetY = -scrollY * s.parallaxFactor;
        // Wrap vertical para que las estrellas reaparezcan
        const drawY = ((s.y + offsetY) % H + H) % H;

        ctx.beginPath();
        ctx.arc(s.x, drawY, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fill();

        // Cruceta para estrellas brillantes (size > 2)
        if (s.size > 2) {
          const crossAlpha = alpha * 0.25;
          ctx.strokeStyle = `rgba(255,255,255,${crossAlpha.toFixed(3)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - s.size * 2.5, drawY);
          ctx.lineTo(s.x + s.size * 2.5, drawY);
          ctx.moveTo(s.x, drawY - s.size * 2.5);
          ctx.lineTo(s.x, drawY + s.size * 2.5);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 0,         // Detrás de todo el contenido
        pointerEvents: 'none',
        opacity: 1,
      }}
    />
  );
}