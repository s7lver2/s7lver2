'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Stats } from '@/app/lib/data'
import DonutChart from './components/DonutChart'
import Chart from './components/charts/Chart'
import { Panel, SectionHead, T } from './components/ui'

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#a78bfa', '#60a5fa', '#7c3aed', '#2563eb']
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const TABS = ['overview', 'traffic', 'live'] as const
type Tab = typeof TABS[number]

interface LiveVisit { lat: number; lon: number; country: string; city: string; page: string; timestamp: string }
interface PresenceSession {
  sessionId: string; page: string; city: string; country: string
  countryCode: string; lat?: number; lon?: number
  connectedAt: number; lastSeen: number
}
interface StreamData {
  activeLastHour: number; todayTotal: number
  recent: LiveVisit[]; online?: PresenceSession[]; ts: number
}
interface FeedItem { label: string; page: string; ts: number; key: string }

function fmt(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), sec = s % 60
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`
}
function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`
}

function Bar({ value, max, color = T.accent }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value / Math.max(max, 1)) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function HeatmapGrid({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const grid = new Map(data.map(d => [`${d.day}:${d.hour}`, d.count]))
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
        <div style={{ height: 16 }} />
        {DAYS.map((d, i) => (
          <div key={i} style={{ height: 14, display: 'flex', alignItems: 'center', fontFamily: T.mono, fontSize: 11, color: T.dim }}>{d}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ flex: 1, textAlign: 'center', fontFamily: T.mono, fontSize: 10, color: T.dim }}>
              {h % 6 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = grid.get(`${day}:${hour}`) ?? 0
              const intensity = count / max
              return (
                <div key={hour} title={`${count}`} style={{
                  flex: 1, height: 14, borderRadius: 2,
                  background: count === 0 ? 'rgba(255,255,255,0.04)' : `rgba(139,92,246,${0.15 + intensity * 0.85})`,
                }} />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewTab({ stats }: { stats: Stats }) {
  const topPageMax = stats.byPage[0]?.count ?? 1
  const topCountryMax = stats.byCountry[0]?.count ?? 1
  const deviceTotal = stats.byDevice.reduce((a, b) => a + b.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Panel label="visitas totales"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stats.total.toLocaleString()}</div></Panel>
        <Panel label="únicos"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stats.unique.toLocaleString()}</div></Panel>
        <Panel label="activos · 1h"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stats.activeLastHour}</div></Panel>
        <Panel label="bounce rate"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stats.bounceRate}%</div></Panel>
        <Panel label="sesión media"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{fmt(stats.avgDuration)}</div></Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 10 }} className="an-row">
        <Panel label="visitas · 7 días">
          <Chart series={stats.byDay.map(d => d.count)} label="visitas/día" rows={7} />
        </Panel>
        <Panel label="dispositivos">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <DonutChart size={100} thickness={12} slices={stats.byDevice.map((d, i) => ({ label: d.device, value: d.count, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              centerLabel={{ value: `${stats.byDevice[0] && deviceTotal > 0 ? Math.round((stats.byDevice[0].count / deviceTotal) * 100) : 0}%`, sub: stats.byDevice[0]?.device?.toUpperCase() ?? '' }} />
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="an-row2">
        <Panel label="top páginas">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byPage.slice(0, 5).map(p => (
              <div key={p.page} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11, color: T.mut }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{p.page}</span>
                  <span>{p.count}</span>
                </div>
                <Bar value={p.count} max={topPageMax} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel label="top países">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byCountry.slice(0, 5).map(c => (
              <div key={c.code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11, color: T.mut }}>
                  <span>{c.country}</span>
                  <span>{c.count}</span>
                </div>
                <Bar value={c.count} max={topCountryMax} color="#3b82f6" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel label="sesiones recientes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {stats.sessions.slice(0, 5).map(sess => (
            <div key={sess.sessionId} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', border: `1px solid ${T.line}`, borderRadius: 8, gap: 8 }}>
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sess.city ? `${sess.city}, ` : ''}{sess.country ?? '—'}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>{fmt(sess.duration)}</div>
            </div>
          ))}
          {stats.sessions.length === 0 && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>no hay sesiones aún</div>}
        </div>
      </Panel>

      <style>{`
        @media (max-width: 900px) { .an-row, .an-row2 { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}

function TrafficTab({ stats }: { stats: Stats }) {
  const refData = stats.byReferrer.slice(0, 6).map((r, i) => ({
    name: r.referrer === '(directo)' || r.referrer === '(direct)' || !r.referrer ? 'direct' : r.referrer,
    value: r.count,
    color: PIE_COLORS[i] ?? PIE_COLORS[PIE_COLORS.length - 1],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="an-row">
        <Panel label="actividad por hora y día">
          <HeatmapGrid data={stats.byDayHour} />
        </Panel>
        <Panel label="tráfico por página · 7 días">
          <Chart series={stats.byPage.slice(0, 8).map(p => p.count)} label="páginas por visitas" rows={6} />
        </Panel>
      </div>

      <Panel label="referrers">
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20 }} className="an-row">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <DonutChart size={100} thickness={12} slices={refData.map(r => ({ label: r.name, value: r.value, color: r.color }))}
              centerLabel={{ value: stats.total, sub: 'VISITAS' }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['fuente', 'visitas', '%'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontFamily: T.mono, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: T.mut, paddingBottom: 8, borderBottom: `1px solid ${T.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.byReferrer.map(r => (
                  <tr key={r.referrer}>
                    <td style={{ fontFamily: T.mono, fontSize: 12, color: T.text, padding: '7px 12px 7px 0', borderBottom: `1px solid ${T.line}` }}>{r.referrer || 'direct'}</td>
                    <td style={{ fontFamily: T.mono, fontSize: 12, color: T.text, padding: '7px 12px 7px 0', borderBottom: `1px solid ${T.line}` }}>{r.count}</td>
                    <td style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, padding: '7px 0', borderBottom: `1px solid ${T.line}` }}>{stats.total > 0 ? Math.round(r.count / stats.total * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function LiveTab({ stream }: { stream: StreamData }) {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    const added: FeedItem[] = []
    for (const v of stream.recent ?? []) {
      const key = `visit:${v.timestamp}:${v.lat}:${v.lon}`
      if (seenRef.current.has(key)) continue
      seenRef.current.add(key)
      added.push({ label: v.city || v.country || '—', page: v.page, ts: new Date(v.timestamp).getTime(), key })
    }
    if (added.length) {
      added.sort((a, b) => b.ts - a.ts)
      setFeed(prev => [...added, ...prev].slice(0, 30))
    }
  }, [stream])

  const online = stream.online ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Panel label="online ahora"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.active }}>{online.length}</div></Panel>
        <Panel label="activos · 1h"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stream.activeLastHour}</div></Panel>
        <Panel label="visitas hoy"><div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 30, color: T.text }}>{stream.todayTotal}</div></Panel>
      </div>

      {online.length > 0 && (
        <Panel label={`online — ${online.length}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {online.map(s => (
              <div key={s.sessionId} style={{ fontFamily: T.mono, fontSize: 11.5, padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.active}55`, color: T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.active }} />
                {s.city || s.country || 'unknown'}
                <span style={{ color: T.dim }}>· {s.page}</span>
                <span style={{ color: T.active }}>{ago(s.connectedAt)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel label="live feed">
        <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {feed.length === 0 ? (
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, fontStyle: 'italic' }}>esperando visitantes…</div>
          ) : feed.map((item, i) => (
            <div key={item.key} style={{ padding: '7px 0', borderBottom: i < feed.length - 1 ? `1px solid ${T.line}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11.5, color: T.mut }}>
                <span>◆ pageview</span>
                <span>{ago(item.ts)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 12, color: T.text }}>
                <span>{item.label}</span>
                <span style={{ color: T.dim }}>{item.page}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [stream, setStream] = useState<StreamData>({ activeLastHour: 0, todayTotal: 0, recent: [], ts: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [ind, setInd] = useState({ left: 0, width: 0, ready: false })
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ overview: null, traffic: null, live: null })

  useEffect(() => {
    // One fetch of /api/admin/stats shared by all three tabs — the endpoint
    // already returns everything Overview, Traffic and Live each need.
    const load = () =>
      fetch('/api/admin/stats')
        .then(r => { if (r.status === 401) { router.push('/admin/login'); return null } return r.json() })
        .then(d => { if (d) { setStats(d); setStream(d); setLoading(false) } })
        .catch(() => setLoading(false))
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 12_000)
    return () => clearInterval(id)
  }, [router])

  useEffect(() => {
    const el = tabRefs.current[tab]
    if (!el) return
    setInd({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [tab, loading])

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (loading) {
    return <div style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, padding: 40, textAlign: 'center' }}>cargando…</div>
  }
  if (!stats) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionHead kicker="admin --analytics" title="Analytics" />

      <div style={{ position: 'relative', display: 'flex', gap: 4, borderBottom: `1px solid ${T.line}` }}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => { tabRefs.current[t] = el }}
            onClick={() => setTab(t)}
            className="admin-focusable"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
              fontFamily: T.mono, fontSize: 12, letterSpacing: '.08em',
              color: tab === t ? T.text : T.mut,
            }}
          >
            [ {t} ]
          </button>
        ))}
        <span aria-hidden style={{
          position: 'absolute', bottom: -1, left: ind.left, width: ind.width, height: 2,
          background: T.active, opacity: ind.ready ? 1 : 0,
          transition: ind.ready && !reduced ? 'left .3s cubic-bezier(.16,1,.3,1), width .3s cubic-bezier(.16,1,.3,1)' : 'none',
        }} />
      </div>

      {tab === 'overview' && <OverviewTab stats={stats} />}
      {tab === 'traffic' && <TrafficTab stats={stats} />}
      {tab === 'live' && <LiveTab stream={stream} />}
    </div>
  )
}
