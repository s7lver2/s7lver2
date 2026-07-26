'use client';

import { useEffect, useRef, useState } from 'react';
import { useGraph } from '@/components/graph/useGraph';
import type { GraphPayload } from '@/lib/graph-types';

export default function ProjectsGraph() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    fetch('/api/projects/graph')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphPayload | null) => {
        if (d?.nodes?.length) setPayload(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const { canvasRef, ready, mode, setMode, fit, reset, autoRotate, setAutoRotate } = useGraph({
    payload,
    bandFraction: 1,
    zoomLabelRef,
  });

  return (
    <section id="projects" className="sec">
      <div className="wrap">
        <span className="seclabel">Projects</span>
        <div className="eyebrow">graph ~/projects --link-by=language</div>
        <h2 className="h2">Selected <span className="grad">work</span></h2>

        <div className="win" style={{ marginTop: 24, position: 'relative' }}>
          <div className="winbar">
            <div className="dots"><i className="r" /><i className="y" /><i className="g" /></div>
            <div className="wintitle"><b>s7lver@portfolio</b>:~$ graph</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="kbadge gbtn" data-on={mode === '2d'} onClick={() => setMode('2d')}>2D</button>
              <button type="button" className="kbadge gbtn" data-on={mode === '3d'} onClick={() => setMode('3d')}>3D esfera</button>
              <button type="button" className="kbadge gbtn" onClick={fit}>⊡ fit</button>
              <button type="button" className="kbadge gbtn" onClick={reset}>⟲ reset</button>
              <button
                type="button"
                className="kbadge gbtn"
                data-on={autoRotate}
                onClick={() => setAutoRotate(!autoRotate)}
                disabled={mode !== '3d'}
                title={mode === '3d' ? 'rotación automática' : 'solo en modo 3D'}
              >
                ◐ auto-rot
              </button>
            </div>
          </div>

          <div className="gstage">
            <canvas ref={canvasRef} className="gcanvas" />
            {!ready && !failed && <div className="gmsg mono">Loading graph…</div>}
            {failed && <div className="gmsg mono">Graph unavailable.</div>}
            <div className="gleg mono">
              <span><i style={{ background: '#00add8' }} />proyecto</span>
              <span><i style={{ background: 'rgba(255,255,255,.3)' }} />lenguaje</span>
            </div>
          </div>

          <div className="gsl">
            <span className="m">NORMAL</span>
            <span className="c">~/projects</span>
            <span className="c" ref={zoomLabelRef}>100%</span>
            <span className="sp" />
          </div>
        </div>
      </div>
    </section>
  );
}
