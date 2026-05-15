// app/components/sections/Projects.tsx
'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const ProjectsCloseup = dynamic(() => import('../planets/ProjectsCloseup'), { ssr: false });

interface Project {
  title: string;
  description?: string;
  language?: string;
  status?: string;
  url?: string;
}

// ── Lista de proyectos (rellenar con los reales)
const projects: Project[] = [
  {
    title: 'file-meet',
    description: 'Plataforma para compartir archivos con salas efímeras.',
    language: 'TypeScript',
    status: 'active',
    url: 'https://github.com/s7lver2/file-meet',
  },
  {
    title: 'ZephyrOS',
    description: 'Sistema operativo experimental escrito en Rust.',
    language: 'Rust',
    status: 'WIP',
    url: 'https://github.com/s7lver2/ZephyrOS',
  },
  {
    title: 'CodeDotJS',
    description: 'Editor de código online minimalista.',
    language: 'JavaScript',
    status: 'active',
    url: 'https://CodeDotjs.vercel.app',
  },
  {
    title: 'tsuki',
    description: 'Framework de firmware para Arduino en Go/Python.',
    language: 'Go',
    status: 'active',
    url: 'https://tsuki.s7lver.xyz',
  },
];

export default function ProjectsSection() {
  const [selected, setSelected] = useState<Project | null>(null);

  return (
    <section
      id="projects"
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: 120,
      }}
    >
      {/* Planeta en primer plano — posición absoluta detrás del contenido */}
      <ProjectsCloseup />

      {/* Contenido superpuesto al planeta */}
      <div className="container" style={{ position: 'relative', zIndex: 2, width: '100%' }}>

        {/* Header */}
        <div className="reveal" style={{ marginBottom: 52 }}>
          <div className="t-label" style={{ marginBottom: 12 }}>projects.work</div>
          <h2 className="t-h2" style={{ marginBottom: 8 }}>Projects</h2>
          <p className="t-body">// select a project to explore</p>
        </div>

        {/* Lista de proyectos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          {projects.map((p, i) => (
            <button
              key={p.title}
              onClick={() => setSelected(p)}
              className="card reveal"
              style={{
                padding: '14px 20px',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'rgba(10,10,10,0.72)',   // semi-transparente sobre el planeta
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transitionDelay: `${i * 0.05}s`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 500,
                  color: 'var(--fg)', fontSize: 14,
                }}>
                  {p.title}
                </span>
                <span className="t-label">{p.language}</span>
              </div>
              {p.description && (
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: 12.5,
                  color: 'var(--fg-muted)', marginTop: 4, lineHeight: 1.5,
                }}>
                  {p.description.slice(0, 80)}{p.description.length > 80 ? '…' : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal de proyecto ──────────────────────────── */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="project-modal-in"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 10, width: '100%', maxWidth: 420, padding: 32,
              position: 'relative',
            }}
          >
            <button
              onClick={() => setSelected(null)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fg-faint)', fontSize: 16, transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--fg-faint)'}
            >✕</button>

            <div className="t-label" style={{ marginBottom: 10 }}>{selected.language}</div>
            <h3 className="t-h3" style={{ marginBottom: 8 }}>{selected.title}</h3>
            <p className="t-body" style={{ marginBottom: 24 }}>{selected.description}</p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {selected.status && <span className="badge">{selected.status}</span>}
              {selected.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 14px' }}
                >
                  View repo ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}