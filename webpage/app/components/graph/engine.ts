import type { GraphPayload } from '@/lib/graph-types';
import { colorFor } from '@/lib/lang-colors';

export type Mode = '2d' | '3d';

export interface GraphNode {
  id: string;
  kind: 'project' | 'language';
  color: string;
  degree: number;
  slug?: string;
  repo?: string | null;
  desc?: string;
  status?: 'done' | 'beta' | 'dev';
  langs?: Record<string, number>;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Layout radius in model units. Drives collision, hit testing and glyph size. */
  r: number;
  /** Drawn in the donut centre. Empty for language nodes. */
  initials: string;
  /** GitHub reported no language — the ring is dashed rather than filled. */
  noLanguage: boolean;
  /** Ring segments in descending percentage order. Projects only. */
  ringSegments: Array<{ color: string; frac: number }>;
  /** Per-node phase offset so idle oscillation is not in unison (Task 7). */
  phase: number;
}

export interface GraphLink { s: GraphNode; t: GraphNode; weight: number; }

export interface Camera { rx: number; ry: number; zoom: number; px: number; py: number; }

export interface Projected { sx: number; sy: number; s: number; z: number; }

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  byId: Record<string, GraphNode>;
  /** adjacency[a][b] is true when a and b share an edge. */
  adjacency: Record<string, Record<string, true>>;
}

export const FOCAL = 470;
export const SPHERE_R = 88;
export const ZOOM_MIN = 0.32;
export const ZOOM_MAX = 2.6;
export const SEED_RADIUS = 80;

export const DEFAULT_CAMERA: Camera = { rx: -0.3, ry: 0.6, zoom: 1, px: 0, py: 0 };

interface PhysicsParams {
  repulseProject: number;
  repulseOther: number;
  springRest: number;
  springK: number;
  collisionPad: number;
  damping: number;
}

// 2D needs more space so labels do not collide; 3D is deliberately tighter so
// the cloud reads as a solid sphere rather than a loose scatter.
export const PHYSICS: Record<Mode, PhysicsParams> = {
  '2d': { repulseProject: 3400, repulseOther: 1500, springRest: 52, springK: 0.05,  collisionPad: 9, damping: 0.8 },
  '3d': { repulseProject: 1500, repulseOther: 620,  springRest: 34, springK: 0.075, collisionPad: 5, damping: 0.8 },
};

const CENTER_K_2D = 0.011;
const RADIAL_K_3D = 0.1;
const FLATTEN_K_2D = 0.14;
const COLLISION_PUSH = 0.42;

function radiusFor(kind: 'project' | 'language', degree: number): number {
  return kind === 'project' ? 9 + degree * 1.4 : 6 + degree * 2.0;
}

/** Distribute nodes over a sphere using a golden-angle spiral. Deterministic. */
export function seedSphere(nodes: GraphNode[], radius: number): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    nodes[i].x = Math.cos(theta) * Math.sin(phi) * radius;
    nodes[i].y = Math.sin(theta) * Math.sin(phi) * radius;
    nodes[i].z = Math.cos(phi) * radius;
  }
}

export function buildGraph(payload: GraphPayload): Graph {
  const byId: Record<string, GraphNode> = {};
  const nodes: GraphNode[] = payload.nodes.map((w, i) => {
    const n: GraphNode = {
      id: w.id,
      kind: w.kind,
      color: w.color,
      degree: w.degree,
      slug: w.slug,
      repo: w.repo,
      desc: w.desc,
      status: w.status,
      langs: w.langs,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      r: radiusFor(w.kind, w.degree),
      initials: w.initials ?? '',
      noLanguage: w.noLanguage ?? false,
      ringSegments: Object.entries(w.langs ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([name, pct]) => ({ color: colorFor(name), frac: pct / 100 })),
      // Golden-ratio stride: deterministic, and adjacent nodes never share a phase.
      phase: (i * 0.618033988749895) % 1,
    };
    byId[n.id] = n;
    return n;
  });

  const links: GraphLink[] = [];
  const adjacency: Record<string, Record<string, true>> = {};
  for (const n of nodes) adjacency[n.id] = {};

  for (const l of payload.links) {
    const s = byId[l.source];
    const t = byId[l.target];
    if (!s || !t) continue;
    links.push({ s, t, weight: l.weight });
    adjacency[s.id][t.id] = true;
    adjacency[t.id][s.id] = true;
  }

  seedSphere(nodes, SEED_RADIUS);
  return { nodes, links, byId, adjacency };
}

/** One integration step. `held` is pinned (used while dragging a node). */
export function step(g: Graph, mode: Mode, alpha: number, held: GraphNode | null): void {
  const P = PHYSICS[mode];
  const is3d = mode === '3d';
  const n = g.nodes;

  for (let i = 0; i < n.length; i++) {
    for (let j = i + 1; j < n.length; j++) {
      const a = n[i], b = n[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = is3d ? b.z - a.z : 0;
      const d2 = dx * dx + dy * dy + dz * dz || 0.01;
      const d = Math.sqrt(d2);

      const bothProjects = a.kind === 'project' && b.kind === 'project';
      const f = (bothProjects ? P.repulseProject : P.repulseOther) / d2;
      a.vx -= (dx / d) * f; a.vy -= (dy / d) * f;
      b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      if (is3d) { a.vz -= (dz / d) * f; b.vz += (dz / d) * f; }

      const min = a.r + b.r + P.collisionPad;
      if (d < min) {
        const push = (min - d) * COLLISION_PUSH;
        a.vx -= (dx / d) * push; a.vy -= (dy / d) * push;
        b.vx += (dx / d) * push; b.vy += (dy / d) * push;
        if (is3d) { a.vz -= (dz / d) * push; b.vz += (dz / d) * push; }
      }
    }
  }

  for (const l of g.links) {
    const dx = l.t.x - l.s.x;
    const dy = l.t.y - l.s.y;
    const dz = is3d ? l.t.z - l.s.z : 0;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
    const f = (d - P.springRest) * P.springK;
    l.s.vx += (dx / d) * f; l.s.vy += (dy / d) * f;
    l.t.vx -= (dx / d) * f; l.t.vy -= (dy / d) * f;
    if (is3d) { l.s.vz += (dz / d) * f; l.t.vz -= (dz / d) * f; }
  }

  for (const node of g.nodes) {
    if (is3d) {
      // Radial constraint: pull every node onto a shell of radius SPHERE_R.
      const d = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z) || 0.01;
      const f = (d - SPHERE_R) * RADIAL_K_3D;
      node.vx -= (node.x / d) * f;
      node.vy -= (node.y / d) * f;
      node.vz -= (node.z / d) * f;
    } else {
      node.vx -= node.x * CENTER_K_2D;
      node.vy -= node.y * CENTER_K_2D;
      node.vz += (0 - node.z) * FLATTEN_K_2D; // flatten so mode switches reverse cleanly
    }

    if (node === held) { node.vx = 0; node.vy = 0; node.vz = 0; continue; }

    node.vx *= P.damping; node.vy *= P.damping; node.vz *= P.damping;
    node.x += node.vx * alpha;
    node.y += node.vy * alpha;
    node.z += node.vz * alpha;
  }
}

export function settle(g: Graph, mode: Mode, iterations: number): void {
  for (let i = 0; i < iterations; i++) step(g, mode, 1, null);
}

/**
 * Rotation + perspective, with zoom and pan deliberately factored out so
 * fitView can solve for them in closed form.
 */
export function baseProject(n: GraphNode, mode: Mode, cam: Camera): { x: number; y: number; s: number; z: number } {
  if (mode === '3d') {
    const cy = Math.cos(cam.ry), sy = Math.sin(cam.ry);
    const x1 = n.x * cy - n.z * sy;
    const z1 = n.x * sy + n.z * cy;
    const cx = Math.cos(cam.rx), sx = Math.sin(cam.rx);
    const y1 = n.y * cx - z1 * sx;
    const z2 = n.y * sx + z1 * cx;
    const s = FOCAL / (FOCAL - z2);
    return { x: x1 * s, y: y1 * s, s, z: z2 };
  }
  return { x: n.x, y: n.y, s: 1, z: 0 };
}

export function project(n: GraphNode, mode: Mode, cam: Camera, w: number, h: number): Projected {
  const b = baseProject(n, mode, cam);
  return {
    sx: w / 2 + b.x * cam.zoom + cam.px,
    sy: h / 2 + b.y * cam.zoom + cam.py,
    s: b.s,
    z: b.z,
  };
}

const FIT_PAD = 28;

/**
 * Solve zoom/pan so the whole graph fits inside a band `bandFraction` of the
 * canvas width, measured from the left edge. Operates on already-projected
 * coordinates, so it works with the sphere at any rotation.
 */
export function fitView(
  g: Graph, mode: Mode, cam: Camera, w: number, h: number, bandFraction: number
): Pick<Camera, 'zoom' | 'px' | 'py'> {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of g.nodes) {
    const b = baseProject(n, mode, cam);
    const pad = n.r + 12;
    if (b.x - pad < minX) minX = b.x - pad;
    if (b.x + pad > maxX) maxX = b.x + pad;
    if (b.y - pad < minY) minY = b.y - pad;
    if (b.y + pad > maxY) maxY = b.y + pad;
  }
  if (!Number.isFinite(minX)) return { zoom: cam.zoom, px: cam.px, py: cam.py };

  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  const bandW = w * bandFraction;

  const zoom = Math.min(
    ZOOM_MAX,
    Math.max(ZOOM_MIN, Math.min((bandW - FIT_PAD * 2) / bw, (h - FIT_PAD * 2) / bh))
  );

  const bcx = (minX + maxX) / 2;
  const bcy = (minY + maxY) / 2;

  return {
    zoom,
    px: bandW / 2 - (w / 2 + bcx * zoom),
    py: -(bcy * zoom),
  };
}
