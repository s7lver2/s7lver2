// webpage/app/admin/live/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface LiveVisit {
  lat: number; lon: number
  country: string; city: string; page: string; timestamp: string
}
interface StreamData {
  activeLastHour: number; todayTotal: number
  recent: LiveVisit[]; ts: number
}

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(139,92,246,0.18)',
      borderRadius: 10, padding: '12px 18px', flex: 1, minWidth: 120,
    }}>
      <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function LivePage() {
  const router = useRouter()
  const [stream, setStream] = useState<StreamData>({ activeLastHour: 0, todayTotal: 0, recent: [], ts: 0 })
  const [feed, setFeed] = useState<LiveVisit[]>([])
  const [liveVisits, setLiveVisits] = useState<LiveVisit[]>([])
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    const es = new EventSource('/api/admin/stream')
    es.onmessage = e => {
      try {
        const d = JSON.parse(e.data) as StreamData
        setStream(d)
        setLiveVisits(d.recent)
        if (d.recent) {
          for (const v of d.recent) {
            const key = v.timestamp + v.lat + v.lon
            if (!seenRef.current.has(key)) {
              seenRef.current.add(key)
              setFeed(prev => [v, ...prev].slice(0, 20))
            }
          }
        }
      } catch {}
    }
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) router.replace('/admin/login')
    }
    return () => es.close()
  }, [router])

  const ago = (ts: string) => {
    const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`
  }

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text)', margin: 0 }}>live</h1>
        <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          real-time activity
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, marginBottom: 14 }} className="live-grid">
        {/* Replacement for WorldMapV2: activity log panel */}
        <div style={{ flex: 1, background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '16px', overflowY: 'auto', height: 380 }}>
          <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 12 }}>activity log</div>
          {feed.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.2)', fontStyle: 'italic' }}>waiting for visits…</div>
          ) : feed.map((v, i) => (
            <div key={v.timestamp + i} style={{ padding: '8px 0', borderBottom: i < feed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#e9d5ff' }}>{v.city || v.country || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, color: 'rgba(233,213,255,0.28)' }}>{ago(v.timestamp)}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#8b5cf6', marginTop: 1 }}>{v.page}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '14px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 12 }}>live feed</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {feed.length === 0 ? (
              <div style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.2)', fontStyle: 'italic' }}>waiting for visits…</div>
            ) : feed.map((v, i) => (
              <div key={v.timestamp + i} style={{
                padding: '7px 0',
                borderBottom: i < feed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                animation: i === 0 ? 'fi 0.3s ease' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ ...S, fontSize: 10, color: 'var(--text)' }}>{v.city || v.country || '—'}</span>
                  <span style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.28)' }}>{ago(v.timestamp)}</span>
                </div>
                <div style={{ ...S, fontSize: 9, color: '#8b5cf6', marginTop: 1 }}>{v.page}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="Active (1h)" value={stream.activeLastHour} />
        <StatPill label="Visits Today" value={stream.todayTotal} />
        <StatPill label="Last Visit" value={feed[0] ? (feed[0].city || feed[0].country || '—') : '—'} />
        <StatPill label="Last Page" value={feed[0]?.page ?? '—'} />
      </div>

      <style>{`
        @keyframes fi { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width: 768px) { .live-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}