'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SkillC, ConceptKey } from '@/app/lib/content'

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

export default function SkillsPage() {
  const router = useRouter()
  const [skills, setSkills] = useState<SkillC[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/admin/content/skills')
        if (r.status === 401) { router.push('/admin/login'); return }
        if (!r.ok) return
        const data = await r.json() as SkillC[]
        setSkills(data)
      } catch { }
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (idx: number, key: keyof SkillC, value: unknown) => {
    const newSkills = [...skills]
    ;(newSkills[idx][key] as unknown) = value
    setSkills(newSkills)
  }

  const handleAdd = () => {
    setSkills([...skills, {
      name: 'New Skill',
      value: 0.5,
      color: '#8b5cf6',
      tools: '',
      conceptKey: 'web',
    }])
  }

  const handleRemove = (idx: number) => {
    setSkills(skills.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/content/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skills),
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
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', marginBottom: 2 }}>
          skills
        </div>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          edit and manage skills
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {skills.map((skill, idx) => (
          <div key={idx} style={Card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  name
                </div>
                <input
                  type="text"
                  value={skill.name}
                  onChange={e => handleChange(idx, 'name', e.target.value)}
                  style={{ width: '100%', ...Input }}
                />
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  color
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={skill.color}
                    onChange={e => handleChange(idx, 'color', e.target.value)}
                    style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={skill.color}
                    onChange={e => handleChange(idx, 'color', e.target.value)}
                    style={{ flex: 1, ...Input }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  value (0-1)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={skill.value}
                    onChange={e => handleChange(idx, 'value', parseFloat(e.target.value))}
                    style={{ flex: 1, height: 6, borderRadius: 3, appearance: 'none' } as CSSProperties & { appearance: string }}
                  />
                  <span style={{ ...S, fontSize: 11, color: '#fff', minWidth: 40 }}>
                    {(skill.value * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  concept key
                </div>
                <select
                  value={skill.conceptKey}
                  onChange={e => handleChange(idx, 'conceptKey', e.target.value as ConceptKey)}
                  style={{ width: '100%', ...Input, appearance: 'none' }}
                >
                  <option value="web">web</option>
                  <option value="net">net</option>
                  <option value="recon">recon</option>
                  <option value="ad">ad</option>
                  <option value="rev">rev</option>
                  <option value="crypto">crypto</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                tools (· separated)
              </div>
              <input
                type="text"
                value={skill.tools}
                onChange={e => handleChange(idx, 'tools', e.target.value)}
                placeholder="Burp · SQLMap · Wfuzz"
                style={{ width: '100%', ...Input }}
              />
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
          + add skill
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
      </div>
    </div>
  )
}
