// webpage/app/admin/sessions/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { Stats, SessionSummary } from '@/app/lib/analytics'

const TT = { background: 'rgba(5,0,7,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#fee0f4', padding: '6px 10px' }
const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

function Sec({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', marginBottom: 14, ...style }}>
      <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

// Semi-circle gauge
function BounceGauge({ rate }: { rate: number }) {
  const r = 54, cx = 70, cy = 65
  const circumference = Math.PI * r
  const filled = circumference * (rate / 100)
  const color = rate < 40 ? '#4ade80' : rate < 70 ? '#facc15' : '#f87171'
  const angle = -180 + (rate / 100) * 180
  const rad = (angle * Math.PI) / 180
  const needleX = cx + (r - 8) * Math.cos(rad)
  const needleY = cy + (r - 8) * Math.sin(rad)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={140} height={76} viewBox="0 0 140 76">
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} strokeLinecap="round" />
        {/* Value arc */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`} style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }} />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="rgba(254,240,244,0.7)" strokeWidth={1.5} strokeLinecap="round" style={{ transition: 'x2 0.6s ease, y2 0.6s ease' }} />
        <circle cx={cx} cy={cy} r={3} fill="rgba(254,240,244,0.5)" />
        {/* Labels */}
        <text x={cx - r - 4} y={cy + 14} fill="rgba(254,240,244,0.3)" fontSize={8} fontFamily="Space Mono, monospace">0%</text>
        <text x={cx + r - 10} y={cy + 14} fill="rgba(254,240,244,0.3)" fontSize={8} fontFamily="Space Mono, monospace">100%</text>
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 32, color, lineHeight: 1, marginTop: -10 }}>{rate}%</div>
      <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)', marginTop: 4 }}>
        {rate < 40 ? '✓ low' : rate < 70 ? '~ medium' : '↑ high'}
      </div>
    </div>
  )
}

// Mini donut
function MiniDonut({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#6d28d9', '#8b5cf6']
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ ...S, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 8 }}>{title}</div>
      <PieChart width={120} height={100}>
        <Pie data={data} dataKey="value" innerRadius={32} outerRadius={48} paddingAngle={2} startAngle={90} endAngle={-270}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={TT} formatter={(v) => [`${Number(v)} (${Math.round(Number(v) / Math.max(total, 1) * 100)}%)`, '']} />
      </PieChart>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
        {data.slice(0, 4).map((d, i) => (
          <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <span style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.45)' }}>{d.name}</span>
            </div>
            <span style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)' }}>{Math.round(d.value / Math.max(total, 1) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDur(s: number) {
  if (!s) return '—'
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const PER_PAGE = 10

export default function SessionsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => { if (r.status === 401) { router.replace('/admin/login'); return null } return r.json() as Promise<Stats> })
      .then(d => { if (d) { setStats(d); setLoading(false) } })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  if (loading) return <div style={{ ...S, fontSize: 14, color: 'rgba(254,240,244,0.3)', paddingTop: 60, textAlign: 'center' }}>loading…</div>
  if (!stats) return null

  const sessions = stats.sessions ?? []
  const totalPages = Math.ceil(sessions.length / PER_PAGE)
  const paginated = sessions.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const devData = stats.byDevice.map(d => ({ name: d.device, value: d.count }))
  const brwData = stats.byBrowser.map(d => ({ name: d.browser, value: d.count }))
  const osData = stats.byOS.map(d => ({ name: d.os, value: d.count }))

  // Avg duration per page (approximate from sessions)
  const pageDur = new Map<string, { total: number; count: number }>()
  for (const s of sessions) {
    for (const p of s.pages) {
      const cur = pageDur.get(p) ?? { total: 0, count: 0 }
      pageDur.set(p, { total: cur.total + s.duration / Math.max(s.pages.length, 1), count: cur.count + 1 })
    }
  }
  const durByPage = [...pageDur.entries()]
    .map(([page, d]) => ({ page, avg: Math.round(d.total / d.count) }))
    .sort((a, b) => b.avg - a.avg).slice(0, 6)

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text)', margin: 0 }}>sessions</h1>
        <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          behavior and devices
        </div>
      </div>

      {/* 3 donuts + gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px', gap: 14, marginBottom: 14 }} className="sess-top-grid">
        <Sec title="devices" style={{ marginBottom: 0 }}>
          {devData.length ? <MiniDonut data={devData} title="" /> : <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.2)' }}>no data</span>}
        </Sec>
        <Sec title="browsers" style={{ marginBottom: 0 }}>
          {brwData.length ? <MiniDonut data={brwData} title="" /> : <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.2)' }}>no data</span>}
        </Sec>
        <Sec title="sistemas operativos" style={{ marginBottom: 0 }}>
          {osData.length ? <MiniDonut data={osData} title="" /> : <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.2)' }}>no data</span>}
        </Sec>
        <Sec title="bounce rate" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <BounceGauge rate={stats.bounceRate} />
        </Sec>
      </div>

      {/* Duration by page */}
      {durByPage.length > 0 && (
        <Sec title="avg duration by page">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={durByPage} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 10 }}>
              <XAxis type="number" tick={{ fill: 'rgba(233,213,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}s`} />
              <YAxis type="category" dataKey="page" tick={{ fill: 'rgba(233,213,255,0.45)', fontSize: 9, fontFamily: 'Space Mono, monospace' }} tickLine={false} axisLine={false} width={65} />
              <Tooltip contentStyle={TT} formatter={(v) => [formatDur(Number(v)), 'avg duration']} />
              <Bar dataKey="avg" name="segundos" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Sec>
      )}

      {/* Sessions table */}
      <Sec title={`latest sessions — ${sessions.length} recorded`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['ID', 'origin', 'pages', 'duration', 'device', 'type', 'first visit'].map(h => (
                  <th key={h} style={{ textAlign: 'left', ...S, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.55)', paddingBottom: 10, paddingRight: 12, borderBottom: '1px solid rgba(139,92,246,0.1)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((s: SessionSummary) => {
                const time = new Date(s.firstSeen).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                return (
                  <tr key={s.sessionId}>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.35)', padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'monospace' }}>{s.sessionId}</td>
                    <td style={{ ...S, fontSize: 9, color: 'var(--text)', padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>
                      {s.city && s.country ? `${s.city}, ${s.country}` : s.country ?? '—'}
                    </td>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.45)', padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.pages.join(' → ')}
                    </td>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.5)', padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>{formatDur(s.duration)}</td>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.4)', padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>
                      {[s.device, s.os].filter(Boolean).join(' / ')}
                    </td>
                    <td style={{ padding: '8px 12px 8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{
                        ...S, fontSize: 8, letterSpacing: '0.08em',
                        padding: '2px 7px', borderRadius: 20,
                        background: s.isNew ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                        color: s.isNew ? '#8b5cf6' : 'rgba(254,240,244,0.3)',
                        border: `1px solid ${s.isNew ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                        {s.isNew ? 'new' : 'returning'}
                      </span>
                    </td>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.3)', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>{time}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ background: 'none', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, padding: '5px 12px', ...S, fontSize: 9, color: page === 0 ? 'rgba(254,240,244,0.2)' : 'var(--text)', cursor: page === 0 ? 'default' : 'pointer' }}
            >← ant</button>
            <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.3)' }}>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{ background: 'none', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, padding: '5px 12px', ...S, fontSize: 9, color: page === totalPages - 1 ? 'rgba(254,240,244,0.2)' : 'var(--text)', cursor: page === totalPages - 1 ? 'default' : 'pointer' }}
            >sig →</button>
          </div>
        )}
      </Sec>

      <style>{`
        @media (max-width: 900px) { .sess-top-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px) { .sess-top-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}