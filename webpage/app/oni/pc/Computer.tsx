'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DESKTOP, type DesktopC } from '@/app/lib/content-constants';
import Boot from './Boot';
import Login from './Login';
import Desktop from './Desktop';
import Virus from './Virus';
import { PcAudio } from './pcAudio';
import { ARROW, HOURGLASS, paintGrid } from './pixels';

/*
 * Dentro del ordenador. Todo pasa detrás del mismo cristal de tubo (barrido, viñeteado,
 * parpadeo y algún salto de sincronía): se enciende el tubo, el BIOS cuenta la memoria,
 * arranca ONI//OS, el login y el escritorio.
 */

type Phase = 'post' | 'boot' | 'login' | 'desk' | 'virus';

const POST = (mem: number) =>
  ['ONI BIOS v0.7   (c) 1997 s7lver', '', 'CPU  : 486DX2-66', `MEM  : ${mem}K${mem >= 16384 ? ' ok' : ''}`, '', 'detecting ide drives ...', '  primary master : ONI-HDD 540MB', '', 'booting ONI//OS'];

function Computer({ fontFamily, ctx, cctv, onExit }: { fontFamily: string; ctx?: AudioContext; cctv: ImageBitmap | null; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('post');
  const [user, setUser] = useState('guest');
  const [items, setItems] = useState(DEFAULT_DESKTOP.items);
  const [post, setPost] = useState<string[]>([]);
  const [bootP, setBootP] = useState(0);
  const [power, setPower] = useState(0); // cuenta los encendidos, para repetir la animación del tubo
  const audio = useRef<PcAudio>();
  audio.current ||= new PcAudio(ctx);
  const cur = useRef<HTMLCanvasElement>(null);
  const screen = useRef<HTMLDivElement>(null);

  // el contenido es editable: si la API responde, manda; si no, el de serie
  useEffect(() => {
    fetch('/api/content/desktop')
      .then((r) => (r.ok ? (r.json() as Promise<DesktopC>) : null))
      .then((d) => d?.items?.length && setItems(d.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const a = audio.current!;
    a.start();
    return () => a.dispose();
  }, []);

  // encendido y POST
  useEffect(() => {
    if (phase !== 'post') return;
    const a = audio.current!;
    a.degauss();
    let alive = true, t = 0;
    const wait = (ms: number) => new Promise<void>((r) => (t = window.setTimeout(r, ms)));
    (async () => {
      setPost([]);
      await wait(900);
      const lines = POST(0);
      for (let i = 0; i < lines.length && alive; i++) {
        if (i === 3) {
          for (let m = 1024; m <= 16384 && alive; m += 1024) {
            setPost(POST(m).slice(0, 4));
            await wait(35);
          }
          a.post();
        } else setPost(POST(16384).slice(0, i + 1));
        if (i === 6) a.hdd(8);
        await wait(110 + Math.random() * 150);
      }
      await wait(450);
      if (alive) setPhase('boot');
    })();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [phase, power]);

  // la carga de ONI//OS: a trompicones, con el disco rascando
  useEffect(() => {
    if (phase !== 'boot') return;
    setBootP(0);
    const a = audio.current!;
    let p = 0, done = 0;
    const id = setInterval(() => {
      if (Math.random() < 0.35) return; // se atasca un poco
      p = Math.min(1, p + Math.random() * 0.09);
      if (Math.random() < 0.4) a.hdd(3);
      setBootP(p);
      if (p >= 1) {
        clearInterval(id);
        done = window.setTimeout(() => setPhase('login'), 600);
      }
    }, 120);
    return () => {
      clearInterval(id);
      clearTimeout(done);
    };
  }, [phase, power]);

  // cursor de píxel propio (en táctil no se pinta)
  const busyT = useRef(0);
  const busy = useCallback((ms: number) => {
    if (!cur.current) return;
    paintGrid(cur.current, HOURGLASS);
    clearTimeout(busyT.current);
    busyT.current = window.setTimeout(() => cur.current && paintGrid(cur.current, ARROW), ms);
  }, []);
  useEffect(() => {
    const c = cur.current!;
    paintGrid(c, ARROW);
    const mv = (e: PointerEvent) => {
      c.style.display = e.pointerType === 'mouse' ? 'block' : 'none';
      c.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerdown', mv);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerdown', mv);
    };
  }, []);

  // saltos de sincronía de vez en cuando, como un tubo viejo
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = 0;
    const jump = () => {
      screen.current?.setAttribute('data-jit', '');
      setTimeout(() => screen.current?.removeAttribute('data-jit'), 70);
      t = window.setTimeout(jump, 4000 + Math.random() * 9000);
    };
    t = window.setTimeout(jump, 5000);
    return () => clearTimeout(t);
  }, []);

  const infect = useCallback(() => setPhase('virus'), []);

  // desarrollo: ?pc&virus salta al escritorio y abre passwords.txt
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !new URLSearchParams(location.search).has('virus')) return;
    setPhase('desk');
    const id = setTimeout(() => document.querySelector('.pc-icons li[data-virus] .pc-ic')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), 1500);
    return () => clearTimeout(id);
  }, []);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const reboot = useCallback(() => {
    setPhase('post');
    setPower((n) => n + 1);
  }, []);

  return (
    <div className="pc" style={{ ['--font-tanker' as string]: fontFamily }}>
      <div className="pc-screen" ref={screen}>
        {phase === 'post' && (
          <pre className="pc-post" aria-live="polite">
            {post.join('\n')}
          </pre>
        )}
        {phase === 'boot' && <Boot progress={bootP} />}
        {phase === 'login' && (
          <Login
            audio={audio.current}
            onDone={(u) => {
              setUser(u);
              setPhase('desk');
            }}
          />
        )}
        {(phase === 'desk' || phase === 'virus') && <Desktop audio={audio.current} user={user} items={items} busy={busy} onReboot={reboot} onVirus={infect} />}
        {phase === 'virus' && <Virus audio={audio.current} cctv={cctv} reduced={reduced} onDone={onExit} />}
      </div>
      <div className="pc-roll" aria-hidden="true" />
      <div className="pc-glass" aria-hidden="true" />
      <div key={power} className="pc-power" aria-hidden="true" />
      <canvas ref={cur} className="pc-cursor" aria-hidden="true" />
    </div>
  );
}

// la habitación sigue renderizando por debajo (su reloj, cada segundo): que no arrastre al ordenador
export default memo(Computer);
