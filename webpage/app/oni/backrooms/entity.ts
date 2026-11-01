import * as THREE from 'three';
import { bfs, CELL, type Cell } from './maze';
import { center, type World } from './world';
import type { Assets } from './game';
import type { Target } from './items';
import { sees } from './items';
import { Rig } from './rig';

/*
 * Las entidades: la bacteria y el partygoer. Deambulan por el laberinto; si te ven (a 18 m, 24 con la
 * linterna encendida, dentro de su cono de 100° y sin pared en medio) corren hacia donde te vieron
 * por última vez; si te pierden 6 s, vuelven a deambular. A 1,2 m, atacan. No pisan los huecos ni la
 * celda del ascensor.
 */

export type Kind = 'bacteria' | 'partygoer';
const CLIPS: Record<Kind, { idle: string; walk: string; run: string; attack: string; dances: string[]; height: number }> = {
  bacteria: { idle: 'Idle', walk: 'Walking', run: 'Run', attack: 'Jump Attack', dances: ['Booty Hip Hop Dance', 'Twist Dance'], height: 3 },
  partygoer: { idle: 'Happy Idle', walk: 'Dwarf Walk', run: 'Drunk Run Forward', attack: 'Standing Melee Attack Horizontal', dances: ['Macarena Dance'], height: 2.2 },
};
// persiguen más rápido de lo que andas y más despacio de lo que corres: escapar cuesta aguante
const WANDER = 1.1, CHASE = 2.9, SIGHT = 18, SIGHT_LIT = 24, CONE = THREE.MathUtils.degToRad(50), LOSE = 6, REACH = 1.2;

export class Entity implements Target {
  readonly pos = new THREE.Vector3();
  readonly height: number;
  readonly rig: Rig;
  alive = true;
  state: 'wander' | 'chase' | 'attack' | 'dance' | 'dead' = 'wander';
  balloon?: THREE.Object3D;
  private path: THREE.Vector3[] = [];
  private repath = 0;
  private lost = 0;
  private seen = new THREE.Vector3();
  private facing = 0;
  private blocked: Set<number>;
  /** Hp con el que empezó: la siguiente aguanta uno más. */
  readonly hp0: number;

  constructor(readonly kind: Kind, private world: World, assets: Assets, at: Cell, readonly speed = 1, public hp = 1) {
    const clip = CLIPS[kind];
    this.hp0 = hp;
    this.height = clip.height;
    this.rig = new Rig(assets.gltf[kind]);
    this.rig.root.traverse((o) => void ((o as THREE.Mesh).isMesh && (o.castShadow = true)));
    // la bacteria viene sin textura (gris): negra y algo brillante, como en el original
    if (kind === 'bacteria')
      this.rig.root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.isMeshStandardMaterial) m.color.setHex(0x111111), (m.roughness = 0.45);
      });
    this.pos.copy(center(at));
    this.rig.root.position.copy(this.pos);
    world.root.add(this.rig.root);
    const m = world.maze;
    this.blocked = new Set([...m.voids, m.elevator].map((c) => c.y * m.w + c.x));
    if (kind === 'partygoer') {
      // el globo, con el cordel en la mano derecha (se coloca cada fotograma: ver update)
      const b = assets.gltf.balloon.scene.clone(true), box = new THREE.Box3().setFromObject(b);
      b.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      this.balloon = new THREE.Group().add(b);
      world.root.add(this.balloon);
    }
    this.rig.play(clip.walk, 0);
  }

  private cellOf(p: THREE.Vector3): Cell {
    return this.world.cellAt(p.x, p.z);
  }

  /** Camino por la rejilla hasta `to` (centros de celda), evitando huecos y el ascensor. */
  private route(to: Cell) {
    // la celda propia nunca cuenta como bloqueada: si una persecución la dejó sobre un hueco, que salga
    const m = this.world.maze, from = this.cellOf(this.pos), own = from.y * m.w + from.x;
    const blocked = this.blocked.has(own) ? new Set([...this.blocked].filter((i) => i !== own)) : this.blocked;
    const d = bfs(m, to, blocked);
    if (d[from.y * m.w + from.x] < 0) return [];
    // se baja por las distancias desde el destino: cada paso, al vecino más cerca de él
    const out: THREE.Vector3[] = [];
    let c = from;
    for (let i = 0; i < 400 && (c.x !== to.x || c.y !== to.y); i++) {
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter((n) => n.x >= 0 && n.y >= 0 && n.x < m.w && n.y < m.h && d[n.y * m.w + n.x] >= 0);
      c = nb.sort((a, b) => d[a.y * m.w + a.x] - d[b.y * m.w + b.x])[0];
      if (!c) break;
      out.push(center(c));
    }
    return out;
  }

  private blockedAt(p: THREE.Vector3) {
    const c = this.cellOf(p);
    return this.blocked.has(c.y * this.world.maze.w + c.x);
  }

  private wanderTarget(): Cell {
    const m = this.world.maze;
    for (let i = 0; i < 40; i++) {
      const c = { x: (Math.random() * m.w) | 0, y: (Math.random() * m.h) | 0 };
      if (m.open[c.y * m.w + c.x] && !this.blocked.has(c.y * m.w + c.x)) return c;
    }
    return this.cellOf(this.pos);
  }

  /** ¿Ve al jugador? `eye` son sus ojos; con la linterna encendida se le ve de más lejos. */
  private spot(eye: THREE.Vector3, lit: boolean) {
    const me = this.pos.clone().setY(this.height * 0.85), to = eye.clone().sub(me), d = to.length();
    if (d > (lit ? SIGHT_LIT : SIGHT)) return false;
    const ang = Math.abs(THREE.MathUtils.euclideanModulo(Math.atan2(to.x, to.z) - this.facing + Math.PI, Math.PI * 2) - Math.PI);
    return (ang < CONE || d < 2.5) && sees(this.world, me, eye);
  }

  /** Un fotograma. Devuelve true el fotograma en que alcanza al jugador. */
  update(dt: number, player: THREE.Vector3, eye: THREE.Vector3, lit: boolean, god: boolean) {
    const clip = CLIPS[this.kind];
    let caught = false;
    if (this.state === 'wander' || this.state === 'chase') {
      if (this.spot(eye, lit)) {
        if (this.state !== 'chase') this.repath = 0;
        this.state = 'chase';
        this.lost = 0;
        this.seen.copy(player);
      } else if (this.state === 'chase' && (this.lost += dt) > LOSE) (this.state = 'wander'), (this.path = []);
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) {
        this.path = this.route(this.state === 'chase' ? this.cellOf(this.seen) : this.wanderTarget());
        this.repath = this.state === 'chase' ? 0.5 : 8;
      }
      // en la misma celda que el jugador, directo a él
      const near = this.state === 'chase' && this.pos.distanceTo(player) < CELL * 1.2 && sees(this.world, this.pos, player) && !this.blockedAt(player);
      const goal = near ? player : this.path[0];
      const v = this.state === 'chase' ? CHASE * this.speed : WANDER;
      if (goal) {
        const to = goal.clone().sub(this.pos).setY(0), d = to.length();
        if (d < 0.15 && !near) this.path.shift();
        else {
          const next = this.pos.clone().addScaledVector(to.normalize(), Math.min(d, v * dt));
          if (!near || !this.blockedAt(next)) this.pos.copy(next);
        }
        // girar hacia donde va, a 6 rad/s como mucho
        const turn = THREE.MathUtils.euclideanModulo(Math.atan2(to.x, to.z) - this.facing + Math.PI, Math.PI * 2) - Math.PI;
        this.facing += Math.sign(turn) * Math.min(Math.abs(turn), dt * 6);
      }
      const a = this.rig.play(this.state === 'chase' ? clip.run : goal ? clip.walk : clip.idle);
      if (a && this.state === 'chase') a.timeScale = this.speed;
      if (this.state === 'chase' && this.pos.distanceTo(player) < REACH && !god) {
        this.state = 'attack';
        this.rig.play(clip.attack, 0.1, true);
        caught = true;
      }
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.facing;
    this.rig.update(dt);
    if (this.balloon && this.state !== 'dead') {
      const hand = this.rig.bone('RightHand');
      if (hand) this.balloon.position.copy(hand.getWorldPosition(new THREE.Vector3()));
      this.balloon.rotation.z = Math.sin(performance.now() / 700) * 0.12;
    }
    return caught;
  }

  /** Tras atacar: mira al jugador y baila uno de sus bailes. */
  dance(at: THREE.Vector3) {
    const clips = CLIPS[this.kind].dances;
    this.state = 'dance';
    this.facing = Math.atan2(at.x - this.pos.x, at.z - this.pos.z);
    this.rig.play(clips[(Math.random() * clips.length) | 0], 0.3);
  }

  hit() {
    if (!this.alive) return false;
    if (--this.hp > 0) return false;
    this.alive = false;
    this.state = 'dead';
    return true;
  }

  dispose() {
    this.rig.mixer.stopAllAction();
    this.rig.root.removeFromParent();
    this.balloon?.removeFromParent();
  }
}
