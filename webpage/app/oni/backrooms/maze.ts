/*
 * El mapa de las backrooms, nuevo en cada partida. Una rejilla de celdas de 1,5 m (suelo o pared)
 * repartida por zonas, como en los mapas del BR Movie y de Escape the Backrooms: salas de columnas,
 * pasillos largos paralelos, oficinas de cuartos pequeños con tabiques sueltos, salas grandes vacías y
 * alguna zona apagada. Puro: la misma semilla da el mismo mapa, y todo lo que hay que alcanzar se
 * alcanza desde el inicio sin pisar un hueco.
 */

export type Cell = { x: number; y: number };
export type PropKind = 'vent' | 'socket' | 'armchair' | 'exit' | 'door';
export interface Maze {
  w: number;
  h: number; // en celdas de 1,5 m
  open: Uint8Array; // w*h, 1 = suelo, 0 = pared
  lit: Uint8Array; // w*h, 1 = zona con fluorescentes, 0 = zona apagada
  voids: Cell[]; // huecos al vacío (suelo abierto que no se pisa)
  start: Cell;
  elevator: Cell; // un callejón de una celda: la cabina
  camera: Cell;
  pistol: Cell | null;
  tapes: Cell[]; // 8
  spawns: Cell[]; // arranque de bacteria y partygoer, y candidatos para las que reaparezcan
  lamps: Cell[]; // celdas con panel de luz encendido
  props: { cell: Cell; kind: PropKind; rot: number }[];
}

export const CELL = 1.5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distancias por BFS desde `from` (-1 donde no se llega); `blocked` cuenta como pared. */
export function bfs(m: Pick<Maze, 'w' | 'h' | 'open'>, from: Cell, blocked?: Set<number>) {
  const d = new Int32Array(m.w * m.h).fill(-1), q = [from.y * m.w + from.x];
  d[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % m.w, y = (c / m.w) | 0;
    for (const [dx, dy] of DIRS) {
      const n = (y + dy) * m.w + x + dx;
      if (x + dx < 0 || y + dy < 0 || x + dx >= m.w || y + dy >= m.h || !m.open[n] || d[n] >= 0 || blocked?.has(n)) continue;
      d[n] = d[c] + 1;
      q.push(n);
    }
  }
  return d;
}

/** Lo que mide, en celdas, el recorrido bueno: inicio → cámara → cintas (la más cercana cada vez) → ascensor. */
export function routeLength(m: Maze) {
  const blocked = new Set(m.voids.map((v) => v.y * m.w + v.x));
  let at = m.camera, len = bfs(m, m.start, blocked)[at.y * m.w + at.x];
  const left = [...m.tapes];
  while (left.length) {
    const d = bfs(m, at, blocked);
    left.sort((a, b) => d[a.y * m.w + a.x] - d[b.y * m.w + b.x]);
    const t = left.shift()!;
    len += d[t.y * m.w + t.x];
    at = t;
  }
  return len + bfs(m, at, blocked)[m.elevator.y * m.w + m.elevator.x];
}

type Rect = { x: number; y: number; w: number; h: number };

function build(seed: number, n: number): Maze {
  const rnd = mulberry32(seed), w = n, h = n, open = new Uint8Array(w * h), lit = new Uint8Array(w * h);
  const at = (x: number, y: number) => y * w + x;
  const int = (a: number, b: number) => a + ((rnd() * (b - a + 1)) | 0); // entero en [a, b]
  const pick = <T,>(a: T[]) => a[(rnd() * a.length) | 0];
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fill = (r: Rect, v: 0 | 1) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) open[at(x, y)] = v;
  };
  const wall = (x: number, y: number) => void (open[at(x, y)] = 0);

  // un hueco de puerta de `len` celdas en una línea de pared (vertical u horizontal), donde haya suelo a los dos lados
  const door = (vertical: boolean, line: number, from: number, to: number, len = 2) => {
    const ok: number[] = [];
    for (let i = from; i + len - 1 <= to; i++) {
      let good = true;
      for (let k = 0; k < len && good; k++) {
        const [a, b] = vertical ? [at(line - 1, i + k), at(line + 1, i + k)] : [at(i + k, line - 1), at(i + k, line + 1)];
        good = !!open[a] && !!open[b];
      }
      if (good) ok.push(i);
    }
    if (!ok.length) return false;
    const i = pick(ok);
    for (let k = 0; k < len; k++) open[vertical ? at(line, i + k) : at(i + k, line)] = 1;
    return true;
  };

  // las zonas: cada una llena su rectángulo (ya abierto) con lo suyo
  const pillars = (r: Rect) => {
    const cross = rnd() < 0.35, step = cross ? 5 : 3;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++)
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if ((x - r.x) % step !== step >> 1 || (y - r.y) % step !== step >> 1) continue;
        wall(x, y);
        if (cross) DIRS.forEach(([dx, dy]) => wall(x + dx, y + dy)); // columnas en cruz
      }
  };
  const stripes = (r: Rect) => {
    // tiras de 2 celdas a lo largo del lado mayor; cada muro con uno o dos huecos
    const along = r.w >= r.h;
    const span = along ? r.h : r.w, len = along ? r.w : r.h;
    for (let k = 2; k < span - 1; k += 3) {
      for (let i = 0; i < len; i++) along ? wall(r.x + i, r.y + k) : wall(r.x + k, r.y + i);
      const gaps = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let g = 0; g < gaps; g++) {
        const i = int(0, len - 2);
        for (let q = 0; q < 2; q++) open[along ? at(r.x + i + q, r.y + k) : at(r.x + k, r.y + i + q)] = 1;
      }
    }
  };
  const office = (r: Rect, depth = 0): void => {
    // cuartos pequeños: se parte en dos con un muro y una puerta, hasta cuartos de 3–6 celdas
    const big = Math.max(r.w, r.h);
    if (big < 7 || depth > 4 || (big < 10 && rnd() < 0.3)) {
      // un tabique suelto dentro, a veces
      if (r.w >= 4 && r.h >= 4 && rnd() < 0.4) {
        const vert = rnd() < 0.5, l = int(2, 3);
        const x = int(r.x + 1, r.x + r.w - 2), y = int(r.y + 1, r.y + r.h - 2);
        for (let i = 0; i < l; i++) vert ? y + i < r.y + r.h - 1 && wall(x, y + i) : x + i < r.x + r.w - 1 && wall(x + i, y);
      }
      return;
    }
    const vert = r.w > r.h || (r.w === r.h && rnd() < 0.5);
    const s = vert ? int(r.x + 3, r.x + r.w - 4) : int(r.y + 3, r.y + r.h - 4);
    if (vert) {
      for (let y = r.y; y < r.y + r.h; y++) wall(s, y);
      office({ x: r.x, y: r.y, w: s - r.x, h: r.h }, depth + 1);
      office({ x: s + 1, y: r.y, w: r.x + r.w - s - 1, h: r.h }, depth + 1);
      door(true, s, r.y, r.y + r.h - 1, rnd() < 0.7 ? 1 : 2);
    } else {
      for (let x = r.x; x < r.x + r.w; x++) wall(x, s);
      office({ x: r.x, y: r.y, w: r.w, h: s - r.y }, depth + 1);
      office({ x: r.x, y: s + 1, w: r.w, h: r.y + r.h - s - 1 }, depth + 1);
      door(false, s, r.x, r.x + r.w - 1, rnd() < 0.7 ? 1 : 2);
    }
  };
  const hall = (r: Rect) => {
    // sala grande: casi vacía, con algún tabique y alguna columna sueltos
    const k = Math.round((r.w * r.h) / 40);
    for (let i = 0; i < k; i++) {
      const x = int(r.x + 2, r.x + r.w - 3), y = int(r.y + 2, r.y + r.h - 3);
      if (rnd() < 0.5) wall(x, y);
      else {
        const vert = rnd() < 0.5, l = int(2, 4);
        for (let q = 0; q < l; q++) vert ? y + q < r.y + r.h - 2 && wall(x, y + q) : x + q < r.x + r.w - 2 && wall(x + q, y);
      }
    }
  };
  const ZONES = [pillars, pillars, stripes, office, office, hall];

  // el reparto: un BSP; cada corte deja un muro de una celda con dos o tres puertas
  const leaves: Rect[] = [];
  const cuts: { vertical: boolean; line: number; from: number; to: number }[] = [];
  const split = (r: Rect) => {
    const big = Math.max(r.w, r.h);
    if (big <= 16 && (big <= 10 || rnd() < 0.4)) return leaves.push(r);
    const vert = r.w > r.h || (r.w === r.h && rnd() < 0.5);
    const lo = vert ? r.x : r.y, len = vert ? r.w : r.h, s = lo + int(Math.max(5, (len * 0.3) | 0), Math.min(len - 6, (len * 0.7) | 0));
    if (vert) {
      cuts.push({ vertical: true, line: s, from: r.y, to: r.y + r.h - 1 });
      split({ x: r.x, y: r.y, w: s - r.x, h: r.h });
      split({ x: s + 1, y: r.y, w: r.x + r.w - s - 1, h: r.h });
    } else {
      cuts.push({ vertical: false, line: s, from: r.x, to: r.x + r.w - 1 });
      split({ x: r.x, y: r.y, w: r.w, h: s - r.y });
      split({ x: r.x, y: s + 1, w: r.w, h: r.y + r.h - s - 1 });
    }
  };
  split({ x: 1, y: 1, w: w - 2, h: h - 2 });
  for (const l of leaves) {
    fill(l, 1);
    pick(ZONES)(l);
    const on = rnd() < 0.82 ? 1 : 0; // alguna zona entera apagada
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) lit[at(x, y)] = on;
  }
  // las puertas entre zonas, de las hojas hacia arriba (las más hondas primero: las de arriba ya ven suelo)
  for (const c of cuts.reverse()) {
    const k = c.to - c.from > 20 ? 3 : 2;
    for (let i = 0; i < k; i++) door(c.vertical, c.line, c.from, c.to, rnd() < 0.5 ? 2 : 3);
  }

  // el inicio: el suelo más cerca de la esquina; lo que no se alcanza desde él se tapia
  let start: Cell = { x: 1, y: 1 };
  for (let s = 2; s < w + h; s++) {
    const c = Array.from({ length: s - 1 }, (_, i) => ({ x: 1 + i, y: s - 1 - i })).find((c) => c.x < w - 1 && c.y < h - 1 && open[at(c.x, c.y)]);
    if (c) {
      start = c;
      break;
    }
  }
  const m = { w, h, open };
  const d0 = bfs(m, start);
  for (let i = 0; i < w * h; i++) if (open[i] && d0[i] < 0) open[i] = 0;

  const nOpen = (c: Cell) => DIRS.filter(([dx, dy]) => open[at(c.x + dx, c.y + dy)]).length;
  const near = (a: Cell, b: Cell, k: number) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < k;

  // el ascensor: un nicho de una celda abierto en una pared, lo más lejos posible del inicio, con
  // pared a sus otros tres lados (la cabina)
  let elevator: Cell = start, best = -1;
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      if (open[at(x, y)]) continue;
      const opens = DIRS.filter(([dx, dy]) => open[at(x + dx, y + dy)]);
      if (opens.length !== 1) continue;
      const [dx, dy] = opens[0], o = d0[at(x + dx, y + dy)];
      if (o < 0) continue;
      if (o > best) (best = o), (elevator = { x, y });
    }
  open[at(elevator.x, elevator.y)] = 1;
  lit[at(elevator.x, elevator.y)] = 1;

  const cells: Cell[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (open[at(x, y)] && !(x === elevator.x && y === elevator.y)) cells.push({ x, y });
  const total = cells.length + 1;
  const reach = (blocked: Set<number>) => bfs(m, start, blocked).reduce((s, v) => s + (v >= 0 ? 1 : 0), 0);

  // huecos al vacío: en sitios abiertos (4 vecinos) y lejos del inicio y del ascensor, sin desconectar nada
  const blocked = new Set<number>(), voids: Cell[] = [];
  for (const c of shuffle([...cells])) {
    if (voids.length >= 5 + ((seed >>> 3) & 1) * 3) break;
    if (nOpen(c) < 4 || near(c, start, 10) || near(c, elevator, 6) || voids.some((v) => near(v, c, 10))) continue;
    blocked.add(at(c.x, c.y));
    if (reach(blocked) === total - blocked.size) voids.push(c);
    else blocked.delete(at(c.x, c.y));
  }

  const d = bfs(m, start, blocked);
  const free = cells.filter((c) => !blocked.has(at(c.x, c.y)) && !(c.x === start.x && c.y === start.y) && d[at(c.x, c.y)] > 0);
  const used = new Set<number>([at(start.x, start.y), at(elevator.x, elevator.y)]);
  const take = (c: Cell) => (used.add(at(c.x, c.y)), c);
  const dist = (c: Cell) => d[at(c.x, c.y)];
  const camera = take(pick(free.filter((c) => dist(c) >= 6 && dist(c) <= 12)) ?? free[0]);
  // las cintas, repartidas por todo el mapa: cada una donde más lejos queda, andando, de las demás y de
  // la cámara (con algo de azar para que no salgan siempre en las mismas puntas)
  const tapes: Cell[] = [];
  const cand = shuffle(free.filter((c) => !used.has(at(c.x, c.y)) && dist(c) >= 8 && !near(c, elevator, 6)));
  const gap = new Float32Array(m.w * m.h).fill(Infinity);
  const mark = (c: Cell) => bfs(m, c, blocked).forEach((v, i) => v >= 0 && v < gap[i] && (gap[i] = v));
  mark(camera);
  while (tapes.length < 8 && cand.length) {
    let bi = 0, bs = -1;
    cand.forEach((c, i) => {
      const s = gap[at(c.x, c.y)] * (0.8 + rnd() * 0.4);
      if (s > bs) (bs = s), (bi = i);
    });
    const c = take(cand.splice(bi, 1)[0]);
    tapes.push(c);
    mark(c);
  }
  // la pistola, a veces, en un rincón (dos paredes al lado) lejos del inicio
  const corners = free.filter((c) => nOpen(c) <= 2 && dist(c) >= 18 && !used.has(at(c.x, c.y)));
  const pistol = rnd() < 0.5 && corners.length ? take(pick(corners)) : null;
  // los arranques de las entidades: lejos del inicio y separados entre sí
  const spawns: Cell[] = [];
  for (const c of [...free].sort((a, b) => dist(b) - dist(a))) {
    if (spawns.length === 8) break;
    if (dist(c) < 18 || used.has(at(c.x, c.y)) || near(c, elevator, 3) || spawns.some((s) => near(s, c, 12))) continue;
    spawns.push(c);
  }
  // los fluorescentes: uno cada dos celdas (3 m) en las zonas encendidas, uno de cada nueve fundido
  const lamps = cells.filter((c) => c.x % 2 === 0 && c.y % 2 === 0 && lit[at(c.x, c.y)] && rnd() > 1 / 9);
  // detalles: rejillas en el techo, enchufes y puertas falsas en las paredes, sillones en las salas
  const props: Maze['props'] = [];
  const wallSide = (c: Cell) => DIRS.findIndex(([dx, dy]) => !open[at(c.x + dx, c.y + dy)]);
  for (const c of free) {
    const r = rnd();
    if (used.has(at(c.x, c.y))) continue;
    if (r < 0.025 && c.x % 2 && c.y % 2) props.push({ cell: c, kind: 'vent', rot: 0 });
    else if (r < 0.05 && wallSide(c) >= 0) props.push({ cell: c, kind: 'socket', rot: wallSide(c) });
    else if (r < 0.058 && wallSide(c) >= 0) props.push({ cell: c, kind: 'door', rot: wallSide(c) });
    else if (r < 0.064 && nOpen(c) === 4) props.push({ cell: c, kind: 'armchair', rot: (rnd() * 4) | 0 });
  }
  // la salida: el cartel encima del ascensor, en su lado abierto
  props.push({ cell: elevator, kind: 'exit', rot: DIRS.findIndex(([dx, dy]) => open[at(elevator.x + dx, elevator.y + dy)]) });
  return { w, h, open, lit, voids, start, elevator, camera, pistol, tapes, spawns, lamps, props };
}

/**
 * El mapa de una semilla, del tamaño justo para una partida de ≤ 10 min: el recorrido bueno
 * (inicio → cámara → cintas → ascensor) mide 240–400 celdas (360–600 m, unos 3–5 min entre andar y
 * correr; con lo que se busca, se pierde y se esquiva, 7–10).
 */
export function generateMaze(seed: number): Maze {
  let n = 56, best: Maze | undefined, bestErr = Infinity;
  for (let i = 0; i < 6; i++) {
    const m = build(seed, n), len = routeLength(m);
    const err = len < 240 ? 240 - len : len > 400 ? len - 400 : 0;
    if (err < bestErr && m.tapes.length === 8 && m.spawns.length >= 2) (best = m), (bestErr = err);
    if (!err) break;
    n += len < 240 ? 6 : -6;
  }
  return best ?? build(seed, 56);
}
