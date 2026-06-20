'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { HomeC } from '@/app/lib/content'

const S: CSSProperties = { fontFamily: 'var(--font-body)' }

const Card: CSSProperties = {
  background: 'rgba(5,0,10,0.97)',
  border: '1px solid rgba(139,92,246,0.35)',
  borderRadius: 8,
  padding: '20px',
}

const Input: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 6,
  padding: '10px 12px',
  color: '#e9d5ff',
  fontFamily: 'Space Mono, monospace',
  fontSize: 12,
  width: '100%',
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

export default function HomePage() {
  const router = useRouter()
  const [home, setHome] = useState<HomeC>({ heroTitle: '', heroSubtitle: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/admin/content/home')
        if (r.status === 401) { router.push('/admin/login'); return }
        if (!r.ok) return
        const data = await r.json() as HomeC
        setHome(data)
      } catch { }
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (key: keyof HomeC, value: string) => {
    setHome({ ...home, [key]: value })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/content/home', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(home),
      })
      if (r.status === 401) { router.push('/admin/login'); return }
      if (!r.ok) return
    } catch { }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
      loading…
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', marginBottom: 2 }}>
          home
        </div>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          edit hero section
        </div>
      </div>

      <div style={Card}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            hero title
          </div>
          <input
            type="text"
            value={home.heroTitle}
            onChange={e => handleChange('heroTitle', e.target.value)}
            style={Input}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            hero subtitle
          </div>
          <textarea
            value={home.heroSubtitle}
            onChange={e => handleChange('heroSubtitle', e.target.value)}
            style={{
              ...Input,
              minHeight: 80,
              resize: 'none',
              fontFamily: 'Space Mono, monospace',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...Button, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          onMouseOver={e => !saving && (e.currentTarget.style.opacity = '0.8')}
          onMouseOut={e => !saving && (e.currentTarget.style.opacity = '1')}
        >
          {saving ? 'saving…' : 'save'}
        </button>
      </div>
    </div>
  )
}
