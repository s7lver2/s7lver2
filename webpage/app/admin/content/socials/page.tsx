'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SocialC } from '@/app/lib/content'
import { useDirty } from '@/app/admin/components/ui'

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
