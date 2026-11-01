'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ARROW } from '../pc/pixels';
import { holdStill } from '../still';
import { BackroomsGame, type Hud } from './game';
import { generateMaze } from './maze';
import Touch from './Touch';
import Inventory from './Inventory';
import { setCursors } from './cursors';

/*
 * El caparazón del juego de las backrooms: la carga de los 90 (letra blanca, barra de bloques), el
 * menú (Quit se cae, Options te roba el cursor y le da a Play) y, encima de la partida, el OSD de la
 * cámara, la pausa y el cuelgue falso. El juego en sí (game.ts) no sabe de React.
 */

type Screen = 'load' | 'menu' | 'play' | 'pause' | 'dead' | 'crash';
const BLOCKS = 24;

// el cursor de flecha del ordenador, pero en blanco y negro
function paintArrow(cv: HTMLCanvasElement) {
  cv.width = ARROW[0].length;
  cv.height = ARROW.length;
  const x = cv.getContext('2d')!;
  ARROW.forEach((r, y) => [...r].forEach((ch, i) => ch !== '.' && ((x.fillStyle = ch === '3' ? '#050505' : '#f2f2ee'), x.fillRect(i, y, 1, 1))));
}

// desarrollo: el laberinto de una semilla en ASCII (S inicio, L ascensor, C cámara, P pistola, t cintas, E entidades, O huecos)
function asciiMaze(seed: number) {
  const m = generateMaze(seed), mark = new Map<number, string>();
  const put = (c: { x: number; y: number }, ch: string) => mark.set(c.y * m.w + c.x, ch);
  m.voids.forEach((c) => put(c, 'O'));
  m.tapes.forEach((c) => put(c, 't'));
  m.spawns.slice(0, 2).forEach((c) => put(c, 'E'));
  put(m.start, 'S');
  put(m.elevator, 'L');
  put(m.camera, 'C');
  if (m.pistol) put(m.pistol, 'P');
  let out = '';
  for (let y = 0; y < m.h; y++, out += '\n') for (let x = 0; x < m.w; x++) out += mark.get(y * m.w + x) ?? (m.open[y * m.w + x] ? '.' : '#');
  return out;
}

/** La estática de la cinta detrás de la carga y del menú: nieve gris a 15 fps (quieta con movimiento reducido). */
function Static({ still }: { still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, x = c.getContext('2d')!, img = x.createImageData(c.width, c.height);
    let id = 0, last = 0;
    const draw = (t: number) => {
      if (t - last > 66) {
        last = t;
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      }
      if (!still) id = requestAnimationFrame(draw);
    };
    draw(100);
    return () => cancelAnimationFrame(id);
  }, [still]);
  return <canvas ref={ref} className="br-static" width={192} height={108} aria-hidden="true" />;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const two = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** El visor de la camcorder (solo mirando por ella): REC y el contador, la batería, la fecha (de 1994), el zoom, el recuadro de enfoque y las fotos. */
function Osd({ hud }: { hud: Hud }) {
  const d = new Date(), t = hud.time;
  const bars = Math.ceil(hud.battery * 4);
  return (
    <div className="br-osd" aria-live="off">
      <p className="br-osd__tl">
        <span className="br-osd__rec">● REC</span> {two(t / 3600)}:{two((t / 60) % 60)}:{two(t % 60)}
      </p>
      <p className="br-osd__tr" aria-label={`battery ${Math.round(hud.battery * 100)}%`}>
        {'▮'.repeat(bars)}
        <span className="br-osd__dim">{'▮'.repeat(4 - bars)}</span>
      </p>
      <p className="br-osd__bl">
        {MONTHS[d.getMonth()]} {two(d.getDate())} 1994 {two(d.getHours())}:{two(d.getMinutes())}:{two(d.getSeconds())}
      </p>
      <p className="br-osd__br">
        x{hud.zoom.toFixed(1)}
        <br />
        PHOTOS {hud.photos}/2
      </p>
      <div className="br-osd__focus" data-on={hud.focus || undefined} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

/** La misión, siempre en pantalla (sin mirar por la cámara): qué toca ahora, las cintas y las fotos en bloques y, si se gasta, el aguante. */
function Mission({ hud }: { hud: Hud }) {
  const i = hud.inv;
  const goal = !i.camera ? 'FIND A CAMCORDER' : i.tapes < 8 ? 'FIND THE TAPES' : i.photos < 2 ? 'PHOTOGRAPH 2 ENTITIES' : 'REACH THE ELEVATOR';
  const blocks = (n: number, of: number) => (
    <>
      {'▮'.repeat(n)}
      <span className="br-osd__dim">{'▮'.repeat(of - n)}</span>
    </>
  );
  return (
    <div className="br-mission" aria-live="polite">
      <p>{goal}</p>
      <p aria-label={`tapes ${i.tapes} of 8`}>TAPES {blocks(i.tapes, 8)} {i.tapes}/8</p>
      {i.camera && <p aria-label={`photos ${i.photos} of 2`}>PHOTOS {blocks(i.photos, 2)} {i.photos}/2</p>}
      {i.stamina < 0.99 && <p className="br-mission__stamina" data-low={i.stamina < 0.25 || undefined}>STAMINA {blocks(Math.round(i.stamina * 10), 10)}</p>}
    </div>
  );
}

export default function Backrooms({ onQuit, onWin }: { onQuit: () => void; onWin: () => void }) {
  const [screen, setScreen] = useState<Screen>('load');
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [quitGone, setQuitGone] = useState(false);
  const [touch, setTouch] = useState(false);
  const [hand, setHand] = useState<'none' | 'camera' | 'gun'>('none');
  const [hud, setHud] = useState<Hud>();
  // los números del error, inventados una vez
  const [crashCode] = useState(() => ((Math.random() * 0xffffff) | 0).toString(16).toUpperCase().padStart(6, '0'));
  const [crashFrame] = useState(() => 1000 + ((Math.random() * 90000) | 0));
  const game = useRef<BackroomsGame>();
  const gl = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLCanvasElement>(null);
  const play = useRef<HTMLButtonElement>(null);
  const quit = useRef<HTMLButtonElement>(null);
  const stolen = useRef(false); // Options lleva el cursor: el ratón de verdad no lo mueve
  const reduced = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const quitRef = useRef(onQuit);
  quitRef.current = onQuit;
  const winRef = useRef(onWin);
  winRef.current = onWin;

  // la carga: mientras, la pantalla está quieta (en Firefox se compila aquí, ver still.ts)
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches || (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('reduced'));
    const dev = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const low = coarse || !!dev?.has('low');
    setTouch(coarse);
    setCursors(root.current!);
    // el lienzo se crea aquí y no en el JSX: al salir se pierde su contexto, y el doble montaje de
    // StrictMode (en desarrollo) necesita uno nuevo
    const cv = Object.assign(document.createElement('canvas'), { className: 'br-gl' });
    cv.setAttribute('aria-hidden', 'true');
    gl.current!.prepend(cv);
    const g = (game.current = new BackroomsGame(cv, { low, reduced: reduced.current }));
    // desarrollo: __game y __maze(semilla) en la consola
    if (dev) Object.assign(window, { __game: g, __maze: (seed: number) => console.info(asciiMaze(seed)) });
    g.onPause = () => alive && setScreen('pause');
    g.onDeath = () => alive && setScreen('crash');
    g.onWin = () => winRef.current();
    g.showTv(); // la sala oscura con la tele, mientras carga
    // un clic o una tecla: la cámara se acerca más deprisa
    const hurry = () => g.tv && (g.tv.speed = 3);
    addEventListener('pointerdown', hurry);
    addEventListener('keydown', hurry);
    const free = holdStill();
    let alive = true;
    g.load((f) => alive && setProgress(f))
      .then(async () => {
        if (!alive) return;
        setProgress(1);
        await new Promise((r) => setTimeout(r, 400));
        await g.diveIntoTv(); // y nos metemos en la tele: dentro está el menú
        if (alive) setScreen('menu');
      })
      .catch(() => alive && (setFailed(true), (g.tvFailed = true)))
      .finally(free);
    return () => {
      alive = false;
      removeEventListener('pointerdown', hurry);
      removeEventListener('keydown', hurry);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      free();
      g.dispose();
      cv.remove();
    };
  }, []);

  // si no carga: cualquier tecla o toque vuelve al escritorio
  useEffect(() => {
    if (!failed) return;
    const back = () => quitRef.current();
    const id = setTimeout(() => (addEventListener('keydown', back), addEventListener('pointerdown', back)), 400);
    return () => {
      clearTimeout(id);
      removeEventListener('keydown', back);
      removeEventListener('pointerdown', back);
    };
  }, [failed]);

  // lo que el OSD y los controles táctiles leen del juego, diez veces por segundo (el visor sale al subir la cámara)
  useEffect(() => {
    if (screen !== 'play') return;
    const id = setInterval(() => {
      setHand(game.current?.player?.hand ?? 'none');
      setHud(game.current?.hud);
    }, 100);
    return () => clearInterval(id);
  }, [screen]);

  // en el menú, Escape vuelve al escritorio
  useEffect(() => {
    if (screen !== 'menu') return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !stolen.current && quitRef.current();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [screen]);

  // el cuelgue falso: el último fotograma congelado y temblando, la pantalla de error y, a los 3,5 s,
  // de vuelta al escritorio
  useEffect(() => {
    if (screen !== 'crash') return;
    const id = setTimeout(() => quitRef.current(), 4400);
    return () => clearTimeout(id);
  }, [screen]);

  // pantalla completa y el puntero, siempre dentro del clic (fuera de un gesto el navegador los niega)
  const enter = useCallback(() => {
    if (!document.fullscreenElement) root.current?.requestFullscreen?.().catch(() => {});
    game.current?.input.lock();
  }, []);

  const resume = useCallback(() => {
    enter();
    game.current!.resume();
    setScreen('play');
  }, [enter]);

  const start = useCallback(() => {
    if (started.current) return; // un clic en Play mientras Options lleva el cursor
    started.current = true;
    // el cursor que se llevó Options se va: en la partida mandan los de verdad
    root.current?.removeAttribute('data-stolen');
    if (cursor.current) cursor.current.style.display = 'none';
    // desarrollo: &seed=N fija el laberinto
    const fixed = process.env.NODE_ENV === 'development' ? Number(new URLSearchParams(location.search).get('seed')) : 0;
    game.current!.start(fixed || (Math.random() * 2 ** 31) | 0);
    setScreen('play');
  }, []);

  // Quit se descuelga: gira sobre su esquina de arriba a la izquierda, se suelta y cae
  const drop = () => {
    const b = quit.current!;
    if (b.dataset.falling) return;
    b.dataset.falling = '1';
    const fall = innerHeight - b.getBoundingClientRect().top + 80;
    const tl = gsap.timeline({ onComplete: () => setQuitGone(true) });
    if (reduced.current) tl.to(b, { y: fall, duration: 0.7, ease: 'power2.in' });
    else
      tl.set(b, { transformOrigin: '0% 0%' })
        .to(b, { rotation: 38, duration: 0.5, ease: 'back.out(3)' })
        .to(b, { rotation: 24, duration: 0.25, ease: 'sine.inOut' })
        .to(b, { y: fall, rotation: 70, x: 30, duration: 0.8, ease: 'power2.in' });
  };

  // Options agarra el cursor y lo lleva hasta Play (en táctil sale uno falso donde estaba el dedo)
  const steal = (e: React.MouseEvent) => {
    if (stolen.current) return;
    stolen.current = true;
    enter();
    // el cursor de verdad se esconde y sale uno dibujado donde estaba, que es el que se lleva
    const c = cursor.current!, r = play.current!.getBoundingClientRect();
    paintArrow(c);
    root.current?.setAttribute('data-stolen', '');
    const from = { x: e.clientX, y: e.clientY }, to = { x: r.left + r.width * 0.35, y: r.top + r.height * 0.5 };
    // un arco que se pasa un poco hacia arriba, como una mano que tira
    const mid = { x: (from.x + to.x) / 2 + 40, y: Math.min(from.y, to.y) - 60 };
    c.style.display = 'block';
    const st = { t: 0 };
    gsap.to(st, {
      t: 1,
      duration: 0.9,
      ease: 'power2.inOut',
      onUpdate: () => {
        // con movimiento reducido, en línea recta
        const t = st.t, m = reduced.current ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } : mid;
        const x = (1 - t) * (1 - t) * from.x + 2 * t * (1 - t) * m.x + t * t * to.x;
        const y = (1 - t) * (1 - t) * from.y + 2 * t * (1 - t) * m.y + t * t * to.y;
        c.style.transform = `translate(${x}px, ${y}px)`;
      },
      onComplete: () => {
        play.current?.setAttribute('data-press', '');
        setTimeout(start, 180);
      },
    });
  };

  return (
    <div ref={root} className="br" data-screen={screen}>
      {screen === 'menu' && <Static still={reduced.current} />}
      <div ref={gl} className="br-stage" />
      {screen === 'load' && (
        <div className="br-load br-sr" role="progressbar" aria-label="Loading Backrooms" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <p className="br-load__head">BACKROOMS</p>
          {failed ? (
            <p>Failed to load. Press any key.</p>
          ) : (
            <>
              <p>Loading assets... this may take a while.</p>
              <div className="br-load__bar" aria-hidden="true">
                {Array.from({ length: BLOCKS }, (_, i) => (
                  <i key={i} data-on={i < Math.floor(progress * BLOCKS) || undefined} />
                ))}
              </div>
              <p className="br-load__pct" aria-hidden="true">
                {String(Math.round(progress * 100)).padStart(3, ' ')}%
              </p>
            </>
          )}
        </div>
      )}
      {screen === 'menu' && (
        <nav className="br-menu" aria-label="Backrooms">
          <p className="br-menu__ch">CH 03</p>
          <h1 className="br-menu__title">BACKROOMS</h1>
          <p className="br-menu__sub">LEVEL 0 &nbsp; SP &nbsp; 1994</p>
          <ul>
            <li>
              <button ref={play} type="button" className="br-opt" onClick={() => (enter(), start())} autoFocus>
                PLAY
              </button>
            </li>
            <li>
              <button type="button" className="br-opt" onClick={steal}>
                SETUP
              </button>
            </li>
            {!quitGone && (
              <li>
                <button ref={quit} type="button" className="br-opt" onClick={drop}>
                  EJECT
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}
      {(screen === 'play' || screen === 'pause') && hud?.aiming && <Osd hud={hud} />}
      {screen === 'play' && hud && !hud.aiming && !hud.bag && <Mission hud={hud} />}
      {screen === 'play' && hud?.hint && !hud.bag && !hud.aiming && (
        <p className="br-hint">
          [{touch ? 'GRAB' : 'G'}] PICK UP {hud.hint.toUpperCase()}
        </p>
      )}
      {screen === 'play' && hud?.bag && game.current && (
        <Inventory
          inv={hud.inv}
          onPlace={(s, g) => game.current!.player?.place(s, g)}
          onLight={() => game.current!.player && (game.current!.player.flashOn = !game.current!.player.flashOn)}
          onClose={() => game.current!.closeBag()}
        />
      )}
      {screen === 'play' && touch && game.current && !hud?.bag && <Touch input={game.current.input} hand={hand} aiming={!!hud?.aiming} />}
      {screen === 'pause' && (
        <div className="br-pause" role="dialog" aria-labelledby="br-pause-t">
          <p className="br-pause__head" id="br-pause-t">
            PAUSE <span aria-hidden="true">❚❚</span>
          </p>
          <ul>
            <li>
              <button type="button" className="br-opt" onClick={resume} autoFocus>
                RESUME
              </button>
            </li>
            <li>
              <button type="button" className="br-opt" onClick={onQuit}>
                STOP
              </button>
            </li>
          </ul>
        </div>
      )}
      {screen === 'crash' && (
        <div className="br-crash" role="alert">
          <p className="br-crash__head">RECORDING CORRUPTED</p>
          <p>TAPE ERROR 0x{crashCode}</p>
          <p>head 2 lost tracking at frame {crashFrame}</p>
          <p className="br-crash__dim">the tape was eaten.</p>
        </div>
      )}
      <canvas ref={cursor} className="br-cursor" aria-hidden="true" />
    </div>
  );
}
