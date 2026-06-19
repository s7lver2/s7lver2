'use client'

import { useState, useEffect } from 'react'

type Mode = 'password' | 'webauthn'

const FIELD: React.CSSProperties = {
  width: '100%', padding: '11px 14px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 10, color: '#fff', fontFamily: 'var(--font-body)', fontSize: 13,
  outline: 'none', letterSpacing: '0.05em', transition: 'border-color 0.2s',
}

const TAB_STYLE: React.CSSProperties = {
  flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
  transition: 'background 0.2s, color 0.2s',
}

const errStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 12, color: '#a78bfa', textAlign: 'center', letterSpacing: '0.04em',
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '11px 0', background: disabled ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.2)',
  border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10,
  color: disabled ? 'rgba(255,255,255,0.4)' : '#fff', fontFamily: 'var(--font-body)', fontSize: 12,
  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.2s',
})

const backBtn: React.CSSProperties = {
  padding: '9px 0', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '0.08em',
  cursor: 'pointer', transition: 'background 0.2s',
}

// ─── First-login setup modal ───────────────────────────────────────────────────

function SetupModal({ name, onDone }: { name: string; onDone: () => void }) {
  const [step, setStep] = useState<'choose' | 'password'>('choose')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (body: object) => {
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/admin/auth/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (r.ok) {
        setDone(true)
        setTimeout(onDone, 1100)
      } else {
        setError(d.error ?? 'Setup failed'); setSaving(false)
      }
    } catch { setError('Connection error'); setSaving(false) }
  }

  const savePassword = () => {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    submit({ type: 'password', password })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,0,10,0.9)', backdropFilter: 'blur(10px)', animation: 'sm-fade 0.3s ease', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#07000f', border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 20, padding: 30, animation: 'sm-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 0 60px rgba(139,92,246,0.15)',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0', animation: 'sm-fade 0.3s ease' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#4ade80',
            }}>✓</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: '#fff' }}>all set</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: '0.1em' }}>entering the panel…</div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🌙</div>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: '#fff' }}>welcome, {name}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginTop: 6 }}>
                {step === 'choose' ? "choose how you'll log in" : 'set a password'}
              </div>
            </div>

            {step === 'choose' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setStep('password'); setError('') }} style={{
                  flex: 1, padding: '18px 8px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.25)',
                  transition: 'background 0.2s', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24 }}>🔒</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#fff', marginTop: 8 }}>set password</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>classic login</div>
                </button>
              </div>
            )}

            {step === 'password' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="password" aria-label="new password" placeholder="new password" value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }} style={FIELD} />
                <input type="password" aria-label="confirm password" placeholder="confirm password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') savePassword() }} style={FIELD} />
                {error && <div style={errStyle}>{error}</div>}
                <button type="button" onClick={savePassword} disabled={saving} style={primaryBtn(saving)}>
                  {saving ? 'saving…' : 'set password →'}
                </button>
                <button type="button" onClick={() => { setStep('choose'); setError('') }} style={backBtn}>← back</button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`
        @keyframes sm-fade { from{opacity:0} to{opacity:1} }
        @keyframes sm-pop { from{opacity:0;transform:scale(0.9) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  )
}

// ─── Login page ──────────────────────────────────────────────────────────────

export default function AdminLogin() {
  const [mode, setMode] = useState<Mode>('password')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupName, setSetupName] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [webauthnState, setWebauthnState] = useState<'idle' | 'waiting' | 'verifying' | 'error'>('idle')
  const [webauthnError, setWebauthnError] = useState('')

  useEffect(() => { setError('') }, [mode])

  const loginWithWebAuthn = async () => {
    setWebauthnState('waiting')
    setWebauthnError('')
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser')

      const optRes = await fetch('/api/admin/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      })
      if (!optRes.ok) throw new Error('Could not get authentication options')
      const { _token, ...options } = await optRes.json()

      setWebauthnState('waiting')
      const assertion = await startAuthentication({ optionsJSON: options })

      setWebauthnState('verifying')
      const verRes = await fetch('/api/admin/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...assertion, _token }),
      })
      const data = await verRes.json()
      if (!verRes.ok) throw new Error(data.error ?? 'Verification failed')

      window.location.replace('/admin')
    } catch (e: unknown) {
      const msg = (e as Error).message
      if (msg.includes('cancelled') || msg.includes('NotAllowedError')) {
        setWebauthnError('Operation cancelled.')
      } else {
        setWebauthnError(msg)
      }
      setWebauthnState('error')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username || 'root', password, method: 'password' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (data.needsSetup) { setSetupName(data.name ?? username); setLoading(false); return }
        window.location.replace('/admin')
      } else {
        setError(data.error ?? 'Invalid credentials'); setShake(n => n + 1); setLoading(false)
      }
    } catch {
      setError('Connection error'); setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05000a', padding: 20 }}>
      <div key={shake} style={{
        width: '100%', maxWidth: 340, background: 'rgba(139,92,246,0.04)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: 24, padding: 36,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
        animation: shake > 0 ? 'lg-shake 0.4s ease' : 'lg-in 0.5s ease',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px', background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ◈
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: '#fff', marginBottom: 4 }}>control panel</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(139,92,246,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>s7lver • admin</div>
        </div>

        {/* Mode tabs */}
        <div style={{ width: '100%', display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3 }}>
          <button type="button"
            onClick={() => { setMode('password'); setError(''); setWebauthnState('idle'); setWebauthnError('') }}
            style={{
              ...TAB_STYLE,
              background: mode === 'password' ? 'rgba(139,92,246,0.22)' : 'transparent',
              color: mode === 'password' ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          >
            🔒 password
          </button>
          <button type="button"
            onClick={() => { setMode('webauthn'); setError(''); setWebauthnState('idle'); setWebauthnError('') }}
            style={{
              ...TAB_STYLE,
              background: mode === 'webauthn' ? 'rgba(139,92,246,0.22)' : 'transparent',
              color: mode === 'webauthn' ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          >
            U2F key
          </button>
        </div>

        {mode !== 'webauthn' ? (
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input aria-label="username" placeholder="username" value={username} autoComplete="username"
              onChange={e => setUsername(e.target.value)} style={FIELD}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)')} />

            <input type="password" aria-label="password" placeholder="password" value={password} autoComplete="current-password"
              onChange={e => setPassword(e.target.value)} style={FIELD}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)')} />

            {error && <div style={errStyle}>{error}</div>}

            <button type="submit" disabled={loading || !password} style={primaryBtn(loading || !password)}>
              {loading ? 'signing in…' : 'sign in'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            <div>
              <label style={{ fontSize: 12, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>
                USERNAME
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="root"
                style={FIELD}
                autoComplete="username"
              />
            </div>

            {webauthnError && (
              <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{webauthnError}</div>
            )}

            <button type="button"
              onClick={loginWithWebAuthn}
              disabled={webauthnState === 'waiting' || webauthnState === 'verifying' || !username.trim()}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: webauthnState === 'waiting' ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.8)',
                color: '#fff', fontFamily: 'var(--font-body)', fontSize: 12,
                letterSpacing: '0.1em', cursor: 'pointer', transition: 'background 0.2s',
                opacity: (!username.trim()) ? 0.4 : 1,
              }}
            >
              {webauthnState === 'waiting' && '⏳ waiting for key…'}
              {webauthnState === 'verifying' && '✓ verifying…'}
              {(webauthnState === 'idle' || webauthnState === 'error') && 'sign in with U2F'}
            </button>
          </div>
        )}

        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', textAlign: 'center' }}>
          owner logs in as <span style={{ color: 'rgba(255,255,255,0.4)' }}>root</span>
        </div>
      </div>

      {setupName && <SetupModal name={setupName} onDone={() => window.location.replace('/admin')} />}

      <style>{`
        @keyframes lg-in { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lg-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(3px)} }
      `}</style>
    </main>
  )
}
