'use client';

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';

/** The site's real tokens, from app/globals.css. Purple is accent only. */
export const T = {
  glass: 'rgba(21,21,29,.7)',
  surface: '#0d0d13',
  deep: '#090a0e',
  line: 'rgba(255,255,255,.08)',
  mut: 'rgba(255,255,255,.5)',
  dim: 'rgba(255,255,255,.4)',
  text: 'rgba(255,255,255,.92)',
  accent: '#8b5cf6',
  active: '#5eead4',
  green: '#22c55e',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  display: 'Sora, system-ui, sans-serif',
} as const;

/** A TUI panel: 1px rule and a bracket label, no shadow, no elevation. */
export function Panel({ label, children, style }: {
  label?: string; children: ReactNode; style?: CSSProperties;
}) {
  return (
    <section style={{
      border: `1px solid ${T.line}`, borderRadius: 12, background: T.glass,
      padding: '18px 20px 20px', position: 'relative', ...style,
    }}>
      {label && (
        <span style={{
          position: 'absolute', top: -9, left: 16, padding: '0 8px',
          background: T.surface, fontFamily: T.mono, fontSize: 10.5,
          letterSpacing: '.18em', textTransform: 'uppercase', color: T.mut,
        }}>
          [ {label} ]
        </span>
      )}
      {children}
    </section>
  );
}

/** Editorial heading inside TUI chrome: mono kicker, Sora 800 title. */
export function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.green }}>$ {kicker}</div>
      <h1 style={{
        fontFamily: T.display, fontWeight: 800, fontSize: 'clamp(26px,4vw,38px)',
        letterSpacing: '-.015em', margin: '6px 0 0', color: T.text,
      }}>
        {title}
      </h1>
    </header>
  );
}

export function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{
        display: 'block', fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.16em',
        textTransform: 'uppercase', color: T.mut, marginBottom: 5,
      }}>
        {label}
      </span>
      <input
        {...rest}
        style={{
          width: '100%', padding: '8px 11px', background: T.deep,
          border: `1px solid ${T.line}`, borderRadius: 8, color: T.text,
          fontFamily: T.mono, fontSize: 12.5, outline: 'none', ...rest.style,
        }}
      />
    </label>
  );
}

export function Btn({ tone = 'ghost', children, ...rest }: {
  tone?: 'ghost' | 'accent' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const c = tone === 'accent' ? T.accent : tone === 'danger' ? '#f87171' : T.mut;
  return (
    <button
      type="button"
      {...rest}
      className={`admin-focusable ${rest.className ?? ''}`}
      style={{
        padding: '7px 13px', background: 'transparent',
        border: `1px solid ${tone === 'ghost' ? T.line : c + '55'}`,
        borderRadius: 8, color: c, fontFamily: T.mono, fontSize: 11.5,
        letterSpacing: '.08em', cursor: 'pointer',
        transition: 'background .18s, color .18s, border-color .18s',
        ...rest.style,
      }}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      padding: '1px 5px', border: `1px solid ${T.line}`, borderRadius: 4,
      fontFamily: T.mono, fontSize: 10, color: T.mut,
    }}>
      {children}
    </kbd>
  );
}

/**
 * Panel-wide dirty/saved state. The statusline is the single source of truth
 * for "what state am I in", so it has to be shared rather than per-page.
 */
type Dirty = { dirty: boolean; setDirty: (d: boolean) => void };
const DirtyCtx = createContext<Dirty>({ dirty: false, setDirty: () => {} });

export function DirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return <DirtyCtx.Provider value={{ dirty, setDirty }}>{children}</DirtyCtx.Provider>;
}
export const useDirty = () => useContext(DirtyCtx);
