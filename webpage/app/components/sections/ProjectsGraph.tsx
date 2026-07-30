'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGraph } from '@/components/graph/useGraph';
import type { GraphNode } from '@/components/graph/engine';
import type { GraphPayload } from '@/lib/graph-types';
import Readme from '@/components/graph/Readme';
import { useReveal } from '@/lib/reveal';

type ReadmeState =
  | { status: 'idle' }
  | { status: 'loading'; slug: string }
  | { status: 'ok'; slug: string; markdown: string; repo: string }
  | { status: 'none'; slug: string; reason: 'no_repo' | 'not_found' | 'fetch_failed' };

export default function ProjectsGraph() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const reveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    fetch('/api/projects/graph')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphPayload | null) => {
        if (d?.nodes?.length) setPayload(d);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const [readme, setReadme] = useState<ReadmeState>({ status: 'idle' });
  const open = readme.status !== 'idle';

  const onOpenProject = useCallback((n: GraphNode) => {
    const slug = n.slug ?? n.id;
    setReadme({ status: 'loading', slug });
    fetch(`/api/projects/${encodeURIComponent(slug)}/readme`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setReadme({ status: 'ok', slug, markdown: d.markdown, repo: d.repo });
        else setReadme({ status: 'none', slug, reason: d?.reason ?? 'fetch_failed' });
      })
      .catch(() => setReadme({ status: 'none', slug, reason: 'fetch_failed' }));
  }, []);

  const closeReadme = useCallback(() => setReadme({ status: 'idle' }), []);

  const { canvasRef, ready, mode, setMode, hovered, selected, setSelected,
          autoRotate, setAutoRotate, filterLang, setFilterLang, reset } = useGraph({
    payload,
    bandFraction: open ? 0.42 : 1,
    zoomLabelRef,
    onOpenProject,
  });

  // Legend/filter chips — the language nodes themselves no longer render on
  // the canvas (see render.ts), so this row is now the only place languages
  // are named. Sorted by how many projects use them, most-used first.
  const languages = (payload?.nodes ?? [])
    .filter((n) => n.kind === 'language')
    .sort((a, b) => b.degree - a.degree);

  useEffect(() => {
    if (!selected) setReadme({ status: 'idle' });
  }, [selected]);

  return (
    <section id="projects" className="sec">
      <div className="wrap reveal" ref={reveal}>
        <span className="seclabel">Projects</span>
        <div className="eyebrow">graph ~/projects --link-by=language</div>
        <h2 className="h2">Selected <span className="grad">work</span></h2>

        <div className="win" style={{ marginTop: 24, position: 'relative' }}>
          <div className="winbar">
            <div className="dots"><i className="r" /><i className="y" /><i className="g" /></div>
            <div className="wintitle"><b>s7lver@portfolio</b>:~$ graph</div>
            {/* Trimmed from 5 buttons to 3: 2D/3D was two separate toggle
                buttons for one binary choice, now one; fit and reset were
                nearly always used together, now one action. */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="kbadge gbtn"
                onClick={() => setMode(mode === '2d' ? '3d' : '2d')}
                title="Cambiar entre grafo 2D y esfera 3D"
              >
                {mode === '2d' ? '◫ 2D' : '◉ 3D esfera'}
              </button>
              <button
                type="button"
                className="kbadge gbtn"
                onClick={reset}
                title="Reiniciar cámara"
              >
                ⟲ reset
              </button>
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

            <aside className={`grd${open ? ' open' : ''}`} aria-hidden={!open}>
              {readme.status !== 'idle' && (
                <>
                  <div className="grdbar">
                    <span className="dot" style={{ background: selected?.color ?? '#8b5cf6' }} />
                    <span className="fn">
                      {readme.slug}{readme.status === 'ok' ? '/README.md' : ''}
                    </span>
                    <span className="src">
                      {readme.status === 'ok' ? 'raw.githubusercontent.com'
                        : readme.status === 'loading' ? 'cargando…'
                        : readme.reason === 'no_repo' ? 'sin repo público' : 'no disponible'}
                    </span>
                    <button
                      type="button"
                      className="kbadge gbtn x"
                      onClick={() => { setSelected(null); closeReadme(); }}
                    >
                      ✕ esc
                    </button>
                  </div>

                  {readme.status === 'loading' && <div className="grdempty mono">Cargando README…</div>}

                  {readme.status === 'none' && (
                    <div className="grdempty mono">
                      <span className="big">◌</span>
                      {readme.reason === 'no_repo'
                        ? <>Este proyecto no tiene repositorio público.</>
                        : <>No se pudo cargar el <code>README.md</code>.</>}
                      {selected?.desc && <p className="fb">{selected.desc}</p>}
                    </div>
                  )}

                  {readme.status === 'ok' && (
                    <Readme
                      markdown={readme.markdown}
                      repo={readme.repo}
                      accent={selected?.color ?? '#8b5cf6'}
                    />
                  )}
                </>
              )}
            </aside>
          </div>

          {/* Replaces the language nodes/edges that used to live on the canvas
              (see render.ts) — a clickable legend instead of floating clutter.
              Clicking a chip pins it as a filter (click again to clear);
              non-matching projects dim on the graph above. */}
          {languages.length > 0 && (
            <div className="glegend">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  className="glegend-chip"
                  data-active={filterLang === lang.id}
                  style={{ ['--chip-color' as string]: lang.color }}
                  onClick={() => setFilterLang(filterLang === lang.id ? null : lang.id)}
                  title={`${lang.id} · ${lang.degree} proyecto${lang.degree === 1 ? '' : 's'}`}
                >
                  <i />
                  {lang.id}
                  <b>{lang.degree}</b>
                </button>
              ))}
            </div>
          )}

          <div className="gsl">
            <span className="m" data-readme={open}>{open ? 'README' : 'NORMAL'}</span>
            <span className="c">{selected ? `~/projects/${selected.id}` : '~/projects'}</span>
            <span className="c" ref={zoomLabelRef}>100%</span>
            <span className="sp" />
            <span className="k">
              {hovered ? (
                hovered.kind === 'project' ? (
                  <>
                    <span><b>{hovered.id}</b></span>
                    <span>{hovered.degree} lenguajes</span>
                    <span><b>click</b> README</span>
                  </>
                ) : (
                  <>
                    <span><b>{hovered.id}</b></span>
                    <span>en {hovered.degree} proyecto{hovered.degree > 1 ? 's' : ''}</span>
                  </>
                )
              ) : (
                <>
                  <span><b>drag</b> {mode === '3d' ? 'rotar' : 'pan'}</span>
                  <span><b>scroll</b> zoom</span>
                  <span><b>click vacío</b> deselect</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
