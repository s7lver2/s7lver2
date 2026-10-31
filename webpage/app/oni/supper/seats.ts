import type { Clip, Pose } from '../library/subject';
import { TABLE } from './table';

/*
 * Los trece sitios, detrás de la mesa, como en el cuadro: cuatro tríos y el del centro. Solo el del
 * centro está sentado; los demás se pelean. Cada uno se queda con un trozo de su clip (`win`, en s:
 * el golpe, el disparo, el impacto), de ida y vuelta y muy despacio, como un fotograma de una pelea
 * que casi no avanza. Encima va la postura: de pie, de pie en la silla, de bruces sobre la mesa o
 * cayéndose de espaldas.
 *
 * Se cuadran a mano con ?supper&edit (en desarrollo): el panel copia la línea de cada uno, que va aquí.
 * Los dx/dz de ahora salen de medir los huesos a lo largo de cada trozo: ninguno se mete en otro, ni
 * en la mesa ni en el ventanal.
 */

export type Stance = 'stand' | 'lean' | 'chair' | 'fall';
export type Prop = 'pistol' | 'mp5' | 'grenade';
export interface Seat {
  clip: Clip;
  win: [number, number];
  stance: Stance;
  /** A quién se encara (índice del sitio); cuánto de ese giro se queda (0: a cámara, 1: de perfil). */
  at: number;
  turn: number;
  prop?: Prop;
  /** Lo que se aparta de su sitio (m): a lo largo de la mesa y hacia delante. */
  dx?: number;
  dz?: number;
}

/** Dónde va la silla (z de su asiento) y lo alto que es el asiento. */
export const SEAT_Z = -TABLE.d / 2 - 0.24, SEAT_H = 0.47;
/** Lo que tarda cada trozo en ir y volver (s): cuanto más, más lenta la cámara lenta. */
export const PERIOD = 32;

/** Su sitio a lo largo de la mesa (m). */
export const seatX = (i: number) => (i - 6) * 0.47 + Math.sign(i - 6) * 0.16;

export const SEATS: Seat[] = [
  { clip: 'shooting', win: [0.15, 0.45], stance: 'stand', at: 1, turn: 0.75, prop: 'pistol' },
  { clip: 'reaction', win: [0.3, 0.95], stance: 'fall', at: 0, turn: 0.5 },
  { clip: 'drawing-gun', win: [1.25, 1.85], stance: 'chair', at: 0, turn: 0.7, prop: 'pistol' },
  { clip: 'punching', win: [0.25, 0.6], stance: 'stand', at: 4, turn: 0.85, dx: -0.22, dz: 0.15 },
  { clip: 'head-hit', win: [0.2, 0.75], stance: 'lean', at: 3, turn: 0.5, dx: 0.1, dz: -0.1 },
  { clip: 'toss-grenade', win: [1.0, 1.9], stance: 'chair', at: 4, turn: 0.35, prop: 'grenade', dx: 0.08 },
  { clip: 'idle', win: [0, 0], stance: 'stand', at: 6, turn: 0 },
  { clip: 'taking-punch', win: [0.6, 1.5], stance: 'stand', at: 8, turn: 0.6, dx: -0.05 },
  { clip: 'punching', win: [0.25, 0.6], stance: 'chair', at: 7, turn: 0.85, dx: 0.18 },
  { clip: 'kidney-hit', win: [0.15, 0.7], stance: 'lean', at: 8, turn: 0.4 },
  { clip: 'shooting', win: [0.15, 0.45], stance: 'stand', at: 12, turn: 0.7, prop: 'mp5' },
  { clip: 'reaction', win: [0.3, 0.95], stance: 'fall', at: 10, turn: 0.45 },
  { clip: 'drawing-gun', win: [1.25, 1.85], stance: 'stand', at: 10, turn: 0.75, prop: 'pistol', dx: 0.08 },
];
export const CENTER = 6;
/** El trío al que pertenece cada sitio (2: el del centro). */
export const group = (i: number) => (i === CENTER ? 2 : i < 3 ? 0 : i < 6 ? 1 : i < 10 ? 3 : 4);

/* Medidas en el espacio del sujeto (ver ritual/poses.ts): +z delante, y desde el suelo; sentado, la cadera baja 0,56 m. */
export const STANCES: Record<Stance, Pose | null> = {
  stand: null,
  chair: null,
  fall: null,
  lean: { hips: [0, -0.04, 0.05], turn: { Spine: [32, 0, 0], Spine1: [26, 0, 0], Spine2: [18, 0, 0], Neck: [-14, 0, 0], Head: [-10, 0, 0] } },
};
/** Cuánto sube la raíz (m) y cuánto se inclina hacia atrás (rad), por postura. */
export const LIFT: Record<Stance, number> = { stand: 0, chair: SEAT_H, lean: 0, fall: 0.2 };
export const TILT: Record<Stance, number> = { stand: 0, chair: 0, lean: 0, fall: -0.5 };

/*
 * El del centro: sentado e inclinado hacia ti, el peso en los antebrazos; las manos abiertas sobre la
 * mesa, algo más juntas que los hombros y con los dedos un poco hacia dentro, una más adelantada que
 * la otra; los codos abiertos y un pie recogido bajo la silla. La cabeza la lleva la mirada (fija en
 * la cámara), que así le sale un poco desde abajo.
 */
export const HANDS: Pose = {
  hips: [0, -0.56, 0],
  turn: { Spine: [9, 0, 0], Spine1: [7, 1, 0], Spine2: [5, 0, 0] },
  ik: {
    RightFoot: { at: [-0.15, 0.07, 0.42], pole: [-0.1, 0.3, 1] },
    LeftFoot: { at: [0.12, 0.07, 0.28], pole: [0.1, 0.3, 1] },
    RightHand: { at: [-0.18, TABLE.top + 0.015, 0.37], pole: [-1, -0.3, -0.5], aim: [0.3, -0.12, 1] },
    LeftHand: { at: [0.16, TABLE.top + 0.015, 0.41], pole: [1, -0.3, -0.5], aim: [-0.25, -0.12, 1] },
  },
};
