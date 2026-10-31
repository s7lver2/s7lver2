/*
 * El muro de teles: qué modelos hay, hacia dónde mira cada uno y dónde está su pantalla, y
 * cómo se apilan en un arco poco profundo frente a la consola.
 */

export type TvModel = 'tvstack' | 'crt' | 'oldtv' | 'retrotv' | 'antennatv';

export interface TvSlot { model: TvModel; position: [number, number, number]; rotY: number; scale: number; screenCount: number }

/**
 * - front: hacia dónde mira la pantalla en el modelo original.
 * - aspect: alto / ancho de frente.
 * - screens: materiales de las mallas de pantalla, o rectángulos medidos a ojo (visor de
 *   desarrollo) para los modelos de una sola malla, en unidades normalizadas (lado mayor = 1,
 *   centro de la caja = 0, ya girado de frente): centro x,y,z y tamaño ancho,alto.
 */
export const TV_MODELS: Record<TvModel, { url: string; front: '+z' | '-z' | '+x'; aspect: number; screens: RegExp | { c: [number, number, number]; s: [number, number] }[] }> = {
  tvstack: { url: '/models/surveilance_room/tvstack.glb', front: '+z', aspect: 0.9, screens: /^(screen|sreen)_|^Sreen_/i },
  crt: { url: '/models/surveilance_room/crt.glb', front: '-z', aspect: 0.96, screens: /^TVScreen$/ },
  oldtv: { url: '/models/surveilance_room/oldtv.glb', front: '+z', aspect: 0.674, screens: [{ c: [-0.095, 0.017, 0.34], s: [0.7, 0.6] }] },
  retrotv: { url: '/models/surveilance_room/retrotv.glb', front: '+x', aspect: 1.095, screens: [{ c: [0, 0.1, 0.5], s: [0.836, 0.648] }] },
  antennatv: { url: '/models/surveilance_room/antennatv.glb', front: '+x', aspect: 1.15, screens: /^TV_Screen_PBR$/ },
};

const SCREENS: Record<TvModel, number> = { tvstack: 10, crt: 1, oldtv: 1, retrotv: 1, antennatv: 1 };
export const WALL_Z = -1.6; // frente del muro, en el centro
export const WALL_R = 4.6; // el muro se curva un poco hacia ti (y en U si hay muchas teles)
export const SHELF_Y = 0.8; // las teles empiezan a la altura de la mesa
const GAP = 0.012;

// azar con semilla: el muro sale igual cada vez
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Un muro denso, pegado detrás de la mesa, de la altura de la mesa al techo: filas de teles de
 * anchos distintos que se tocan, sobre un arco que se cierra en U cuando hay muchas. Las teles
 * salen ordenadas de la más céntrica a la más apartada: el canal 1 cae delante de ti. Las dos
 * pilas pequeñas van al suelo, a los lados de la mesa.
 */
/** `missing`: modelos que no han llegado (los de licencia que no van en el repo): no se usan. */
export function layoutWall(screens: number, seed: number, missing: TvModel[] = []): TvSlot[] {
  const rand = rng(seed);
  const singles = Math.max(30, screens);
  const rows = 4;
  const perRow = Math.ceil(singles / rows);
  const zc = WALL_Z + WALL_R;
  const out: (TvSlot & { rank: number })[] = [];
  let antennas = 0, y = SHELF_Y;
  for (let r = 0; r < rows; r++) {
    const n = Math.min(perRow, singles - r * perRow);
    const row: { model: TvModel; w: number }[] = [];
    for (let i = 0; i < n; i++) {
      const pool: TvModel[] = r === rows - 1 && antennas < 2 && rand() < 0.3 ? ['antennatv'] : (['crt', 'oldtv', 'retrotv'] as TvModel[]).filter((m) => !missing.includes(m));
      const model = pool[(rand() * pool.length) | 0];
      if (model === 'antennatv') antennas++;
      // cada tele elige su alto; el ancho sale de su proporción (así las filas casan)
      row.push({ model, w: Math.min(0.66, (0.4 + rand() * 0.08) / TV_MODELS[model].aspect) });
    }
    const L = row.reduce((a, t) => a + t.w + GAP, -GAP);
    let s = -L / 2, rowH = 0;
    row.forEach((t, i) => {
      const w = t.w;
      const th = (s + w / 2) / WALL_R;
      s += w + GAP;
      const R = WALL_R + (rand() - 0.5) * 0.06;
      rowH = Math.max(rowH, w * TV_MODELS[t.model].aspect);
      out.push({
        model: t.model,
        position: [R * Math.sin(th), y, zc - R * Math.cos(th)],
        rotY: -th + ((rand() - 0.5) * 5 * Math.PI) / 180,
        scale: w,
        screenCount: 1,
        rank: Math.abs(r - 1) * 10 + Math.abs(i - (n - 1) / 2),
      });
    });
    y += rowH + 0.01;
  }
  for (const x of [-1, 1]) out.push({ model: 'tvstack', position: [x * 2.55, 0, -0.95], rotY: -x * 0.75, scale: 0.95, screenCount: SCREENS.tvstack, rank: 1e6 });
  return out.sort((a, b) => a.rank - b.rank).map(({ rank: _, ...s }) => s);
}
