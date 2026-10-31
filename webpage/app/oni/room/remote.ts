import type * as THREE from 'three';

/*
 * Los botones del mando, como rectángulos en su textura (medidos en la de 1024 px, origen
 * arriba como en glTF; los números de la textura van girados, y se comprobaron sobre el mando
 * en 3D). El clic se resuelve con el uv del raycast.
 */

export type RemoteButton = 'power' | 'chUp' | 'chDown' | 'ok' | 'source' | `d${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const PX: [RemoteButton, number, number, number, number][] = [
  ['power', 66, 868, 112, 914],
  ['chUp', 398, 762, 442, 806],
  ['chDown', 398, 806, 442, 852],
  ['ok', 726, 862, 774, 910],
  ['source', 543, 885, 567, 927],
  ['d9', 3, 805, 42, 850],
  ['d2', 45, 805, 85, 850],
  ['d7', 88, 805, 128, 850],
  ['d6', 132, 805, 172, 850],
  ['d8', 176, 805, 216, 850],
  ['d0', 252, 862, 296, 920],
  ['d4', 310, 862, 352, 920],
  ['d5', 656, 862, 700, 920],
  ['d1', 726, 798, 766, 850],
  ['d3', 770, 798, 812, 850],
];

export const REMOTE_BUTTONS = PX.map(([id, ...r]) => ({ id, uv: r.map((v) => v / 1024) as [number, number, number, number] }));

export function buttonAt(uv: THREE.Vector2): RemoteButton | null {
  return REMOTE_BUTTONS.find(({ uv: [u0, v0, u1, v1] }) => uv.x >= u0 && uv.x <= u1 && uv.y >= v0 && uv.y <= v1)?.id ?? null;
}
