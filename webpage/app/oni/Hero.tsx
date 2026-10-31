'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { HeroScene } from './roomScene';
import Loader from './Loader';
import type { RoomExit } from './room/Room';
import type { LibraryExit } from './library/Library';
import type { RitualExit } from './ritual/Ritual';
import type { CreditsExit } from './credits/Credits';
import { scroll } from './scroll';

async function uploadBake(scene: HeroScene) {
  const { glb, meta } = await scene.exportBake();
  await fetch('/api/bake?f=scene.glb', { method: 'POST', body: glb });
  await fetch('/api/bake?f=meta.json', { method: 'POST', body: JSON.stringify(meta) });
  document.title = 'BAKE EXPORTED';
}

// el ordenador solo se descarga cuando llegas a él
const Computer = dynamic(() => import('./pc/Computer'), { ssr: false });
const Room = dynamic(() => import('./room/Room'), { ssr: false });
const Library = dynamic(() => import('./library/Library'), { ssr: false });
const Ritual = dynamic(() => import('./ritual/Ritual'), { ssr: false });
const Credits = dynamic(() => import('./credits/Credits'), { ssr: false });
const Supper = dynamic(() => import('./supper/Supper'), { ssr: false });

const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

export default function Hero({ fontFamily }: { fontFamily: string }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState<'pending' | 'ok' | 'fail'>('pending');
  const [clock, setClock] = useState('--:--:--');
  // la carga: se monta solo con JS (sin JS no hay nada que esperar) y bloquea el scroll mientras tanto
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const sceneRef = useRef<HeroScene>();
  const [inPc, setInPc] = useState(false);
  // el virus termina en la cámara de seguridad: de ahí se sale a la sala
  const [inRoom, setInRoom] = useState(false);
  const exitPc = useCallback(() => setInRoom(true), []);
  const [inLibrary, setInLibrary] = useState(false);
  // al apagar la sala, la biblioteca se queda con su renderer, su lienzo y su escena
  const [fromRoom, setFromRoom] = useState<RoomExit>();
  const toLibrary = useCallback((e: RoomExit) => {
    setFromRoom(e);
    setInRoom(false);
    setInLibrary(true);
  }, []);
  // el sujeto se ha ido en su rayo: la biblioteca le pasa su renderer y su lienzo al ritual
  const [inRitual, setInRitual] = useState(false);
  const [fromLibrary, setFromLibrary] = useState<LibraryExit>();
  const leaveLibrary = useCallback((e: LibraryExit) => {
    setFromLibrary(e);
    setInLibrary(false);
    setFromRoom(undefined);
    setInRitual(true);
  }, []);
  // la máscara ha tocado el suelo: el ritual les pasa su renderer y su lienzo a los créditos, la
  // última escena (la página no vuelve a hacer scroll)
  const [inCredits, setInCredits] = useState(false);
  const [fromRitual, setFromRitual] = useState<RitualExit>();
  // el ritual se queda montado (con su último fotograma) hasta que los créditos toman el lienzo: si
  // no, mientras se descargan no habría nada en pantalla
  const leaveRitual = useCallback((e: RitualExit) => {
    setFromRitual(e);
    setInCredits(true);
  }, []);
  const creditsShown = useCallback(() => {
    setInRitual(false);
    setFromLibrary(undefined);
  }, []);
  // los créditos se oscurecen: la cena se queda con su renderer y su lienzo; los créditos se
  // quitan cuando la cena ya pinta
  const [inSupper, setInSupper] = useState(false);
  const [fromCredits, setFromCredits] = useState<CreditsExit>();
  // una escena que no ha podido arrancar: directos al final (va sin WebGL)
  const toEnd = useCallback(() => setInSupper(true), []);
  // si la GPU pierde el contexto a mitad de recorrido (memoria, el móvil en segundo plano), el lienzo
  // se queda negro: directos al final. La habitación lo suelta a propósito al entrar en la sala, y
  // la cena se ocupa del suyo
  useEffect(() => {
    const lost = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t === canvas.current || t.closest?.('.supper')) return;
      toEnd();
    };
    window.addEventListener('webglcontextlost', lost, true);
    return () => window.removeEventListener('webglcontextlost', lost, true);
  }, [toEnd]);
  const leaveCredits = useCallback((e: CreditsExit) => {
    setFromCredits(e);
    setInSupper(true);
  }, []);
  const supperShown = useCallback(() => {
    // lo de detrás ya no se ve: fuera (si se llegó saltando, puede quedar alguna escena montada)
    setInLibrary(false);
    setInRitual(false);
    setInCredits(false);
    setFromRitual(undefined);
  }, []);
  // ya en la sala: fuera el ordenador y la habitación (que ya no se va a volver a ver)
  const arrive = useCallback(() => {
    setInPc(false);
    sceneRef.current?.dispose();
  }, []);
  // las cámaras de seguridad de la habitación: la CAM 03 la enseña el virus; todas, la sala
  const [cams, setCams] = useState<ImageBitmap[]>([]);
  useEffect(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.documentElement.dataset.loading = '1';
    setLoading(true);
    // si algo se cuelga, no dejar a nadie mirando una barra: al minuto se entra igual (Firefox, que
    // compila sin paralelo, tarda ~20 s en un PC rápido: con menos margen se entraba a oscuras)
    const id = setTimeout(() => setProgress(1), 60000);
    return () => clearTimeout(id);
  }, []);
  const enter = useCallback(() => sceneRef.current?.audio.unlock(), []);
  const finish = useCallback(() => {
    setLoading(false);
    delete document.documentElement.dataset.loading;
    scroll.lenis?.start();
    sceneRef.current?.wake();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB')), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: HeroScene | undefined;
    let st: ScrollTrigger | undefined;
    let alive = true;
    let entered = false;
    // al final de la inmersión ya no hay vuelta atrás: el scroll se bloquea dentro del ordenador
    const enterPc = () => {
      entered = true;
      scroll.lenis?.stop();
      document.documentElement.style.overflow = 'hidden';
      setInPc(true);
      scene?.cctv().then((b) => alive && setCams(b), () => {});
      setTimeout(() => scene?.setVisible(false), 900);
    };

    // tools/bake_lighting.py abre la página con ?bake: la escena se sube al servidor de desarrollo y ya
    const bake = process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('bake');
    import('./roomScene')
      .then(({ HeroScene }) => {
        if (!alive || !canvas.current) return;
        scene = new HeroScene({
          canvas: canvas.current,
          fontFamily,
          reducedMotion: reduced,
          bake,
          onReady: () => {
            if (process.env.NODE_ENV === 'development') (window as unknown as { __hero: unknown }).__hero = scene;
            setGl('ok');
            // desarrollo: ?pc salta directo al ordenador
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('pc')) {
              finish();
              enterPc();
            }
            // desarrollo: ?room salta directo a la sala, con las cámaras de verdad
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('room')) {
              finish();
              entered = true;
              scroll.lenis?.stop();
              document.documentElement.style.overflow = 'hidden';
              scene!.cctv().then((b) => alive && (setCams(b), setInRoom(true)));
            }
            // desarrollo: ?library salta a la biblioteca, sin la sala
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('library')) {
              finish();
              entered = true;
              scroll.lenis?.stop();
              document.documentElement.style.overflow = 'hidden';
              scene!.setVisible(false);
              setInLibrary(true);
            }
            // desarrollo: ?ritual salta al ritual, sin la biblioteca
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('ritual')) {
              finish();
              entered = true;
              scroll.lenis?.stop();
              document.documentElement.style.overflow = 'hidden';
              scene!.setVisible(false);
              setInRitual(true);
            }
            // desarrollo: ?credits salta a los créditos, sin el ritual
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('credits')) {
              finish();
              entered = true;
              scroll.lenis?.stop();
              document.documentElement.style.overflow = 'hidden';
              scene!.setVisible(false);
              setInCredits(true);
            }
            // desarrollo: ?supper salta a la cena, sin los créditos
            if (process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('supper')) {
              finish();
              entered = true;
              scroll.lenis?.stop();
              document.documentElement.style.overflow = 'hidden';
              scene!.setVisible(false);
              setInSupper(true);
            }
            if (bake) uploadBake(scene!);
          },
          onProgress: (f) => setProgress((p) => Math.max(p, f)),
        });
        sceneRef.current = scene;
        st = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: '+=520%',
          pin: true,
          scrub: 1, // con inercia: la cámara acelera y frena en vez de ir pegada a la rueda
          onUpdate: (s) => {
            scene?.setProgress(s.progress);
            if (s.progress > 0.985 && !entered) enterPc();
            // el OSD se apaga con el tubo
            section.current?.style.setProperty('--osd', String(Math.max(0, 1 - Math.max(0, s.progress - 0.8) / 0.08)));
            section.current?.style.setProperty('--hint', String(Math.max(0, 1 - s.progress / 0.04)));
          },
          onToggle: (s) => scene?.setVisible(s.isActive || s.progress < 1),
        });
      })
      .catch(() => {
        setGl('fail');
        setProgress(1);
        // sin WebGL no hay recorrido: queda el final, con el contacto y el footer
        setInSupper(true);
      });

    return () => {
      alive = false;
      st?.kill();
      scene?.dispose();
      document.documentElement.style.overflow = '';
    };
  }, [fontFamily]);

  // el canal parpadea en katakana antes de engancharse
  const [channel, setChannel] = useState('CH 07');
  useEffect(() => {
    if (gl !== 'ok') return;
    let f = 0;
    const id = setInterval(() => {
      f++;
      setChannel(f > 14 ? 'CH 07' : 'CH ' + KATA[(Math.random() * KATA.length) | 0] + KATA[(Math.random() * KATA.length) | 0]);
      if (f > 14) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [gl]);

  return (
    <section ref={section} className="oni-hero" data-gl={gl} aria-label="Intro">
      {loading && createPortal(<Loader fontFamily={fontFamily} progress={gl === 'pending' ? progress : 1} ready={progress >= 1 || gl !== 'pending'} onEnter={enter} onDone={finish} />, document.body)}
      {inPc && createPortal(<Computer fontFamily={fontFamily} ctx={sceneRef.current?.audio.listener.context} cctv={cams[2] ?? null} onExit={exitPc} />, document.body)}
      {inRoom && createPortal(<Room feeds={cams} onArrive={arrive} onExit={toLibrary} />, document.body)}
      {inLibrary && createPortal(<Library renderer={fromRoom?.renderer} canvas={fromRoom?.canvas} scene={fromRoom?.scene} onDone={leaveLibrary} onSkip={toEnd} />, document.body)}
      {inRitual && createPortal(<Ritual renderer={fromLibrary?.renderer} canvas={fromLibrary?.canvas} ready={fromLibrary?.ritual} onDone={leaveRitual} onSkip={toEnd} />, document.body)}
      {inCredits && createPortal(<Credits renderer={fromRitual?.renderer} canvas={fromRitual?.canvas} ready={fromRitual?.credits} pose={fromRitual?.pose} onShown={creditsShown} onDone={leaveCredits} onSkip={toEnd} />, document.body)}
      {inSupper && createPortal(<Supper renderer={fromCredits?.renderer} canvas={fromCredits?.canvas} onShown={supperShown} />, document.body)}
      <canvas ref={canvas} className="oni-hero__gl" aria-hidden="true" />
      {/* Texto real: visible si WebGL no arranca, y siempre accesible */}
      <h1 className="oni-hero__title">S7LVER</h1>
      <div className="oni-osd">
        <span className="oni-osd__tl">
          <b>{channel}</b>
          <br />
          S7LVER.SYS
        </span>
        <span className="oni-osd__tr">
          <i aria-hidden="true" /> REC {clock}
        </span>
        <span className="oni-hint" aria-hidden="true">
          scroll
          <i />
        </span>
        <span className="oni-osd__tate" aria-hidden="true">
          信号・銀の鬼
        </span>
      </div>
    </section>
  );
}
