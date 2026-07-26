'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { FeaturedRepo } from '@/app/lib/featured'
import { repoName } from '@/app/lib/featured'
import { colorFor } from '@/app/lib/lang-colors'
import { Panel, SectionHead, Btn, T, useDirty } from '@/app/admin/components/ui'
import type { AdminRepo } from '@/app/api/admin/github/repos/route'

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function ProjectsPage() {
  const router = useRouter()
  const [available, setAvailable] = useState<AdminRepo[]>([])
  const [featured, setFeatured] = useState<FeaturedRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<'ok' | 'error' | null>(null)
  const dragIdx = useRef<number | null>(null)
  const { dirty, setDirty } = useDirty()

  useEffect(() => {
    const load = async () => {
      try {
        const [repoRes, featRes] = await Promise.all([
          fetch('/api/admin/github/repos'),
          fetch('/api/admin/content/featured'),
        ])
        if (repoRes.status === 401 || featRes.status === 401) { router.push('/admin/login'); return }
        const repoData = repoRes.ok ? await repoRes.json() : { repos: [] }
        const featData = featRes.ok ? await featRes.json() : []
        setAvailable(repoData.repos ?? [])
        setFeatured(Array.isArray(featData) ? featData : [])
      } catch { }
      setLoading(false)
    }
    load()

    const flashId = sessionStorage.getItem('admin:flash')
    if (flashId) {
      sessionStorage.removeItem('admin:flash')
      setFlash(flashId)
      setTimeout(() => setFlash(null), 1200)
    }
  }, [router])

  const isSelected = (fullName: string) => featured.some((f) => f.repo === fullName)

  const toggle = (repo: AdminRepo) => {
    if (isSelected(repo.fullName)) {
      setFeatured((prev) => prev.filter((f) => f.repo !== repo.fullName))
    } else {
      setFeatured((prev) => [...prev, { repo: repo.fullName, status: 'dev' }])
    }
    setDirty(true)
  }

  const updateEntry = (idx: number, patch: Partial<FeaturedRepo>) => {
    setFeatured((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
    setDirty(true)
  }

  const removeEntry = (idx: number) => {
    setFeatured((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  const onDragStart = (idx: number) => { dragIdx.current = idx }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDrop = (idx: number) => {
    const from = dragIdx.current
    dragIdx.current = null
    if (from === null || from === idx) return
    setFeatured((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDirty(true)
  }

  // Every entry's repo comes from the GitHub picker, so it should always be
  // well-formed — validated anyway as a defence against a future manual
  // editing path, and because every status must be one of the three literals.
  const invalidIdx = featured.findIndex(
    (f) => !REPO_RE.test(f.repo) || !['done', 'beta', 'dev'].includes(f.status)
  )

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const handleSave = async () => {
    if (invalidIdx >= 0) {
      setSaveResult('error')
      setTimeout(() => setSaveResult(null), 4000)
      return
    }
    setSaving(true)
    setSaveResult(null)
    try {
      const r = await fetch('/api/admin/content/featured', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featured),
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

  useEffect(() => {
    const onExternalSave = () => { void handleSave() }
    window.addEventListener('admin:save', onExternalSave)
    return () => window.removeEventListener('admin:save', onExternalSave)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured])

  const filtered = available.filter((r) => {
    const q = search.toLowerCase()
    return r.name.toLowerCase().includes(q) || (r.language ?? '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div style={{ ...({ fontFamily: T.mono } as React.CSSProperties), fontSize: 12, color: T.mut, padding: 40, textAlign: 'center' }}>
        cargando…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHead kicker="admin --projects" title="Proyectos" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }} className="proj-grid">
        <Panel label="repos disponibles">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar por nombre o lenguaje…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 11px', marginBottom: 12,
              background: T.deep, border: `1px solid ${T.line}`, borderRadius: 8,
              color: T.text, fontFamily: T.mono, fontSize: 12.5, outline: 'none',
            }}
          />
          <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((repo) => (
              <label
                key={repo.fullName}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 8, border: `1px solid ${T.line}`, cursor: 'pointer',
                  background: isSelected(repo.fullName) ? 'rgba(94,234,212,.06)' : 'transparent',
                }}
              >
                <input type="checkbox" checked={isSelected(repo.fullName)} onChange={() => toggle(repo)} />
                <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.name}
                </span>
                {repo.language && (
                  <span style={{
                    fontFamily: T.mono, fontSize: 10, padding: '2px 7px', borderRadius: 999,
                    color: colorFor(repo.language), border: `1px solid ${colorFor(repo.language)}55`,
                  }}>
                    {repo.language}
                  </span>
                )}
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mut }}>★{repo.stars}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>{timeAgo(repo.updatedAt)}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, padding: 12 }}>sin resultados</div>
            )}
          </div>
        </Panel>

        <Panel label="seleccionados">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {featured.map((f, idx) => (
              <div
                key={f.repo}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(idx)}
                data-flash={flash === f.repo ? 'true' : undefined}
                style={{
                  border: `1px solid ${flash === f.repo ? T.active : T.line}`,
                  borderRadius: 10, padding: '10px 12px',
                  transition: 'border-color 1.2s ease, background 1.2s ease',
                  background: flash === f.repo ? 'rgba(94,234,212,.08)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ cursor: 'grab', color: T.dim }}>⠿</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.text, flex: 1 }}>
                    {repoName(f.repo)}
                  </span>
                  <select
                    value={f.status}
                    onChange={(e) => updateEntry(idx, { status: e.target.value as FeaturedRepo['status'] })}
                    style={{
                      background: T.deep, border: `1px solid ${T.line}`, borderRadius: 6,
                      color: T.text, fontFamily: T.mono, fontSize: 11, padding: '4px 6px',
                    }}
                  >
                    <option value="done">done</option>
                    <option value="beta">beta</option>
                    <option value="dev">dev</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeEntry(idx)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontFamily: T.mono, fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={f.nameOverride ?? ''}
                  onChange={(e) => updateEntry(idx, { nameOverride: e.target.value || undefined })}
                  placeholder="nombre override (opcional)"
                  style={{
                    width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: '6px 9px',
                    background: T.deep, border: `1px solid ${T.line}`, borderRadius: 6,
                    color: T.text, fontFamily: T.mono, fontSize: 11.5, outline: 'none',
                  }}
                />
                <input
                  value={f.descOverride ?? ''}
                  onChange={(e) => updateEntry(idx, { descOverride: e.target.value || undefined })}
                  placeholder="descripción override (opcional)"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '6px 9px',
                    background: T.deep, border: `1px solid ${T.line}`, borderRadius: 6,
                    color: T.text, fontFamily: T.mono, fontSize: 11.5, outline: 'none',
                  }}
                />
              </div>
            ))}
            {featured.length === 0 && (
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, padding: 12 }}>
                selecciona repos de la lista de la izquierda
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn tone="accent" onClick={handleSave} disabled={saving}>
          {saving ? 'guardando…' : 'guardar'}
        </Btn>
        {invalidIdx >= 0 && (
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: '#f87171' }}>
            repo inválido: {featured[invalidIdx]?.repo}
          </span>
        )}
        {saveResult === 'ok' && (
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.active }}>✓ guardado</span>
        )}
        {saveResult === 'error' && invalidIdx < 0 && (
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: '#f87171' }}>✕ no se pudo guardar</span>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) { .proj-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
