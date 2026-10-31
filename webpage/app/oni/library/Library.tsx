'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RitualScene } from '../ritual/ritualScene';
import type { SocialC } from '../../lib/content-constants';
import { LibraryScene } from './libraryScene';
import { loadPapers, type Paper } from './papers';
import { shelfmark } from './sheets';
import ScrollMeter from './ScrollMeter';
import Osd, { useLatch } from '../Osd';

/*
 * La biblioteca a pantalla completa. Llega de la sala con su escena ya cargada y el renderer y el
 * lienzo de la sala (así no hay corte); sin nada (el atajo ?library, o si se entra sin sala) crea
 * los suyos.
 */
const CLIPS = ['idle', 'searching-files-high', 'reaching-out', 'taking-item', 'picking-up-object', 'looking-behind', 'left-turn', 'nervously-look-around', 'rummaging', 'walking'] as const;

// 1-0 los clips, L mirar a la cámara, R alcanzar un libro, T lanzar a la cámara, F congelar, X soltar
function devBot(lib: LibraryScene) {
  const s = lib.subject, eye = () => lib.camera.position.clone();
  let frozen = false;
  addEventListener('keydown', (e) => {
    const n = '1234567890'.indexOf(e.key);
    if (n >= 0) s.to(CLIPS[n]);
    if (e.key === 'l') s.lookAt(eye());
    if (e.key === 'r') s.reachTo(lib.loose[0].getWorldPosition(new THREE.Vector3()));
    if (e.key === 't') {
      // una carta de usar y tirar: se queda en el suelo de la escena donde la suelte
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.063, 0.088), new THREE.MeshBasicMaterial({ color: 0xebe4dc, side: THREE.DoubleSide }));
      lib.scene.add(card);
      s.drawAndThrow(card, eye(), (from, dir) => console.log('suelta', from.toArray(), dir.toArray()));
    }
    if (e.key === 'f') s.freeze((frozen = !frozen), 0.02);
    if (e.key === 'x') (s.lookAt(null), s.reachTo(null));
  });
}

// el scroll que llena el indicador del tiempo parado: unos 900 px de rueda (cada golpe cuenta 60
// como mucho), y baja a 0.25/s cuando llevas medio segundo sin hacer scroll
const FILL_PX = 900, DECAY = 0.25, PER_EVENT = 60;

/**
 * El tiempo parado: la rueda, el arrastre del dedo y las teclas llenan el indicador (y nada más
 * se mueve); el puntero señala hojas y un clic abre su PDF. Al llenarse, `onFull`.
 */
function still(lib: LibraryScene, cv: HTMLCanvasElement, setMeter: (v: number) => void, onFull: () => void) {
  let v = 0, idle = 0, done = false, touchY: number | null = null, down: { x: number; y: number } | null = null;
  const add = (px: number) => {
    if (done || px <= 0) return;
    v = Math.min(1, v + px / FILL_PX);
    idle = 0;
    if (v >= 1) {
      done = true;
      onFull();
    }
  };
  const tick = (dt: number) => {
    if (!done && (idle += dt) > 0.5) v = Math.max(0, v - DECAY * dt);
    lib.audio.drone(v);
    setMeter(v);
  };
  const ndc = (e: { clientX: number; clientY: number }) => {
    const r = cv.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  // la inercia del trackpad: tras el golpe, una cola de deltas que solo bajan; esa cola cuenta la mitad
  let lastDy = 0, lastAt = -1e9;
  const wheel = (e: WheelEvent) => {
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    const coasting = e.timeStamp - lastAt < 120 && Math.abs(dy) < lastDy;
    lastDy = Math.abs(dy);
    lastAt = e.timeStamp;
    add(Math.min(dy, PER_EVENT) * (coasting ? 0.5 : 1));
  };
  const touchstart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? null);
  const touchmove = (e: TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (touchY === null || y === undefined) return;
    add((touchY - y) * 2.2); // el dedo hacia arriba es scroll hacia abajo
    touchY = y;
  };
  const key = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest?.('a, button, input')) return;
    if (e.key === 'ArrowDown') add(120);
    else if (e.key === 'PageDown' || e.key === ' ') add(400);
    else return;
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const p = lib.sheetAt(ndc(e));
    lib.hover(p);
    cv.style.cursor = p ? 'pointer' : '';
  };
  const press = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse') lib.hover(lib.sheetAt(ndc(e)));
  };
  // un clic (o un toque sin arrastre) sobre una hoja abre su PDF; el relleno, un pitido
  const up = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    down = null;
    const p = lib.sheetAt(ndc(e));
    if (!p) return;
    if (p.pdf) window.open(p.pdf, '_blank', 'noopener');
    else lib.audio.error();
  };
  lib.onFrame.add(tick);
  addEventListener('wheel', wheel, { passive: true });
  addEventListener('touchstart', touchstart, { passive: true });
  addEventListener('touchmove', touchmove, { passive: true });
  addEventListener('keydown', key);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerdown', press);
  cv.addEventListener('pointerup', up);
  return () => {
    lib.onFrame.delete(tick);
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

/** Lo que la biblioteca le pasa al ritual al acabar: su renderer y su lienzo, vivos. */
/** Lo que la biblioteca le pasa al ritual: su renderer, su lienzo y el ritual ya cargado (o cargándose). */
export interface LibraryExit { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; ritual?: Promise<PreparedRitual> }
export interface PreparedRitual { scene: RitualScene; socials: SocialC[] }

/** El índice del archivo: pasa por los papers uno a uno, con su número, su signatura y su título. */
function Catalog({ papers, hovered }: { papers: Paper[]; hovered: Paper | null }) {
  const [cycle, setI] = useState(0);
  // la hoja señalada manda; si no, va pasando
  const at = hovered ? papers.indexOf(hovered) : -1, i = at >= 0 ? at : cycle;
  useEffect(() => {
    if (papers.length < 2 || hovered) return;
    const id = setInterval(() => setI((n) => (n + 1) % papers.length), 2800);
    return () => clearInterval(id);
  }, [papers.length, hovered]);
  const p = papers[i % Math.max(1, papers.length)];
  const pad = (n: number) => String(n).padStart(2, '0');
  const code = useLatch(p ? shelfmark(p) : '', 8);
  if (!p) return null;
  return (
    <>
      <b>
        {pad(i + 1)}/{pad(papers.length)}
      </b>
      <span>{code}</span>
      <small>{p.placeholder ? 'Classified' : hovered ? `${p.title} · click to open ↗` : p.title}</small>
    </>
  );
}

export default function Library({ renderer, canvas, scene, onDone, onSkip }: { renderer?: THREE.WebGLRenderer; canvas?: HTMLCanvasElement; scene?: LibraryScene; onDone?: (exit: LibraryExit) => void; onSkip?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const own = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'cctv' | 'inside'>(scene ? 'inside' : 'cctv');
  const [papers, setPapers] = useState<Paper[]>(scene?.papers ?? []);
  const [stopped, setStopped] = useState(false);
  const [meter, setMeter] = useState(0);
  const [hovered, setHovered] = useState<Paper | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  // la escena se monta una sola vez: el doble montaje de StrictMode (en desarrollo) no la desecha
  const life = useRef<{ bin?: number; kill: () => void }>();

  // el lienzo de la sala pasa aquí antes de pintar: sin un fotograma en negro entre las dos
  useLayoutEffect(() => {
    if (!canvas) return;
    canvas.className = 'library__gl';
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
    let alive = true, lib = scene, made: THREE.WebGLRenderer | undefined, stop: (() => void) | undefined, handed = false;
    let next: Promise<PreparedRitual> | undefined;
    const dev0 = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
    // desarrollo: &reduced fuerza el camino sin movimiento
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!dev0?.has('reduced');
    const cv = canvas ?? own.current!;
    const start = async () => {
      if (!lib) {
        made = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
        made.setPixelRatio(Math.min(devicePixelRatio, 1.75));
        const ps = await loadPapers();
        if (!alive) return;
        setPapers(ps);
        lib = new LibraryScene({ renderer: made, papers: ps, reduced });
        await lib.load();
      }
      if (!alive) return;
      lib.onView = setView;
      lib.takeOver(cv);
      const dev = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
      if (dev) (window as unknown as { __lib: LibraryScene }).__lib = lib;
      // el audio necesita un gesto: si el contexto nace suspendido, el primer toque lo despierta
      const wake = () => lib!.audio.ctx.resume().catch(() => {});
      addEventListener('pointerdown', wake, { once: true });
      const quiet = stop;
      stop = () => (quiet?.(), removeEventListener('pointerdown', wake));
      // desarrollo: ?library&free da una cámara libre para mirar la escena, sin secuencia
      if (dev?.has('free')) {
        lib.setView('inside');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const oc = new OrbitControls(lib.camera, cv);
        oc.target.set(-5, 1.2, 2);
        oc.enableDamping = true;
        lib.onFrame.add(() => oc.update());
      }
      // desarrollo: ?library&bot prueba el sujeto con el teclado
      if (dev?.has('bot')) devBot(lib);
      if (dev?.has('free')) return;
      // desarrollo: &from=throw|inside|still|bolt salta hasta ese momento
      const from = dev?.get('from') as LibraryScene['skip'] | null;
      if (from) lib.skip = from;
      // de la sala llega ya con la grabación hecha; sin sala, se ve aquí a pantalla completa
      if (!scene) await lib.recording();
      if (!alive) return;
      await lib.inside();
      if (!alive) return;
      setStopped(true);
      // mientras el tiempo está parado, el ritual se carga y se compila en el mismo renderer: al
      // salir de aquí ya está listo y no hay negro ni tirón
      const r = (renderer ?? made)!;
      next = Promise.all([import('../ritual/ritualScene'), import('../ritual/socials')]).then(async ([{ RitualScene }, { loadSocials }]) => {
        const socials = await loadSocials();
        const rit = new RitualScene({ renderer: r, socials, reduced });
        await rit.load();
        return { scene: rit, socials };
      });
      next.catch(() => {});
      const l = lib;
      if (from === 'bolt') l.skip = undefined;
      const unwake = stop;
      l.onHover = setHovered;
      stop = still(l, cv, setMeter, async () => {
        stop?.();
        stop = unwake;
        // el rayo y la carta, con el ritual ya cargado: si aún carga, el tiempo sigue parado hasta que
        // acabe (cargando a la vez que la carta caía, iba a tirones)
        await next?.catch(() => {});
        if (!alive) return;
        setStopped(false);
        l.resume().then(() => {
          if (!alive) return;
          // el renderer y el lienzo siguen vivos: se los queda el ritual
          handed = true;
          done.current?.({ renderer: (renderer ?? made)!, canvas: cv, ritual: next });
        });
      });
      // con &from=bolt, el indicador se llena solo
      if (from === 'bolt') for (let i = 0; i < 40; i++) dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    };
    // sin WebGL, la lista de papers se queda a pantalla completa
    start().catch(() => {
      if (!alive) return;
      setFailed(true);
      if (!scene) loadPapers().then((ps) => alive && setPapers(ps));
    });
    life.current = {
      kill: () => {
        alive = false;
        stop?.();
        lib?.dispose();
        if (handed) return;
        next?.then((x) => x.scene.dispose(), () => {});
        const r = renderer ?? made;
        r?.dispose();
        // suelta ya el contexto WebGL y todo lo que quedaba en la gráfica (también lo de la sala)
        r?.forceContextLoss();
      },
    };
    return later;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="library" data-failed={failed || undefined}>
      {!canvas && <canvas ref={own} className="library__gl" aria-hidden="true" />}
      {/* si la escena no ha podido arrancar, una salida: el final (contacto y footer) va sin WebGL */}
      {failed && onSkip && (
        <button type="button" className="oni-skip" onClick={onSkip}>
          Skip to the end
        </button>
      )}
      {!failed && (
        <Osd ch={11} sys="ARCHIVE.SYS" tate="書庫・止まった時間" off={view !== 'inside'}>
          <Catalog papers={papers} hovered={hovered} />
        </Osd>
      )}
      {stopped && <ScrollMeter value={meter} />}
      {/* los papers como enlaces: ocultos salvo con el teclado, y lo único que queda sin WebGL */}
      <nav className="library-papers" aria-label="Papers">
        <ul>
          {papers.map((p, i) => (
            <li key={i}>
              {p.pdf ? (
                <a href={p.pdf} target="_blank" rel="noopener">
                  {p.title} <span>{[p.authors.join(', '), p.venue, p.year].filter(Boolean).join(' · ')}</span>
                </a>
              ) : (
                <p>
                  Classified <span>nothing published yet</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
