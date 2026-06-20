'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { EngagementResponse } from '@/app/api/admin/engagement/route'
import type { AppEvent } from '@/app/lib/events'
import KPICard from '@/app/admin/components/KPICard'

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

function Sec({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', marginBottom: 14, ...style }}>
      <div style={{ ...S, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function GeoMap({ geo }: { geo: { lat: number; lon: number }[] }) {
  const W = 480, H = 240
  return (
    <svg width={W} height={H} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, display: 'block', margin: '0 auto' }} viewBox={`0 0 ${W} ${H}`}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const x = pct * W
        const y = pct * H
        return (
          <g key={`grid-${pct}`} opacity={0.15}>
            <line x1={x} y1={0} x2={x} y2={H} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4,4" />
            <line x1={0} y1={y} x2={W} y2={y} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4,4" />
          </g>
        )
      })}
      {/* Blips */}
      {geo.map((g, i) => {
        const x = ((g.lon + 180) / 360) * W
        const y = ((90 - g.lat) / 180) * H
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill="#8b5cf6"
            opacity={0.8}
            style={{ mixBlendMode: 'screen' }}
          />
        )
      })}
      {/* Border */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth={1} />
    </svg>
  )
}

function ScrollDepthBars({ sections }: { sections: { section: string; avg: number }[] }) {
  const sorted = [...sections].sort((a, b) => b.avg - a.avg)
  const max = sorted[0]?.avg ?? 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((s) => {
        const pct = Math.min(100, s.avg)
        return (
          <div key={s.section} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.45)', flex: '0 0 80px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {s.section}
            </span>
            <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: `linear-gradient(90deg, rgba(139,92,246,0.6), rgba(139,92,246,0.3))`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ ...S, fontSize: 12, color: '#fff', flex: '0 0 35px', textAlign: 'right' }}>{s.avg}%</span>
          </div>
        )
      })}
    </div>
  )
}

function EventsTable({ events }: { events: AppEvent[] }) {
  const filtered = events.filter((e) => ['scroll_depth', 'cmdk_open', 'terminal_cmd', 'project_click'].includes(e.type))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['type', 'detail', 'section', 'depth %', 'timestamp'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  ...S,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(139,92,246,0.55)',
                  paddingBottom: 8,
                  paddingRight: 12,
                  borderBottom: '1px solid rgba(139,92,246,0.1)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 30).map((e, i) => {
            const ts = new Date(e.ts)
            const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            return (
              <tr key={i}>
                <td style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '6px 12px 6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 500 }}>
                  {e.type.replace(/_/g, ' ')}
                </td>
                <td style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: '6px 12px 6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.detail || '—'}
                </td>
                <td style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: '6px 12px 6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.section || '—'}
                </td>
                <td style={{ ...S, fontSize: 11, color: '#fff', padding: '6px 12px 6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  {e.depth != null ? e.depth : '—'}
                </td>
                <td style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>
                  {timeStr}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function EngagementPage() {
  const router = useRouter()
  const [data, setData] = useState<EngagementResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () =>
      fetch('/api/admin/engagement')
        .then((r) => { if (r.status === 401) { router.replace('/admin/login'); return null } return r.json() as Promise<EngagementResponse> })
        .then((d) => { if (d) { setData(d); setLoading(false) } })
        .catch(() => router.replace('/admin/login'))
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 15_000)
    return () => clearInterval(id)
  }, [router])

  if (loading) return <div style={{ ...S, fontSize: 14, color: 'rgba(255,255,255,0.3)', paddingTop: 60, textAlign: 'center' }}>loading…</div>
  if (!data) return null

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 }}>engagement</h1>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          user interaction analytics
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <KPICard label="⌘K Opens" value={data.cmdkOpens} accent />
        <KPICard label="Terminal Cmds" value={data.terminalCmds} accent />
        <KPICard label="Avg Scroll Depth" value={`${data.avgScrollDepth}%`} />
        <KPICard label="Read Full %" value={`${data.readFullPct}%`} />
      </div>

      {/* Scroll Depth by Section */}
      <Sec title="scroll depth by section">
        {data.scrollBySection.length > 0 ? (
          <ScrollDepthBars sections={data.scrollBySection} />
        ) : (
          <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
            No scroll data
          </div>
        )}
      </Sec>

      {/* Geo Map */}
      <Sec title={`Visitor Map (${data.geo.length} locations)`}>
        {data.geo.length > 0 ? (
          <GeoMap geo={data.geo} />
        ) : (
          <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '60px 0' }}>
            No geo data
          </div>
        )}
      </Sec>

      {/* Events Table */}
      <Sec title="recent events">
        {data.recent.length > 0 ? (
          <EventsTable events={data.recent} />
        ) : (
          <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
            No events
          </div>
        )}
      </Sec>
    </>
  )
}
