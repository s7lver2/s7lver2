import type { Pose } from '../library/subject';

/*
 * Las poses del ritual, hechas a mano sobre el esqueleto del sujeto (de pie, encima de idle).
 * Posiciones en el espacio del sujeto: m, +z delante, +x su izquierda (su derecha es -x), y desde
 * el suelo. Medidas de referencia: cadera a 1,10 m, hombros a 1,43, centro de la máscara a 1,72 y
 * 5 cm por delante; brazo 23 + 23 cm, de la muñeca a la punta del índice unos 14 cm.
 *
 * Una pose es de todo el cuerpo: el peso cae en una pierna (la cadera se va hacia ella y baja del
 * otro lado, la otra rodilla se dobla), los hombros se inclinan al revés que la cadera, la columna
 * acompaña al gesto y la cabeza mira hacia abajo, al que está a sus pies (la cámara). Giros de
 * `turn`: [adelante, a su izquierda, inclinarse a su derecha], en grados.
 */
export type PoseName = 'silence' | 'mask' | 'crossed' | 'think' | 'point' | 'kneel';

// la mano cerrada salvo los dedos que se nombran: cada falange, algo menos que la anterior (en x)
const fist = (side: 'Right' | 'Left', deg: number, open: string[] = []): NonNullable<Pose['bones']> => {
  const o: NonNullable<Pose['bones']> = {};
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky'])
    if (!open.includes(f)) for (const j of [1, 2, 3]) o[`${side}Hand${f}${j}`] = [deg * (1 - j * 0.12), 0, 0];
  o[`${side}HandThumb2`] = [deg * 0.4, 0, 0];
  o[`${side}HandThumb3`] = [deg * 0.4, 0, 0];
  return o;
};

// el peso en una pierna: la cadera se desplaza hacia ella y baja un poco; ese pie, debajo; el otro,
// suelto, algo adelantado y abierto (su rodilla se dobla sola al bajar la cadera de ese lado)
const weight = (on: 'Right' | 'Left', free: [number, number, number] = [0.17, 0.07, 0.13]): Pose => {
  const s = on === 'Right' ? -1 : 1, other = on === 'Right' ? 'Left' : 'Right';
  return {
    hips: [0.045 * s, -0.025, 0],
    turn: { Hips: [0, 0, 5 * s], Spine: [0, 0, -3 * s], Spine1: [0, 0, -3 * s] },
    ik: {
      [`${on}Foot`]: { at: [0.09 * s, 0.068, 0.0], pole: [0.2 * s, 0, 1] },
      [`${other}Foot`]: { at: [free[0] * -s, free[1], free[2]], pole: [-0.3 * s, 0, 1] },
    },
  };
};

// varias capas de pose en una (las últimas mandan); los giros del mismo hueso se suman
const merge = (...ps: Pose[]): Pose => {
  const turn: NonNullable<Pose['turn']> = {};
  for (const p of ps)
    for (const [k, v] of Object.entries(p.turn ?? {})) {
      const t = turn[k] ?? [0, 0, 0];
      turn[k] = [t[0] + v![0], t[1] + v![1], t[2] + v![2]];
    }
  return {
    hips: ps.reduce<Pose['hips']>((a, p) => p.hips ?? a, undefined),
    turn,
    bones: Object.assign({}, ...ps.map((p) => p.bones ?? {})),
    ik: Object.assign({}, ...ps.map((p) => p.ik ?? {})),
  };
};

export const POSES: Record<PoseName, Pose> = {
  // shh: se inclina hacia nosotros, la cabeza baja, el índice vertical delante de la boca
  silence: merge(weight('Right'), {
    turn: { Spine1: [6, 0, 0], Spine2: [5, 4, 0], Neck: [6, 0, 0], Head: [10, 0, -6] },
    bones: fist('Right', 75, ['Index']),
    ik: {
      RightHand: { at: [-0.058, 1.43, 0.23], pole: [-1, -0.7, -0.1], aim: [0.0, 1, -0.12] },
      LeftHand: { at: [0.2, 0.96, 0.06], pole: [1, 0, -0.6] },
    },
  }),
  // se coloca la máscara: dos dedos en el puente de la nariz, el codo alto, el torso girado hacia
  // la mano y la barbilla algo alta
  mask: merge(weight('Left'), {
    turn: { Spine: [0, -6, 0], Spine1: [-2, -6, 2], Spine2: [-2, -4, 3], Neck: [2, -4, 0], Head: [4, -6, 4] },
    bones: { ...fist('Right', 70, ['Index', 'Middle']), ...fist('Left', 25) },
    ik: {
      RightHand: { at: [-0.05, 1.57, 0.22], pole: [-1, 0.6, 0.1], aim: [0.2, 0.8, -0.55] },
      LeftHand: { at: [0.22, 0.98, -0.02], pole: [1, 0, -0.8] },
    },
  }),
  // brazos cruzados, el peso cargado en la derecha, un poco echado atrás, mirándonos desde arriba
  crossed: merge(weight('Right', [0.2, 0.07, 0.1]), {
    turn: { Spine: [-3, 0, 0], Spine2: [-3, 0, 0], Neck: [8, 0, 0], Head: [12, 4, -4] },
    bones: { ...fist('Right', 30), ...fist('Left', 30) },
    ik: {
      RightHand: { at: [0.11, 1.24, 0.15], pole: [-1, -0.2, -0.3], aim: [1, 0.05, -0.1] },
      LeftHand: { at: [-0.1, 1.23, 0.15], pole: [1, -0.2, -0.3], aim: [-1, 0.05, -0.1] },
    },
  }),
  // pensando: encorvado hacia delante, la barbilla en el puño, el codo sobre el otro brazo, la
  // cabeza ladeada y bajada; el peso en la izquierda y la rodilla derecha suelta
  think: merge(weight('Left', [0.15, 0.07, 0.16]), {
    turn: { Spine: [4, 0, 0], Spine1: [7, 3, 0], Spine2: [6, 3, -2], Neck: [8, 0, -4], Head: [12, 0, -10] },
    bones: { ...fist('Right', 55), ...fist('Left', 35) },
    ik: {
      RightHand: { at: [-0.01, 1.46, 0.17], pole: [-0.6, -1, 0.3], aim: [0, 1, 0.1] },
      LeftHand: { at: [-0.08, 1.17, 0.22], pole: [1, -1, -0.3], aim: [-1, 0, 0] },
    },
  }),
  // señala a alguien a su derecha, fuera de plano, con el brazo extendido; el torso y la cabeza
  // giran hacia allí (señalar a cámara desde tan cerca esconde el brazo delante del cuerpo)
  point: merge(weight('Left', [0.14, 0.07, 0.26]), {
    turn: { Spine: [2, -6, 0], Spine1: [3, -8, 2], Spine2: [2, -6, 3], Neck: [4, -10, 0], Head: [8, -22, 0] },
    bones: { ...fist('Right', 85, ['Index']), ...fist('Left', 30) },
    ik: {
      RightHand: { at: [-0.48, 1.34, 0.16], pole: [0, -1, -0.4], aim: [-1, -0.08, 0.2] },
      LeftHand: { at: [0.22, 0.98, -0.06], pole: [1, 0, -0.8] },
    },
  }),
  // rodilla derecha en el suelo, la izquierda a 90°, el torso algo vencido y la cabeza baja
  kneel: {
    hips: [0, -0.535, 0],
    turn: { Spine1: [6, 0, 0], Spine2: [4, 0, 0], Neck: [12, 0, 0], Head: [22, 0, 0] },
    // el pie de atrás estirado, con el empeine hacia el suelo
    bones: { RightFoot: [-35, 0, 0], ...fist('Left', 25), ...fist('Right', 20) },
    ik: {
      RightFoot: { at: [-0.1, 0.07, -0.4], pole: [0, -1, 0.6] },
      LeftFoot: { at: [0.12, 0.07, 0.42], pole: [0, 0.3, 1] },
      // la izquierda sobre la rodilla de delante; la derecha, colgando junto al muslo
      LeftHand: { at: [0.11, 0.62, 0.4], pole: [1, -0.2, -1], aim: [0, -0.4, 1] },
      RightHand: { at: [-0.24, 0.48, 0.05], pole: [-1, 0, -0.5] },
    },
  },
};
