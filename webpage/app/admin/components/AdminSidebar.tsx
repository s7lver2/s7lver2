'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from './ui'

interface NavItem { href: string; label: string; icon: string }
interface NavGroup { title: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    title: 'Analytics',
    items: [
      { href: '/admin', label: 'Analytics', icon: '◈' },
      { href: '/admin/engagement', label: 'Engagement', icon: '⊙' },
    ]
  },
  {
    title: 'Contenido',
    items: [
      { href: '/admin/content/projects', label: 'Proyectos', icon: '◫' },
      { href: '/admin/content/socials', label: 'Redes', icon: '@' },
    ]
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/users', label: 'Users', icon: '◇' },
      { href: '/admin/audit', label: 'Audit', icon: '⊟' },
      { href: '/admin/config', label: 'Configuración', icon: '⚙' },
    ]
  }
]

const FLAT_ITEMS: NavItem[] = GROUPS.flatMap((g) => g.items)

interface LiveData { activeLastHour: number; todayTotal: number }

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [live, setLive] = useState<LiveData>({ activeLastHour: 0, todayTotal: 0 })
  const [open, setOpen] = useState(false)
  const esRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const navRef = useRef<HTMLDivElement | null>(null)
  const [ind, setInd] = useState({ top: 0, height: 0, ready: false })

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/admin/stats')
        if (!r.ok) return
        const d = await r.json() as { activeLastHour?: number; todayTotal?: number }
        setLive({ activeLastHour: d.activeLastHour ?? 0, todayTotal: d.todayTotal ?? 0 })
      } catch { }
    }
    poll()
    esRef.current = setInterval(poll, 15000)
    return () => { if (esRef.current) clearInterval(esRef.current) }
  }, [])

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.replace('/admin/login')
  }

  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
  const activeItem = FLAT_ITEMS.find((it) => isActive(it.href))

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = activeItem ? itemRefs.current[activeItem.href] : null
    if (!el) return
    setInd({ top: el.offsetTop, height: el.offsetHeight, ready: true })
    void reduced
  }, [pathname, activeItem])

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 20, color: T.text, lineHeight: 1 }}>
          s7lver
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.mut, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
          admin
        </div>
      </div>

      {/* Nav with groups */}
      <nav ref={navRef} style={{ padding: '12px 10px', flex: 1, overflowY: 'auto', position: 'relative' }}>
        <span aria-hidden style={{
          position: 'absolute', left: 0, width: 2,
          top: ind.top, height: ind.height,
          background: T.active, borderRadius: 2,
          boxShadow: `0 0 8px ${T.active}`,
          opacity: ind.ready ? 1 : 0,
          // No transition on the first paint, or the bar slides in from y=0.
          transition: ind.ready && !reducedMotion
            ? 'top .34s cubic-bezier(.16,1,.3,1), height .34s cubic-bezier(.16,1,.3,1)'
            : 'none',
        }} />
        {GROUPS.map((group, groupIdx) => (
          <div key={group.title}>
            {groupIdx > 0 && <div style={{ height: 1, background: T.line, margin: '8px 0' }} />}
            <div style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: T.dim,
              padding: '8px 12px 6px 12px',
              marginTop: groupIdx > 0 ? 8 : 0,
            }}>
              {group.title}
            </div>
            {group.items.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                ref={(el) => { itemRefs.current[href] = el }}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                  fontFamily: T.mono, fontSize: 12,
                  letterSpacing: '0.08em', textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  background: isActive(href) ? 'rgba(94,234,212,0.08)' : 'transparent',
                  color: isActive(href) ? T.text : T.mut,
                }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', color: isActive(href) ? T.active : 'inherit' }}>
                  {icon}
                </span>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Live indicator */}
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: T.active,
            boxShadow: `0 0 6px ${T.active}`,
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.mut, letterSpacing: '0.1em' }}>
            {live.activeLastHour} active (1h)
          </span>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.dim, marginBottom: 12, letterSpacing: '0.08em' }}>
          {live.todayTotal} visits today
        </div>
        <button
          type="button"
          onClick={logout}
          className="admin-focusable"
          style={{
            width: '100%', padding: '7px 0', background: 'transparent',
            border: `1px solid ${T.line}`, borderRadius: 7,
            color: T.mut, fontFamily: T.mono, fontSize: 11,
            letterSpacing: '0.1em', cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          log out
        </button>
      </div>

      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1;box-shadow:0 0 6px ${T.active}} 50%{opacity:0.4;box-shadow:0 0 3px ${T.active}} }`}</style>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        width: 200,
        background: T.surface,
        borderRight: `1px solid ${T.line}`,
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
        background: T.surface, borderBottom: `1px solid ${T.line}`,
        padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 18, color: T.text }}>s7lver</span>
        <button type="button" onClick={() => setOpen(o => !o)} className="admin-focusable" style={{
          background: 'none', border: `1px solid ${T.line}`, borderRadius: 6,
          padding: '5px 10px', color: T.text, cursor: 'pointer', fontFamily: T.mono, fontSize: 12,
        }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99, background: T.surface,
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
