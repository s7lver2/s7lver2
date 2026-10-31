'use client';
import { useEffect, useState } from 'react';
import type { SupperScene } from './supperScene';
import { CENTER, type Seat, type Stance } from './seats';

/*
 * Solo en desarrollo (?supper&edit): el panel para cuadrar a mano cada robot de la cena. Se elige
 * uno, la cámara se le acerca y se le cambia el clip, el trozo, la postura, el giro y el sitio; el
 * trozo se puede parar en su principio o su final para ver si atraviesa algo. «Copy» copia la línea
 * para `SEATS` (seats.ts).
 */

const STANCES: Stance[] = ['stand', 'chair', 'lean', 'fall'];
const r2 = (v: number) => Math.round(v * 100) / 100;

function line(s: Seat) {
  const o: Record<string, unknown> = { clip: s.clip, win: s.win.map(r2), stance: s.stance, at: s.at, turn: r2(s.turn) };
  if (s.prop) o.prop = s.prop;
  if (s.dx) o.dx = r2(s.dx);
  if (s.dz) o.dz = r2(s.dz);
  return '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${JSON.stringify(v).replace(/"/g, "'").replace(/,/g, ', ')}`).join(', ') + ' },';
}

export default function Tuner({ sc }: { sc: SupperScene }) {
  const [i, setI] = useState(0);
  const [, redraw] = useState(0);
  const [close, setClose] = useState(true);
  const [peek, setPeek] = useState<number | null>(null);
  // al abrir, de cerca sobre el primero
  useEffect(() => sc.focus(0), [sc]);
  const s = sc.seats[i], dur = sc.bots[i].duration(s.clip);
  const set = (p: Partial<Seat>) => {
    sc.tune(i, p);
    redraw((n) => n + 1);
  };
  const pick = (n: number) => {
    setI(n);
    sc.focus(close ? n : null);
  };
  const num = (label: string, v: number, min: number, max: number, step: number, on: (v: number) => void) => (
    <label>
      <span>
        {label} <b>{r2(v)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} />
    </label>
  );

  return (
    <div className="supper-tuner">
      <div className="supper-tuner__seats">
        {sc.seats.map((_, n) => (
          <button key={n} aria-pressed={n === i} onClick={() => pick(n)} disabled={n === CENTER}>
            {n}
          </button>
        ))}
      </div>
      <label>
        <span>clip</span>
        <select value={s.clip} onChange={(e) => set({ clip: e.target.value, win: [0, Math.min(1, sc.bots[i].duration(e.target.value))] })}>
          {sc.bots[i].clips().map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {num('from', s.win[0], 0, dur, 0.01, (v) => set({ win: [v, Math.max(v, s.win[1])] }))}
      {num('to', s.win[1], 0, dur, 0.01, (v) => set({ win: [Math.min(s.win[0], v), v] }))}
      <label>
        <span>stance</span>
        <select value={s.stance} onChange={(e) => set({ stance: e.target.value as Stance })}>
          {STANCES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span>faces</span>
        <select value={s.at} onChange={(e) => set({ at: +e.target.value })}>
          {sc.seats.map((_, n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {num('turn', s.turn, 0, 1, 0.05, (v) => set({ turn: v }))}
      {num('dx', s.dx ?? 0, -0.4, 0.4, 0.01, (v) => set({ dx: v }))}
      {num('dz', s.dz ?? 0, -0.4, 0.4, 0.01, (v) => set({ dz: v }))}
      <div className="supper-tuner__row">
        <label>
          <input
            type="checkbox"
            checked={close}
            onChange={(e) => {
              setClose(e.target.checked);
              sc.focus(e.target.checked ? i : null);
            }}
          />
          close-up
        </label>
        {(['play', 0, 1] as const).map((k) => (
          <button
            key={k}
            aria-pressed={(k === 'play' ? null : k) === peek}
            onClick={() => {
              const v = k === 'play' ? null : k;
              setPeek(v);
              sc.peek(v);
            }}
          >
            {k === 'play' ? 'play' : k ? 'end' : 'start'}
          </button>
        ))}
      </div>
      <code>{line(s)}</code>
      <button onClick={() => navigator.clipboard.writeText(line(s))}>Copy</button>
      <button onClick={() => navigator.clipboard.writeText(sc.seats.map(line).join('\n'))}>Copy all</button>
    </div>
  );
}
