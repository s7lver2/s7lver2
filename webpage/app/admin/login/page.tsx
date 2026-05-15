// webpage/app/admin/login/page.tsx
'use client';
import { useState } from 'react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { window.location.replace('/admin/overview'); }
      else { setError('contraseña incorrecta'); }
    } catch { setError('connection error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgb(6,3,12)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'rgba(139,92,246,0.04)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 16, padding: 32,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 22, color: '#e9d5ff', marginBottom: 4 }}>
            control panel
          </div>
          <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(139,92,246,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            s7lver • admin
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            placeholder="contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              padding: '10px 12px',
              background: 'rgba(139,92,246,0.05)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 8, color: '#e9d5ff',
              fontFamily: 'var(--font-mono), monospace', fontSize: 12,
              outline: 'none', boxSizing: 'border-box', width: '100%',
            }}
          />
          {error && <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#a78bfa', textAlign: 'center' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              padding: '10px 0',
              background: loading ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: 8, color: loading ? 'rgba(233,213,255,0.4)' : '#e9d5ff',
              fontFamily: 'var(--font-mono), monospace', fontSize: 11,
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {loading ? 'signing in…' : 'sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}