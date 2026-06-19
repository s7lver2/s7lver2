'use client'

import { useState, useEffect, useCallback } from 'react'

interface AuditEntry {
  id: string; action: string; actor: string; actorId: string
  target?: string; targetId?: string; detail?: string; ip?: string; ua?: string; ts: string
}

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

const ACTION_COLOR: Record<string, string> = {
  login: '#4ade80', logout: '#94a3b8', login_fail: '#f87171',
  user_create: '#34d399', user_update: '#60a5fa', user_delete: '#f87171',
  user_suspend: '#fbbf24', user_unsuspend: '#4ade80',
  otp_reset: '#a78bfa', setup_complete: '#34d399',
  webauthn_register: '#818cf8', webauthn_remove: '#f87171', webauthn_login: '#34d399',
  avatar_upload: '#38bdf8', me_update: '#60a5fa', admin_action: '#a78bfa',
}

function color(action: string) { return ACTION_COLOR[action] ?? '#94a3b8' }

function relTime(ts: string): string {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterActor, setFilterActor] = useState('')
  const LIMIT = 50

  const load = useCallback(async (off = 0, actor = '') => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
    if (actor) params.set('actor', actor)
    const res = await fetch(`/api/admin/audit?${params}`)
    if (res.ok) {
      const d = await res.json()
      setEntries(d.entries)
      setTotal(d.total)
      setOffset(off)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(0, filterActor) }, [load, filterActor])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 }}>audit log</h1>
        <input
          value={filterActor} onChange={e => setFilterActor(e.target.value)}
          style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', width: 180 }}
          placeholder="Filter by actor…"
        />
      </div>

      {loading ? (
        <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No entries yet.</p>
      ) : (
        <>
          <div className="card-glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Time', 'Action', 'Actor', 'Target', 'Detail', 'IP'].map(h => (
                    <th key={h} style={{ ...S, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '11px 16px', whiteSpace: 'nowrap' }}>{relTime(e.ts)}</td>
                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ ...S, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: `${color(e.action)}18`, color: color(e.action), border: `1px solid ${color(e.action)}30` }}>
                        {e.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ ...S, fontSize: 12, color: '#a78bfa', padding: '11px 16px' }}>@{e.actor}</td>
                    <td style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '11px 16px' }}>{e.target ? `@${e.target}` : '—'}</td>
                    <td style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '11px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.detail ?? '—'}
                    </td>
                    <td style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '11px 16px', fontFamily: 'monospace' }}>{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <button
              disabled={offset === 0} onClick={() => load(Math.max(0, offset - LIMIT), filterActor)}
              style={{ padding: '7px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: offset === 0 ? 'rgba(255,255,255,0.2)' : '#a78bfa', cursor: offset === 0 ? 'not-allowed' : 'pointer', ...S, fontSize: 12 }}>
              Prev
            </button>
            <span style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              disabled={offset + LIMIT >= total} onClick={() => load(offset + LIMIT, filterActor)}
              style={{ padding: '7px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: offset + LIMIT >= total ? 'rgba(255,255,255,0.2)' : '#a78bfa', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', ...S, fontSize: 12 }}>
              Next
            </button>
          </div>
        </>
      )}
    </>
  )
}
