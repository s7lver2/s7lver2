import { baseProject, type Camera, type Graph, type GraphNode, type Mode } from './engine';

export interface RenderState {
  graph: Graph;
  mode: Mode;
  cam: Camera;
  w: number;
  h: number;
  /** Node driving the highlight (hover takes precedence over selection). */
  lit: GraphNode | null;
  selected: GraphNode | null;
  /** rAF timestamp, ms. Drives idle oscillation, edge dash flow and the entrance. */
  t: number;
  /** prefers-reduced-motion, read once on mount. */
  reduced: boolean;
  /** Raw ms elapsed since the graph was built. Infinity when reduced (every
   *  node's own entrance below resolves to 1 immediately). Each node offsets
   *  this by its own phase so nodes cascade in rather than all popping in
   *  lockstep — see ENTRANCE_STAGGER/ENTRANCE_DURATION. */
  entranceMs: number;
  /** Pinned via a legend chip click. Non-null dims every project that
   *  doesn't use this language, independent of hover. */
  filterLang: string | null;
}

const TEAL = '#5eead4';
const DIM_ALPHA = 0.12;
// Each node's own tween takes this long, offset by up to STAGGER ms based on
// its phase (0..1) — so instead of every donut popping into place in one
// synchronized 700ms beat, they cascade in over ~STAGGER+DURATION total.
const ENTRANCE_STAGGER = 380;
const ENTRANCE_DURATION = 480;

function depthFactor(mode: Mode, s: number): number {
  return mode === '3d' ? Math.max(0.24, Math.min(1, s - 0.36)) : 1;
}

/** This node's own entrance progress, eased, in [0, 1]. */
function nodeEntrance(n: GraphNode, entranceMs: number): number {
  const raw = Math.max(0, Math.min(1, (entranceMs - n.phase * ENTRANCE_STAGGER) / ENTRANCE_DURATION));
  return 1 - Math.pow(1 - raw, 3);
}

export function drawGraph(ctx: CanvasRenderingContext2D, st: RenderState): void {
  const { graph, mode, cam, w, h, lit, selected, entranceMs, filterLang } = st;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;

  // Project once; reused by links, nodes and depth sorting. Each node's
  // entrance (position lerp from centre, eased in) is computed here, keyed
  // by its own phase-based stagger rather than one shared global value.
  const P = new Map<string, { sx: number; sy: number; s: number; z: number; e: number }>();
  for (const n of graph.nodes) {
    const b = baseProject(n, mode, cam);
    const e = nodeEntrance(n, entranceMs);
    const sx = cx + (b.x * cam.zoom + cam.px) * e;
    const sy = cy + (b.y * cam.zoom + cam.py) * e;
    P.set(n.id, { sx, sy, s: b.s, z: b.z, e });
  }

  // Project-to-project connections, derived from shared languages (see
  // engine.ts) — the only visible connective lines left now that language
  // nodes themselves are never drawn. Brighter and thicker than the old
  // project<->language edges so they read as real relationships, not a faint
  // web in the background.
  for (const l of graph.projectLinks) {
    const a = P.get(l.s.id)!;
    const b = P.get(l.t.id)!;
    const litOn = !lit || l.s === lit || l.t === lit;
    const filterOn = !filterLang
      || (!!graph.adjacency[l.s.id]?.[filterLang] && !!graph.adjacency[l.t.id]?.[filterLang]);
    const on = litOn && filterOn;
    const highlighted = on && (!!lit || !!filterLang);
    const dep = mode === '3d' ? Math.max(0.2, Math.min(1, (a.s + b.s) / 2 - 0.4)) : 1;
    const entranceGate = Math.min(a.e, b.e);

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = l.color ?? TEAL;
    ctx.globalAlpha = (on ? (highlighted ? 0.6 : 0.32) : 0.05) * dep * entranceGate;
    ctx.lineWidth = (highlighted ? 2 : 1.4) * (mode === '3d' ? Math.max(0.6, (a.s + b.s) / 2 * 0.85) : 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── nodes, painted back to front so nearer glyphs win. Language nodes are
  // skipped outright — only projects render — per the legend-driven redesign. ──
  const ordered = [...graph.nodes].filter((n) => n.kind === 'project')
    .sort((p, q) => P.get(p.id)!.z - P.get(q.id)!.z);

  for (const n of ordered) {
    const p = P.get(n.id)!;
    const litOn = !lit || n === lit || graph.adjacency[lit.id][n.id];
    const matchesFilter = !filterLang || !!graph.adjacency[n.id]?.[filterLang];
    const on = litOn && matchesFilter;
    const dep = depthFactor(mode, p.s);
    const alpha = (on ? 1 : DIM_ALPHA) * dep * p.e;
    const osc = st.reduced
      ? 1
      : 1 + 0.03 * Math.sin((st.t / 4000) * Math.PI * 2 + n.phase * Math.PI * 2);
    // Grows from half size up to full as its own entrance resolves, on top
    // of the position fly-in — a fade alone read as barely-there motion.
    const growIn = 0.5 + 0.5 * p.e;
    const rr = n.r * osc * growIn * (mode === '3d' ? p.s * 0.9 : 1) * cam.zoom;

    ctx.globalAlpha = alpha;

    const thickness = Math.max(4, rr * 0.34);
    const ringR = rr - thickness / 2;

    // Bloom behind the node on hover or selection.
    if (n === lit || n === selected) {
      const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rr * 1.7);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    if (n.noLanguage) {
      // Show the missing data rather than disguising it.
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Clockwise from 12 o'clock, descending percentage.
      let a0 = -Math.PI / 2;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';
      for (const seg of n.ringSegments) {
        const a1 = a0 + seg.frac * Math.PI * 2;
        ctx.strokeStyle = seg.color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, ringR, a0, a1);
        ctx.stroke();
        a0 = a1;
      }
    }

    // Centre disc, so edges passing behind do not show through the initials.
    ctx.fillStyle = '#0b0b12';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(0, ringR - thickness / 2), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `600 ${(rr * 0.62).toFixed(1)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.initials, p.sx, p.sy);

    if (n === selected) {
      const pulse = st.reduced ? 1 : 0.6 + 0.4 * Math.sin(st.t / 480);
      ctx.globalAlpha = alpha * 0.6 * pulse;
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr * 1.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Only projects reach this loop now, so their label always shows.
    ctx.globalAlpha = alpha;
    const size = 11 * (mode === '3d' ? Math.max(0.76, p.s * 0.88) : 1);
    ctx.font = `${size}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText(n.id, p.sx, p.sy + rr * 1.35 + 3);
  }

  ctx.globalAlpha = 1;
}
