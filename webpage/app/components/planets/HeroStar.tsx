'use client';
import WireframePlanet from '@/components/WireframePlanet';
import PlanetAtmosphere from '@/components/PlanetAtmosphere';

export default function HeroStar() {
  const RGB: [number, number, number] = [237, 237, 237];

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: '-58%',            // 58% del planeta oculto por debajo del fold
      transform: 'translateX(-50%)',
      width: '78vw',
      maxWidth: 860,
      aspectRatio: '1',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {/*
        PlanetAtmosphere envuelve el wireframe y añade la capa nebulosa blanca.
        intensity baja (0.35) para que sea sutil en el hero.
      */}
      <PlanetAtmosphere
        rgb={RGB}
        intensity={0.35}
        style={{ width: '100%', height: '100%' }}
      >
        <WireframePlanet
          rgb={RGB}
          speed={0.0011}
          tilt={0.20}
          style={{ width: '100%', height: '100%' }}
        />
      </PlanetAtmosphere>

      {/*
        Fade radial integrador — elimina los bordes duros del planeta.
        Usa el mismo color que --surface para fundirse con el fondo oscuro.
      */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(
            ellipse 100% 100% at 50% 50%,
            transparent 28%,
            rgba(5,5,8,0.55) 60%,
            rgba(5,5,8,0.95) 78%
          )
        `,
      }} />

      {/* Fade vertical: el planeta se derrite hacia el bottom */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(5,5,8,1) 0%, transparent 45%)',
      }} />
    </div>
  );
}