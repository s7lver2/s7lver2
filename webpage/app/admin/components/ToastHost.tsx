'use client';

import { useEffect, useState } from 'react';
import { T } from './ui';
import { registerToast } from '../hooks/usePrefs';

interface Toast { id: number; msg: string; }

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    registerToast((msg: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 42, zIndex: 70,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: T.glass, border: `1px solid ${T.line}`, borderRadius: 10,
          padding: '10px 14px', fontFamily: T.mono, fontSize: 11.5, color: T.text,
          backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,.35)',
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
