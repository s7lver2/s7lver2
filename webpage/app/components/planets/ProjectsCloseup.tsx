'use client';
import { useEffect, useRef } from 'react';
import PlanetAtmosphere from '@/components/PlanetAtmosphere';
import WireframePlanet from '@/components/WireframePlanet';

const RGB: [number, number, number] = [251, 146, 60];

/**
 * Planeta de proyectos como primer plano total.
 * El planeta ocupa 200vw — solo la parte superior es visible,
 * creando el efecto de estar muy cerca de su superficie.
 */
export default function ProjectsCloseup() {
  return (
    <div style={{
      position: 'absolute',
      // Centrado horizontalmente
      left: '50%',
      // El planeta empieza en el 35% del viewport desde arriba
      // Solo se ve aprox. la mitad superior del planeta
      top: '35%',
      transform: 'translateX(-50%)',
      width: '200vw',
      aspectRatio: '1',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      <PlanetAtmosphere
        rgb={RGB}
        intensity={0.65}
        style={{ width: '100%', height: '100%' }}
      >
        <WireframePlanet
          rgb={RGB}
          speed={0.0008}          // muy lento — estás cerca, se mueve despacio
          tilt={0.15}
          style={{ width: '100%', height: '100%' }}
        />
      </PlanetAtmosphere>

      {/* Fade superior: el planeta emerge desde el interior de la sección */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '28%', pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(5,5,8,1), transparent)',
      }} />

      {/* Fade inferior (el planeta se pierde por abajo) */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '40%', pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(5,5,8,1), transparent)',
      }} />

      {/* Fade lateral izquierdo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 44%, rgba(5,5,8,0.88) 72%)',
      }} />
    </div>
  );
}