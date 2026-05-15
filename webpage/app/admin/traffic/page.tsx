// webpage/app/admin/traffic/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Stats } from '@/app/lib/analytics'

const TT = { background: 'rgba(5,0,7,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#fee0f4', padding: '6px 10px' }
const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }
const PIE_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#6d28d9', '#8b5cf6', '#4c1d95']
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Sec({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', marginBottom: 14, ...style }}>
      <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

// 7×24 heatmap grid
function HeatmapGrid({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const grid = new Map(data.map(d => [`${d.day}:${d.hour}`, d.count]))
  const [tip, setTip] = useState<{ day: number; hour: number; count: number } | null>(null)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
          <div style={{ height: 16 }} /> {/* hour label row */}
          {DAYS.map((d, i) => (
            <div key={i} style={{ height: 14, display: 'flex', alignItems: 'center', ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)' }}>{d}</div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ flex: 1, textAlign: 'center', ...S, fontSize: 7, color: 'rgba(254,240,244,0.25)' }}>
                {h % 6 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {/* Grid */}
          {Array.from({ length: 7 }, (_, day) => (
            <div key={day} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = grid.get(`${day}:${hour}`) ?? 0
                const intensity = count / max
                return (
                  <div
                    key={hour}
                    onMouseEnter={() => setTip({ day, hour, count })}
                    onMouseLeave={() => setTip(null)}
                    style={{
                      flex: 1, height: 14, borderRadius: 2, cursor: 'default',
                      background: count === 0
                        ? 'rgba(255,255,255,0.04)'
                        : `rgba(139,92,246,${0.15 + intensity * 0.85})`,
                      transition: 'background 0.2s',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {tip && tip.count > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,0,7,0.97)', border: '1px solid rgba(139,92,246,0.35)',
          borderRadius: 6, padding: '5px 10px', pointerEvents: 'none', whiteSpace: 'nowrap',
          ...S, fontSize: 9, color: '#fee0f4', marginBottom: 6,
        }}>
          {DAYS[tip.day]} {tip.hour}:00 — {tip.count} visits
        </div>
      )}
    </div>
  )
}

// Simple funnel
function Funnel({ pages }: { pages: { page: string; count: number }[] }) {
  const top = pages.slice(0, 6)
  const max = top[0]?.count ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {top.map((p, i) => {
        const pct = Math.round((p.count / max) * 100)
        const w = 40 + pct * 0.6
        return (
          <div key={p.page} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.35)', flex: '0 0 18px', textAlign: 'right' }}>{i + 1}</span>
            <div style={{ flex: `0 0 ${w}%`, height: 28, background: `rgba(139,92,246,${0.5 - i * 0.07})`, borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', paddingLeft: 10, transition: 'flex 0.4s ease' }}>
              <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.page}</span>
            </div>
            <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.4)' }}>{p.count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function TrafficPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => { if (r.status === 401) { router.replace('/admin/login'); return null } return r.json() as Promise<Stats> })
      .then(d => { if (d) { setStats(d); setLoading(false) } })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  if (loading) return <div style={{ ...S, fontSize: 14, color: 'rgba(254,240,244,0.3)', paddingTop: 60, textAlign: 'center' }}>loading…</div>
  if (!stats) return null

  // Build stacked area data per page
  const topPages = stats.byPage.slice(0, 4).map(p => p.page)
  const areaData = stats.byDay.map(d => {
    const row: Record<string, string | number> = { date: d.date.slice(5) }
    for (const p of topPages) row[p] = 0
    return row
  })
  // We don't have byDayByPage breakdown, approximate with proportional split
  for (const day of areaData) {
    const total = stats.byDay.find(d => d.date.slice(5) === day.date)?.count ?? 0
    for (const p of topPages) {
      const share = (stats.byPage.find(bp => bp.page === p)?.count ?? 0) / Math.max(stats.total, 1)
      day[p] = Math.round(total * share)
    }
  }

  const PAGE_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#6d28d9']

  const refData = stats.byReferrer.slice(0, 6).map((r, i) => ({
    name: r.referrer === '(directo)' || !r.referrer ? 'directo' : r.referrer,
    value: r.count,
    color: PIE_COLORS[i] ?? PIE_COLORS[PIE_COLORS.length - 1],
  }))

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text)', margin: 0 }}>traffic</h1>
        <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          análisis de fuentes y comportamiento
        </div>
      </div>

      {/* Heatmap + Area chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="tr-grid">
        <Sec title="actividad por hora y día">
          <HeatmapGrid data={stats.byDayHour} />
        </Sec>
        <Sec title="traffic by page — 7 days">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={areaData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
              <XAxis dataKey="date" tick={{ fill: 'rgba(233,213,255,0.3)', fontSize: 9, fontFamily: 'Space Mono, monospace' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(233,213,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              {topPages.map((p, i) => (
                <Area key={p} type="monotone" dataKey={p} stackId="a" fill={PAGE_COLORS[i]} stroke={PAGE_COLORS[i]} fillOpacity={0.5} strokeWidth={1.5} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {topPages.map((p, i) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: PAGE_COLORS[i] }} />
                <span style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.45)' }}>{p}</span>
              </div>
            ))}
          </div>
        </Sec>
      </div>

      {/* Funnel */}
      <Sec title="pages más visitadas — funnel">
        <Funnel pages={stats.byPage} />
      </Sec>

      {/* Referrers */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }} className="ref-grid">
        <Sec title="fuentes de traffic" style={{ marginBottom: 0 }}>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={refData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {refData.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Pie>
              <Tooltip contentStyle={TT} formatter={(v) => [v, 'visits']} />
            </PieChart>
          </ResponsiveContainer>
        </Sec>
        <Sec title="referrers — detalle" style={{ marginBottom: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['fuente', 'visits', '%'].map(h => (
                    <th key={h} style={{ textAlign: 'left', ...S, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.55)', paddingBottom: 10, paddingRight: 16, borderBottom: '1px solid rgba(139,92,246,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.byReferrer.map(r => {
                  const name = r.referrer || 'directo'
                  return (
                    <tr key={r.referrer}>
                      <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.6)', padding: '7px 16px 7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</td>
                      <td style={{ ...S, fontSize: 10, color: 'var(--text)', padding: '7px 16px 7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{r.count}</td>
                      <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.35)', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{Math.round(r.count / stats.total * 100)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Sec>
      </div>

      <style>{`
        @media (max-width: 900px) { .tr-grid, .ref-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}