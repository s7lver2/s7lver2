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
}

const TEAL = '#5eead4';
const LABEL_ZOOM_THRESHOLD = 1.2;
const DIM_ALPHA = 0.12;

function depthFactor(mode: Mode, s: number): number {
  return mode === '3d' ? Math.max(0.24, Math.min(1, s - 0.36)) : 1;
}

export function drawGraph(ctx: CanvasRenderingContext2D, st: RenderState): void {
  const { graph, mode, cam, w, h, lit, selected } = st;
  ctx.clearRect(0, 0, w, h);

  // Project once; reused by edges, nodes and depth sorting.
  const P = new Map<string, { sx: number; sy: number; s: number; z: number }>();
  for (const n of graph.nodes) {
    const b = baseProject(n, mode, cam);
    P.set(n.id, {
      sx: w / 2 + b.x * cam.zoom + cam.px,
      sy: h / 2 + b.y * cam.zoom + cam.py,
      s: b.s,
      z: b.z,
    });
  }

  // ── edges ──
  for (const l of graph.links) {
    const a = P.get(l.s.id)!;
    const b = P.get(l.t.id)!;
    const on = !lit || l.s === lit || l.t === lit;
    const dep = mode === '3d' ? Math.max(0.14, Math.min(1, (a.s + b.s) / 2 - 0.42)) : 1;

    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = on && lit ? (l.s.kind === 'project' ? l.s.color : l.t.color) : '#ffffff';
    ctx.globalAlpha = (on ? (lit ? 0.68 : 0.12) : 0.03) * dep;
    ctx.lineWidth = (on && lit ? 1.6 : 1) * (mode === '3d' ? Math.max(0.55, a.s * 0.85) : 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── nodes, painted back to front so nearer glyphs win ──
  const ordered = [...graph.nodes].sort((p, q) => P.get(p.id)!.z - P.get(q.id)!.z);

  for (const n of ordered) {
    const p = P.get(n.id)!;
    const isProject = n.kind === 'project';
    const on = !lit || n === lit || graph.adjacency[lit.id][n.id];
    const dep = depthFactor(mode, p.s);
    const alpha = (on ? 1 : DIM_ALPHA) * dep;
    const rr = n.r * (mode === '3d' ? p.s * 0.9 : 1) * cam.zoom;

    ctx.globalAlpha = alpha;

    if (isProject) {
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
    } else {
      // Language node: hollow circle, 2px ring in the language colour.
      ctx.fillStyle = '#090a0e';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (n === selected && isProject) {
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rr * 1.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Language labels stay hidden when zoomed out so the graph reads cleanly.
    const showLabel = isProject || on || cam.zoom > LABEL_ZOOM_THRESHOLD;
    if (showLabel) {
      ctx.globalAlpha = alpha * (on ? 1 : 0.5);
      const size = (isProject ? 11 : 9.6) * (mode === '3d' ? Math.max(0.76, p.s * 0.88) : 1);
      ctx.font = `${size}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isProject
        ? 'rgba(255,255,255,.9)'
        : on && lit ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.38)';
      ctx.fillText(n.id, p.sx, p.sy + rr * 1.35 + 3);
    }
  }

  ctx.globalAlpha = 1;
}
