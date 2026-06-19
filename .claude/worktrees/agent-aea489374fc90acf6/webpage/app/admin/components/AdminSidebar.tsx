'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Overview', icon: '◈' },
  { href: '/admin/traffic', label: 'Traffic', icon: '⊡' },
  { href: '/admin/live', label: 'Live', icon: '◎' },
  { href: '/admin/users', label: 'Users', icon: '👤' },
  { href: '/admin/audit', label: 'Audit', icon: '📋' },
]

interface LiveData { activeLastHour: number; todayTotal: number }

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [live, setLive] = useState<LiveData>({ activeLastHour: 0, todayTotal: 0 })
  const [open, setOpen] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/admin/stream')
    esRef.current = es
    es.onmessage = (e) => {
      try { const d = JSON.parse(e.data) as LiveData; setLive(d) } catch { }
    }
    es.onerror = () => { es.close() }
    return () => es.close()
  }, [])

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.replace('/admin/login')
  }

  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--text)', lineHeight: 1 }}>
          s7lver
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(139,92,246,0.7)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
          analytics
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1, overflowY: 'auto' }}>
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, marginBottom: 2,
              fontFamily: 'var(--font-body)', fontSize: 12,
              letterSpacing: '0.08em', textDecoration: 'none',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              background: isActive(href) ? 'rgba(139,92,246,0.14)' : 'transparent',
              color: isActive(href) ? 'var(--text)' : 'rgba(255,255,255,0.45)',
              border: isActive(href) ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center', color: isActive(href) ? '#8b5cf6' : 'inherit' }}>
              {icon}
            </span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Live indicator */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6',
            boxShadow: '0 0 6px #8b5cf6',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            {live.activeLastHour} active (1h)
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.2)', marginBottom: 12, letterSpacing: '0.08em' }}>
          {live.todayTotal} visits today
        </div>
        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%', padding: '7px 0', background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 7,
            color: 'rgba(139,92,246,0.7)', fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.1em', cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          log out
        </button>
      </div>

      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;box-shadow:0 0 6px #8b5cf6} 50%{opacity:0.4;box-shadow:0 0 3px #8b5cf6} }`}</style>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        width: 200,
        background: 'rgba(5,0,10,0.95)',
        borderRight: '1px solid rgba(139,92,246,0.15)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 10,
      }} className="admin-sidebar-desktop">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="admin-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(5,0,10,0.97)', borderBottom: '1px solid rgba(139,92,246,0.15)',
        padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--text)' }}>s7lver</span>
        <button type="button" onClick={() => setOpen(o => !o)} style={{
          background: 'none', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
          padding: '5px 10px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12,
        }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(5,0,10,0.98)',
          display: 'flex', flexDirection: 'column',
        }}>
          {sidebarContent}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-bar { display: flex !important; }
        }
      `}</style>
    </>
  )
}
