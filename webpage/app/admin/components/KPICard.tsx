'use client'

interface SparklineProps { data: number[]; color?: string }

function Sparkline({ data, color = '#8b5cf6' }: SparklineProps) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 60, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.8 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.length > 0 && (() => {
        const lastX = w, lastY = h - (data[data.length - 1] / max) * (h - 4) - 2
        return <circle cx={lastX} cy={lastY} r="2" fill={color} />
      })()}
    </svg>
  )
}

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  sparkData?: number[]
  sub?: string
  accent?: boolean
}

export default function KPICard({ label, value, delta, sparkData, sub, accent }: KPICardProps) {
  const deltaColor = delta == null ? '' : delta >= 0 ? '#4ade80' : '#f87171'
  const deltaSign = delta == null ? '' : delta >= 0 ? '+' : ''

  return (
    <div style={{
      background: accent ? 'rgba(139,92,246,0.07)' : 'rgba(255,255,255,0.032)',
      border: `1px solid ${accent ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.16)'}`,
      borderRadius: 12, padding: '16px 18px',
      flex: 1, minWidth: 140,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: '#fff', lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {delta != null && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: deltaColor }}>
                {deltaSign}{delta}%
              </span>
            )}
            {sub && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {sub}
              </span>
            )}
          </div>
        </div>
        {sparkData && <Sparkline data={sparkData} color={accent ? '#8b5cf6' : '#3b82f6'} />}
      </div>
    </div>
  )
}
