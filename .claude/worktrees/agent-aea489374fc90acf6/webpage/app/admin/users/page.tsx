'use client'

import { useState, useEffect, useCallback } from 'react'

interface SafeUser {
  id: string; username: string; name: string; avatar?: string
  authMethod: string; pendingSetup: boolean; permissions: string[]
  isRoot?: boolean; suspended?: boolean
  createdAt: string; lastLogin?: string; lastActive?: string
}

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

const badge = (text: string, color: string): React.CSSProperties => ({
  ...S, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: 999, background: `${color}22`, color, border: `1px solid ${color}44`,
})

function Avatar({ user }: { user: SafeUser }) {
  if (user.avatar) return <img src={user.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>
      {initials}
    </div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otp, setOtp] = useState('')

  const toggle = (p: string) => setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, name, permissions }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error'); return }
    setOtp(data.otp)
    onCreated()
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 13px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: 8, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="card-glass" style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 16 }}>
        {otp ? (
          <>
            <h2 style={{ ...S, fontSize: 16, color: '#fff', marginBottom: 12 }}>User created</h2>
            <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
              Share this one-time password with <strong style={{ color: '#a78bfa' }}>@{username}</strong>. It expires after first login.
            </p>
            <div style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '14px 18px', textAlign: 'center', fontFamily: 'monospace', fontSize: 20, letterSpacing: '0.15em', color: '#a78bfa', marginBottom: 20 }}>
              {otp}
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '10px 0', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff', cursor: 'pointer', ...S, fontSize: 13 }}>Close</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ ...S, fontSize: 16, color: '#fff', marginBottom: 20 }}>New user</h2>
            <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} style={{ ...fieldStyle, marginBottom: 14 }} placeholder="lowercase, 2-24 chars" required />
            <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4 }}>Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ ...fieldStyle, marginBottom: 14 }} placeholder="Full name" />
            <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8 }}>Permissions</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['admin', 'owner'].map(p => (
                <button key={p} type="button" onClick={() => toggle(p)} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid',
                  borderColor: permissions.includes(p) ? '#8b5cf6' : 'rgba(255,255,255,0.12)',
                  background: permissions.includes(p) ? 'rgba(139,92,246,0.2)' : 'transparent',
                  color: permissions.includes(p) ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', ...S, fontSize: 12,
                }}>{p}</button>
              ))}
            </div>
            {error && <p style={{ ...S, fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', ...S, fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', ...S, fontSize: 13 }}>
                {loading ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<SafeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) { const d = await res.json(); setUsers(d.users) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAction(user: SafeUser, action: 'suspend' | 'unsuspend' | 'reset_otp' | 'delete') {
    if (action === 'delete' && !confirm(`Delete user @${user.username}? This cannot be undone.`)) return

    let res: Response
    if (action === 'reset_otp') {
      res = await fetch(`/api/admin/users/${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_otp' }) })
      if (res.ok) { const d = await res.json(); setMsg(`OTP for @${user.username}: ${d.otp}`) }
    } else if (action === 'delete') {
      res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (res.ok) load()
    } else {
      res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suspended: action === 'suspend' }) })
      if (res.ok) load()
    }
  }

  return (
    <>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {msg && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '16px 22px', maxWidth: 340 }}>
          <p style={{ ...S, fontSize: 13, color: '#fff', margin: 0 }}>{msg}</p>
          <button onClick={() => setMsg('')} style={{ marginTop: 10, ...S, fontSize: 12, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', margin: 0 }}>users</h1>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 18px', background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 9, color: '#a78bfa', cursor: 'pointer', ...S, fontSize: 12, letterSpacing: '0.08em' }}>
          + New user
        </button>
      </div>

      {loading ? (
        <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(user => (
            <div key={user.id} className="card-glass" style={{ padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, opacity: user.suspended ? 0.5 : 1 }}>
              <Avatar user={user} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...S, fontSize: 14, color: '#fff', fontWeight: 500 }}>{user.name}</span>
                  <span style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>@{user.username}</span>
                  {user.isRoot && <span style={badge('root', '#f59e0b')}>root</span>}
                  {user.pendingSetup && <span style={badge('setup pending', '#3b82f6')}>setup pending</span>}
                  {user.suspended && <span style={badge('suspended', '#f87171')}>suspended</span>}
                  {user.permissions.map(p => <span key={p} style={badge(p, '#8b5cf6')}>{p}</span>)}
                </div>
                <div style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                  {user.authMethod} · joined {new Date(user.createdAt).toLocaleDateString()}
                  {user.lastLogin && ` · last login ${new Date(user.lastLogin).toLocaleDateString()}`}
                </div>
              </div>
              {!user.isRoot && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleAction(user, 'reset_otp')} style={{ padding: '5px 12px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 7, color: '#60a5fa', cursor: 'pointer', ...S, fontSize: 11 }}>Reset OTP</button>
                  <button onClick={() => handleAction(user, user.suspended ? 'unsuspend' : 'suspend')} style={{ padding: '5px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, color: '#fbbf24', cursor: 'pointer', ...S, fontSize: 11 }}>
                    {user.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  <button onClick={() => handleAction(user, 'delete')} style={{ padding: '5px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 7, color: '#f87171', cursor: 'pointer', ...S, fontSize: 11 }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
