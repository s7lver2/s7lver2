'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

interface Settings {
  flags: { terminal: boolean; machines: boolean; timeline: boolean; maintenance: boolean }
  theme: 'morado' | 'azul' | 'verde' | 'mono'
  avatars: Record<string, string>
  discordId: string
  trackingEnabled: boolean
}

const THEMES: Record<string, { label: string; color1: string; color2: string }> = {
  morado: { label: 'Morado', color1: '#8b5cf6', color2: '#3b82f6' },
  azul: { label: 'Azul', color1: '#3b82f6', color2: '#06b6d4' },
  verde: { label: 'Verde', color1: '#22c55e', color2: '#06b6d4' },
  mono: { label: 'Mono', color1: '#ffffff', color2: '#a0a0a0' },
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  terminal: 'Enable command palette (⌘K / backtick)',
  machines: 'Show HTB machines carousel',
  timeline: 'Show progress rail navigation',
  maintenance: 'Show maintenance notice (not implemented)',
}

const Sec: React.FC<{ title: string; children: React.ReactNode; style?: CSSProperties }> = ({ title, children, style }) => (
  <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', ...style }}>
    <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 14, fontFamily: 'var(--font-body)' }}>
      {title}
    </div>
    {children}
  </div>
)

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        setSettings({
          flags: d.flags || { terminal: true, machines: true, timeline: true, maintenance: false },
          theme: d.theme || 'morado',
          avatars: d.avatars || {},
          discordId: d.discordId || '',
          trackingEnabled: typeof d.trackingEnabled === 'boolean' ? d.trackingEnabled : true,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = async (patch: Partial<Settings>) => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setSettings({
          flags: updated.flags || settings.flags,
          theme: updated.theme || settings.theme,
          avatars: updated.avatars || settings.avatars,
          discordId: updated.discordId || settings.discordId,
          trackingEnabled: typeof updated.trackingEnabled === 'boolean' ? updated.trackingEnabled : settings.trackingEnabled,
        })
      }
    } catch (err) {
      console.error('Failed to update settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleFlagChange = (flag: keyof Settings['flags']) => {
    if (!settings) return
    const newFlags = { ...settings.flags, [flag]: !settings.flags[flag] }
    setSettings({ ...settings, flags: newFlags })
    updateSetting({ flags: newFlags })
  }

  const handleThemeChange = (theme: Settings['theme']) => {
    if (!settings) return
    setSettings({ ...settings, theme })
    updateSetting({ theme })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'var(--font-body)' }}>
      loading…
    </div>
  )

  if (!settings) return null

  const themeConfig = THEMES[settings.theme]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: '#fff', lineHeight: 1.1, marginBottom: 4 }}>
          settings
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>
          feature flags · theme
        </div>
      </div>

      {/* Feature Flags */}
      <Sec title="feature flags" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(Object.keys(settings.flags) as Array<keyof Settings['flags']>).map(flag => (
            <div key={flag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
              <div>
                <div style={{ fontSize: 12, color: '#fff', fontFamily: 'var(--font-body)', marginBottom: 4, textTransform: 'capitalize' }}>
                  {flag}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}>
                  {FLAG_DESCRIPTIONS[flag]}
                </div>
              </div>
              <button
                onClick={() => handleFlagChange(flag)}
                disabled={saving}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(139,92,246,0.35)',
                  background: settings.flags[flag] ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                  color: settings.flags[flag] ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                {settings.flags[flag] ? '✓ on' : '○ off'}
              </button>
            </div>
          ))}
        </div>
      </Sec>

      {/* Theme Picker */}
      <Sec title="theme">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(Object.keys(THEMES) as Array<Settings['theme']>).map(theme => {
            const config = THEMES[theme]
            const isActive = settings.theme === theme
            return (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                disabled={saving}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '16px',
                  borderRadius: 8,
                  border: isActive ? '2px solid rgba(139,92,246,0.6)' : '1px solid rgba(139,92,246,0.2)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: config.color1 }} />
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: config.color2 }} />
                </div>
                <div style={{ fontSize: 11, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {config.label}
                  {isActive && ' ✓'}
                </div>
              </button>
            )
          })}
        </div>
      </Sec>

      <style>{`
        button:disabled { opacity: 0.6 !important; cursor: not-allowed !important; }
      `}</style>
    </div>
  )
}
