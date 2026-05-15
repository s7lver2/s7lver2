'use client';
import { useEffect, useRef, useState } from 'react';

interface SpaceWarpProps {
  /** Etiqueta de destino que aparece durante el viaje (ej: "→ projects.work") */
  destination?: string;
  /** Color de acento de la sección de destino en formato [r,g,b] */
  accentRgb?: [number, number, number];
}

export default function SpaceWarp({
  destination,
  accentRgb = [237, 237, 237],
}: SpaceWarpProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [r, g, b]  = accentRgb;

  // Progreso de scroll dentro de esta sección (0 = entrando, 1 = saliendo)
  const progressRef = useRef(0);
  const [labelVisible, setLabelVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas  = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    let raf: number;

    // ── Generar rayas de warp
    const RAY_COUNT = 180;
    type Ray = { angle: number; len: number; speed: number; dist: number; opacity: number };
    const rays: Ray[] = Array.from({ length: RAY_COUNT }, () => ({
      angle:   Math.random() * Math.PI * 2,
      len:     Math.random() * 0.14 + 0.04,
      speed:   Math.random() * 0.006 + 0.003,
      dist:    Math.random(),
      opacity: Math.random() * 0.7 + 0.3,
    }));

    const resize = () => {
      canvas.width  = Math.round(canvas.offsetWidth  * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      ctx.scale(dpr, dpr);
    };

    const onScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh   = window.innerHeight;
      // progress: 0 cuando la parte superior de la sección está en el fondo del viewport
      //           1 cuando la parte inferior de la sección está en la parte superior del viewport
      const raw  = 1 - (rect.bottom / (vh + rect.height));
      progressRef.current = Math.max(0, Math.min(1, raw));
      setLabelVisible(progressRef.current > 0.2 && progressRef.current < 0.8);
    };

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const p = progressRef.current;

      ctx.clearRect(0, 0, W, H);

      // Gradiente radial de fondo
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0,   `rgba(${r},${g},${b},${(p * 0.04).toFixed(3)})`);
      bg.addColorStop(0.5, 'rgba(5,5,8,0)');
      bg.addColorStop(1,   'rgba(5,5,8,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Rayas de warp — escalan su longitud con el progreso de scroll
      const cx = W / 2, cy = H / 2;
      const warpIntensity = Math.pow(p * 2 - 1, 2); // pico en 0 y 1, mínimo en 0.5

      for (const ray of rays) {
        // Las rayas avanzan continuamente
        ray.dist = (ray.dist + ray.speed * (warpIntensity * 3 + 0.2)) % 1;

        const near = ray.dist;
        const far  = Math.min(1, ray.dist + ray.len * (1 + warpIntensity * 4));

        const x1 = cx + Math.cos(ray.angle) * near * (W * 0.55);
        const y1 = cy + Math.sin(ray.angle) * near * (H * 0.55);
        const x2 = cx + Math.cos(ray.angle) * far  * (W * 0.55);
        const y2 = cy + Math.sin(ray.angle) * far  * (H * 0.55);

        const alpha = ray.opacity * warpIntensity * 0.9;
        if (alpha < 0.01) continue;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(3)})`);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(0.4, near * 1.6);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [r, g, b]);

  return (
    <div
      ref={sectionRef}
      style={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Canvas de warp */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Etiqueta de destino */}
      {destination && (
        <div
          style={{
            position: 'relative', zIndex: 2,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: `rgba(${r},${g},${b},0.7)`,
            opacity: labelVisible ? 1 : 0,
            transform: labelVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            pointerEvents: 'none',
          }}
        >
          {destination}
        </div>
      )}

      {/* Fade suave en top/bottom para no cortar bruscamente con las secciones */}
      <div aria-hidden style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(to bottom, var(--surface), transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(to top, var(--surface), transparent)',
        pointerEvents: 'none', zIndex: 1,
      }} />
    </div>
  );
}