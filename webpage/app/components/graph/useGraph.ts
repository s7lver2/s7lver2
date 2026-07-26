'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildGraph, settle, step, fitView, project,
  DEFAULT_CAMERA, ZOOM_MIN, ZOOM_MAX,
  type Camera, type Graph, type GraphNode, type Mode,
} from './engine';
import { drawGraph } from './render';
import type { GraphPayload } from '@/lib/graph-types';

const SETTLE_ITERATIONS = 500;
const LOOP_ALPHA = 0.5;
const DRAG_THRESHOLD = 4;

export interface UseGraphOptions {
  payload: GraphPayload | null;
  /** Fraction of canvas width the graph should occupy (1 = full, 0.42 = left band). */
  bandFraction: number;
  /** Element whose textContent receives the zoom percentage, updated per frame
   *  without triggering React re-renders. */
  zoomLabelRef?: React.RefObject<HTMLElement>;
  /** Called when a project node is clicked (not dragged). */
  onOpenProject?: (n: GraphNode) => void;
}

export interface UseGraphResult {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  hovered: GraphNode | null;
  selected: GraphNode | null;
  setSelected: (n: GraphNode | null) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  fit: () => void;
  reset: () => void;
}

export function useGraph({ payload, bandFraction, zoomLabelRef, onOpenProject }: UseGraphOptions): UseGraphResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const camRef = useRef<Camera>({ ...DEFAULT_CAMERA });
  const modeRef = useRef<Mode>('2d');
  const sizeRef = useRef({ w: 0, h: 0 });
  const heldRef = useRef<GraphNode | null>(null);
  const litRef = useRef<GraphNode | null>(null);
  const selRef = useRef<GraphNode | null>(null);
  const bandRef = useRef(bandFraction);
  const tweenRef = useRef<{
    from: Pick<Camera, 'zoom' | 'px' | 'py'>;
    to: Pick<Camera, 'zoom' | 'px' | 'py'>;
    ms: number; t0: number;
  } | null>(null);
  const onOpenProjectRef = useRef(onOpenProject);

  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<Mode>('2d');
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [selected, setSelectedState] = useState<GraphNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotRef = useRef(false);
  const reduced = useRef(false);
  const entranceT0 = useRef(0);

  useEffect(() => { bandRef.current = bandFraction; }, [bandFraction]);
  useEffect(() => { autoRotRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { onOpenProjectRef.current = onOpenProject; }, [onOpenProject]);

  const setSelected = useCallback((n: GraphNode | null) => { selRef.current = n; setSelectedState(n); }, []);

  const applyView = useCallback((frac: number, animate: boolean) => {
    const g = graphRef.current;
    const { w, h } = sizeRef.current;
    if (!g || !w || !h) return;
    const target = fitView(g, modeRef.current, camRef.current, w, h, frac);
    if (animate) {
      tweenRef.current = {
        from: { zoom: camRef.current.zoom, px: camRef.current.px, py: camRef.current.py },
        to: target, ms: 460, t0: performance.now(),
      };
    } else {
      camRef.current.zoom = target.zoom;
      camRef.current.px = target.px;
      camRef.current.py = target.py;
    }
  }, []);

  // Build the graph when data arrives.
  useEffect(() => {
    if (!payload) return;
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = buildGraph(payload);
    settle(g, '2d', SETTLE_ITERATIONS);
    graphRef.current = g;
    entranceT0.current = performance.now();
    setReady(true);
  }, [payload]);

  // Size the canvas to its box, DPR-aware.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!tweenRef.current) applyView(bandRef.current, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [applyView, ready]);

  // Render loop.
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let alive = true;

    const frame = () => {
      if (!alive) return;
      const g = graphRef.current;
      if (g) {
        if (!reduced.current) {
          if (autoRotRef.current && modeRef.current === '3d' && !heldRef.current) {
            camRef.current.ry += 0.0022;
          }
          step(g, modeRef.current, LOOP_ALPHA, heldRef.current);
        }

        const tw = tweenRef.current;
        if (tw) {
          const k = Math.min(1, (performance.now() - tw.t0) / tw.ms);
          const e = 1 - Math.pow(1 - k, 3);
          camRef.current.zoom = tw.from.zoom + (tw.to.zoom - tw.from.zoom) * e;
          camRef.current.px = tw.from.px + (tw.to.px - tw.from.px) * e;
          camRef.current.py = tw.from.py + (tw.to.py - tw.from.py) * e;
          if (k >= 1) tweenRef.current = null;
        }

        const { w, h } = sizeRef.current;
        const now = performance.now();
        const entrance = reduced.current
          ? 1
          : Math.min(1, (now - entranceT0.current) / 700);
        const entranceEased = 1 - Math.pow(1 - entrance, 3);
        drawGraph(ctx, {
          graph: g, mode: modeRef.current, cam: camRef.current, w, h,
          lit: litRef.current, selected: selRef.current,
          t: now, reduced: reduced.current, entrance: entranceEased,
        });

        if (zoomLabelRef?.current) {
          zoomLabelRef.current.textContent = `${Math.round(camRef.current.zoom * 100)}%`;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    frame();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [ready, zoomLabelRef]);

  // ── pointer interaction ──
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let drag: {
      mx: number; my: number;
      px: number; py: number; rx: number; ry: number;
      nx: number; ny: number;
      node: GraphNode | null;
    } | null = null;

    const rel = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    const pick = (mx: number, my: number): GraphNode | null => {
      const g = graphRef.current;
      const { w, h } = sizeRef.current;
      if (!g) return null;
      let best: GraphNode | null = null;
      let bestD = Infinity;
      for (const n of g.nodes) {
        const p = project(n, modeRef.current, camRef.current, w, h);
        const rr = Math.max(n.r * (modeRef.current === '3d' ? p.s : 1) * camRef.current.zoom, 9) + 5;
        const d = Math.hypot(mx - p.sx, my - p.sy);
        if (d < rr && d < bestD) { bestD = d; best = n; }
      }
      return best;
    };

    const onMove = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      if (drag) {
        const dx = mx - drag.mx;
        const dy = my - drag.my;
        if (drag.node && modeRef.current === '2d') {
          drag.node.x = drag.nx + dx / camRef.current.zoom;
          drag.node.y = drag.ny + dy / camRef.current.zoom;
        } else if (modeRef.current === '3d') {
          camRef.current.ry = drag.ry + dx * 0.0088;
          camRef.current.rx = Math.max(-1.45, Math.min(1.45, drag.rx + dy * 0.0088));
        } else {
          camRef.current.px = drag.px + dx;
          camRef.current.py = drag.py + dy;
        }
        tweenRef.current = null; // any gesture cancels an in-flight re-frame
        return;
      }
      const n = pick(mx, my);
      if (n !== litRef.current) {
        litRef.current = n;
        setHovered(n);
        canvas.style.cursor = n && n.kind === 'project' ? 'pointer' : 'grab';
      }
    };

    const onDown = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      const n = pick(mx, my);
      // Node dragging is 2D only — dragging a projected point through a rotated
      // space is not predictable.
      heldRef.current = n && modeRef.current === '2d' ? n : null;
      drag = {
        mx, my,
        px: camRef.current.px, py: camRef.current.py,
        rx: camRef.current.rx, ry: camRef.current.ry,
        nx: n?.x ?? 0, ny: n?.y ?? 0,
        node: n,
      };
      canvas.classList.add('grabbing');
      canvas.setPointerCapture(e.pointerId);
    };

    const onUp = (e: PointerEvent) => {
      const [mx, my] = rel(e);
      const moved = !!drag && (Math.abs(mx - drag.mx) > DRAG_THRESHOLD || Math.abs(my - drag.my) > DRAG_THRESHOLD);
      const n = drag?.node ?? null;
      if (!moved) {
        if (n && n.kind === 'project') {
          selRef.current = n;
          setSelectedState(n);
          onOpenProjectRef.current?.(n);
        } else if (!n) {
          selRef.current = null;
          setSelectedState(null);
        }
      }
      heldRef.current = null;
      drag = null;
      canvas.classList.remove('grabbing');
    };

    const onLeave = () => {
      litRef.current = null;
      setHovered(null);
      heldRef.current = null;
      drag = null;
      canvas.classList.remove('grabbing');
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      tweenRef.current = null;
      const next = camRef.current.zoom * (e.deltaY > 0 ? 0.9 : 1.11);
      camRef.current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [ready]);

  // `Esc` deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      selRef.current = null;
      setSelectedState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setMode = useCallback((m: Mode) => {
    const g = graphRef.current;
    if (!g) return;
    modeRef.current = m;
    setModeState(m);
    if (m === '3d') {
      // Nodes flattened by 2D need a z nudge or the sphere never inflates.
      for (const n of g.nodes) if (Math.abs(n.z) < 1) n.z = (Math.random() - 0.5) * 70;
    }
    settle(g, m, 380);
    applyView(bandRef.current, true);
  }, [applyView]);

  const fit = useCallback(() => applyView(bandRef.current, true), [applyView]);
  const reset = useCallback(() => {
    camRef.current.rx = DEFAULT_CAMERA.rx;
    camRef.current.ry = DEFAULT_CAMERA.ry;
    applyView(bandRef.current, true);
  }, [applyView]);

  // Re-frame whenever the available band changes (README opening/closing).
  useEffect(() => {
    if (ready) applyView(bandFraction, true);
  }, [bandFraction, ready, applyView]);

  return {
    canvasRef, ready, mode, setMode,
    hovered, selected, setSelected,
    autoRotate, setAutoRotate, fit, reset,
  };
}
