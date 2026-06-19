'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import DonutChart from './components/DonutChart'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import KPICard from './components/KPICard'
import type { Stats } from '@/app/lib/data'

const TT: CSSProperties = {
  background: 'rgba(5,0,10,0.97)',
  border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8,
  fontFamily: 'Space Mono, monospace',
  fontSize: 12,
  color: '#e9d5ff',
  padding: '6px 10px',
}

const S: CSSProperties = { fontFamily: 'var(--font-body)' }
const AXIS_TICK = { fontSize: 12, fill: 'rgba(255,255,255,0.3)' } as const
const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#a78bfa', '#60a5fa', '#7c3aed', '#2563eb']

function Sec({ title, children, style }: { title: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', ...style }}>
      <div style={{ ...S, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function fmt(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), sec = s % 60
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

function Bar({ value, max, color = '#8b5cf6' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value / Math.max(max, 1)) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function OverviewPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/stats')
        .then(r => { if (r.status === 401) { router.push('/admin/login'); return null } return r.json() })
        .then(d => { if (d) { setStats(d); setLoading(false) } })
        .catch(() => setLoading(false))
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 12_000)
    return () => clearInterval(id)
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
      loading…
    </div>
  )
  if (!stats) return null

  const topPageMax = stats.byPage[0]?.count ?? 1
  const topCountryMax = stats.byCountry[0]?.count ?? 1
  const topRefMax = stats.byReferrer[0]?.count ?? 1
  const topBrowserMax = stats.byBrowser[0]?.count ?? 1
  const deviceTotal = stats.byDevice.reduce((a, b) => a + b.count, 0)
  const recentSessions = stats.sessions.slice(0, 5)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', lineHeight: 1.1 }}>
            overview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ ...S, fontSize: 10, color: 'rgba(74,222,128,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>live</span>
          </div>
        </div>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>
          all-time summary · auto-refreshes every 12s
        </div>
      </div>

      {/* KPI row — 5 cards */}
      <div className="ov-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <KPICard label="total visits" value={stats.total.toLocaleString()} delta={stats.deltaTotal} sub="vs yesterday" accent />
        <KPICard label="unique visitors" value={stats.unique.toLocaleString()} delta={stats.deltaUnique} sub="by IP" sparkData={stats.byDay.map(d => d.count)} />
        <KPICard label="active · 1h" value={stats.activeLastHour} sub="right now" />
        <KPICard label="bounce rate" value={`${stats.bounceRate}%`} sub={stats.bounceRate < 50 ? 'good' : stats.bounceRate < 70 ? 'ok' : 'high'} />
        <KPICard label="avg session" value={fmt(stats.avgDuration)} sub="duration" />
      </div>

      {/* Chart + Devices */}
      <div className="ov-chart-row" style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, marginBottom: 10 }}>
        <Sec title="visits · last 7 days">
          <ResponsiveContainer width="100%" height={118}>
            <AreaChart data={stats.byDay} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT} labelFormatter={(l: unknown) => typeof l === 'string' ? fmtDate(l) : String(l ?? '')} formatter={(v: unknown) => [String(v ?? ''), 'visits'] as const} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Sec>

        <Sec title="devices">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <DonutChart
              size={100}
              thickness={12}
              slices={stats.byDevice.map((d, i) => ({ label: d.device, value: d.count, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={{
                value: `${stats.byDevice[0] && deviceTotal > 0 ? Math.round((stats.byDevice[0].count / deviceTotal) * 100) : 0}%`,
                sub: stats.byDevice[0]?.device?.toUpperCase() ?? 'DESKTOP',
              }}
            />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {stats.byDevice.map((d, i) => (
                <div key={d.device} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{d.device}</span>
                  </div>
                  <span style={{ ...S, fontSize: 11, color: '#fff' }}>{deviceTotal > 0 ? Math.round((d.count / deviceTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Sec>
      </div>

      {/* 4-column analytics: pages · countries · referrers · browsers */}
      <div className="ov-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
        <Sec title="top pages">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byPage.slice(0, 5).map(p => (
              <div key={p.page} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{p.page}</span>
                  <span style={{ ...S, fontSize: 11, color: '#fff', flexShrink: 0 }}>{p.count}</span>
                </div>
                <Bar value={p.count} max={topPageMax} color="#8b5cf6" />
              </div>
            ))}
          </div>
        </Sec>

        <Sec title="top countries">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byCountry.slice(0, 5).map(c => (
              <div key={c.code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>
                    {c.code && (
                      <img src={`https://flagcdn.com/16x12/${c.code.toLowerCase()}.png`} alt={c.code}
                        style={{ width: 13, height: 9, objectFit: 'cover', marginRight: 5, borderRadius: 1, verticalAlign: 'middle', display: 'inline-block' }} />
                    )}
                    {c.country}
                  </span>
                  <span style={{ ...S, fontSize: 11, color: '#fff', flexShrink: 0 }}>{c.count}</span>
                </div>
                <Bar value={c.count} max={topCountryMax} color="#3b82f6" />
              </div>
            ))}
          </div>
        </Sec>

        <Sec title="referrers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byReferrer.length === 0 && (
              <div style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>no referrers yet</div>
            )}
            {stats.byReferrer.slice(0, 5).map(r => (
              <div key={r.referrer} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{r.referrer}</span>
                  <span style={{ ...S, fontSize: 11, color: '#fff', flexShrink: 0 }}>{r.count}</span>
                </div>
                <Bar value={r.count} max={topRefMax} color="#a78bfa" />
              </div>
            ))}
          </div>
        </Sec>

        <Sec title="browsers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byBrowser.slice(0, 5).map((b, i) => (
              <div key={b.browser} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{b.browser}</span>
                  <span style={{ ...S, fontSize: 11, color: '#fff', flexShrink: 0 }}>{b.count}</span>
                </div>
                <Bar value={b.count} max={topBrowserMax} color={PIE_COLORS[i % PIE_COLORS.length]} />
              </div>
            ))}
          </div>
        </Sec>
      </div>

      {/* Recent sessions — full width */}
      <Sec title="recent sessions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recentSessions.length === 0 && (
            <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>no sessions yet</div>
          )}
          {recentSessions.map(sess => (
            <div key={sess.sessionId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(139,92,246,0.09)',
              borderRadius: 8, gap: 8,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <div style={{ ...S, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sess.city ? `${sess.city}, ` : ''}{sess.country ?? '—'}
                </div>
                <div style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sess.pages.join(' → ')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <div style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmt(sess.duration)}</div>
                <div style={{ ...S, fontSize: 11, color: 'rgba(139,92,246,0.55)' }}>
                  {sess.browser ?? ''}{sess.os ? ` · ${sess.os}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Sec>

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 1000px) {
          .ov-kpis { grid-template-columns: repeat(3, 1fr) !important; }
          .ov-4col { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 700px) {
          .ov-kpis { grid-template-columns: repeat(2, 1fr) !important; }
          .ov-chart-row { grid-template-columns: 1fr !important; }
          .ov-4col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
