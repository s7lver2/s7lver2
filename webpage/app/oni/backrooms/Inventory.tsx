'use client';
import { useEffect, useRef, useState } from 'react';
import type { Inv } from './game';
import { FITS, type Gear, type Slot } from './player';

/*
 * El inventario (E): el menú en pantalla de la camcorder encima de la partida, que sigue corriendo.
 * A la izquierda, los objetivos y las biométricas; en medio, los bolsillos y el almacén; a la derecha,
 * el equipo: mano izquierda, mano derecha y cinturón. Las cosas se arrastran a su sitio (o se toca una
 * y luego la casilla); soltarlas en el almacén las guarda.
 */

// los iconos, de 16×16 en blanco del OSD: 1 tinta · 2 sombra
const ICON = {
  flashlight: ['................', '................', '................', '..........1111..', '.........122221.', '.111111111222221', '1222222221222221', '1222222221222221', '1222222221222221', '.111111111222221', '.........122221.', '..........1111..', '................', '................', '................', '................'],
  camera: ['................', '................', '.....111111.....', '....12222221....', '.11111111111111.', '1222222222222211', '12111122222221.1', '1211112211112111', '1211112211112111', '12111122222221.1', '1222222222222211', '.11111111111111.', '................', '................', '................', '................'],
  gun: ['................', '................', '................', '................', '1111111111111111', '1222222222222221', '1111122211111111', '....1221........', '....12221.......', '.....1221.......', '.....1111.......', '................', '................', '................', '................', '................'],
  tape: ['................', '................', '.11111111111111.', '.12222222222221.', '.12111111111121.', '.12111111111121.', '.12222222222221.', '.12211222211221.', '.12122122122121.', '.12211222211221.', '.12222222222221.', '.11111111111111.', '................', '................', '................', '................'],
};
const NAME: Record<Gear, string> = { flashlight: 'FLASHLIGHT', camera: 'CAMCORDER', gun: 'RIFLE' };
const SLOTS: [Slot, string][] = [
  ['left', 'L HAND'],
  ['right', 'R HAND'],
  ['belt', 'BELT'],
];
const STORAGE = 12; // casillas del almacén (4 × 3)

function Icon({ kind, dim }: { kind: keyof typeof ICON; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const x = ref.current!.getContext('2d')!;
    x.clearRect(0, 0, 16, 16);
    ICON[kind].forEach((r, y) => [...r].forEach((ch, i) => ch !== '.' && ((x.fillStyle = ch === '1' ? '#f2f1ea' : '#000'), x.fillRect(i, y, 1, 1))));
  }, [kind]);
  return <canvas ref={ref} width={16} height={16} className="br-inv__icon" data-dim={dim || undefined} aria-hidden="true" />;
}

/** Una barra de bloques del OSD, de diez. */
const Bar = ({ v }: { v: number }) => {
  const n = Math.round(v * 10);
  return (
    <span aria-label={`${Math.round(v * 100)}%`}>
      {'▮'.repeat(n)}
      <span className="br-osd__dim">{'▮'.repeat(10 - n)}</span>
    </span>
  );
};

type Where = Slot | 'store';

export default function Inventory({ inv, onPlace, onLight, onClose }: { inv: Inv; onPlace: (s: Slot, g: Gear | 'none') => void; onLight: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<'items' | 'photos'>('items');
  // lo que se lleva (arrastrando, o tocado para soltarlo con otro toque) y dónde va el fantasma
  const [held, setHeld] = useState<{ g: Gear; from: Where } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const fresh = useRef(false); // el clic que sigue a coger algo con un toque no lo suelta

  const at: Record<Slot, Gear | 'none'> = { left: inv.left, right: inv.hand, belt: inv.belt };
  const owned: Gear[] = ['flashlight', ...(inv.camera ? (['camera'] as const) : []), ...(inv.gun ? (['gun'] as const) : [])];
  const stored = owned.filter((g) => !Object.values(at).includes(g));

  // soltar en `to`: en una casilla que le vale, va ahí; en el almacén, sale de donde estaba
  const drop = (to: Where | null) => {
    if (held && to && to !== held.from) {
      if (to === 'store') onPlace(held.from as Slot, 'none');
      else if (FITS[to].includes(held.g)) onPlace(to, held.g);
    }
    setHeld(null);
    setGhost(null);
  };
  const whereAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-where]') as HTMLElement | null)?.dataset.where as Where | undefined;

  const grab = (g: Gear, from: Where) => (e: React.PointerEvent) => {
    if (held) return; // ya lleva uno (por toque): este toque lo suelta, ver onClick de la casilla
    down.current = { x: e.clientX, y: e.clientY, moved: false };
    setHeld({ g, from });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
    if (d.moved) setGhost({ x: e.clientX, y: e.clientY });
  };
  const up = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (d?.moved) drop(whereAt(e.clientX, e.clientY) ?? null);
    else fresh.current = true; // sin mover: queda cogido hasta tocar una casilla
  };
  // un toque en una casilla (o en el almacén) con algo cogido lo suelta ahí
  const tap = (to: Where) => () => {
    if (fresh.current) fresh.current = false;
    else if (held && !down.current) drop(to);
  };

  const item = (g: Gear, from: Where) => (
    <button type="button" className="br-inv__gear" data-held={held?.g === g || undefined} onPointerDown={grab(g, from)} onPointerMove={move} onPointerUp={up} aria-label={`${NAME[g]}: drag to a slot`}>
      <Icon kind={g} />
      <span>{NAME[g]}</span>
    </button>
  );

  const goals: [string, number, number][] = [
    ['FIND A CAMCORDER', inv.camera ? 1 : 0, 1],
    ['FIND VHS TAPES', inv.tapes, 8],
    ['PHOTOGRAPH ENTITIES', inv.photos, 2],
    ['REACH THE ELEVATOR', inv.escaped ? 1 : 0, 1],
  ];

  return (
    <div className="br-inv" role="dialog" aria-label="Inventory">
      <div className="br-inv__tabs" role="tablist">
        <button type="button" role="tab" className="br-opt" aria-selected={tab === 'items'} onClick={() => setTab('items')}>
          CHARACTER
        </button>
        <button type="button" role="tab" className="br-opt" aria-selected={tab === 'photos'} onClick={() => setTab('photos')}>
          PHOTOS {inv.thumbs.length}
        </button>
        <button type="button" className="br-opt br-inv__exit" onClick={onClose}>
          EXIT [E]
        </button>
      </div>
      {tab === 'items' ? (
        <div className="br-inv__cols">
          <section aria-label="Objectives and biometrics">
            <p className="br-inv__head">OBJECTIVES</p>
            <ul className="br-inv__goals">
              {goals.map(([t, n, of]) => (
                <li key={t} data-done={n >= of || undefined}>
                  <span>{t}</span>
                  <span>
                    {n}/{of}
                  </span>
                </li>
              ))}
            </ul>
            <p className="br-inv__head">BIOMETRICS</p>
            <ul className="br-inv__goals">
              <li data-low={inv.sanity < 0.3 || undefined}>
                <span>SANITY</span>
                <Bar v={inv.sanity} />
              </li>
              <li data-low={inv.stamina < 0.25 || undefined}>
                <span>STAMINA</span>
                <Bar v={inv.stamina} />
              </li>
            </ul>
          </section>

          <section aria-label="Inventory">
            <p className="br-inv__head">POCKETS</p>
            <div className="br-inv__pockets">
              <div className="br-slot">
                <Icon kind="tape" dim={!inv.tapes} />
                <span>VHS TAPE ×{inv.tapes}</span>
              </div>
            </div>
            <p className="br-inv__head">STORAGE</p>
            <div className="br-inv__store" data-where="store" onClick={tap('store')}>
              {Array.from({ length: STORAGE }, (_, i) => (
                <div key={i} className="br-slot">
                  {stored[i] && item(stored[i], 'store')}
                </div>
              ))}
            </div>
            <p className="br-inv__keys">DRAG TO A SLOT. TAP, THEN TAP A SLOT.</p>
          </section>

          <section aria-label="Equipment">
            <p className="br-inv__head">EQUIPMENT</p>
            <div className="br-inv__equip">
              {SLOTS.map(([s, label]) => (
                <div key={s} className="br-slot br-inv__slot" data-where={s} data-slot={s} data-fits={(held && FITS[s].includes(held.g)) || undefined} onClick={tap(s)}>
                  <span className="br-inv__label">{label}</span>
                  {at[s] !== 'none' ? item(at[s] as Gear, s) : <span className="br-osd__dim">EMPTY</span>}
                  {s === 'left' && at.left === 'flashlight' && (
                    <button type="button" className="br-opt br-inv__switch" onClick={(e) => (e.stopPropagation(), onLight())}>
                      {inv.flashOn ? 'ON' : 'OFF'} {Math.round(inv.battery * 100)}%
                    </button>
                  )}
                  {s !== 'left' && at[s] === 'gun' && (
                    <span className="br-inv__state">
                      {inv.ammo}/3 +{inv.spare}
                    </span>
                  )}
                  {s !== 'left' && at[s] === 'camera' && <span className="br-inv__state">PHOTOS {inv.photos}/2</span>}
                </div>
              ))}
            </div>
            <p className="br-inv__keys">[Q] SWAPS R HAND AND BELT</p>
          </section>
        </div>
      ) : inv.thumbs.length ? (
        <div className="br-inv__photos">
          {inv.thumbs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1}`} width={160} height={120} />
          ))}
        </div>
      ) : (
        <p className="br-inv__head">NO PHOTOS. HOLD THE CAMCORDER, RIGHT CLICK, CLICK.</p>
      )}
      {held && ghost && (
        <div className="br-inv__ghost" style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }} aria-hidden="true">
          <Icon kind={held.g} />
        </div>
      )}
    </div>
  );
}
