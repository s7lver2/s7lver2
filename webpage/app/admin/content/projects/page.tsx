'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectC } from '@/app/lib/content'

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
  fontWeight: 400,
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

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectC[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/admin/content/projects')
        if (r.status === 401) { router.push('/admin/login'); return }
        if (!r.ok) return
        const data = await r.json() as ProjectC[]
        setProjects(data)
      } catch { }
      setLoading(false)
    }
    load()
  }, [router])

  const handleChange = (idx: number, key: keyof ProjectC, value: unknown) => {
    const newProjects = [...projects]
    if (key === 'tags' && typeof value === 'string') {
      newProjects[idx][key] = value.split(',').map(t => t.trim()).filter(t => t) as string[]
    } else {
      (newProjects[idx][key] as unknown) = value
    }
    setProjects(newProjects)
  }

  const handleAdd = () => {
    setProjects([...projects, {
      slug: `project-${Date.now()}`,
      name: 'New Project',
      desc: '',
      status: 'dev',
      ac: '#8b5cf6',
      tags: [],
    }])
  }

  const handleRemove = (idx: number) => {
    setProjects(projects.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/content/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects),
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
          proyectos
        </div>
        <div style={{ ...S, fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          edit and manage projects
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {projects.map((proj, idx) => (
          <div key={idx} style={Card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  name
                </div>
                <input
                  type="text"
                  value={proj.name}
                  onChange={e => handleChange(idx, 'name', e.target.value)}
                  style={{ width: '100%', ...Input }}
                />
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  slug
                </div>
                <input
                  type="text"
                  value={proj.slug}
                  onChange={e => handleChange(idx, 'slug', e.target.value)}
                  style={{ width: '100%', ...Input }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                description
              </div>
              <textarea
                value={proj.desc}
                onChange={e => handleChange(idx, 'desc', e.target.value)}
                style={{ width: '100%', minHeight: 60, ...Input, fontFamily: 'Space Mono, monospace', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  status
                </div>
                <select
                  value={proj.status}
                  onChange={e => handleChange(idx, 'status', e.target.value as 'done' | 'beta' | 'dev')}
                  style={{ width: '100%', ...Input, appearance: 'none' }}
                >
                  <option value="done">done</option>
                  <option value="beta">beta</option>
                  <option value="dev">dev</option>
                </select>
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  color
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={proj.ac}
                    onChange={e => handleChange(idx, 'ac', e.target.value)}
                    style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={proj.ac}
                    onChange={e => handleChange(idx, 'ac', e.target.value)}
                    style={{ flex: 1, ...Input }}
                  />
                </div>
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  web
                </div>
                <input
                  type="text"
                  value={proj.web ?? ''}
                  onChange={e => handleChange(idx, 'web', e.target.value)}
                  placeholder="https://…"
                  style={{ width: '100%', ...Input }}
                />
              </div>
              <div>
                <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  screenshot
                </div>
                <input
                  type="text"
                  value={proj.shot ?? ''}
                  onChange={e => handleChange(idx, 'shot', e.target.value)}
                  placeholder="/projects/…"
                  style={{ width: '100%', ...Input }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S, fontSize: 10, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                tags (comma-separated)
              </div>
              <input
                type="text"
                value={(proj.tags ?? []).join(', ')}
                onChange={e => handleChange(idx, 'tags', e.target.value)}
                placeholder="Go, CLI, WebRTC"
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
          + add project
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
