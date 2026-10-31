'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { Vector2 } from 'three';
import type { SurveillanceScene } from './surveillanceScene';
import { loadChannels, type Channel } from './channels';
import { broadcastFor } from './broadcasts';
import type { RemoteButton } from './remote';
import { PcAudio } from '../pc/pcAudio';
import Osd from '../Osd';
import CctvHud from '../pc/CctvHud';
import type { LibraryScene } from '../library/libraryScene';

/** Lo que la sala le pasa a la biblioteca al apagarse: su renderer, su lienzo y la escena ya en marcha. */
export interface RoomExit { renderer: import('three').WebGLRenderer; canvas: HTMLCanvasElement; scene: LibraryScene }

/*
 * La sala de videovigilancia, a pantalla completa. Entra fundiéndose sobre la última imagen
 * del virus (la CAM 03) y la cámara sale de esa misma tele. Con el mando en la mano se cambia
 * de canal: la cámara va a esa tele y encima se monta su emisión. Sin WebGL, la lista de canales.
 */

const ch = (n: number) => `CH ${String(n).padStart(2, '0')}`;
const KEYS: Record<string, RemoteButton> = { ArrowUp: 'chUp', ArrowDown: 'chDown', Enter: 'ok', s: 'source', S: 'source' };

function Room({ feeds, live = true, onArrive, onExit }: { feeds: ImageBitmap[]; live?: boolean; onArrive: () => void; onExit?: (e: RoomExit) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // el rótulo de la CAM 03 sigue mientras estamos dentro de la tele; al salir, se va
  const [hud, setHud] = useState(true);
  // el indicador de scroll: aparece con la flecha y se va en cuanto empiezas a acercarte
  const [hint, setHint] = useState(false);
  const [held, setHeld] = useState(false);
  // la tele encuadrada (su emisión se pinta en ella) y el número de canal arriba a la derecha
  const [tv, setTv] = useState<number | null>(null);
  const [osd, setOsd] = useState<string | null>(null);
  const sceneRef = useRef<SurveillanceScene>();
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const audio = useRef<PcAudio>();
  const sound = () => {
    const a = (audio.current ??= new PcAudio());
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    return a;
  };
  // la biblioteca se prepara en cuanto la sala está lista, para que el apagado no tenga que esperar
  const library = useRef<Promise<LibraryScene>>();
  const exit = useRef(onExit);
  exit.current = onExit;
  const off = useRef(false);
  const cur = useRef(-1);
  const digits = useRef('');
  const timers = useRef({ digit: 0, osd: 0, back: 0 });
  // se monta en cuanto empieza el virus, para cargar y compilar mientras tanto (antes, todo eso
  // pasaba con la estática en pantalla y la congelaba): entra cuando el virus termina
  const gate = useRef<{ open: Promise<void>; let: () => void }>();
  if (!gate.current) {
    let open!: () => void;
    gate.current = { open: new Promise<void>((r) => (open = r)), let: () => open() };
  }
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => void (live && gate.current!.let()), [live]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: SurveillanceScene | undefined, alive = true;
    Promise.all([loadChannels(), import('./surveillanceScene')]).then(([chs, { SurveillanceScene }]) => {
      if (!alive) return;
      // desarrollo: ?room&channels=60 rellena con copias para probar un muro grande
      const want = process.env.NODE_ENV === 'development' ? Number(new URLSearchParams(location.search).get('channels')) : 0;
      for (let i = chs.length; i < want; i++) chs.push({ ...chs[i % 4], number: i + 1, name: `${chs[i % 4].name} ${i + 1}` });
      setChannels(chs);
      try {
        scene = sceneRef.current = new SurveillanceScene({
          canvas: canvas.current!,
          channels: chs,
          feeds,
          reduced,
          onReady: async () => {
            if (!alive) return;
            // dos fotogramas pintados (las texturas suben a la GPU) y quieta hasta que le toque
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            scene!.paused = true;
            const parts = Promise.all([import('../library/libraryScene'), import('../library/papers').then((m) => m.loadPapers()), import('../library/Library')]);
            const lib = () => {
              library.current ??= parts.then(async ([{ LibraryScene }, papers]) => {
                const l = new LibraryScene({ renderer: scene!.renderer, papers, reduced, ctx: sound().ctx });
                await l.load();
                return l;
              });
              library.current.catch(() => {});
            };
            // con el virus aún en pantalla, la biblioteca también se carga ya (sus tirones caen en el
            // virus). Si la sala ha tardado y ya toca entrar, espera a que termine la entrada: a la vez
            // que ella, la entrada iba a tirones (y luego coger el mando, también)
            const early = !liveRef.current;
            if (early) lib();
            await gate.current!.open;
            if (!alive) return;
            scene!.paused = false;
            if (process.env.NODE_ENV === 'development') (window as unknown as { __sala: unknown }).__sala = scene;
            const intro = scene!.startIntro();
            intro.then(() => alive && !sceneRef.current!.holding && sceneRef.current!.approach < 0.03 && setHint(true));
            if (!early) intro.then(lib);
            // un fotograma pintado antes de fundirse encima del virus
            requestAnimationFrame(() => requestAnimationFrame(() => {
              setReady(true);
              setTimeout(() => arrive.current(), 1400);
              setTimeout(() => setHud(false), reduced ? 600 : 2600);
            }));
          },
          onError: () => gate.current!.open.then(() => {
            if (!alive) return;
            setFailed(true);
            arrive.current();
          }),
        });
      } catch {
        gate.current!.open.then(() => {
          setFailed(true);
          arrive.current();
        });
      }
    });
    const t = timers.current;
    return () => {
      alive = false;
      scene?.dispose();
      // la biblioteca preparada que no llegó a usarse
      if (!off.current) library.current?.then((l) => l.dispose(), () => {});
      clearTimeout(t.digit);
      clearTimeout(t.osd);
      clearTimeout(t.back);
      audio.current?.dispose();
    };
  }, [feeds]);

  const flash = (text: string, ms: number) => {
    setOsd(text);
    clearTimeout(timers.current.osd);
    timers.current.osd = window.setTimeout(() => setOsd(null), ms);
  };

  const take = () => {
    const s = sceneRef.current;
    if (!s?.introDone || s.holding) return;
    s.pickUp();
    setHeld(true);
    setHint(false);
  };

  // ir al canal de índice i: la tele se encuadra y, al llegar, su emisión sale encima
  const go = (i: number) => {
    const s = sceneRef.current;
    if (!s?.introDone || !channels[i]) return;
    take();
    cur.current = i;
    setTv(null);
    flash(ch(channels[i].number), 2600);
    clearTimeout(timers.current.back);
    s.focus(i, () => {
      setTv(i);
      stay();
    });
  };

  // unos segundos en el canal y vuelves a sentarte; cada botón que pulses alarga el rato
  const stay = () => {
    clearTimeout(timers.current.back);
    timers.current.back = window.setTimeout(() => {
      setTv(null);
      sceneRef.current?.seat();
    }, 8000);
  };

  const press = (b: RemoteButton) => {
    if (off.current) return;
    sound().click();
    if (tv !== null) stay();
    const n = channels.length;
    if (!n) return;
    if (b === 'chUp') go((cur.current + 1) % n);
    else if (b === 'chDown') go(cur.current < 0 ? n - 1 : (cur.current - 1 + n) % n);
    else if (b === 'ok' || b === 'source') {
      const c = channels[cur.current], url = b === 'ok' ? c?.web : c?.repo;
      if (url) window.open(url, '_blank', 'noopener');
      else sound().error();
    } else if (b[0] === 'd') {
      // los dígitos se esperan 1.5 s; si el número no existe, el canal más cercano
      digits.current += b[1];
      clearTimeout(timers.current.digit);
      const commit = () => {
        const want = Number(digits.current);
        digits.current = '';
        let best = 0;
        channels.forEach((c, i) => Math.abs(c.number - want) < Math.abs(channels[best].number - want) && (best = i));
        go(best);
      };
      const len = Math.max(2, String(channels[n - 1].number).length);
      flash(`CH ${digits.current.padStart(len, '_')}`, 4000);
      if (digits.current.length >= len) commit();
      else timers.current.digit = window.setTimeout(commit, 1500);
    }
    else if (b === 'power') powerOff();
  };

  // apagar: todas las teles se van; tras un rato a oscuras se enciende una sola con la grabación
  // de la biblioteca, y cuando la carta rompe la cámara, la biblioteca se queda con todo
  const powerOff = async () => {
    const s = sceneRef.current;
    if (!s?.introDone || off.current || !library.current) return;
    off.current = true;
    const lib = await library.current.catch(() => null);
    if (!lib || sceneRef.current !== s) {
      off.current = false;
      sound().error();
      return;
    }
    const t = timers.current;
    clearTimeout(t.digit);
    clearTimeout(t.back);
    clearTimeout(t.osd);
    setTv(null);
    setOsd(null);
    setHeld(false);
    sound().clonk();
    await s.powerOff();
    await new Promise((r) => setTimeout(r, 1200));
    if (sceneRef.current !== s) return;
    s.showFeed(s.centerScreen(), lib.feed.texture, (dt) => {
      lib.update(dt);
      lib.renderFeed();
    });
    await lib.recording();
    if (sceneRef.current !== s) return;
    const { renderer, canvas } = s.release();
    exit.current?.({ renderer, canvas, scene: lib });
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  // scroll (rueda, dedo o teclado) para acercarte a la mesa; con el mando, el teclado es el mando
  useEffect(() => {
    const nudge = (d: number) => {
      const s = sceneRef.current;
      if (!s?.introDone || s.holding) return;
      s.approach = Math.min(1, Math.max(0, s.approach + d));
      if (s.approach > 0.03) setHint(false);
    };
    let ty = 0;
    const wheel = (e: WheelEvent) => nudge(e.deltaY / 1400);
    const tstart = (e: TouchEvent) => (ty = e.touches[0].clientY);
    const tmove = (e: TouchEvent) => {
      nudge((ty - e.touches[0].clientY) / 700);
      ty = e.touches[0].clientY;
    };
    const key = (e: KeyboardEvent) => {
      const s = sceneRef.current;
      if (!s?.introDone || (e.target as HTMLElement).closest?.('button, a, input')) return;
      const b: RemoteButton | undefined = /^[0-9]$/.test(e.key) ? (`d${e.key}` as RemoteButton) : KEYS[e.key];
      if (b && (s.holding || !e.key.startsWith('Arrow'))) {
        e.preventDefault();
        s.light(b);
        pressRef.current(b);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') nudge(0.15);
      if (e.key === 'ArrowUp' || e.key === 'PageUp') nudge(-0.15);
    };
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('touchstart', tstart, { passive: true });
    window.addEventListener('touchmove', tmove, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchstart', tstart);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('keydown', key);
    };
  }, []);

  const ndc = (e: React.PointerEvent | React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const shown = tv === null ? null : channels[tv];
  const Show = shown && broadcastFor(shown).Component;

  return (
    <div className="room" data-ready={ready || failed || undefined} data-failed={failed || undefined} {...((live ? {} : { inert: '' }) as object)}>
      <canvas
        ref={canvas}
        className="room__gl"
        aria-hidden="true"
        onPointerMove={(e) => {
          // el cursor avisa cuando estás encima del mando
          const s = sceneRef.current;
          if (s) e.currentTarget.style.cursor = s.introDone && s.hitRemote(ndc(e)) ? 'pointer' : '';
        }}
        onClick={(e) => {
          const s = sceneRef.current;
          if (!s?.introDone || off.current) return;
          if (!s.holding) {
            if (s.hitRemote(ndc(e))) {
              sound().click();
              take();
            }
            return;
          }
          const b = s.pressAt(ndc(e));
          if (b) press(b);
        }}
      />
      {ready && (
        <div className="room-hud" data-off={!hud || undefined}>
          <CctvHud cam={3} />
        </div>
      )}
      {/* el rótulo del inicio, en cuanto se apaga el de la cámara de seguridad */}
      {ready && <Osd ch={3} sys="MONITOR.SYS" tate="監視・銀の鬼" off={hud} />}
      {/* la emisión se ve pintada en la tele; aquí, su texto para quien no la ve */}
      {Show && shown && (
        <div className="room-sr" aria-live="polite">
          <Show channel={shown} />
        </div>
      )}
      {osd && (
        <p className="room-osd" aria-live="polite">
          {osd}
        </p>
      )}
      <p className="room-keys" data-on={held || undefined} aria-hidden="true">
        <span><b>↑↓</b>channel</span>
        <span><b>0-9</b>number</span>
        <span><b>enter</b>site</span>
        <span><b>s</b>source</span>
      </p>
      {/* apagar: un botón pequeño mientras tienes el mando, en vez de una tecla */}
      <button
        type="button"
        className="room-power"
        data-on={held || undefined}
        tabIndex={held ? 0 : -1}
        onClick={() => {
          sceneRef.current?.light('power');
          press('power');
        }}
      >
        power off
      </button>
      <div className="room-scroll" data-on={hint || undefined} aria-hidden="true">
        <i />
        <span>scroll</span>
      </div>
      <nav className="room-nav" aria-label="Channels">
        <ul>
          {channels.map((c, i) => (
            <li key={c.number}>
              <button type="button" onClick={() => go(i)}>
                {ch(c.number)} · {c.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// el reloj de Hero vuelve a pintar cada segundo: que no arrastre a la sala
export default memo(Room);
