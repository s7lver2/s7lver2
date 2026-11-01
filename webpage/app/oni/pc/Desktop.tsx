'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeskNode } from '@/app/lib/content-constants';
import { RAW } from '../mask';
import { ICONS, dither, paintGrid, type IconKind } from './pixels';
import type { PcAudio } from './pcAudio';
import Terminal from './Terminal';

/*
 * ONI//OS: el escritorio dentro del monitor. Iconos, ventanas que se arrastran como en los 90
 * (solo se mueve el contorno punteado y la ventana salta al soltar), un visor de texto, un
 * explorador de carpetas, la terminal y tres fondos tramados en la rampa de fósforo.
 */

type Wallpaper = 'mask' | 'room' | 'kanji';
type Kind = 'text' | 'folder' | 'term';
interface Win {
  id: number;
  kind: Kind;
  title: string;
  stack: DeskNode[]; // carpeta: la ruta abierta; texto: el archivo
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

const iconOf = (n: DeskNode): IconKind =>
  n.kind === 'text' ? (n.virus ? 'key' : 'txt') : n.kind === 'folder' ? 'dir' : n.app === 'corrupt' ? 'bad' : n.app === 'whatsapp' ? 'chat' : 'exe';

function Icon({ kind }: { kind: IconKind }) {
  const r = useRef<HTMLCanvasElement>(null);
  useEffect(() => paintGrid(r.current!, ICONS[kind]), [kind]);
  return <canvas ref={r} className="pc-icon" aria-hidden="true" />;
}

// ── fondos
const LUM: Record<string, number> = { ' ': 0, '2': 0.16, '3': 0.3, '4': 0.5, '5': 1 };
let roomPx: { d: Uint8ClampedArray; w: number; h: number } | null = null;

function WallpaperCanvas({ wp }: { wp: Wallpaper }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const x = c.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = 0, hex: string[] = [], kanji: Uint8ClampedArray | null = null, grid = { cols: 0, rows: 0 };
    if (wp === 'room' && !roomPx) {
      const img = new Image();
      img.src = '/pc/room.webp';
      img.onload = () => {
        const t = document.createElement('canvas');
        t.width = img.width;
        t.height = img.height;
        const tx = t.getContext('2d')!;
        tx.drawImage(img, 0, 0);
        roomPx = { d: tx.getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height };
      };
    }
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 80) return; // ~12 fps, que el tramado no necesita más
      last = now;
      const VW = c.clientWidth, VH = c.clientHeight;
      if (wp === 'kanji') {
        const cw = 11, ch = 15;
        if (c.width !== VW) {
          c.width = VW;
          c.height = VH;
          grid = { cols: Math.ceil(VW / cw), rows: Math.ceil(VH / ch) };
          const m = document.createElement('canvas');
          m.width = grid.cols;
          m.height = grid.rows;
          const mx = m.getContext('2d')!;
          mx.fillStyle = '#fff';
          mx.font = `700 ${Math.min(grid.rows, grid.cols * 0.9)}px serif`;
          mx.textAlign = 'center';
          mx.textBaseline = 'middle';
          mx.fillText('鬼', grid.cols * (VW > 700 ? 0.64 : 0.5), grid.rows * 0.55);
          kanji = mx.getImageData(0, 0, grid.cols, grid.rows).data;
          hex = Array.from({ length: grid.cols * grid.rows }, () => '0123456789abcdef'[(Math.random() * 16) | 0]);
        }
        if (!reduced) for (let i = 0; i < 60; i++) hex[(Math.random() * hex.length) | 0] = '0123456789abcdef'[(Math.random() * 16) | 0];
        x.fillStyle = '#070303';
        x.fillRect(0, 0, VW, VH);
        x.font = '15px ' + getComputedStyle(c).fontFamily;
        x.textBaseline = 'top';
        const off = reduced ? 0 : ((now / 260) | 0) % grid.rows;
        for (let y = 0; y < grid.rows; y++)
          for (let i = 0; i < grid.cols; i++) {
            const inK = kanji![(y * grid.cols + i) * 4 + 3] > 128;
            const wave = 0.5 + 0.5 * Math.sin((y - now / 320) * 0.35);
            x.fillStyle = inK ? (wave > 0.86 ? '#ffd9cf' : '#c4221a') : (y + i) % 3 ? '#1c0403' : '#2a0605';
            x.fillText(hex[((y + off) % grid.rows) * grid.cols + i], i * cw, y * ch);
          }
        return;
      }
      // máscara y habitación: imagen pequeña tramada y escalada a píxel gordo
      const W = 200, H = Math.max(80, Math.round((W * VH) / VW));
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const img = x.createImageData(W, H);
      if (wp === 'room') {
        if (!roomPx) return;
        const { d, w, h } = roomPx;
        const k = Math.max(W / w, H / h), ox = (W - w * k) / 2, oy = (H - h * k) / 2;
        const jit = !reduced && Math.random() < 0.04 ? 2 : 0;
        dither(img, (X, Y) => {
          const sx = Math.min(w - 1, Math.max(0, ((X + (Y % 9 === 0 ? jit : 0) - ox) / k) | 0)), sy = Math.min(h - 1, Math.max(0, ((Y - oy) / k) | 0));
          const o = (sy * w + sx) * 4;
          return Math.pow((d[o] * 0.5 + d[o + 1] * 0.3 + d[o + 2] * 0.2) / 255, 0.8) * 0.75;
        });
      } else {
        const rows = RAW.length, cols = RAW[0].length;
        const s = (H * 0.84) / rows, ox = W * (VW > 700 ? 0.63 : 0.5) - (cols / 2) * s, oy = H * 0.1;
        const glitch = !reduced && ((now / 900) | 0) % 7 === 0 ? (((now / 60) | 0) % 9) - 4 : 0;
        const tone = (mx: number, my: number) => LUM[RAW[my]?.[mx] ?? ' '] ?? 0;
        dither(img, (X, Y) => {
          const fy = (Y - oy) / s;
          if (glitch && (fy | 0) % 6 === 2) X += glitch;
          const fx = (X - ox) / s;
          if (fx < 0 || fy < 0 || fx >= cols - 1 || fy >= rows - 1) return 0.015 + 0.02 * Math.sin(Y * 0.4 + now / 900);
          const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
          let v = tone(ix, iy) * (1 - ax) * (1 - ay) + tone(ix + 1, iy) * ax * (1 - ay) + tone(ix, iy + 1) * (1 - ax) * ay + tone(ix + 1, iy + 1) * ax * ay;
          if (v > 0.7) v = 0.75 + 0.25 * Math.sin(now / 600); // los ojos respiran
          return v * 0.85;
        });
      }
      x.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [wp]);
  return <canvas ref={ref} className="pc-wall" aria-hidden="true" />;
}

// ── salvapantallas: la máscara rebotando, como el logo de un DVD
function Saver() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    paintGrid(c, RAW.map((r) => r.replace(/ /g, '.').replace(/2/g, '1').replace(/3/g, '2').replace(/4/g, '3').replace(/5/g, '4')));
    const p = { x: 40, y: 40, vx: 1.4, vy: 1.1 };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const W = c.parentElement!.clientWidth - c.offsetWidth, H = c.parentElement!.clientHeight - c.offsetHeight;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      c.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pc-saver" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}

function CpuMeter({ load }: { load: () => number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const x = ref.current!.getContext('2d')!;
    const hist = Array(24).fill(1);
    const id = setInterval(() => {
      hist.shift();
      hist.push(1 + ((Math.random() * (2 + load())) | 0));
      x.clearRect(0, 0, 24, 7);
      hist.forEach((h, i) => {
        x.fillStyle = h > 4 ? '#ffd9cf' : '#c4221a';
        x.fillRect(i, 7 - Math.min(7, h), 1, Math.min(7, h));
      });
    }, 250);
    return () => clearInterval(id);
  }, [load]);
  return <canvas ref={ref} className="pc-cpu" width={24} height={7} aria-hidden="true" />;
}

export default function Desktop({ audio, user, items, busy, onReboot, onVirus, onApp }: { audio: PcAudio; user: string; items: DeskNode[]; busy: (ms: number) => void; onReboot: () => void; onVirus: () => void; onApp: (app: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [wins, setWins] = useState<Win[]>([]);
  const [wp, setWp] = useState<Wallpaper>('mask');
  const [menu, setMenu] = useState<null | 'file' | 'view' | 'sys'>(null);
  const [sel, setSel] = useState(-1);
  const [disk, setDisk] = useState(false);
  const [muted, setMuted] = useState(audio.muted);
  const [clock, setClock] = useState('');
  const [drag, setDrag] = useState<null | { id: number; x: number; y: number; w: number; h: number }>(null);
  const [trails, setTrails] = useState<{ id: number; x: number; y: number; w: number; h: number }[]>([]);
  const [saver, setSaver] = useState(false);
  const z = useRef(10), nextId = useRef(1), idle = useRef(performance.now());
  const winCount = useRef(0);
  winCount.current = wins.length;
  const load = useCallback(() => winCount.current * 2, []);

  useEffect(() => {
    const t = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    t();
    const id = setInterval(t, 5000);
    return () => clearInterval(id);
  }, []);

  // salvapantallas tras un rato sin tocar nada
  useEffect(() => {
    const wake = () => {
      idle.current = performance.now();
      setSaver(false);
    };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    const id = setInterval(() => performance.now() - idle.current > 30000 && setSaver(true), 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, wake));
      clearInterval(id);
    };
  }, []);

  const spin = useCallback(
    (ms: number) => {
      busy(ms);
      audio.hdd(Math.ceil(ms / 70));
      setDisk(true);
      setTimeout(() => setDisk(false), ms);
    },
    [busy, audio],
  );

  const focus = (id: number) => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: ++z.current } : w)));
  const addWin = (kind: Kind, title: string, stack: DeskNode[], w: number, h: number) =>
    setWins((ws) => {
      const had = ws.find((o) => o.title === title);
      if (had) return ws.map((o) => (o.id === had.id ? { ...o, z: ++z.current } : o));
      const r = root.current!.getBoundingClientRect();
      const narrow = r.width < 700;
      const W = narrow ? r.width - 24 : w, H = Math.min(h, r.height - 80);
      const n = ws.length % 6;
      const x = narrow ? 12 : Math.min(r.width - W - 16, r.width * 0.3 + n * 30);
      const y = Math.min(r.height - H - 12, 64 + n * 26);
      return [...ws, { id: nextId.current++, kind, title, stack, x, y, w: W, h: H, z: ++z.current }];
    });

  // el archivo que quiere ser abierto: si tardas, tiembla, luego da saltitos y al final viene a por ti
  const bitten = useRef(false);
  useEffect(() => {
    const li = root.current?.querySelector<HTMLElement>('.pc-icons li[data-virus]');
    const ic = li?.querySelector<HTMLElement>('.pc-ic');
    if (!li || !ic) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now(), mouse = { x: -1, y: 0 }, pos = { x: 0, y: 0 };
    let raf = 0, next = t0 + 40000;
    const mv = (e: PointerEvent) => ((mouse.x = e.clientX), (mouse.y = e.clientY));
    const nudge = (ax: string) => {
      ic.removeAttribute(ax);
      void ic.offsetWidth; // reinicia la animación
      ic.setAttribute(ax, '');
    };
    window.addEventListener('pointermove', mv);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (bitten.current) return;
      const t = now - t0;
      if (t >= 100000 && !reduced && mouse.x >= 0) {
        const r = ic.getBoundingClientRect(), d = root.current!.getBoundingClientRect();
        const dx = mouse.x - (r.left + r.width / 2), dy = mouse.y - (r.top + r.height / 2), l = Math.hypot(dx, dy);
        if (l < 24) return;
        pos.x += (dx / l) * 2;
        pos.y += (dy / l) * 2;
        // sin salirse del escritorio
        const bx = li.offsetLeft + pos.x, by = li.offsetTop + pos.y;
        pos.x -= Math.min(0, bx) + Math.max(0, bx + li.offsetWidth - d.width + 12);
        pos.y -= Math.min(0, by) + Math.max(0, by + li.offsetHeight - d.height + 48);
        li.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        return;
      }
      if (now < next) return;
      next = now + 5000 + Math.random() * 3000;
      if (reduced) return nudge('data-blink');
      if (t >= 70000) {
        pos.x += (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4);
        pos.y += (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4);
        li.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        audio.click();
      }
      nudge('data-shake');
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', mv);
    };
  }, [audio, items]);

  const open = (node: DeskNode | 'term') => {
    spin(420);
    setTimeout(() => {
      if (node === 'term') {
        audio.open();
        addWin('term', 'tty0', [], 470, 300);
      } else if (node.kind === 'app') {
        // de momento solo hay juego de las backrooms; las demás apps, el pitido de error
        if (node.app === 'backrooms') onApp(node.app);
        else audio.error();
      }
      else if (node.kind === 'text') {
        audio.open();
        addWin('text', node.name, [node], 420, 280);
        if (node.virus && !bitten.current) {
          bitten.current = true;
          setTimeout(onVirus, 80); // que la ventana llegue a pintarse
        }
      } else {
        audio.open();
        addWin('folder', node.name + '/', [node], 360, 230);
      }
    }, 420);
  };

  const close = (w: Win) => {
    audio.close();
    setWins((ws) => ws.filter((o) => o.id !== w.id));
    // el fósforo tarda en apagarse
    setTrails((t) => [...t, { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h }]);
    setTimeout(() => setTrails((t) => t.filter((o) => o.id !== w.id)), 650);
  };

  // la terminal se abre sola al arrancar: la capa hacker (en el móvil taparía el escritorio)
  useEffect(() => {
    if (window.innerWidth < 700) return;
    const id = setTimeout(() => open('term'), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (e: React.PointerEvent, w: Win) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const r = root.current!.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    let g = { id: w.id, x: w.x, y: w.y, w: w.w, h: w.h };
    setDrag(g);
    const mv = (ev: PointerEvent) => {
      g = { ...g, x: Math.max(60 - w.w, Math.min(r.width - 60, w.x + ev.clientX - sx)), y: Math.max(32, Math.min(r.height - 30, w.y + ev.clientY - sy)) };
      setDrag(g);
    };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      setDrag(null);
      if (g.x !== w.x || g.y !== w.y) audio.click();
      setWins((ws) => ws.map((o) => (o.id === w.id ? { ...o, x: g.x, y: g.y } : o)));
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up, { once: true });
  };

  const top = wins.reduce((m, w) => Math.max(m, w.z), 0);
  const all: (DeskNode | 'term')[] = [...items, 'term'];

  return (
    <div
      ref={root}
      className="pc-desk"
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('.pc-bar')) setMenu(null);
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pc-wall')) setSel(-1);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        const f = wins.find((w) => w.z === top);
        if (f) close(f);
      }}
    >
      <WallpaperCanvas wp={wp} />

      <header className="pc-bar">
        <b>ONI//OS</b>
        {(
          [
            ['file', 'file'],
            ['view', 'view'],
            ['sys', 'system'],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="pc-menu" data-open={menu === k || undefined}>
            <button
              type="button"
              onClick={() => {
                audio.click();
                setMenu(menu === k ? null : k);
              }}
            >
              {label}
            </button>
            {menu === k && (
              <div className="pc-menu__list" role="menu">
                {k === 'file' && (
                  <>
                    <button type="button" role="menuitem" onClick={() => (setMenu(null), open('term'))}>new terminal</button>
                    {items.filter((n) => n.kind === 'text').map((n) => (
                      <button key={n.name} type="button" role="menuitem" onClick={() => (setMenu(null), open(n))}>open {n.name}</button>
                    ))}
                  </>
                )}
                {k === 'view' &&
                  (
                    [
                      ['mask', 'wallpaper: mask'],
                      ['room', 'wallpaper: the room'],
                      ['kanji', 'wallpaper: 鬼 in hex'],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} type="button" role="menuitemradio" aria-checked={wp === v} onClick={() => (setMenu(null), spin(500), setWp(v))}>
                      {l}
                    </button>
                  ))}
                {k === 'sys' && (
                  <>
                    <button type="button" role="menuitemcheckbox" aria-checked={!muted} onClick={() => (audio.setMuted(!muted), setMuted(!muted))}>sound: {muted ? 'off' : 'on'}</button>
                    <button type="button" role="menuitem" onClick={onReboot}>reboot</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        <span className="pc-bar__r">
          <CpuMeter load={load} />
          <span>hdd</span>
          <i className="pc-led" data-on={disk || undefined} />
          <span className="pc-bar__user">{user}@oni</span>
          <span>{clock}</span>
        </span>
      </header>

      <ul className="pc-icons" aria-label="Desktop">
        {all.map((n, i) => {
          const name = n === 'term' ? 'tty0' : n.name;
          return (
            <li key={name} data-virus={(n !== 'term' && n.kind === 'text' && n.virus) || undefined}>
              <button
                type="button"
                className="pc-ic"
                aria-pressed={sel === i}
                onClick={(e) => {
                  audio.click();
                  setSel(i);
                  // en pantallas táctiles no hay doble clic: un toque abre
                  if ((e.nativeEvent as PointerEvent).pointerType === 'touch') open(n);
                }}
                onDoubleClick={() => open(n)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), open(n))}
              >
                <Icon kind={n === 'term' ? 'term' : iconOf(n)} />
                <span>{name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {wins.map((w) => (
        <section
          key={w.id}
          className="pc-win"
          data-kind={w.kind}
          data-blur={w.z !== top || undefined}
          style={{ left: w.x, top: w.y, width: w.w, height: w.h, zIndex: w.z }}
          onPointerDown={() => w.z !== top && focus(w.id)}
          role="dialog"
          aria-label={w.title}
        >
          <div className="pc-win__in">
            <div className="pc-win__t" onPointerDown={(e) => startDrag(e, w)}>
              <b>{w.kind === 'folder' ? w.stack.map((n) => n.name).join('/') + '/' : w.title}</b>
              <button type="button" aria-label={'close ' + w.title} onClick={() => close(w)}>
                x
              </button>
            </div>
            <div className="pc-win__b">
              {w.kind === 'text' && w.stack[0].kind === 'text' && (
                <div className="pc-doc">
                  {w.stack[0].body.split('\n').map((l, i) => (
                    <p key={i}>
                      <span>{i + 1}</span>
                      <span data-dim={l.startsWith('#') || undefined}>{l || ' '}</span>
                    </p>
                  ))}
                </div>
              )}
              {w.kind === 'folder' && (
                <ul className="pc-ls">
                  {w.stack.length > 1 && (
                    <li>
                      <button
                        type="button"
                        className="pc-ic"
                        onClick={(e) => {
                          audio.click();
                          if ((e.nativeEvent as PointerEvent).pointerType === 'touch') e.currentTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                        }}
                        onDoubleClick={() => setWins((ws) => ws.map((o) => (o.id === w.id ? { ...o, stack: o.stack.slice(0, -1) } : o)))}
                      >
                        <Icon kind="dir" />
                        <span>..</span>
                      </button>
                    </li>
                  )}
                  {(() => {
                    const cur = w.stack[w.stack.length - 1];
                    return cur.kind === 'folder'
                      ? cur.children.map((c) => (
                          <li key={c.name}>
                            <button
                              type="button"
                              className="pc-ic"
                              onClick={(e) => {
                                audio.click();
                                if ((e.nativeEvent as PointerEvent).pointerType === 'touch') e.currentTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                              }}
                              onDoubleClick={() => {
                                if (c.kind === 'folder') {
                                  spin(300);
                                  setWins((ws) => ws.map((o) => (o.id === w.id ? { ...o, stack: [...o.stack, c] } : o)));
                                } else open(c);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))}
                            >
                              <Icon kind={iconOf(c)} />
                              <span>{c.name}</span>
                            </button>
                          </li>
                        ))
                      : null;
                  })()}
                </ul>
              )}
              {w.kind === 'term' && <Terminal audio={audio} user={user} items={items} active={w.z === top} />}
            </div>
          </div>
        </section>
      ))}

      {trails.map((t) => (
        <div key={t.id} className="pc-trail" style={{ left: t.x, top: t.y, width: t.w, height: t.h }} />
      ))}
      {drag && <div className="pc-ghost" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />}
      {saver && <Saver />}
    </div>
  );
}
