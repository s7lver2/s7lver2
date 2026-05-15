'use client';
import React from 'react';

interface PlanetAtmosphereProps {
  /** RGB del color de acento, igual que WireframePlanet */
  rgb: [number, number, number];
  /** Intensidad del halo. 0-1. Default: 0.55 */
  intensity?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Envuelve un WireframePlanet y añade:
 *  - Una nebulosa difusa en el color del planeta (mix-blend-mode: screen)
 *  - Un halo interior concentrado (corona)
 *  - Un limb glow exterior suave
 *
 * El wireframe interior sigue visible; la capa solo colorea/ilumina.
 *
 * Uso:
 *   <PlanetAtmosphere rgb={[251, 146, 60]}>
 *     <WireframePlanet rgb={[251, 146, 60]} ... />
 *   </PlanetAtmosphere>
 */
export default function PlanetAtmosphere({
  rgb,
  intensity = 0.55,
  children,
  className = '',
  style = {},
}: PlanetAtmosphereProps) {
  const [r, g, b] = rgb;
  const i = Math.max(0, Math.min(1, intensity));

  return (
    <div
      className={`relative ${className}`}
      style={{ position: 'relative', ...style }}
    >
      {/* El planeta wireframe */}
      {children}

      {/*
        Capa 1 — Nebulosa difusa exterior
        mix-blend-mode: screen: solo suma luz, no tapa el wireframe
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-18%',
          borderRadius: '50%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: `radial-gradient(
            ellipse 70% 70% at 50% 50%,
            rgba(${r},${g},${b},${(i * 0.18).toFixed(3)}) 0%,
            rgba(${r},${g},${b},${(i * 0.09).toFixed(3)}) 40%,
            rgba(${r},${g},${b},0) 70%
          )`,
        }}
      />

      {/*
        Capa 2 — Corona interna (anillo justo en el borde del planeta)
        Simula la atmósfera de borde tipo limb
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: `radial-gradient(
            ellipse 100% 100% at 50% 50%,
            transparent 52%,
            rgba(${r},${g},${b},${(i * 0.32).toFixed(3)}) 68%,
            rgba(${r},${g},${b},${(i * 0.14).toFixed(3)}) 82%,
            transparent 95%
          )`,
        }}
      />

      {/*
        Capa 3 — Tinte interior difuso (colorea los filamentos del wireframe)
        Intensidad baja para que el wireframe mantenga su estructura
      */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: `radial-gradient(
            ellipse 60% 60% at 50% 45%,
            rgba(${r},${g},${b},${(i * 0.1).toFixed(3)}) 0%,
            rgba(${r},${g},${b},0) 75%
          )`,
        }}
      />
    </div>
  );
}