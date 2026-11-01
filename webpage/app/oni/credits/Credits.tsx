'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CreditsScene } from './creditsScene';
import type { ExitPose } from '../ritual/ritualScene';
import { CLAUDE_CARD, presenceCard } from './card';
import { watchPresence, type Presence } from './presence';
import { tanker } from '../fonts';
import ScrollCue, { cue } from '../ScrollCue';
import type { SupperScene } from '../supper/supperScene';
import { holdStill } from '../still';

// lo que hay que hacer scroll para todo el recorrido (px de rueda), y el tope por evento
const PX_TOTAL = 2400, PER_EVENT = 120;

/** La rueda, el dedo y las teclas mueven el progreso; nada más se puede tocar. */
function drive(sc: CreditsScene) {
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    sc.push(THREE.MathUtils.clamp(e.deltaY, -PER_EVENT, PER_EVENT) / PX_TOTAL);
  };
  let y = 0;
  const touchstart = (e: TouchEvent) => void (y = e.touches[0].clientY);
  const touchmove = (e: TouchEvent) => {
    e.preventDefault();
    const n = e.touches[0].clientY;
    sc.push((y - n) / (PX_TOTAL / 2));
    y = n;
  };
  const key = (e: KeyboardEvent) => {
    const d = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    sc.push(d * 0.08);
  };
  addEventListener('wheel', wheel, { passive: false });
  addEventListener('touchstart', touchstart, { passive: true });
  addEventListener('touchmove', touchmove, { passive: false });
  addEventListener('keydown', key);
  return () => {
    removeEventListener('wheel', wheel);
    removeEventListener('touchstart', touchstart);
    removeEventListener('touchmove', touchmove);
    removeEventListener('keydown', key);
  };
}

/**
 * Los créditos a pantalla completa. Llegan del ritual con su renderer, su lienzo y la escena ya
 * cargada; sin nada (el atajo ?credits) crean los suyos. Es la última escena: al salir suelta el
 * contexto WebGL.
 */
/** Lo que los créditos le pasan a la cena al oscurecerse: su renderer y su lienzo. */
export interface CreditsExit {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  /** La cena, que se carga y se compila mientras corren los créditos. */
  supper?: Promise<SupperScene>;
}

export default function Credits({ renderer, canvas, ready, pose, onShown, onDone, onSkip }: { renderer?: THREE.WebGLRenderer; canvas?: HTMLCanvasElement; ready?: Promise<CreditsScene>; pose?: ExitPose; onShown?: () => void; onDone?: (e: CreditsExit) => void; onSkip?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [presence, setPresence] = useState<Presence>({ name: 's7lver', status: null, custom: null, activity: null, spotify: null });
  // la escena se monta una sola vez: el doble montaje de StrictMode (en desarrollo) no la desecha
  const life = useRef<{ bin?: number; kill: () => void }>();
  const shown = useRef(onShown);
  shown.current = onShown;
  const done = useRef(onDone);
  done.current = onDone;

  // el lienzo del ritual pasa aquí antes de pintar
  useLayoutEffect(() => {
    if (!canvas) return;
    canvas.className = 'credits__gl';
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
    let alive = true, sc: CreditsScene | undefined, made: THREE.WebGLRenderer | undefined, stop: (() => void) | undefined, handed = false, next: Promise<SupperScene> | undefined;
    // Discord en directo: el texto del DOM y la ficha (cuando la escena exista)
    const unwatch = watchPresence((p) => {
      setPresence(p);
      sc?.setPresence(p);
    });
    const dev = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
    // desarrollo: &reduced fuerza el camino sin movimiento
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!dev?.has('reduced');
    // sin lienzo prestado (el atajo) se crea uno fuera de React: así puede pasar a la cena
    const cv = canvas ?? Object.assign(document.createElement('canvas'), { className: 'credits__gl', ariaHidden: 'true' });
    if (!canvas) root.current!.prepend(cv);
    const start = async () => {
      // desarrollo: &nogl hace como si WebGL no arrancara
      if (dev?.has('nogl')) throw new Error('nogl');
      const r = renderer ?? (made = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }));
      if (made) made.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      // del ritual suele llegar ya cargada; si no (o falló), se carga aquí. Mientras, el último
      // fotograma del ritual se queda quieto en pantalla (en Firefox, ahí se compila: ver still.ts)
      const free = holdStill();
      const got = await ready?.catch(() => undefined);
      if (!alive) return got?.dispose();
      sc = got ?? new CreditsScene({ renderer: r, reduced });
      if (!got) await sc.load().finally(free);
      free();
      if (!alive) return;
      // del ritual es el mismo plano, sin corte ni cambio de ángulo; con el atajo, entra con unas bandas
      if (pose) sc.enter(pose);
      sc.takeOver(cv);
      if (!got) sc.cut();
      shown.current?.();
      stop = drive(sc);
      // la cena se carga en el mismo renderer (al oscurecerse, sale sin esperar a compilar), pero
      // no mientras la máscara se hunde: cuando acaba la bajada
      const low = window.matchMedia('(pointer: coarse)').matches || !!dev?.has('low');
      const prepare = () =>
        (next ??= import('../supper/supperScene').then(async ({ SupperScene }) => {
          const s = new SupperScene({ renderer: r, reduced, low });
          await s.load();
          return s;
        })).catch(() => {});
      sc.onFrame.add(() => {
        cue(hint.current, sc!.idle);
        if (sc!.entered && done.current && !next) prepare();
      });
      // al oscurecerse del todo, la cena se queda con el renderer y el lienzo
      sc.onEnd = () => {
        if (!done.current) return;
        handed = true;
        stop?.();
        stop = undefined;
        sc!.halt();
        if (!next) prepare();
        done.current({ renderer: r, canvas: cv, supper: next });
      };
      if (dev) Object.assign(window, { __credits: sc });
    };
    // sin WebGL, los créditos se quedan como texto a pantalla completa
    start().catch(() => alive && setFailed(true));
    life.current = {
      kill: () => {
        alive = false;
        unwatch();
        stop?.();
        sc?.dispose();
        if (handed) return;
        next?.then((s) => s.dispose(), () => {});
        const r = renderer ?? made;
        r?.dispose();
        r?.forceContextLoss();
      },
    };
    return later;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className={`credits ${tanker.variable}`} data-failed={failed || undefined}>
      {/* si la escena no ha podido arrancar, una salida: el final (contacto y footer) va sin WebGL */}
      {failed && onSkip && (
        <button type="button" className="oni-skip" onClick={onSkip}>
          Skip to the end
        </button>
      )}
      {!failed && <ScrollCue ref={hint} />}
      {/* los créditos como texto: ocultos a la vista (están en el holograma) y lo único que queda sin WebGL */}
      <ol className="credits-list" aria-label="Credits">
        {[presenceCard(presence, new Image()), CLAUDE_CARD].map((c) => (
          <li key={c.name}>
            <span>{c.role}</span>
            <b>{c.name}</b>
            {c.lines.map((l) => (
              <span key={l.text}>{l.text}</span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
