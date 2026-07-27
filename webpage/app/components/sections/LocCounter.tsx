'use client';

import { useEffect, useState } from 'react';
import type { LocPayload } from '@/lib/loc';
import { useCountUp } from '@/lib/countup';

function CountTo({ value }: { value: number }) {
  const { ref, value: shown } = useCountUp(value);
  return <span ref={ref}>{shown.toLocaleString('en-US')}</span>;
}

export default function LocCounter() {
  const [data, setData] = useState<LocPayload | null>(null);
  const [tip, setTip] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/github/loc')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d as LocPayload); })
      .catch(() => { /* quiet: the card simply does not appear */ });
    return () => { alive = false; };
  }, []);

  if (!data || data.totalLines === 0) return null;

  const top = data.byLanguage.slice(0, 6);
  const breakdown = top.map((l) => `${l.name} ${l.pct}%`).join(' · ');

  return (
    <div className="card locbig reveal">
      <div className="cap" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span>Lines of code · every repo</span>
        <span className="mono" style={{ color: 'var(--dim)', fontSize: 11, minHeight: 14 }}>{tip}</span>
      </div>

      {/* Hover the total to see the same kind of breakdown the heatmap
          cells show on hover — here it's the language share of all lines,
          not a single day's repos. */}
      <div
        className="locnum"
        onMouseEnter={() => setTip(breakdown)}
        onMouseLeave={() => setTip('')}
        style={{ cursor: 'default' }}
      >
        {/* `~` only when the number is a byte-derived estimate. */}
        <span className="grad">
          {data.source === 'estimate' ? '~' : ''}
          <CountTo value={data.totalLines} />
        </span>
        <em>lines</em>
      </div>

      <div className="locbar">
        {top.map((l) => (
          <span key={l.name} style={{ width: `${l.pct}%`, background: l.color }} />
        ))}
      </div>

      <div className="locleg">
        {top.map((l) => (
          <span key={l.name}>
            <i style={{ background: l.color }} />
            {l.name} <b>{l.lines.toLocaleString('en-US')}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
