'use client';
import { useEffect, useState } from 'react';

/** El rótulo de la cámara de seguridad: el mismo sitio y la misma letra en el virus y en la sala. */
export default function CctvHud({ cam }: { cam: number }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const s = () => setTime(new Date().toLocaleTimeString('en-GB'));
    s();
    const id = setInterval(s, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="cctv-hud" aria-hidden="true">
      <span className="cctv-hud__cam">CAM {String(cam).padStart(2, '0')}</span>
      <span className="cctv-hud__rec">
        <i /> REC {time}
      </span>
    </div>
  );
}
