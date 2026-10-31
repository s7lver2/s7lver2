'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onUnlock, type Achievement } from './achievements';
import { paintGrid, ICONS } from './pc/pixels';

/*
 * El aviso de logro: una ventanita de ONI//OS en la esquina de abajo, con el pitido del ordenador.
 * Uno detrás de otro; con la pantalla de carga delante, esperan a que se vaya.
 */

const SHOW = 4000;
let ctx: AudioContext | undefined;

// dos notas en onda cuadrada, como los pitidos del ordenador; sin un gesto antes, no suena
function beep() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.04, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.12);
      o.connect(g).connect(ctx!.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.14);
    });
  } catch {}
}

export default function Toast() {
  const [now, setNow] = useState<Achievement | null>(null);
  const queue = useRef<Achievement[]>([]);
  const icon = useRef<HTMLCanvasElement>(null);
  // el portal va al body: solo en el cliente
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);

  useEffect(() => {
    let id = 0;
    const next = () => {
      if (document.documentElement.dataset.loading) return void (id = window.setTimeout(next, 500));
      const a = queue.current.shift() ?? null;
      setNow(a);
      if (!a) return void (id = 0);
      beep();
      id = window.setTimeout(next, SHOW);
    };
    const off = onUnlock((a) => {
      queue.current.push(a);
      if (!id) next();
    });
    return () => {
      off();
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (now && icon.current) paintGrid(icon.current, ICONS.cup);
  }, [now]);

  if (!ok) return null;
  return createPortal(
    <div className="oni-toast" aria-live="polite">
      {now && (
        <div className="oni-toast__w" key={now.id}>
          <div className="oni-toast__in">
            <div className="oni-toast__t">
              <b>ACHIEVEMENT.SYS</b>
            </div>
            <div className="oni-toast__b">
              <canvas ref={icon} aria-hidden="true" />
              <p>
                <strong>{now.name}</strong>
                <span>{now.desc}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
