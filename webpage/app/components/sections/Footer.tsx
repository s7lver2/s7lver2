'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_PROJECTS, DEFAULT_SOCIALS, type SocialC } from '@/lib/content-constants';

const navLinks = [
  { id: 'about',    label: 'Introduction' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb',      label: 'HTB' },
  { id: 'contact',  label: 'Contact' },
];

export default function Footer() {
  // Same source the admin-managed Social section reads from, not a second
  // hardcoded list that can drift from it — and only entries with a real
  // URL render; several defaults are still '#' placeholders until filled in
  // via the admin panel, and a footer with a dead Discord link is worse than
  // no Discord link at all.
  const [socials, setSocials] = useState<SocialC[]>(DEFAULT_SOCIALS);

  useEffect(() => {
    fetch('/api/content/socials')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SocialC[] | null) => { if (Array.isArray(d) && d.length) setSocials(d); })
      .catch(() => {});
  }, []);

  const realSocials = socials.filter((s) => s.url.startsWith('http'));

  const scroll = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer id="footer" className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div className="ftr-col ftr-brand">
            <div className="ftr-logo">s7lver<span className="grad">2</span></div>
            <p className="ftr-tag">Developer &amp; cybersecurity student</p>
          </div>

          <nav className="ftr-col">
            <span className="ftr-h">Navigate</span>
            {navLinks.map(({ id, label }) => (
              <button key={id} type="button" className="ftr-link" onClick={() => scroll(id)}>
                {label}
              </button>
            ))}
          </nav>

          <nav className="ftr-col">
            <span className="ftr-h">Projects</span>
            {DEFAULT_PROJECTS.map((p) => (
              <a
                key={p.slug}
                href={p.web ?? `https://github.com/${p.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ftr-link"
              >
                {p.name}
              </a>
            ))}
          </nav>

          <nav className="ftr-col">
            <span className="ftr-h">Elsewhere</span>
            {realSocials.map((s) => (
              <a
                key={s.k}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ftr-link"
              >
                {s.k}
              </a>
            ))}
          </nav>
        </div>

        <div className="ftr-meta">
          <span>© 2026 s7lver</span>
          <span className="ftr-egg" aria-hidden>Press ` to open the terminal</span>
        </div>
      </div>
    </footer>
  );
}
