import * as THREE from 'three';

/*
 * La cámara de dentro, por planos. Un plano es dónde está, adónde mira y cómo respira:
 * - `drift`: un empuje lento hacia lo que mira (m/s), para que ningún plano esté muerto;
 * - `breathe`: el balanceo de cámara en mano (rad, de 0 a 0,004).
 * `cut` salta a un plano; `go` viaja hasta él con entrada y salida suaves. Con movimiento
 * reducido no hay balanceo ni empuje, y los viajes son cortes.
 */
export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov?: number;
  drift?: number;
  breathe?: number;
}

const smoother = (k: number) => k * k * k * (k * (6 * k - 15) + 10);

export class CameraRig {
  private shot?: Shot;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private fov?: number;
  private t = 0;
  private trip?: { from: { pos: THREE.Vector3; look: THREE.Vector3; fov?: number }; to: Shot; t0: number; sec: number; ease: (k: number) => number; res: () => void };

  constructor(private camera: THREE.PerspectiveCamera, private o: { reduced: boolean }) {}

  cut(shot: Shot) {
    this.trip?.res();
    this.trip = undefined;
    this.shot = shot;
    this.pos.copy(shot.pos);
    this.look.copy(shot.look);
    this.fov = shot.fov;
    this.apply();
  }

  go(shot: Shot, sec: number, ease = smoother) {
    if (this.o.reduced || !this.shot || sec <= 0) return Promise.resolve(this.cut(shot));
    this.trip?.res();
    return new Promise<void>((res) => {
      this.trip = { from: { pos: this.pos.clone(), look: this.look.clone(), fov: this.fov ?? this.camera.fov }, to: shot, t0: this.t, sec, ease, res };
    });
  }

  /** Con el reloj de la escena: con la pestaña oculta o en cámara lenta, la cámara también. */
  update(dt: number) {
    this.t += dt;
    if (!this.shot) return;
    const tr = this.trip;
    if (tr) {
      const k = Math.min(1, (this.t - tr.t0) / tr.sec), e = tr.ease(k);
      this.pos.lerpVectors(tr.from.pos, tr.to.pos, e);
      this.look.lerpVectors(tr.from.look, tr.to.look, e);
      if (tr.to.fov !== undefined) this.fov = THREE.MathUtils.lerp(tr.from.fov!, tr.to.fov, e);
      if (k >= 1) {
        this.trip = undefined;
        this.shot = tr.to;
        tr.res();
      }
    } else if (this.shot.drift && !this.o.reduced) {
      // el empuje: se acerca a lo que mira, sin llegar nunca
      const d = this.look.clone().sub(this.pos);
      if (d.length() > 0.3) this.pos.addScaledVector(d.normalize(), this.shot.drift * dt);
    }
    this.apply();
  }

  private apply() {
    const c = this.camera;
    c.position.copy(this.pos);
    c.lookAt(this.look);
    const b = this.o.reduced ? 0 : Math.min(0.004, (this.trip ? this.trip.to.breathe : this.shot?.breathe) ?? 0);
    if (b) {
      // dos senos lentos que no se repiten: el pulso de quien sujeta la cámara
      c.rotateX(Math.sin(this.t * 0.9) * b + Math.sin(this.t * 2.3) * b * 0.3);
      c.rotateY(Math.sin(this.t * 0.7 + 1.3) * b);
      c.rotateZ(Math.sin(this.t * 0.5 + 0.4) * b * 0.6);
    }
    if (this.fov !== undefined && c.fov !== this.fov) {
      c.fov = this.fov;
      c.updateProjectionMatrix();
    }
  }
}
