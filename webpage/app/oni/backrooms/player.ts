import * as THREE from 'three';
import type { Controls } from './input';
import type { World } from './world';
import type { Assets } from './game';
import { Rig, aim } from './rig';
import { solveTwoBone } from './ik';

/*
 * El jugador: el hazmat en primera persona. La cámara va a la altura de los ojos y el cuerpo debajo,
 * un poco atrás, sin cabeza (se encoge el hueso): al mirar abajo se ven el pecho, las piernas y las
 * botas. Los brazos los pone el IK encima de la animación: cada mano va a su punto de agarre. La
 * izquierda lleva la linterna; con la pistola (o mirando por la cámara) van las dos al objeto, y la
 * linterna queda montada (su luz sigue saliendo de la vista).
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// los agarres, en el espacio de cada objeto (que es el de la vista): dónde va la muñeca y hacia dónde
// apuntan los dedos
const GRIPS = {
  // la linterna, en puño: la mano entera orientada respecto a ella (los dedos hacia delante, la palma
  // hacia dentro) y los dedos cerrados, que si no la mano solo apunta y queda abierta debajo
  flashlight: { left: V(0.03, -0.04, 0.11), leftFingers: V(0.5, -0.15, -0.85), fist: { y: V(0.2, 0, -1).normalize(), z: V(1, 0, 0), curl: 1.2 } },
  camera: { right: V(0.055, -0.01, 0.01), rightFingers: V(-0.1, 0, -1), left: V(-0.03, -0.075, -0.01), leftFingers: V(0.85, 0.25, -0.45) },
  gun: { right: V(0, -0.07, 0.15), rightFingers: V(-0.55, -0.45, -0.7), left: V(-0.005, -0.045, -0.17), leftFingers: V(0.7, 0.35, -0.6) },
};

export const EYE = 1.62;
const FOV = 70;
const REST_CAM = new THREE.Vector3(0.16, -0.2, -0.33), EYE_CAM = new THREE.Vector3(0.01, -0.03, -0.12);
const REACH_T = 0.85; // lo que dura recoger algo, en segundos
const WALK = 1.6, RUN = 3.6, JUMP = Math.sqrt(2 * 9.8 * 0.9), G = 9.8, R = 0.3;

/** Un modelo escalado para que su lado mayor mida `size`, centrado en el origen y girado `ry`. */
export function fit(o: THREE.Object3D, size: number, ry = 0) {
  const box = new THREE.Box3().setFromObject(o), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = size / Math.max(s.x, s.y, s.z);
  const g = new THREE.Group();
  o.position.sub(c);
  g.add(o);
  g.scale.setScalar(k);
  g.rotation.y = ry;
  return g;
}

/** Lo que se lleva encima y dónde va: la derecha y el cinturón, camcorder o rifle; la izquierda, la linterna. */
export type Gear = 'flashlight' | 'camera' | 'gun';
export type Slot = 'left' | 'right' | 'belt';
export const FITS: Record<Slot, Gear[]> = { left: ['flashlight'], right: ['camera', 'gun'], belt: ['camera', 'gun'] };

export class Player {
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  hand: 'none' | 'camera' | 'gun' = 'none';
  left: 'none' | 'flashlight' = 'flashlight';
  belt: 'none' | 'camera' | 'gun' = 'none';
  readonly has = { camera: false, gun: false };
  /** Correr lo gasta y a cero no se corre hasta recuperar un cuarto; la cordura la lleva game.ts. */
  stamina = 1;
  sanity = 1;
  private winded = false;
  ammo = 0; // en el cargador
  spare = 0; // de reserva
  flashOn = true;
  private lens?: THREE.MeshStandardMaterial;
  private leftFingers: THREE.Bone[] = [];
  private leftThumb: THREE.Bone[] = [];
  // recoger: la vista se agacha hacia el objeto y la mano derecha baja a por él (0 → REACH_T)
  private reachAt?: THREE.Vector3;
  private reachT = 0;
  private reachCb?: () => void;
  /** Mirando por la camcorder (clic derecho). */
  aiming = false;
  /** El zoom de la camcorder, 1×–4×. */
  zoom = 1;
  private aimK = 0; // 0 → 1 mientras se sube la cámara al ojo
  onFall?: () => void;
  readonly rig: Rig;
  /** Lo que va en las manos, pegado a la cámara: la linterna a la izquierda y la cámara o la pistola a la derecha. */
  readonly items = { flashlight: new THREE.Group(), camera: new THREE.Group(), gun: new THREE.Group() };
  speed = 0;
  private velY = 0;
  private ground = true;
  private falling = false;
  private fell = false;
  private bob = 0;
  private busy = 0; // segundos de una animación de una vez (recoger, recargar)
  private recoil = 0;
  /** El jugador ya no manda (muerto, en el ascensor): solo se pinta. */
  frozen = false;
  /** Le ha pillado una entidad: el cuerpo cae (y la cámara ya no es suya: la lleva game.ts). */
  dead = false;
  private deadT = 0;
  private bones: Record<string, THREE.Bone | undefined>;

  constructor(private world: World, assets: Assets, private camera: THREE.PerspectiveCamera, private flash: THREE.SpotLight, private reduced: boolean) {
    this.rig = new Rig(assets.gltf.hazmat);
    world.root.add(this.rig.root);
    this.bones = Object.fromEntries(['Head', 'Neck', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1'].map((n) => [n, this.rig.bone(n)]));
    this.leftThumb = [1, 2, 3, 4].map((i) => this.rig.bone('LeftHandThumb' + i)).filter((b): b is THREE.Bone => !!b);
    this.leftFingers = ['Index', 'Middle', 'Ring', 'Pinky'].flatMap((f) => [1, 2, 3].map((i) => this.rig.bone('LeftHand' + f + i))).filter((b): b is THREE.Bone => !!b);
    // los objetos de la mano, a escala de mano y apuntando al frente (-z): el rifle y la linterna
    // miran a +z en su modelo; la cámara, a +x
    this.items.flashlight.add(fit(assets.gltf.flashlight.scene.clone(true), 0.26, Math.PI));
    this.items.flashlight.getObjectByName('Circle_6')?.removeFromParent(); // la tira de la muñeca
    // la lente: su emisiva va con la linterna (encendida o no); un material propio, que es la única
    this.items.flashlight.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).emissive?.getHex()) this.lens = m.material = (m.material as THREE.MeshStandardMaterial).clone();
    });
    this.items.camera.add(fit(assets.gltf.camcorder.scene.clone(true), 0.2, Math.PI / 2));
    this.items.gun.add(fit(assets.gltf.gun.scene.clone(true), 0.72, Math.PI));
    this.items.flashlight.position.set(-0.15, -0.18, -0.36);
    this.items.camera.position.copy(REST_CAM);
    this.items.gun.position.set(0.15, -0.205, -0.4);
    for (const it of Object.values(this.items)) camera.add(it);
    this.items.camera.visible = this.items.gun.visible = false;
    this.rig.play('Neutral Idle', 0);
  }

  spawn(at: THREE.Vector3, yaw: number) {
    this.pos.copy(at).setY(0);
    this.yaw = yaw;
    this.pitch = 0;
    this.velY = 0;
    this.ground = true;
    this.falling = this.fell = false;
  }

  private blocked(x: number, z: number) {
    const w = this.world;
    return w.solid(x - R, z - R) || w.solid(x + R, z - R) || w.solid(x - R, z + R) || w.solid(x + R, z + R);
  }

  update(dt: number, c: Controls) {
    if (this.dead) return this.fall(dt);
    if (this.frozen) c = { ...c, move: new THREE.Vector2(), look: new THREE.Vector2(), jump: false, flash: false, swap: false, aim: false };
    // mirar por la cámara: se sube al ojo, la vista se cierra y, ya arriba, se mira a través (el modelo se esconde)
    const want = c.aim && this.hand === 'camera';
    this.aimK = THREE.MathUtils.clamp(this.aimK + (want ? dt : -dt) * 6, 0, 1);
    this.aiming = this.aimK > 0.85;
    this.zoom = this.aiming ? THREE.MathUtils.clamp(this.zoom + c.zoom * 0.5, 1, 4) : 1;
    const k = this.aimK * this.aimK * (3 - 2 * this.aimK);
    this.items.camera.position.lerpVectors(REST_CAM, EYE_CAM, k);
    this.items.camera.visible = this.hand === 'camera' && !this.aiming;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / THREE.MathUtils.lerp(1, this.zoom * 1.25, k)));
    if (Math.abs(fov - this.camera.fov) > 0.01) (this.camera.fov = fov), this.camera.updateProjectionMatrix();
    this.yaw -= c.look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - c.look.y, -1.45, 1.45);
    if (c.flash && this.left === 'flashlight') this.flashOn = !this.flashOn;
    if (c.swap) this.swap();

    // andar: hacia donde se mira, chocando eje a eje con las paredes
    const moving = c.move.length() > 0.05, run = c.run && moving && !this.winded;
    // ~9 s corriendo; se recupera en ~6 s andando y ~4 s parado; agotado, no se corre hasta el 30 %
    this.stamina = THREE.MathUtils.clamp(this.stamina + dt * (run ? -1 / 9 : moving ? 1 / 6 : 1 / 4), 0, 1);
    if (this.stamina <= 0) this.winded = true;
    else if (this.stamina > 0.3) this.winded = false;
    const speed = moving ? (run ? RUN : WALK) * Math.min(1, c.move.length()) : 0;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
    const v = f.multiplyScalar(c.move.y).add(r.multiplyScalar(c.move.x));
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(speed * dt);
    if (!this.blocked(this.pos.x + v.x, this.pos.z)) this.pos.x += v.x;
    if (!this.blocked(this.pos.x, this.pos.z + v.z)) this.pos.z += v.z;
    this.speed = speed;

    // saltar y caer: sobre un hueco no hay suelo
    if (c.jump && this.ground && !this.falling) (this.velY = JUMP), (this.ground = false);
    const floor = this.falling || this.world.voidAt(this.pos.x, this.pos.z) ? -Infinity : 0;
    this.velY -= G * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= floor) (this.pos.y = floor), (this.velY = 0), (this.ground = true);
    else if (this.pos.y < -0.2) this.falling = true;
    if (this.pos.y < -3 && !this.fell) (this.fell = true), this.onFall?.();

    // recoger: sube y baja en REACH_T; a mitad, la mano llega y el objeto es suyo
    let rk = 0;
    if (this.reachAt) {
      this.reachT += dt;
      if (this.reachT >= REACH_T / 2 && this.reachCb) this.reachCb(), (this.reachCb = undefined);
      if (this.reachT >= REACH_T) this.reachAt = undefined;
      else rk = Math.sin((Math.PI * this.reachT) / REACH_T);
    }
    // el cuerpo: detrás de los ojos, mirando hacia donde se mira (los de Mixamo miran a +z); al mirar
    // abajo se retrasa (y el ojo se adelanta, sobre el cuello), que no se vea por dentro
    const down = Math.max(0, -this.pitch) / 1.45;
    const body = this.rig.root, back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.16 + 0.2 * down);
    body.position.copy(this.pos).add(back);
    body.position.y -= 0.45 * rk;
    body.rotation.y = this.yaw + Math.PI;
    const idle = this.hand === 'gun' ? 'Rifle Idle' : 'Neutral Idle';
    this.busy -= dt;
    if (this.busy <= 0) {
      const a = this.rig.play(speed > 2 ? 'Slow Run' : speed > 0 ? 'Walking222' : idle);
      if (a) a.timeScale = speed > 0 ? speed / (speed > 2 ? RUN : WALK) : 1;
    }
    this.rig.update(dt);
    this.bones.Head?.scale.setScalar(0.001);
    // con la cámara en el ojo, los brazos no se ven (estarían delante de la lente)
    for (const s of ['LeftArm', 'RightArm']) this.bones[s]?.scale.setScalar(this.aiming ? 0.001 : 1);
    this.bones.Neck?.scale.setScalar(0.5);

    // la cámara: los ojos, con el vaivén de una cámara de mano al andar
    this.bob += dt * (speed > 2 ? 11 : 7) * (speed > 0 ? 1 : 0);
    const amp = this.reduced || !this.ground ? 0 : speed > 2 ? 0.045 : speed > 0 ? 0.025 : 0;
    const neck = Math.sin(down * 1.45) * 0.12;
    this.camera.position.set(this.pos.x - Math.sin(this.yaw) * neck, this.pos.y + EYE - 0.5 * rk + Math.sin(this.bob * 2) * amp, this.pos.z - Math.cos(this.yaw) * neck);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    // al recoger, la vista se va al objeto
    let pitch = this.pitch;
    if (this.reachAt) {
      const d = Math.hypot(this.reachAt.x - this.camera.position.x, this.reachAt.z - this.camera.position.z);
      pitch = THREE.MathUtils.lerp(this.pitch, Math.atan2(this.reachAt.y - this.camera.position.y, d), rk * 0.85);
    }
    this.camera.rotation.set(pitch + this.recoil * 0.06, this.yaw, Math.sin(this.bob) * amp * 0.3, 'YXZ');
    this.camera.updateMatrixWorld();

    // los brazos, a sus agarres (el codo, hacia abajo y hacia fuera)
    const q = this.camera.quaternion;
    const grip = (side: 'Left' | 'Right', item: THREE.Object3D, at: THREE.Vector3, fingers: THREE.Vector3) => {
      const arm = this.bones[side + 'Arm'], fore = this.bones[side + 'ForeArm'], hand = this.bones[side + 'Hand'];
      if (!arm || !fore || !hand) return;
      const pole = arm.getWorldPosition(new THREE.Vector3()).add(V(side === 'Right' ? 0.5 : -0.5, -0.8, 0.15).applyQuaternion(q));
      solveTwoBone(arm, fore, hand, item.localToWorld(at.clone()), pole, this.bones[side + 'HandMiddle1'], fingers.clone().applyQuaternion(q).normalize());
    };
    const two = this.hand === 'gun' || (this.hand === 'camera' && this.aiming);
    const lamp = this.left === 'flashlight';
    this.items.flashlight.visible = lamp && !two;
    if (!two && lamp) {
      grip('Left', this.items.flashlight, GRIPS.flashlight.left, GRIPS.flashlight.leftFingers);
      const hand = this.bones.LeftHand, f = GRIPS.flashlight.fist, iq = this.items.flashlight.getWorldQuaternion(new THREE.Quaternion());
      if (hand) {
        const y = f.y.clone().applyQuaternion(iq), x = y.clone().cross(f.z.clone().applyQuaternion(iq)).normalize(), z = x.clone().cross(y);
        const want = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
        for (const b of this.leftFingers) b.quaternion.setFromAxisAngle(V(1, 0, 0), f.curl);
        hand.updateWorldMatrix(false, true);
        // el pulgar, a lo largo de la linterna hacia la lente, por encima (como sobre el botón)
        const along = V(0.15, 0.35, -1).normalize().applyQuaternion(iq);
        for (let k = 0; k < this.leftThumb.length - 1; k++) aim(this.leftThumb[k], this.leftThumb[k + 1], along);
      }
    }
    if (this.hand !== 'none') {
      const it = this.items[this.hand], g = GRIPS[this.hand];
      it.visible = !rk && !(this.hand === 'camera' && this.aiming); // la derecha suelta lo que lleva mientras recoge
      if (!rk) grip('Right', it, g.right, g.rightFingers);
      if (two) grip('Left', it, g.left, g.leftFingers);
    }
    if (rk && this.reachAt) {
      // la mano derecha, de su sitio en reposo hasta el objeto, con los dedos hacia abajo
      const arm = this.bones.RightArm, fore = this.bones.RightForeArm, hand = this.bones.RightHand;
      if (arm && fore && hand) {
        // hacia el objeto, hasta donde llega el brazo (y se vea en cuadro): medio metro desde el ojo
        const eye = this.camera.position, dir = this.reachAt.clone().sub(eye), far = Math.min(0.5, dir.length());
        const rest = this.camera.localToWorld(V(0.2, -0.32, -0.3)), to = rest.lerp(eye.clone().addScaledVector(dir.normalize(), far).add(V(0.06, 0, 0)), rk);
        const pole = arm.getWorldPosition(new THREE.Vector3()).add(V(0.5, -0.6, 0.2).applyQuaternion(q));
        solveTwoBone(arm, fore, hand, to, pole, this.bones.RightHandMiddle1, V(0, -1, 0).lerp(V(0, 0, -1).applyQuaternion(q), 0.4).normalize());
      }
    }

    this.flash.intensity = this.lightOn ? 26 : 0;
    this.lens?.emissive.setScalar(this.lightOn ? 1 : 0.04);
  }

  /**
   * Muerto: el cuerpo entero se ve (con la cabeza) y cae de espaldas: con el clip de muerte de Mixamo
   * si lo hay; si no, se desploma por código, girando sobre los pies.
   */
  private fall(dt: number) {
    const first = this.deadT === 0;
    this.deadT += dt;
    if (first) for (const it of Object.values(this.items)) it.visible = false;
    const body = this.rig.root, back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.16);
    body.position.copy(this.pos).add(back);
    const clip = ['Dying', 'Falling Back Death', 'Death'].find((n) => this.rig.action(n));
    if (clip) {
      if (first) this.rig.play(clip, 0.1, true);
      body.rotation.set(0, this.yaw + Math.PI, 0);
    } else {
      const k = Math.min(1, this.deadT / 0.75);
      body.rotation.set(-k * k * (Math.PI / 2) * 0.96, this.yaw + Math.PI, 0, 'YXZ');
      if (first) this.rig.play('Neutral Idle', 0.2);
    }
    this.rig.update(dt);
    for (const s of ['Head', 'Neck', 'LeftArm', 'RightArm']) this.bones[s]?.scale.setScalar(1);
  }

  /** Donde queda el cuerpo tirado (el centro, en el suelo). */
  get corpse() {
    return this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.9));
  }

  /** Una animación de una vez sobre el cuerpo (recoger, recargar): manda hasta que acaba. */
  /** Recoger lo que hay en `at`: `grab` se llama cuando la mano llega (a mitad del gesto). */
  reach(at: THREE.Vector3, grab: () => void) {
    if (this.reachAt) return false;
    this.reachAt = at.clone();
    this.reachT = 0;
    this.reachCb = grab;
    return true;
  }

  act(name: string) {
    const a = this.rig.play(name, 0.15, true);
    if (a) (a.timeScale = 1.6), (this.busy = a.getClip().duration / 1.6);
  }

  /** El retroceso del disparo: la vista salta un poco hacia arriba y el rifle hacia atrás. */
  kick() {
    this.recoil = 1;
  }

  hold(h: Player['hand']) {
    this.hand = h;
    this.items.camera.visible = h === 'camera';
    if (h !== 'camera') this.aimK = 0;
    this.items.gun.visible = h === 'gun';
  }

  /** La linterna da luz: encendida y en la mano izquierda. */
  get lightOn() {
    return this.flashOn && this.left === 'flashlight';
  }

  /** Q o la rueda: lo de la mano derecha al cinturón y lo del cinturón a la mano. */
  swap() {
    const b = this.belt;
    this.belt = this.hand;
    this.hold(b);
  }

  /** Poner `it` en `slot` (o vaciarlo con 'none'): sale de donde estuviera; lo que había, al almacén. */
  place(slot: Slot, it: Gear | 'none') {
    if (it !== 'none') {
      if (!FITS[slot].includes(it) || (it !== 'flashlight' && !this.has[it])) return false;
      if (this.hand === it) this.hold('none');
      if (this.belt === it) this.belt = 'none';
      if (this.left === it) this.left = 'none';
    }
    if (slot === 'right') this.hold(it as Player['hand']);
    else if (slot === 'belt') this.belt = it as Player['belt'];
    else this.left = it as Player['left'];
    return true;
  }

  /** Lo recién cogido: a la mano si está libre, si no al cinturón, si no al almacén. */
  stow(it: 'camera' | 'gun') {
    if (this.hand === 'none') this.hold(it);
    else if (this.belt === 'none') this.belt = it;
  }

  dispose() {
    for (const it of Object.values(this.items)) it.removeFromParent();
    this.rig.root.removeFromParent();
    this.rig.mixer.stopAllAction();
  }
}
