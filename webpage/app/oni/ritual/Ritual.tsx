'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SocialC } from '../../lib/content-constants';
import { RitualScene, type ExitPose } from './ritualScene';
import { hasLink, loadSocials } from './socials';
import { POSES } from './poses';
import type { Hologram } from './hologram';
import type { PreparedRitual } from '../library/Library';
import ScrollCue, { cue } from '../ScrollCue';
import Osd, { useLatch } from '../Osd';
import type { CreditsScene } from '../credits/creditsScene';

/** Lo que el ritual le pasa a los créditos: su renderer, su lienzo y los créditos ya cargados (o cargándose). */
export interface RitualExit { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; credits?: Promise<CreditsScene>; pose?: ExitPose }

// lo que hay que hacer scroll para pasar de una estación a la siguiente (px), y el tope por evento
const PX_STATION = 160, PER_EVENT = 100;

/**
 * El recorrido: la rueda, el dedo y las teclas mueven el progreso (con el tope por evento y la
 * cola de inercia del trackpad casi sin contar, como en la biblioteca); el puntero señala los
 * hologramas, un clic abre su red y en táctil el primer toque fija y el segundo abre.
 */
function drive(rit: RitualScene, cv: HTMLCanvasElement) {
  let touchY: number | null = null, down: { x: number; y: number } | null = null;
  const add = (px: number) => rit.push(px / PX_STATION);
  let lastDy = 0, lastAt = -1e9;
  const wheel = (e: WheelEvent) => {
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    const coasting = e.timeStamp - lastAt < 120 && Math.abs(dy) < lastDy;
    lastDy = Math.abs(dy);
    lastAt = e.timeStamp;
    add(Math.sign(dy) * Math.min(Math.abs(dy), PER_EVENT) * (coasting ? 0.15 : 1));
  };
  const touchstart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? null);
  const touchmove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (touchY === null || y === undefined) return;
    add((touchY - y) * 1.6); // el dedo hacia arriba es avanzar
    touchY = y;
  };
  const key = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest?.('a, button, input')) return;
    const k = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!k) return;
    rit.push(k);
    e.preventDefault();
  };
  const ndc = (e: { clientX: number; clientY: number }) => {
    const r = cv.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const opens = (h: Hologram | null) => !!h?.social && hasLink(h.social);
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const p = ndc(e);
    rit.pointer.copy(p);
    const h = rit.pick(p);
    for (const x of rit.holograms) x.hover = x === h && opens(h);
    cv.style.cursor = opens(h) ? 'pointer' : '';
  };
  const press = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const up = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    down = null;
    const h = rit.pick(ndc(e));
    if (e.pointerType === 'mouse') {
      if (opens(h)) window.open(h!.social!.url, '_blank', 'noopener');
      return;
    }
    // táctil: el primer toque fija (se queda en la marca), el segundo sobre el mismo abre; fuera, suelta
    if (h?.pinned && opens(h)) window.open(h.social!.url, '_blank', 'noopener');
    for (const x of rit.holograms) x.pinned = x === h && !!h.social;
  };
  addEventListener('wheel', wheel, { passive: true });
  addEventListener('touchstart', touchstart, { passive: true });
  addEventListener('touchmove', touchmove, { passive: true });
  addEventListener('keydown', key);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerdown', press);
  cv.addEventListener('pointerup', up);
  return () => {
    removeEventListener('wheel', wheel);
    removeEventListener('touchstart', touchstart);
    removeEventListener('touchmove', touchmove);
    removeEventListener('keydown', key);
    cv.removeEventListener('pointermove', move);
    cv.removeEventListener('pointerdown', press);
    cv.removeEventListener('pointerup', up);
    cv.style.cursor = '';
  };
}

/*
 * El ritual a pantalla completa. Llega de la biblioteca con su renderer y su lienzo (así no hay
 * corte); sin nada (el atajo ?ritual) crea los suyos. Es la última escena 3D: al salir suelta el
 * contexto WebGL.
 */
/** La estatua que se mira: su número entre las cuatro y sus dos redes. */
function Station({ n, pair }: { n: number; pair: (SocialC | null)[] }) {
  const nets = pair.filter((s): s is SocialC => !!s);
  const names = useLatch(nets.map((s) => s.k.toUpperCase()).join(' · '), 8);
  return (
    <>
      <b>{n}/4</b>
      <span>{names}</span>
      <small>{nets.map((s) => s.v).join('  ')}</small>
    </>
  );
}

export default function Ritual({ renderer, canvas, ready, onDone, onSkip }: { renderer?: THREE.WebGLRenderer; canvas?: HTMLCanvasElement; ready?: Promise<PreparedRitual>; onDone?: (exit: RitualExit) => void; onSkip?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const own = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [socials, setSocials] = useState<SocialC[]>([]);
  // para el rótulo: la estación en la que está la cámara, sus redes y si ya empezó el final
  const [station, setStation] = useState<{ n: number; pair: (SocialC | null)[] }>({ n: 0, pair: [] });
  const [ending, setEnding] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  // la escena se monta una sola vez: el doble montaje de StrictMode (en desarrollo) no la desecha
  const life = useRef<{ bin?: number; kill: () => void }>();
  const scene = useRef<RitualScene>();

  // el lienzo de la biblioteca pasa aquí antes de pintar
  useLayoutEffect(() => {
    if (!canvas) return;
    canvas.className = 'ritual__gl';
    canvas.style.cursor = '';
    root.current!.prepend(canvas);
  }, [canvas]);

  useEffect(() => {
    const later = () => {
      const l = life.current!;
      l.bin = window.setTimeout(l.kill);
    };
    if (life.current) {
      clearTimeout(life.current.bin);
      return later;
    }
    let alive = true, rit: RitualScene | undefined, made: THREE.WebGLRenderer | undefined, stop: (() => void) | undefined, handed = false;
    let next: Promise<CreditsScene> | undefined;
    const dev = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
    // desarrollo: &reduced fuerza el camino sin movimiento
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!dev?.has('reduced');
    const cv = canvas ?? own.current!;
    const start = async () => {
      const r = renderer ?? (made = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }));
      if (made) made.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      // de la biblioteca suele llegar ya cargado; si no (o falló), se carga aquí
      const got = await ready?.catch(() => undefined);
      const ss = got?.socials ?? (await loadSocials());
      if (!alive) return got?.scene.dispose();
      setSocials(ss);
      rit = got?.scene ?? new RitualScene({ renderer: r, socials: ss, reduced });
      // desarrollo: &from=statues|top|finale salta hasta ese momento (antes de cargar)
      const from = dev?.get('from') as RitualScene['skip'] | null;
      if (from) rit.skip = from;
      if (!got) await rit.load();
      if (!alive) return;
      rit.takeOver(cv);
      scene.current = rit;
      stop = drive(rit, cv);
      // los créditos se cargan y se compilan ya, en el mismo renderer, con el primer plano quieto
      // (antes se cargaban durante el final y el final iba a tirones); en el golpe de la máscara se
      // les pasa el lienzo
      next = import('../credits/creditsScene').then(async ({ CreditsScene }) => {
        const c = new CreditsScene({ renderer: r, reduced });
        await c.load();
        return c;
      });
      next.catch(() => {});
      rit.onStation = (n) => setStation({ n, pair: n >= 1 && n <= 4 ? rit!.holograms.slice(n * 2 - 2, n * 2).map((h) => h.social) : [] });
      rit.onSummit = () => {
        stop?.();
        setEnding(true);
        rit!.finale().then(() => {
          if (!alive) return;
          // el renderer y el lienzo siguen vivos: se los quedan los créditos, que siguen el plano
          handed = true;
          done.current?.({ renderer: r, canvas: cv, credits: next, pose: rit!.exit });
        });
      };
      rit.onFrame.add(() => cue(hint.current, rit!.idle));
      if (dev) Object.assign(window, { __ritual: rit, __poses: POSES });
      // desarrollo: ?ritual&free da una cámara libre para mirar la escena, sin secuencia
      if (dev?.has('free')) {
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        rit.manual = true;
        const oc = new OrbitControls(rit.camera, cv);
        oc.enableDamping = true;
        rit.onFrame.add(() => oc.update());
      }
    };
    // sin WebGL, la lista de redes se queda a pantalla completa
    start().catch(() => {
      if (!alive) return;
      setFailed(true);
      loadSocials().then((ss) => alive && setSocials(ss));
    });
    life.current = {
      kill: () => {
        alive = false;
        stop?.();
        rit?.dispose();
        if (handed) return;
        next?.then((c) => c.dispose(), () => {});
        const r = renderer ?? made;
        r?.dispose();
        r?.forceContextLoss();
      },
    };
    return later;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="ritual" data-failed={failed || undefined}>
      {!canvas && <canvas ref={own} className="ritual__gl" aria-hidden="true" />}
      {/* si la escena no ha podido arrancar, una salida: el final (contacto y footer) va sin WebGL */}
      {failed && onSkip && (
        <button type="button" className="oni-skip" onClick={onSkip}>
          Skip to the end
        </button>
      )}
      {!failed && (
        <Osd ch={13} sys="RITE.SYS · 儀式" off={ending}>
          {station.n >= 1 && station.n <= 4 && <Station key={station.n} n={station.n} pair={station.pair} />}
        </Osd>
      )}
      {!failed && <ScrollCue ref={hint} />}
      {/* las redes como enlaces: ocultas salvo con el teclado, y lo único que queda sin WebGL */}
      <nav className="ritual-socials" aria-label="Social">
        <ul>
          {socials.map((s, i) => (
            // con el teclado, la cámara va a la estatua de esa red (las ocho primeras tienen una)
            <li key={i} onFocus={() => i < 8 && scene.current?.goTo(1 + (i >> 1))}>
              {hasLink(s) ? (
                <a href={s.url} target="_blank" rel="noopener">
                  {s.k} <span>{s.v}</span>
                </a>
              ) : (
                <p>
                  {s.k} <span>{s.v}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
