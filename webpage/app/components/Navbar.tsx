'use client';
import { useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

interface NavbarProps { onOpenTerminal?: () => void; }

const sections = [
  { id: 'about',    label: 'Introduction' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb',      label: 'HTB' },
  { id: 'discord',  label: 'Presence' },
  { id: 'contact',  label: 'Contact' },
];

export default function Navbar({ onOpenTerminal = () => {} }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const scroll = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 52, display: 'flex', alignItems: 'center',
      padding: '0 32px',
      transition: 'background 0.25s ease, border-color 0.25s ease',
      background: scrolled ? 'rgba(10,10,10,0.92)' : 'rgba(10,10,10,0.5)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'var(--border-subtle)'}`,
    }}>
      <div style={{
        maxWidth: 1100, width: '100%', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <button
          onClick={() => scroll('about')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
            letterSpacing: '-0.03em', color: 'var(--fg)',
          }}
        >
          s7lver
        </button>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {sections.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scroll(id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400,
                color: 'var(--fg-muted)', padding: '5px 10px', borderRadius: 5,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--fg)';
                (e.currentTarget as HTMLElement).style.background = 'var(--hover)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--fg-muted)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >{label}</button>
          ))}

          <a
            href="https://github.com/s7lver2"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center',
              color: 'var(--fg-faint)', marginLeft: 8, padding: '5px 8px',
              borderRadius: 5, transition: 'color 0.15s',
              textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--fg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--fg-faint)'}
          >
            <FaGithub size={16} />
          </a>

          <button
            onClick={onOpenTerminal}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--accent-inv)', background: 'var(--fg)',
              border: 'none', cursor: 'pointer',
              padding: '6px 14px', borderRadius: 5, marginLeft: 6,
              letterSpacing: '0.04em', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.82'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            $ terminal
          </button>
        </div>
      </div>
    </nav>
  );
}