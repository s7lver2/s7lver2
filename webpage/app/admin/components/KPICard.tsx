// webpage/app/admin/components/KPICard.tsx
'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: number;
  sub?: string;
  accent?: boolean;
  sparkData?: number[];
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = 28;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke="rgba(139,92,246,0.6)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export default function KPICard({ label, value, delta, sub, accent, sparkData }: KPICardProps) {
  const positive = delta !== undefined ? delta >= 0 : true;
  return (
    <div style={{
      flex: 1, minWidth: 130,
      background: accent ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${accent ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.12)'}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 28, color: '#e9d5ff', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {delta !== undefined && (
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: positive ? '#86efac' : '#fca5a5' }}>
            {positive ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
        {sub && (
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.3)' }}>
            {sub}
          </span>
        )}
        {sparkData && <Sparkline data={sparkData} />}
      </div>
    </div>
  );
}