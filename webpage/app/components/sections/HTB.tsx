'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HTBPlanet = dynamic(() => import('../planets/HTBPlanet'), { ssr: false });

interface HTBData {
  name?: string;
  rank?: string;
  points?: number;
  user_owns?: number;
  system_owns?: number;
  rank_text?: string;
}

export default function HTBSection({ onOpenTerminal }: { onOpenTerminal?: () => void }) {
  const [data, setData] = useState<HTBData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/htb')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError(true));
  }, []);

  const stats = data ? [
    { label: 'Rank',    value: data.rank_text ?? data.rank ?? '—' },
    { label: 'Points',  value: data.points?.toLocaleString() ?? '—' },
    { label: 'User Owns',   value: data.user_owns?.toString() ?? '—' },
    { label: 'System Owns', value: data.system_owns?.toString() ?? '—' },
  ] : [];

  return (
    <section id="htb" className="section-planet">
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

          {/* Left: planet */}
          <div style={{ position: 'relative', height: 420 }}>
            <div style={{
              position: 'absolute', right: '-18%', bottom: '-28%',
              width: '110%', aspectRatio: '1', pointerEvents: 'none',
            }}>
              <HTBPlanet />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse 100% 100% at 60% 60%, transparent 34%, var(--surface) 62%)',
              }} />
            </div>
          </div>

          {/* Right: content */}
          <div className="reveal">
            <div className="t-label" style={{ marginBottom: 12 }}>hackthebox.com</div>
            <h2 className="t-h2" style={{ marginBottom: 8 }}>HTB Stats</h2>
            <p className="t-body" style={{ marginBottom: 36 }}>
              // active hacking progress
            </p>

            {error ? (
              <div style={{
                padding: '16px 20px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--fg-faint)',
              }}>
                No se pudo conectar con HTB. &nbsp;
                <a
                  href={`https://www.hackthebox.com/profile/1584434`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--ok)', textDecoration: 'none' }}
                >
                  Ver perfil en HTB ↗
                </a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
                {(data ? stats : Array(4).fill({ label: '…', value: '…' })).map((s, i) => (
                  <div key={i} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600,
                      letterSpacing: '-0.04em', color: 'var(--fg)',
                    }}>{s.value}</div>
                    <div className="t-label" style={{ marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={onOpenTerminal}
              className="btn btn-secondary"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            >
              $ open terminal
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}