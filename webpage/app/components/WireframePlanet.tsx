'use client';
import { useEffect, useRef } from 'react';

interface WireframePlanetProps {
  /** Color base en formato R, G, B — e.g. [237, 237, 237] para blanco */
  rgb?: [number, number, number];
  /** Velocidad de rotación en radianes/frame. Default: 0.0014 */
  speed?: number;
  /** Inclinación del eje en radianes. Default: 0.28 */
  tilt?: number;
  /** Clases extra para el contenedor div */
  className?: string;
  style?: React.CSSProperties;
}

export default function WireframePlanet({
  rgb = [237, 237, 237],
  speed = 0.0014,
  tilt = 0.28,
  className = '',
  style = {},
}: WireframePlanetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    let raf: number;
    let angle = 0;
    const [r, g, b] = rgb;

    const setup = () => {
      const parent = canvas.parentElement;
      const w = parent?.offsetWidth  ?? 400;
      const h = parent?.offsetHeight ?? 400;
      const s = Math.min(w, h) * 0.92;
      sizeRef.current = s;
      canvas.style.width  = `${s}px`;
      canvas.style.height = `${s}px`;
      canvas.width  = Math.round(s * dpr);
      canvas.height = Math.round(s * dpr);
      ctx.scale(dpr, dpr);
    };

    setup();
    window.addEventListener('resize', setup);

    const LAT = 20;
    const LON = 28;

    function project(px: number, py: number, pz: number, rot: number) {
      const cosA = Math.cos(rot), sinA = Math.sin(rot);
      const rx = px * cosA - pz * sinA;
      const rz = px * sinA + pz * cosA;
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const ry2 = py * cosT - rz * sinT;
      const rz2 = py * sinT + rz * cosT;
      return { x: rx, y: ry2, z: rz2 };
    }

    function draw() {
      const s  = sizeRef.current;
      if (s === 0) { raf = requestAnimationFrame(draw); return; }
      const cx = s / 2, cy = s / 2;
      const R  = s * 0.43;

      ctx.clearRect(0, 0, s, s);

      // Outer glow
      for (let i = 4; i >= 1; i--) {
        const gr = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (1 + i * 0.07));
        gr.addColorStop(0,   `rgba(${r},${g},${b},0)`);
        gr.addColorStop(0.5, `rgba(${r},${g},${b},${0.012 * i})`);
        gr.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1 + i * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }

      // Clip sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // Latitude lines
      for (let i = 0; i <= LAT; i++) {
        const phi = (Math.PI * i) / LAT;
        ctx.beginPath();
        let moved = false;
        for (let j = 0; j <= LON * 2; j++) {
          const theta = (2 * Math.PI * j) / (LON * 2);
          const p = project(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta),
            angle
          );
          const alpha = Math.max(0, (p.z + 0.55) / 1.55) * 0.65;
          if (!moved) {
            ctx.moveTo(cx + p.x * R, cy - p.y * R);
            moved = true;
          } else {
            ctx.lineTo(cx + p.x * R, cy - p.y * R);
          }
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        }
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }

      // Longitude lines
      for (let j = 0; j < LON; j++) {
        const theta = (2 * Math.PI * j) / LON;
        ctx.beginPath();
        let moved = false;
        for (let i = 0; i <= LAT * 2; i++) {
          const phi = (Math.PI * i) / (LAT * 2);
          const p = project(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta),
            angle
          );
          const alpha = Math.max(0, (p.z + 0.55) / 1.55) * 0.65;
          if (!moved) {
            ctx.moveTo(cx + p.x * R, cy - p.y * R);
            moved = true;
          } else {
            ctx.lineTo(cx + p.x * R, cy - p.y * R);
          }
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        }
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }

      // Intersection nodes
      for (let i = 0; i <= LAT; i += 2) {
        for (let j = 0; j < LON; j += 2) {
          const phi   = (Math.PI * i) / LAT;
          const theta = (2 * Math.PI * j) / LON;
          const p = project(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta),
            angle
          );
          if (p.z < 0) continue;
          const alpha = Math.min(1, (p.z + 0.3) / 1.3) * 0.95;
          ctx.beginPath();
          ctx.arc(cx + p.x * R, cy - p.y * R, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      ctx.restore();

      // Limb highlight
      const limb = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
      limb.addColorStop(0,   `rgba(${r},${g},${b},0)`);
      limb.addColorStop(0.8, `rgba(${r},${g},${b},0)`);
      limb.addColorStop(1,   `rgba(${r},${g},${b},0.07)`);
      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Dark side terminator
      const dark = ctx.createRadialGradient(cx + R * 0.18, cy - R * 0.05, 0, cx - R * 0.1, cy + R * 0.1, R * 1.1);
      dark.addColorStop(0,    'rgba(10,10,10,0.0)');
      dark.addColorStop(0.48, 'rgba(10,10,10,0.0)');
      dark.addColorStop(1,    'rgba(10,10,10,0.76)');
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      angle += speed;
      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', setup);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative ${className}`} style={style}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}