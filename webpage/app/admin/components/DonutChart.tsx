interface DonutSlice { label: string; value: number; color: string }

export default function DonutChart({ slices, size = 120, thickness = 14, centerLabel }: {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: { value: string | number; sub: string }
}) {
  const r = (size / 2) - (thickness / 2)
  const circumference = 2 * Math.PI * r
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  let offset = 0
  const arcs = slices.map(s => {
    const dash = total > 0 ? (s.value / total) * circumference : 0
    const gap = circumference - dash
    const arc = { ...s, dash, gap, offset, pct: total > 0 ? Math.round((s.value / total) * 100) : 0 }
    offset += dash
    return arc
  })

  const cx = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {/* Slices */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap={arcs.length === 1 ? 'butt' : 'round'}
          />
        ))}
      </svg>
      {centerLabel && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: '#fff', lineHeight: 1 }}>
            {centerLabel.value}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginTop: 3 }}>
            {centerLabel.sub}
          </span>
        </div>
      )}
    </div>
  )
}
