'use client'

import { useState, useEffect, useRef } from 'react'

interface SafeUser {
  id: string; username: string; name: string; avatar?: string; bannerUrl?: string
  authMethod: string; pendingSetup: boolean; permissions: string[]
  isRoot?: boolean; pronouns?: string; bio?: string
  webauthnCredentials?: { id: string; name: string; createdAt: string }[]
}

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

const sectionTitle: React.CSSProperties = {
  ...S, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'rgba(139,92,246,0.6)', marginBottom: 14,
}

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 13px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 8, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
}

const btn = (accent: string, bg: string): React.CSSProperties => ({
  padding: '9px 18px', background: bg, border: `1px solid ${accent}44`,
  borderRadius: 8, color: '#fff', cursor: 'pointer', ...S, fontSize: 12, letterSpacing: '0.06em',
})

export default function AccountPage() {
  const [user, setUser] = useState<SafeUser | null>(null)
  const [name, setName] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // WebAuthn state
  const [regLoading, setRegLoading] = useState(false)
  const [regMsg, setRegMsg] = useState('')
  const [credName, setCredName] = useState('')

  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => {
      setUser(d.user)
      setName(d.user.name ?? '')
      setPronouns(d.user.pronouns ?? '')
      setBio(d.user.bio ?? '')
      setAvatarUrl(d.user.avatar ?? '')
    })
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveMsg('')
    const res = await fetch(`/api/admin/users/${user!.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pronouns, bio }),
    })
    setSaving(false)
    if (res.ok) { const d = await res.json(); setUser(d.user); setSaveMsg('Saved!') }
    else { const d = await res.json(); setSaveMsg(d.error ?? 'Error') }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const d = await res.json()
      setAvatarUrl(d.url)
      await fetch(`/api/admin/users/${user!.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: d.url }),
      })
      setUser(u => u ? { ...u, avatar: d.url } : u)
    }
  }

  async function registerPasskey() {
    setRegLoading(true); setRegMsg('')
    try {
      const { startRegistration } = await import('@simplewebauthn/browser')
      const optsRes = await fetch('/api/admin/webauthn/register/options', { method: 'POST' })
      const opts = await optsRes.json()
      const attResp = await startRegistration({ optionsJSON: opts })
      const verRes = await fetch('/api/admin/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...attResp, name: credName || 'My passkey' }),
      })
      const verData = await verRes.json()
      if (verData.ok) {
        setRegMsg('Passkey registered!')
        const r = await fetch('/api/admin/me'); const d = await r.json(); setUser(d.user)
      } else { setRegMsg(verData.error ?? 'Failed') }
    } catch (err) { setRegMsg(String(err)) }
    setRegLoading(false)
  }

  async function removePasskey(credId: string) {
    if (!confirm('Remove this passkey?')) return
    await fetch(`/api/admin/webauthn/credentials/${encodeURIComponent(credId)}`, { method: 'DELETE' })
    const r = await fetch('/api/admin/me'); const d = await r.json(); setUser(d.user)
  }

  if (!user) return <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading…</p>

  return (
    <>
      <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', marginBottom: 28 }}>account</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>

        {/* Avatar */}
        <div className="card-glass" style={{ padding: '22px 24px', borderRadius: 14 }}>
          <p style={sectionTitle}>avatar</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(139,92,246,0.3)' }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.18)', border: '2px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', fontSize: 22, fontWeight: 700 }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>}
            <div>
              <button onClick={() => fileRef.current?.click()} style={btn('#8b5cf6', 'rgba(139,92,246,0.15)')}>
                Upload image
              </button>
              <p style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Max 4 MB · JPEG, PNG, WebP, GIF, AVIF</p>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="card-glass" style={{ padding: '22px 24px', borderRadius: 14 }}>
          <p style={sectionTitle}>profile</p>
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>Display name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>Pronouns</label>
              <input value={pronouns} onChange={e => setPronouns(e.target.value)} style={fieldStyle} placeholder="e.g. he/him" />
            </div>
            <div>
              <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} style={{ ...fieldStyle, height: 80, resize: 'vertical' }} placeholder="A short bio…" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" disabled={saving} style={btn('#8b5cf6', 'rgba(139,92,246,0.15)')}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              {saveMsg && <span style={{ ...S, fontSize: 12, color: saveMsg === 'Saved!' ? '#4ade80' : '#f87171' }}>{saveMsg}</span>}
            </div>
          </form>
        </div>

        {/* Passkeys */}
        <div className="card-glass" style={{ padding: '22px 24px', borderRadius: 14 }}>
          <p style={sectionTitle}>passkeys</p>
          {(user.webauthnCredentials ?? []).length === 0
            ? <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>No passkeys registered.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {user.webauthnCredentials!.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.025)', borderRadius: 8 }}>
                    <span style={{ ...S, fontSize: 13, color: '#fff', flex: 1 }}>{c.name}</span>
                    <span style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                    <button onClick={() => removePasskey(c.id)} style={{ ...S, fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={credName} onChange={e => setCredName(e.target.value)} style={{ ...fieldStyle, flex: 1 }} placeholder="Passkey name (optional)" />
            <button onClick={registerPasskey} disabled={regLoading} style={btn('#3b82f6', 'rgba(59,130,246,0.15)')}>
              {regLoading ? 'Registering…' : 'Add passkey'}
            </button>
          </div>
          {regMsg && <p style={{ ...S, fontSize: 12, color: regMsg.includes('!') ? '#4ade80' : '#f87171', marginTop: 10 }}>{regMsg}</p>}
        </div>
      </div>
    </>
  )
}
