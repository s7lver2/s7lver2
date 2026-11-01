import * as THREE from 'three';
import { aim } from './rig';

/*
 * IK de dos huesos (brazo y antebrazo) para que las manos cojan de verdad lo que llevan: la muñeca
 * va al punto de agarre, el codo se dobla hacia el polo (abajo y hacia fuera) y la mano apunta los
 * dedos hacia donde se le diga. Va después del mezclador, encima de la animación.
 */

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _e = new THREE.Vector3();

/**
 * Lleva la muñeca (`hand`) a `target` doblando el codo hacia `pole` (todo en el mundo); con `fingers`
 * (una dirección del mundo), la mano apunta hacia allí su hueso `finger`.
 */
export function solveTwoBone(arm: THREE.Bone, fore: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3, finger?: THREE.Object3D, fingers?: THREE.Vector3) {
  arm.updateWorldMatrix(true, true);
  arm.getWorldPosition(_a);
  fore.getWorldPosition(_b);
  hand.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  const dist = THREE.MathUtils.clamp(_a.distanceTo(target), 0.01, (l1 + l2) * 0.999);
  _d.copy(target).sub(_a).normalize();
  // la dirección en que se dobla: hacia el polo, quitándole lo que va a lo largo del brazo
  _n.copy(pole).sub(_a);
  _n.addScaledVector(_d, -_n.dot(_d)).normalize();
  const cos = THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1), sin = Math.sqrt(1 - cos * cos);
  // el codo
  _e.copy(_a).addScaledVector(_d, l1 * cos).addScaledVector(_n, l1 * sin);
  aim(arm, fore, _e.clone().sub(_a).normalize());
  fore.getWorldPosition(_b);
  aim(fore, hand, target.clone().sub(_b).normalize());
  if (finger && fingers) aim(hand, finger, fingers);
}
