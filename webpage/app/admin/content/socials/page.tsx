'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import type { SocialC } from '@/app/lib/content'
import { useDirty, Panel, T } from '@/app/admin/components/ui'

type Net = { k: string; label: string; auto?: string }
const NETS: Net[] = [
  { k: 'github', label: 'GitHub', auto: 'auto · github.com/s7lver2.png' },
  { k: 'discord', label: 'Discord', auto: 'auto · Lanyard (Discord ID)' },
  { k: 'twitter', label: 'Twitter / X' },
  { k: 'tiktok', label: 'TikTok' },
  { k: 'instagram', label: 'Instagram' },
  { k: 'htb', label: 'HackTheBox' },
]

const S: CSSProperties = { fontFamily: 'var(--font-body)' }

const Card: CSSProperties = {
  background: 'rgba(5,0,10,0.97)',
  border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8,
  padding: '16px',
}

const Input: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#e9d5ff',
  fontFamily: 'Space Mono, monospace',
  fontSize: 12,
}

const Button: CSSProperties = {
  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontFamily: 'Space Mono, monospace',
  fontSize: 11,
  padding: '7px 12px',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'opacity 0.2s',
}

export default function SocialsPage() {
  const router = useRouter()
  const [socials, setSocials] = useState<SocialC[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'ok' | 'error' | null>(null)
  const { dirty, setDirty } = useDirty()

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const isValidUrl = (u: string) => {
    if (u === '#') return true
    try { new URL(u); return true } catch { return false }
  }
  const invalidIdx = socials.findIndex((s) => !isValidUrl(s.url))

  // Folded in from the deleted /admin/profiles page (Task 15) — only its UI
  // moved, both /api/admin/settings and /api/admin/upload stay as-is.
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [discordId, setDiscordId] = useState('')
  const [avatarsLoaded, setAvatarsLoaded] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState<string | null>(null)
  const [avatarMsg, setAvatarMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setAvatars(d.avatars ?? {})
      setDiscordId(d.discordId ?? '')
      setAvatarsLoaded(true)
    }).catch(() => setAvatarsLoaded(true))
  }, [])

  async function uploadAvatar(net: string, file: File) {
    setAvatarBusy(net)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (res.ok && d.url) setAvatars(a => ({ ...a, [net]: d.url }))
      else setAvatarMsg(d.error ?? 'Upload failed')
    } catch (e) { setAvatarMsg(String(e)) }
    setAvatarBusy(null)
  }

  async function saveAvatars() {
    setAvatarSaving(true); setAvatarMsg('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatars, discordId }),
      })
      if (res.ok) setAvatarMsg('Saved!')
      else { const d = await res.json(); setAvatarMsg(d.error ?? 'Error') }
    } catch (e) { setAvatarMsg(String(e)) }
    setAvatarSaving(false)
    setTimeout(() => setAvatarMsg(''), 3000)
  }

  const previewSrc = (net: string) => `/api/avatar/${net}?t=${encodeURIComponent(avatars[net] || discordId || '')}`

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/admin/content/socials')
        if (r.status === 401) { router.push('/admin/login'); return }
        if (!r.ok) return
        const data = await r.json() as SocialC[]
        setSocials(data)
      } catch { }
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (idx: number, key: keyof SocialC, value: unknown) => {
    const newSocials = [...socials]
    ;(newSocials[idx][key] as unknown) = value
    setSocials(newSocials)
    setDirty(true)
  }

  const handleAdd = () => {
    setSocials([...socials, {
      k: 'new',
      v: 'value',
      color: '#8b5cf6',
      url: '#',
      initials: 'NW',
    }])
    setDirty(true)
  }

  const handleRemove = (idx: number) => {
    setSocials(socials.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const handleSave = async () => {
    if (invalidIdx >= 0) {
      setSaveResult('error')
      setTimeout(() => setSaveResult(null), 4000)
      return
    }
    setSaving(true)
    setSaveResult(null)
    try {
      const r = await fetch('/api/admin/content/socials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(socials),
      })
      if (r.status === 401) { router.push('/admin/login'); return }
      setSaveResult(r.ok ? 'ok' : 'error')
      if (r.ok) setDirty(false)
    } catch {
      setSaveResult('error')
    }
    setSaving(false)
    setTimeout(() => setSaveResult(null), 4000)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
      loading…
    </div>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', marginBottom: 2 }}>
          redes
        </div>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          edit and manage social networks
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {socials.map((social, idx) => (
          <div key={idx} style={Card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  key
                </div>
                <input
                  type="text"
                  value={social.k}
                  onChange={e => handleChange(idx, 'k', e.target.value)}
                  style={{ width: '100%', ...Input }}
                />
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  value
                </div>
                <input
                  type="text"
                  value={social.v}
                  onChange={e => handleChange(idx, 'v', e.target.value)}
                  style={{ width: '100%', ...Input }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  color
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={social.color}
                    onChange={e => handleChange(idx, 'color', e.target.value)}
                    style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={social.color}
                    onChange={e => handleChange(idx, 'color', e.target.value)}
                    style={{ flex: 1, ...Input }}
                  />
                </div>
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  initials
                </div>
                <input
                  type="text"
                  value={social.initials}
                  onChange={e => handleChange(idx, 'initials', e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  style={{ width: '100%', ...Input }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                url
              </div>
              <input
                type="text"
                value={social.url}
                onChange={e => handleChange(idx, 'url', e.target.value)}
                placeholder="https://…"
                style={{ width: '100%', ...Input, borderColor: !isValidUrl(social.url) ? '#f87171' : undefined }}
              />
              {!isValidUrl(social.url) && (
                <div style={{ ...S, fontSize: 11, color: '#f87171', marginTop: 4 }}>url inválida</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleRemove(idx)}
                style={{
                  ...Button,
                  background: 'rgba(239,68,68,0.15)',
                  color: '#fca5a5',
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <Panel label="avatares" style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, marginTop: 0, marginBottom: 14 }}>
          Avatares de la sección &quot;Find me online&quot;, servidos como ASCII. GitHub es automático; Discord usa Lanyard;
          el resto súbelos o pega una URL.
        </p>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: T.mut, marginBottom: 6 }}>
            discord user id
          </div>
          <input value={discordId} onChange={e => setDiscordId(e.target.value.replace(/[^0-9]/g, ''))}
            style={{ width: '100%', boxSizing: 'border-box', ...Input }} placeholder="123456789012345678" inputMode="numeric" />
        </div>
        {!avatarsLoaded ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim }}>cargando…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {NETS.map(net => (
              <div key={net.k} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <img
                  src={previewSrc(net.k)} alt="" width={40} height={40}
                  style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: T.deep, border: `1px solid ${T.line}` }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25' }}
                />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.text, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {net.label}
                    {net.auto && <span style={{ fontSize: 10, color: T.dim }}>{net.auto}</span>}
                  </div>
                  <input
                    value={avatars[net.k] ?? ''}
                    onChange={e => setAvatars(a => ({ ...a, [net.k]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', ...Input, fontSize: 11.5, padding: '6px 9px' }}
                    placeholder={net.auto ? 'override URL (opcional)…' : 'pega una URL o sube una imagen…'}
                  />
                </div>
                <button type="button" onClick={() => fileRefs.current[net.k]?.click()} disabled={avatarBusy === net.k}
                  style={{ ...Button, background: 'transparent', border: `1px solid ${T.line}`, color: T.mut }}>
                  {avatarBusy === net.k ? '…' : 'subir'}
                </button>
                <input ref={el => { fileRefs.current[net.k] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(net.k, f) }} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={saveAvatars} disabled={avatarSaving} style={Button}>
                {avatarSaving ? 'guardando…' : 'guardar avatares'}
              </button>
              {avatarMsg && <span style={{ fontFamily: T.mono, fontSize: 12, color: avatarMsg === 'Saved!' ? T.active : '#f87171' }}>{avatarMsg}</span>}
            </div>
          </div>
        )}
      </Panel>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleAdd}
          style={Button}
          onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          + add social
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...Button, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          onMouseOver={e => !saving && (e.currentTarget.style.opacity = '0.8')}
          onMouseOut={e => !saving && (e.currentTarget.style.opacity = '1')}
        >
          {saving ? 'saving…' : 'save'}
        </button>
        {saveResult === 'ok' && <span style={{ ...S, fontSize: 12, color: '#5eead4' }}>✓ guardado</span>}
        {saveResult === 'error' && <span style={{ ...S, fontSize: 12, color: '#f87171' }}>✕ no se pudo guardar</span>}
      </div>
    </div>
  )
}
