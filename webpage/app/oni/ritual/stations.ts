import * as THREE from 'three';
import type { Shot } from '../library/shots';

/*
 * El recorrido del ritual por estaciones: 0 el silencio, 1-4 las estatuas, 5 la vista cenital.
 * El scroll da un progreso continuo `p` (0-5); `shape` lo convierte en el de la cámara, que se
 * queda quieta en parte del tramo y gira con entrada y salida suaves en el resto; `shotAt` dice
 * dónde está la cámara para un progreso de cámara.
 */
export const STATIONS = 6;
/** Lo que se queda quieta la cámara en cada estación (fracción del tramo). */
const HOLD = 0.4;

const smoother = (k: number) => k * k * k * (k * (6 * k - 15) + 10);

/** Progreso de scroll → progreso de cámara. Deja fijos los enteros y es monótona. */
export function shape(p: number) {
  const n = Math.floor(p), f = p - n, a = HOLD / 2;
  if (f <= a) return n;
  if (f >= 1 - a) return n + 1;
  return n + smoother((f - a) / (1 - HOLD));
}

export interface Stage {
  center: THREE.Vector3;
  /** La figura del silencio: hacia dónde mira y dónde queda su máscara ya en la pose. */
  silence: { yaw: number; face: THREE.Vector3 };
  statues: { pos: THREE.Vector3; yaw: number }[];
  /** Radio del círculo, para que la cenital lo encuadre entero. */
  radius: number;
  aspect: number;
}

const ahead = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
const side = (yaw: number) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
const TAN25 = Math.tan(THREE.MathUtils.degToRad(25));
/** Cuánto se acerca la cámara a las estatuas respecto al plano que encuadra justo los dos estandartes. */
const CLOSE = 1.02;

/** El plano fijo de la estación `n` (un entero). */
export function stationShot(n: number, s: Stage): Shot {
  if (n <= 0) {
    // primer plano del silencio: a 0,9 m de la máscara, un poco por debajo de ella
    const { yaw, face } = s.silence;
    return { pos: face.clone().addScaledVector(ahead(yaw), 0.9).setY(face.y - 0.1), look: face.clone().setY(face.y - 0.04), fov: 40, breathe: 0.002 };
  }
  if (n >= 5) {
    // la cenital: el círculo entero y las cinco puntas, también en vertical. No justo encima: 0,6 m
    // hacia la última estatua, de donde llega. Mirando en vertical exacto, el giro de la imagen lo
    // decidía un desvío de 1 mm y, al llegar, la cámara rotaba de golpe
    const half = (s.radius + 1.2) / Math.min(1, s.aspect);
    const out = s.statues[3].pos.clone().sub(s.center).setY(0).normalize();
    return { pos: s.center.clone().addScaledVector(out, 0.6).setY(9), look: s.center.clone(), fov: THREE.MathUtils.radToDeg(2 * Math.atan(half / 9)) };
  }
  // la estatua n: de cintura para arriba, ligeramente desde abajo, con sus dos hologramas; en
  // pantallas estrechas la cámara se aleja (y deja de ir de lado) hasta que caben los dos
  const { pos, yaw } = s.statues[n - 1], f = ahead(yaw), r = side(yaw);
  const off = s.aspect >= 1.2 ? 0.3 : 0;
  // en vertical los hologramas van apilados y más cerca del eje (ver la escena)
  const d = Math.max(0.9, ((s.aspect < 0.8 ? 0.52 : 0.62) + off) / (TAN25 * s.aspect) - 0.1) * CLOSE;
  return {
    pos: pos.clone().addScaledVector(f, d).addScaledVector(r, off).setY(0.95),
    look: pos.clone().addScaledVector(f, 0.05).setY(1.55),
    fov: 50,
    breathe: 0.0025,
  };
}

/** Vueltas de más que da la cámara en cada tramo (del silencio a la 1, de la 1 a la 2...): distintas, para que cada paso se sienta otro. */
const TURNS = [1, 2, 1, 3];

/** El plano de un progreso de cámara: entre estaciones, un arco por fuera, dando vueltas. */
export function shotAt(c: number, s: Stage): Shot {
  const n = Math.floor(c), k = c - n;
  const a = stationShot(n, s);
  if (k < 1e-4) return a;
  const b = stationShot(n + 1, s);
  // en polares alrededor del centro: el ángulo por el camino corto, y el radio que se abre a mitad
  const pa = a.pos.clone().sub(s.center), pb = b.pos.clone().sub(s.center);
  const aa = Math.atan2(pa.x, pa.z);
  let da = Math.atan2(pb.x, pb.z) - aa;
  da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
  // hasta la última estatua no va directa: da varias vueltas alrededor y se para en la siguiente
  if (n + 1 <= 4) da += Math.sign(da || 1) * TURNS[n] * Math.PI * 2;
  const ang = aa + da * k;
  // subiendo a la cenital, la mirada y el plano llegan antes (en el primer 40 %), suaves en los dos extremos
  const early = THREE.MathUtils.smoothstep(k, 0, 0.4);
  // subiendo a la cenital se abre más, para ver el grupo en diagonal mientras se separa
  const rad = THREE.MathUtils.lerp(Math.hypot(pa.x, pa.z), Math.hypot(pb.x, pb.z), k) + Math.sin(Math.PI * k) * (n === 4 ? 3.2 : 1.2);
  return {
    pos: new THREE.Vector3(Math.sin(ang) * rad, THREE.MathUtils.lerp(a.pos.y, b.pos.y, k) + Math.sin(Math.PI * k) * 0.5, Math.cos(ang) * rad).add(s.center),
    // en mitad de las vueltas mira al centro del grupo; al llegar, a la estatua. Subiendo a la
    // cenital, mira enseguida al centro y abre el plano: así se ve cómo se separan
    look: n === 4 ? a.look.clone().lerp(b.look, early) : a.look.clone().lerp(b.look, k).lerp(s.center.clone().setY(1.4), Math.sin(Math.PI * k)),
    fov: THREE.MathUtils.lerp(a.fov!, b.fov!, n === 4 ? early : k),
    breathe: THREE.MathUtils.lerp(a.breathe ?? 0, b.breathe ?? 0, k),
  };
}
