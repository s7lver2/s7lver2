'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SupperScene } from './supperScene';
import { unlock, when, type Achievement } from '../achievements';
import { tanker } from '../fonts';
import dynamic from 'next/dynamic';
import Foot from './Foot';
import ScrollCue, { cue } from '../ScrollCue';

// el panel de ajuste, solo en desarrollo: en producción ni se descarga
const Tuner = process.env.NODE_ENV === 'development' ? dynamic(() => import('./Tuner')) : () => null;

const EMAIL = 'nickespro130@outlook.es';
const DARE = 'contact me... if u dare',
  DARED = 'you dared.';

/*
 * El texto del email se descifra: cada letra pasa por glifos al azar (katakana y signos de la
 * terminal) y se fija, de izquierda a derecha, con alguna que vuelve a saltar un instante antes de
 * quedarse. Vuelve a pasar al aparecer la caja, al pasar el puntero y al cambiar de texto.
 */
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ鬼#%&*+=<>/\|_';
function useCipher(text: string, run: unknown) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setOut(text);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - t0;
      let done = true;
      setOut(
        [...text]
          .map((c, i) => {
            const at = 120 + i * 38;
            // fijada, salvo un parpadeo de vuelta a un glifo poco después de fijarse
            if (c === ' ' || (t > at && !(t > at + 90 && t < at + 140 && i % 3 === 0))) return c;
            done = false;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(''),
      );
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);
  return out;
}

// la fecha de un logro, en inglés y con la hora: «30 Oct 2026, 23:52»
const stamp = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * La Última Cena a pantalla completa y, debajo, el footer. Llega de los créditos con su renderer y
 * su lienzo; sin nada (el atajo ?supper) crea los suyos. Es la última escena: al salir suelta el
 * contexto WebGL. El email y los enlaces son DOM de verdad: sin WebGL se ven igual.
 */
export default function Supper({ renderer, canvas, ready, onShown }: { renderer?: THREE.WebGLRenderer; canvas?: HTMLCanvasElement; ready?: Promise<SupperScene>; onShown?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const contact = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  // copiar el email es aceptar el reto: el título cambia y ya no vuelve
  const [dared, setDared] = useState(false);
  // la caja ya a la vista (la cámara lejos) y las veces que el puntero ha entrado: cada una, se descifra
  const [near, setNear] = useState(false);
  const [hovers, setHovers] = useState(0);
  const mail = useCipher(copied ? 'copied to clipboard' : EMAIL, `${near}${hovers}`);
  // el email se copia al portapapeles; si el navegador no deja de ninguna forma, abre el correo
  const copy = () => {
    const ok = () => {
      setCopied(true);
      setDared(true);
      scene.current?.jolt();
      setTimeout(() => setCopied(false), 1600);
    };
    // la vieja escuela, si el portapapeles moderno no deja: un texto seleccionado y «copiar»
    const old = () => {
      const t = Object.assign(document.createElement('textarea'), { value: EMAIL });
      document.body.append(t);
      t.select();
      const done = document.execCommand('copy');
      t.remove();
      if (done) ok();
      else location.href = `mailto:${EMAIL}`;
    };
    (navigator.clipboard?.writeText(EMAIL) ?? Promise.reject()).then(ok, old);
  };
  // el cuadro bajo el puntero y dónde sacar su popup
  const [hover, setHover] = useState<{
    a: Achievement;
    x: number;
    y: number;
  } | null>(null);
  // desarrollo: ?supper&edit abre el panel para cuadrar a cada robot
  const [tuning, setTuning] = useState<SupperScene>();
  const scene = useRef<SupperScene>();
  // la escena se monta una sola vez: el doble montaje de StrictMode (en desarrollo) no la desecha
  const life = useRef<{ bin?: number; kill: () => void }>();
  const shown = useRef(onShown);
  shown.current = onShown;

  // el lienzo de los créditos pasa aquí antes de pintar
  useLayoutEffect(() => {
    if (!canvas) return;
    canvas.className = 'supper__gl';
    stage.current!.prepend(canvas);
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
    let alive = true,
      sc: SupperScene | undefined,
      made: THREE.WebGLRenderer | undefined;
    const dev = process.env.NODE_ENV === 'development' ? new URLSearchParams(location.search) : null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!dev?.has('reduced');
    // en móvil (o forzado con &low en desarrollo), los doce quietos
    const low = window.matchMedia('(pointer: coarse)').matches || !!dev?.has('low');
    const cv =
      canvas ??
      Object.assign(document.createElement('canvas'), {
        className: 'supper__gl',
        ariaHidden: 'true',
      });
    if (!canvas) stage.current!.prepend(cv);
    // la GPU pierde el contexto (no al salir nosotros): el contacto y el footer siguen, sin escena
    cv.addEventListener('webglcontextlost', () => alive && setFailed(true));
    // llegar hasta aquí ya es un logro, con o sin WebGL
    unlock('end');
    const start = async () => {
      if (dev?.has('nogl')) throw new Error('nogl');
      const r =
        renderer ??
        (made = new THREE.WebGLRenderer({
          canvas: cv,
          antialias: false,
          powerPreference: 'high-performance',
        }));
      if (made) made.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      // de los créditos suele llegar ya cargada; si no (o falló), se carga aquí
      const got = await ready?.catch(() => undefined);
      if (!alive) return got?.dispose();
      sc = got ?? new SupperScene({ renderer: r, reduced, low });
      if (!got) await sc.load();
      if (!alive) return;
      const el = contact.current!,
        box = root.current!,
        tr = track.current!;
      // la rueda aleja la cámara: lo bajado del recorrido (el escenario se queda pegado arriba)
      const scroll = () => (sc!.pull = THREE.MathUtils.clamp(box.scrollTop / Math.max(1, tr.offsetHeight - box.clientHeight), 0, 1));
      box.addEventListener('scroll', scroll, { passive: true });
      scroll();
      // el contacto, cuando la cámara ya está lejos
      sc.onFrame.add(() => {
        const far = sc!.pulled >= 0.9;
        if (far !== !el.hasAttribute('data-wait')) el.toggleAttribute('data-wait', !far), setNear(far);
        // la rueda aleja la cámara: el indicador, mientras sigas en el primer plano
        cue(hint.current, sc!.pull < 0.02);
      });
      sc.onHover = (a, x, y) => setHover(a && { a, x, y });
      scene.current = sc;
      sc.takeOver(cv);
      shown.current?.();
      if (dev) Object.assign(window, { __supper: sc });
      if (dev?.has('edit')) setTuning(sc);
    };
    start().catch(() => {
      if (!alive) return;
      setFailed(true);
      shown.current?.();
    });
    life.current = {
      kill: () => {
        alive = false;
        sc?.dispose();
        const r = renderer ?? made;
        r?.dispose();
        r?.forceContextLoss();
      },
    };
    return later;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className={`supper ${tanker.variable}`} data-failed={failed || undefined} data-lenis-prevent>
      <div ref={track} className="supper__track">
        <div ref={stage} className="supper__stage">
          <div ref={contact} className="supper__contact" data-wait>
            <p key={String(dared)} data-text={dared ? DARED : DARE} data-dared={dared || undefined}>
              {dared ? DARED : DARE}
            </p>
            <div className="oni-toast supper__mail">
              <div className="oni-toast__w">
                <div className="oni-toast__in">
                  <div className="oni-toast__t">
                    <b>mail</b>
                  </div>
                  <button type="button" className="oni-toast__b" onClick={copy} onPointerEnter={() => setHovers((n) => n + 1)} data-copied={copied || undefined} aria-label={copied ? 'Copied to clipboard' : `Copy ${EMAIL}`} title="Copy email">
                    {/* el email entero, invisible, guarda el ancho; encima, el texto que se descifra */}
                    <span aria-hidden>{EMAIL}</span>
                    <span aria-hidden>{mail}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <ScrollCue ref={hint} />
        </div>
      </div>
      {hover && (
        <div
          className="oni-toast supper__tip"
          style={{
            left: hover.x,
            top: hover.y,
            transform: hover.x > innerWidth - 340 ? 'translate(calc(-100% - 16px), 16px)' : undefined,
          }}
          role="tooltip"
        >
          <div className="oni-toast__w">
            <div className="oni-toast__in">
              <div className="oni-toast__t">
                <b>{when(hover.a.id) ? hover.a.name : '???'}</b>
              </div>
              <div className="oni-toast__b">
                <p>
                  <span>{when(hover.a.id) ? `Unlocked ${stamp(when(hover.a.id)!)}` : 'Not unlocked yet'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {process.env.NODE_ENV === 'development' && tuning && <Tuner sc={tuning} />}
      <Foot />
    </div>
  );
}
