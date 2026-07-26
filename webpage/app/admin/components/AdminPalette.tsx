'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { T } from './ui';
import { usePrefs } from '../hooks/usePrefs';
import type { Renderer } from './charts/types';
import type { FeaturedRepo } from '@/app/lib/featured';
import { repoName } from '@/app/lib/featured';

type Level = 'root' | 'repos' | 'renderers';

interface Cmd {
  group: 'Ir a' | 'Acciones';
  icon: string;
  title: string;
  /** Navigate here. */
  href?: string;
  /** Run this. */
  run?: () => void | Promise<void>;
  /** Push a second level to choose a target first. */
  push?: Level;
}

/**
 * Mark a row so it flashes teal once the target page has mounted it.
 * sessionStorage rather than a query param: the flag must survive the
 * navigation but must not end up in a shareable URL.
 */
export function flashRow(id: string) {
  sessionStorage.setItem('admin:flash', id);
}

const RENDERERS: Renderer[] = ['dots', 'braille', 'svg'];

export const ROOT_COMMAND_COUNT = 9;

export default function AdminPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { setRenderer } = usePrefs();
  const [level, setLevel] = useState<Level>('root');
  const [query, setQuery] = useState('');
  const [selIdx, setSelIdx] = useState(0);
  const [repos, setRepos] = useState<FeaturedRepo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLevel('root');
    setQuery('');
    setSelIdx(0);
    setTimeout(() => inputRef.current?.focus(), 50);
    fetch('/api/content/featured')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRepos(Array.isArray(d) ? d : []))
      .catch(() => setRepos([]));
  }, [open]);

  const goEdit = useCallback((repo: string) => {
    flashRow(repo);
    router.push('/admin/content/projects');
    onClose();
  }, [router, onClose]);

  const rootCommands: Cmd[] = [
    { group: 'Ir a', icon: '◈', title: 'Analytics', href: '/admin' },
    { group: 'Ir a', icon: '⊙', title: 'Engagement', href: '/admin/engagement' },
    { group: 'Ir a', icon: '◫', title: 'Proyectos', href: '/admin/content/projects' },
    { group: 'Ir a', icon: '@', title: 'Redes', href: '/admin/content/socials' },
    { group: 'Ir a', icon: '◇', title: 'Users', href: '/admin/users' },
    { group: 'Ir a', icon: '⊟', title: 'Audit', href: '/admin/audit' },
    { group: 'Ir a', icon: '⚙', title: 'Configuración', href: '/admin/config' },
    { group: 'Acciones', icon: '✎', title: 'Editar proyecto…', push: 'repos' },
    { group: 'Acciones', icon: '☑', title: 'Marcar / desmarcar repo…', push: 'repos' },
    { group: 'Acciones', icon: '▤', title: 'Renderer de gráficos…', push: 'renderers' },
    {
      group: 'Acciones', icon: '⤓', title: 'Guardar cambios',
      run: () => { window.dispatchEvent(new CustomEvent('admin:save')); onClose(); },
    },
    {
      group: 'Acciones', icon: '↻', title: 'Refrescar caché de líneas',
      run: async () => { await fetch('/api/admin/github/loc/refresh', { method: 'POST' }); onClose(); },
    },
    {
      group: 'Acciones', icon: '＋', title: 'Nuevo usuario',
      run: () => { router.push('/admin/users?new=1'); onClose(); },
    },
    {
      group: 'Acciones', icon: '⤒', title: 'Exportar audit a CSV',
      run: () => {
        router.push('/admin/audit');
        window.dispatchEvent(new CustomEvent('admin:export'));
        onClose();
      },
    },
    {
      group: 'Acciones', icon: '⏻', title: 'Cerrar sesión',
      run: async () => {
        await fetch('/api/admin/auth', { method: 'DELETE' });
        router.replace('/admin/login');
        onClose();
      },
    },
  ];

  const filtered = rootCommands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  const repoItems = repos.filter((f) =>
    repoName(f.repo).toLowerCase().includes(query.toLowerCase())
  );
  const rendererItems = RENDERERS.filter((r) => r.includes(query.toLowerCase()));

  const currentLen = level === 'root' ? filtered.length : level === 'repos' ? repoItems.length : rendererItems.length;

  const runRoot = (cmd: Cmd) => {
    if (cmd.push) { setLevel(cmd.push); setQuery(''); setSelIdx(0); return; }
    if (cmd.href) { router.push(cmd.href); onClose(); return; }
    if (cmd.run) { void cmd.run(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx((i) => Math.min(i + 1, Math.max(0, currentLen - 1))); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (level === 'root') { const c = filtered[selIdx]; if (c) runRoot(c); }
      else if (level === 'repos') {
        const f = repoItems[selIdx];
        if (f) goEdit(f.repo);
      } else if (level === 'renderers') {
        const r = rendererItems[selIdx];
        if (r) { void setRenderer(r); onClose(); }
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (level !== 'root') { setLevel('root'); setQuery(''); setSelIdx(0); }
      else onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(4,4,8,.62)', backdropFilter: 'blur(7px)',
        }}
      />
      <div style={{
        position: 'fixed', top: '18vh', left: '50%', transform: 'translateX(-50%)',
        width: '90%', maxWidth: 560, zIndex: 81,
        background: T.glass, border: `1px solid ${T.line}`, borderRadius: 14,
        fontFamily: T.mono, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder={level === 'root' ? 'Escribe un comando…' : level === 'repos' ? 'Buscar repo…' : 'Buscar renderer…'}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '14px 16px',
            background: 'transparent', border: 'none', borderBottom: `1px solid ${T.line}`,
            color: T.text, fontFamily: T.mono, fontSize: 13, outline: 'none',
          }}
        />
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
          {level === 'root' && (['Ir a', 'Acciones'] as const).map((group) => {
            const items = filtered.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: T.dim, padding: '6px 10px' }}>
                  {group}
                </div>
                {items.map((c) => {
                  const idx = filtered.indexOf(c);
                  return (
                    <div
                      key={c.title}
                      onClick={() => runRoot(c)}
                      onMouseEnter={() => setSelIdx(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                        borderLeft: idx === selIdx ? `2px solid ${T.active}` : '2px solid transparent',
                        background: idx === selIdx ? 'rgba(94,234,212,.08)' : 'transparent',
                        color: T.text, fontSize: 12.5,
                      }}
                    >
                      <span style={{ width: 16, textAlign: 'center', color: T.mut }}>{c.icon}</span>
                      {c.title}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {level === 'repos' && repoItems.map((f, idx) => (
            <div
              key={f.repo}
              onClick={() => goEdit(f.repo)}
              onMouseEnter={() => setSelIdx(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                borderLeft: idx === selIdx ? `2px solid ${T.active}` : '2px solid transparent',
                background: idx === selIdx ? 'rgba(94,234,212,.08)' : 'transparent',
                color: T.text, fontSize: 12.5,
              }}
            >
              <span style={{ width: 16, textAlign: 'center', color: T.mut }}>◫</span>
              {repoName(f.repo)}
              <span style={{ marginLeft: 'auto', color: T.dim, fontSize: 11 }}>{f.status}</span>
            </div>
          ))}

          {level === 'renderers' && rendererItems.map((r, idx) => (
            <div
              key={r}
              onClick={() => { void setRenderer(r); onClose(); }}
              onMouseEnter={() => setSelIdx(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                borderLeft: idx === selIdx ? `2px solid ${T.active}` : '2px solid transparent',
                background: idx === selIdx ? 'rgba(94,234,212,.08)' : 'transparent',
                color: T.text, fontSize: 12.5,
              }}
            >
              <span style={{ width: 16, textAlign: 'center', color: T.mut }}>▤</span>
              {r}
            </div>
          ))}

          {currentLen === 0 && (
            <div style={{ padding: '14px 10px', color: T.dim, fontSize: 12 }}>sin resultados</div>
          )}
        </div>
      </div>
    </>
  );
}
