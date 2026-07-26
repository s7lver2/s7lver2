'use client';

import { useState } from 'react';
import { Panel, SectionHead, Btn, T } from '../components/ui';
import Chart from '../components/charts/Chart';
import { usePrefs } from '../hooks/usePrefs';
import type { Renderer } from '../components/charts/types';

const PREVIEW_SERIES = [3, 7, 4, 9, 12, 8, 15, 11, 6, 10, 14, 9, 18, 13, 7, 10];

const OPTIONS: Array<{ id: Renderer; label: string; note: string }> = [
  { id: 'dots', label: 'dots', note: 'recomendado' },
  { id: 'braille', label: 'braille', note: 'requiere fuente' },
  { id: 'svg', label: 'svg', note: '' },
];

export default function ConfigPage() {
  const { renderer, setRenderer } = usePrefs();
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ totalLines: number; source: string } | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const r = await fetch('/api/admin/github/loc/refresh', { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setResult({ totalLines: d.totalLines, source: d.source });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error');
    }
    setRefreshing(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHead kicker="admin --config" title="Configuración" />

      <Panel label="renderer de gráficos">
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, marginTop: 0, marginBottom: 16 }}>
          Elige cómo se dibujan los gráficos del panel. El cambio se aplica a todos al instante.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {OPTIONS.map((opt) => (
            <label
              key={opt.id}
              style={{
                border: `1px solid ${renderer === opt.id ? T.active : T.line}`,
                borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
                background: renderer === opt.id ? 'rgba(94,234,212,.06)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="renderer"
                  checked={renderer === opt.id}
                  onChange={() => setRenderer(opt.id)}
                />
                <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.text, letterSpacing: '.06em' }}>
                  {opt.label}
                </span>
                {opt.note && (
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.mut, letterSpacing: '.1em' }}>
                    {opt.note}
                  </span>
                )}
              </div>
              <Chart series={PREVIEW_SERIES} rows={4} />
            </label>
          ))}
        </div>
      </Panel>

      <Panel label="caché de líneas">
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, marginTop: 0, marginBottom: 14 }}>
          Recalcula el conteo de líneas de código de los repos seleccionados. Puede tardar hasta dos minutos.
        </p>
        <Btn tone="accent" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'refrescando…' : 'refrescar caché'}
        </Btn>
        {result && (
          <div style={{ marginTop: 12, fontFamily: T.mono, fontSize: 12, color: T.active }}>
            {result.totalLines.toLocaleString('en-US')} líneas · fuente: {result.source}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, fontFamily: T.mono, fontSize: 12, color: '#f87171' }}>
            error: {error}
          </div>
        )}
      </Panel>
    </div>
  );
}
