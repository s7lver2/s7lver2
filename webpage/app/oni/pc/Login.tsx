'use client';
import { useEffect, useRef, useState } from 'react';
import { MASK, COLS, ROWS } from '../mask';
import type { PcAudio } from './pcAudio';

/*
 * El login: la máscara en píxeles te sigue con la cara (cada tono de la máscara se desplaza
 * distinto, así que gira en relieve) y cierra los ojos mientras escribes la contraseña.
 * Debajo, una terminal de login de verdad: vale cualquier cosa.
 */

const TONE = ['', '#2a0605', '#4f0d09', '#9b1c15', '#ff4a36', '#ffd9cf'];
const DEPTH = [0, 0, 0, 0.55, 1.15, 2]; // cuánto se desplaza cada tono con la mirada (en celdas)
const EYE_ROWS = MASK.map((r, y) => (r.includes('5') ? y : -1)).filter((y) => y >= 0);
const LID = EYE_ROWS[EYE_ROWS.length - 1];

export default function Login({ audio, onDone }: { audio: PcAudio; onDone: (user: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const userIn = useRef<HTMLInputElement>(null);
  const passIn = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [step, setStep] = useState<'user' | 'pass' | 'check' | 'ok'>('user');
  const [dots, setDots] = useState(0);
  const st = useRef({ step, pass });
  st.current = { step, pass };

  useEffect(() => userIn.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    const c = canvas.current!;
    const x = c.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const aim = { x: 0, y: 0 }, gaze = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const b = c.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (window.innerWidth * 0.4)));
      aim.y = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height * 0.55)) / (window.innerHeight * 0.4)));
    };
    window.addEventListener('pointermove', onMove);
    let raf = 0, lid = 0, blinkUntil = 0, nextBlink = performance.now() + 2500;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio, 2);
      const cell = Math.max(3, Math.floor(Math.min(window.innerWidth * (window.innerWidth < 700 ? 0.8 : 0.42), window.innerHeight * 0.4) / ROWS));
      const pad = cell * 3;
      const w = cell * COLS + pad * 2, h = cell * ROWS + pad * 2;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
      }
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const k = reduced ? 1 : 0.08;
      gaze.x += (aim.x - gaze.x) * k;
      gaze.y += (aim.y - gaze.y) * k;
      // con la contraseña, los ojos se cierran
      const { step: s, pass: p } = st.current;
      const shut = (s === 'pass' && p.length > 0) || s === 'check' ? 1 : 0;
      lid = Math.max(0, Math.min(1, lid + (shut > lid ? 0.12 : -0.12)));
      if (!reduced && now > nextBlink) {
        blinkUntil = now + 120;
        nextBlink = now + 2500 + Math.random() * 3500;
      }
      const closed = Math.max(lid, now < blinkUntil ? 1 : 0);
      const grant = s === 'ok' ? 1 : 0;
      const sz = cell - 1;
      for (let tone = 2; tone <= 5; tone++) {
        const ox = pad + gaze.x * DEPTH[tone] * cell, oy = pad + gaze.y * DEPTH[tone] * cell * 0.7;
        MASK.forEach((row, y) => {
          for (let i = 0; i < row.length; i++) {
            if (+row[i] !== tone) continue;
            if (tone === 5) {
              // los párpados bajan fila a fila; cerrados, solo queda una raya en la de abajo
              if (closed > 0.5 && y !== LID) continue;
              x.fillStyle = 'rgba(255,40,28,0.25)';
              x.fillRect(ox + (i - 1) * cell, oy + y * cell, sz + cell * 2, sz);
              x.fillStyle = closed > 0.5 ? TONE[3] : grant ? '#ffffff' : TONE[5];
            } else x.fillStyle = TONE[tone];
            x.fillRect(Math.round(ox + i * cell), Math.round(oy + y * cell), sz, sz);
          }
        });
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // comprobación de pega: unos puntos, el disco rascando y adentro
  useEffect(() => {
    if (step !== 'check') return;
    audio.hdd(10);
    let n = 0;
    const id = setInterval(() => {
      setDots(++n);
      if (n === 8) {
        clearInterval(id);
        audio.granted();
        setStep('ok');
      }
    }, 140);
    return () => clearInterval(id);
  }, [step, audio]);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (step !== 'ok') return;
    const id = setTimeout(() => done.current(user.trim() || 'guest'), 1100);
    return () => clearTimeout(id);
  }, [step, user]);

  // Enter avanza. Sin <form> ni type="password": así los gestores de contraseñas no lo toman por
  // un inicio de sesión de verdad (la contraseña ya se pinta con asteriscos)
  const enter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    audio.key();
    if (step === 'user') {
      setStep('pass');
      setTimeout(() => passIn.current?.focus({ preventScroll: true }));
    } else if (step === 'pass') setStep('check');
  };
  const quiet = { autoComplete: 'off', autoCapitalize: 'off', spellCheck: false, 'data-1p-ignore': '', 'data-lpignore': 'true', 'data-bwignore': '', 'data-form-type': 'other' } as const;

  const focusCurrent = () => (step === 'user' ? userIn : passIn).current?.focus({ preventScroll: true });

  return (
    <div className="pc-login" onClick={focusCurrent}>
      <canvas ref={canvas} className="pc-login__mask" aria-hidden="true" />
      <div className="pc-login__tty">
        <p className="pc-dim">ONI//OS 0.7 (tty1)</p>
        <label className="pc-line">
          <span>login:</span>
          <span className="pc-typed">
            {user}
            {step === 'user' && <i className="pc-caret" />}
          </span>
          <input ref={userIn} value={user} onChange={(e) => (audio.key(), setUser(e.target.value.slice(0, 24)))} disabled={step !== 'user'} onKeyDown={enter} {...quiet} aria-label="login" />
        </label>
        {step !== 'user' && (
          <label className="pc-line">
            <span>password:</span>
            <span className="pc-typed">
              {'*'.repeat(pass.length)}
              {step === 'pass' && <i className="pc-caret" />}
            </span>
            <input ref={passIn} value={pass} onChange={(e) => (audio.key(), setPass(e.target.value.slice(0, 32)))} disabled={step !== 'pass'} onKeyDown={enter} {...quiet} aria-label="password" />
          </label>
        )}
        {(step === 'check' || step === 'ok') && <p className="pc-dim">checking {'.'.repeat(dots)}</p>}
        {step === 'ok' && <p className="pc-hot">access granted. welcome, {user.trim() || 'guest'}</p>}
      </div>
    </div>
  );
}
