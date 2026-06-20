'use client'

import { useState, useEffect, useRef } from 'react'

type Net = { k: string; label: string; auto?: string }
const NETS: Net[] = [
  { k: 'github', label: 'GitHub', auto: 'auto · github.com/s7lver2.png' },
  { k: 'discord', label: 'Discord', auto: 'auto · Lanyard (Discord ID)' },
  { k: 'twitter', label: 'Twitter / X' },
  { k: 'tiktok', label: 'TikTok' },
  { k: 'instagram', label: 'Instagram' },
  { k: 'htb', label: 'HackTheBox' },
]

const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }
const sectionTitle: React.CSSProperties = {
  ...S, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'rgba(139,92,246,0.6)', marginBottom: 14,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 8, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
}
const btn = (accent: string, bg: string): React.CSSProperties => ({
  padding: '8px 15px', background: bg, border: `1px solid ${accent}44`,
  borderRadius: 8, color: '#fff', cursor: 'pointer', ...S, fontSize: 12, letterSpacing: '0.06em', whiteSpace: 'nowrap',
})

export default function ProfilesPage() {
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [discordId, setDiscordId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setAvatars(d.avatars ?? {})
      setDiscordId(d.discordId ?? '')
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  async function upload(net: string, file: File) {
    setBusy(net)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (res.ok && d.url) setAvatars(a => ({ ...a, [net]: d.url }))
      else setMsg(d.error ?? 'Upload failed')
    } catch (e) { setMsg(String(e)) }
    setBusy(null)
  }

  async function save() {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatars, discordId }),
      })
      if (res.ok) setMsg('Saved!')
      else { const d = await res.json(); setMsg(d.error ?? 'Error') }
    } catch (e) { setMsg(String(e)) }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  // cache-bust preview after changes
  const previewSrc = (net: string) => `/api/avatar/${net}?t=${encodeURIComponent(avatars[net] || discordId || '')}`

  if (!loaded) return <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Loading…</p>

  return (
    <>
      <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', marginBottom: 8 }}>profiles</h1>
      <p style={{ ...S, fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 26, maxWidth: 600 }}>
        Avatares de la sección “Find me online”. Se sirven como ASCII. GitHub es automático; Discord usa Lanyard;
        el resto súbelos o pega una URL.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>

        {/* Discord / Lanyard */}
        <div className="card-glass" style={{ padding: '20px 22px', borderRadius: 14 }}>
          <p style={sectionTitle}>discord · lanyard</p>
          <label style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 5 }}>
            Discord user ID
          </label>
          <input value={discordId} onChange={e => setDiscordId(e.target.value.replace(/[^0-9]/g, ''))}
            style={fieldStyle} placeholder="123456789012345678" inputMode="numeric" />
          <p style={{ ...S, fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8, lineHeight: 1.5 }}>
            Únete a <b style={{ color: '#a78bfa' }}>discord.gg/lanyard</b> con esta cuenta para que el avatar sea visible.
            Activa el Modo desarrollador en Discord para copiar tu ID.
          </p>
        </div>

        {/* Per-network avatars */}
        <div className="card-glass" style={{ padding: '20px 22px', borderRadius: 14 }}>
          <p style={sectionTitle}>avatars</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {NETS.map(net => (
              <div key={net.k} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={previewSrc(net.k)} alt="" width={44} height={44}
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S, fontSize: 13, color: '#fff', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {net.label}
                    {net.auto && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{net.auto}</span>}
                  </div>
                  <input
                    value={avatars[net.k] ?? ''}
                    onChange={e => setAvatars(a => ({ ...a, [net.k]: e.target.value }))}
                    style={{ ...fieldStyle, fontSize: 12, padding: '7px 10px' }}
                    placeholder={net.auto ? 'override URL (opcional)…' : 'pega una URL o sube una imagen…'}
                  />
                </div>
                <button onClick={() => fileRefs.current[net.k]?.click()} disabled={busy === net.k}
                  style={btn('#8b5cf6', 'rgba(139,92,246,0.15)')}>
                  {busy === net.k ? '…' : 'Upload'}
                </button>
                <input ref={el => { fileRefs.current[net.k] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(net.k, f) }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={save} disabled={saving} style={btn('#8b5cf6', 'rgba(139,92,246,0.18)')}>
            {saving ? 'Saving…' : 'Save profiles'}
          </button>
          {msg && <span style={{ ...S, fontSize: 12, color: msg === 'Saved!' ? '#4ade80' : '#f87171' }}>{msg}</span>}
        </div>
      </div>
    </>
  )
}
