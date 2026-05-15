// webpage/app/admin/components/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin/overview', label: 'overview', icon: '◈' },
  { href: '/admin/sessions', label: 'sessions', icon: '◎' },
  { href: '/admin/traffic', label: 'traffic', icon: '◈' },
  { href: '/admin/geography', label: 'geography', icon: '⬡' },
  { href: '/admin/live', label: 'live', icon: '◉' },
  { href: '/admin/uploads', label: 'uploads', icon: '⬆' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  return (
    <aside style={{
      width: 180, flexShrink: 0,
      background: 'rgba(10,5,20,0.95)',
      borderRight: '1px solid rgba(139,92,246,0.12)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 0',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
        <div style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 18, color: '#e9d5ff' }}>
          s7lver
        </div>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, color: 'rgba(139,92,246,0.6)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 2 }}>
          admin panel
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: active ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
                color: active ? '#e9d5ff' : 'rgba(233,213,255,0.4)',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 10, letterSpacing: '0.08em',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 12, opacity: active ? 1 : 0.5 }}>{item.icon}</span>
              {item.label}
              {item.label === 'live' && (
                <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 6px #8b5cf6', animation: 'lp 2s ease-in-out infinite' }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 12px 0', borderTop: '1px solid rgba(139,92,246,0.1)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px 10px',
            background: 'none', border: '1px solid rgba(139,92,246,0.15)',
            borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font-mono), monospace', fontSize: 10,
            color: 'rgba(233,213,255,0.35)', letterSpacing: '0.08em',
            transition: 'all 0.15s',
          }}
        >
          sign out
        </button>
      </div>

      <style>{`@keyframes lp { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </aside>
  );
}