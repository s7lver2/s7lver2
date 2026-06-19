'use client'

import { useState, useEffect, useRef } from 'react'

interface LiveVisit {
  lat: number; lon: number
  country: string; city: string; page: string; timestamp: string
}
interface PresenceSession {
  sessionId: string; page: string; city: string; country: string
  countryCode: string; lat?: number; lon?: number
  connectedAt: number; lastSeen: number
}
interface LiveEvent {
  type: 'connect' | 'disconnect'
  sessionId: string; city: string; country: string; page: string
  lat?: number; lon?: number; ts: number
}
interface StreamData {
  activeLastHour: number; todayTotal: number
  recent: LiveVisit[]; online?: PresenceSession[]; events?: LiveEvent[]; ts: number
}
interface FeedItem {
  kind: 'visit' | 'connect' | 'disconnect'
  label: string; page: string; ts: number; key: string
}

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.028)', border: `1px solid ${accent ? `${accent}40` : 'rgba(139,92,246,0.18)'}`,
      borderRadius: 10, padding: '12px 18px', flex: 1, minWidth: 120,
    }}>
      <div style={{ ...S, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent ?? 'rgba(139,92,246,0.65)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: accent ?? '#fff', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`
}

const FEED_META: Record<FeedItem['kind'], { color: string; icon: string; word: string }> = {
  connect: { color: '#4ade80', icon: '▲', word: 'connected' },
  disconnect: { color: '#f87171', icon: '▼', word: 'disconnected' },
  visit: { color: '#8b5cf6', icon: '◆', word: 'pageview' },
}

export default function LivePage() {
  const [stream, setStream] = useState<StreamData>({ activeLastHour: 0, todayTotal: 0, recent: [], ts: 0 })
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [online, setOnline] = useState<PresenceSession[]>([])
  const seenRef = useRef(new Set<string>())

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/admin/stats')
        if (!r.ok) return
        const d = await r.json() as StreamData
        setStream(d)
        setOnline(d.online ?? [])

        const added: FeedItem[] = []
        for (const v of d.recent ?? []) {
          const key = `visit:${v.timestamp}:${v.lat}:${v.lon}`
          if (seenRef.current.has(key)) continue
          seenRef.current.add(key)
          added.push({ kind: 'visit', label: v.city || v.country || '—', page: v.page, ts: new Date(v.timestamp).getTime(), key })
        }
        if (added.length) {
          added.sort((a, b) => b.ts - a.ts)
          setFeed(prev => [...added, ...prev].slice(0, 30))
        }
        if (seenRef.current.size > 600) {
          seenRef.current = new Set(Array.from(seenRef.current).slice(-300))
        }
      } catch { }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 }}>live</h1>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          real-time activity
        </div>
      </div>

      {/* Stats pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatPill label="Online now" value={online.length} accent="#4ade80" />
        <StatPill label="Active (1h)" value={stream.activeLastHour} />
        <StatPill label="Visits today" value={stream.todayTotal} />
        <StatPill label="Last seen" value={feed[0] ? feed[0].label : '—'} />
      </div>

      {/* Online sessions */}
      {online.length > 0 && (
        <div style={{ background: 'rgba(74,222,128,0.03)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ ...S, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(74,222,128,0.6)', marginBottom: 10 }}>
            online now — {online.length} visitor{online.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {online.map(s => (
              <div key={s.sessionId} style={{
                ...S, fontSize: 12, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)',
                color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80', display: 'inline-block' }} />
                {s.city || s.country || 'unknown'}
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{s.page}</span>
                <span style={{ color: 'rgba(74,222,128,0.5)', fontSize: 12 }}>{ago(s.connectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live feed */}
      <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '14px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...S, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 12 }}>live feed</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {feed.length === 0 ? (
            <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>waiting for visitors…</div>
          ) : feed.map((item, i) => {
            const meta = FEED_META[item.kind]
            return (
              <div key={item.key} style={{
                padding: '7px 0',
                borderBottom: i < feed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                animation: i === 0 ? 'fi 0.3s ease' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ ...S, fontSize: 12, color: meta.color, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {meta.icon} {meta.word}
                  </span>
                  <span style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{ago(item.ts)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 1 }}>
                  <span style={{ ...S, fontSize: 12, color: '#fff' }}>{item.label}</span>
                  <span style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{item.page}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes fi { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @media (max-width: 768px) { .live-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}
