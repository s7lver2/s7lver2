'use client';

import { usePathname } from 'next/navigation';
import { T, Kbd, useDirty } from './ui';
import { usePrefs } from '../hooks/usePrefs';

export default function StatusLine({ commandCount }: { commandCount: number }) {
  const path = usePathname();
  const { dirty } = useDirty();
  const { renderer } = usePrefs();

  const cell: React.CSSProperties = {
    padding: '0 12px', borderRight: `1px solid ${T.line}`,
    display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 30, zIndex: 60,
      display: 'flex', alignItems: 'stretch', background: T.deep,
      borderTop: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 11,
      color: T.mut,
    }}>
      <span style={{ ...cell, color: T.active }}>~{path}</span>
      <span style={{ ...cell, color: dirty ? '#fbbf24' : T.active }}>
        {dirty ? 'SIN GUARDAR' : 'GUARDADO'}
      </span>
      <span style={cell}>renderer: {renderer}</span>
      <span style={{ flex: 1 }} />
      <span style={{ ...cell, borderRight: 'none' }}>
        {commandCount} cmds · <Kbd>⌘K</Kbd>
      </span>
    </footer>
  );
}
