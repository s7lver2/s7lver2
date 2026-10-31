'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_PROJECTS, DEFAULT_SOCIALS, type SocialC } from '@/lib/content-constants';
import { ACHIEVEMENTS, has } from '../achievements';

/*
 * El footer de verdad, el de la web clásica (components/sections/Footer.tsx) pasado a ONI//OS: la
 * marca, los proyectos, las redes (las del panel de admin, solo las que tienen URL) y la última
 * línea con el año y los logros conseguidos. Debajo de todo, la firma: S7LVER enorme, en las líneas
 * de barrido rojas del holograma, pegada al borde de abajo.
 */
export default function Foot() {
  const [socials, setSocials] = useState<SocialC[]>(DEFAULT_SOCIALS);
  useEffect(() => {
    fetch('/api/content/socials')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SocialC[] | null) => void (Array.isArray(d) && d.length && setSocials(d)))
      .catch(() => {});
  }, []);
  const got = ACHIEVEMENTS.filter((a) => has(a.id)).length;
  const out = { target: '_blank', rel: 'noopener noreferrer' };

  return (
    <footer className="supper-foot">
      <div className="supper-foot__grid">
        <div className="supper-foot__brand">
          <b>s7lver</b>
          <p>Developer &amp; cybersecurity student</p>
        </div>
        <nav aria-label="Projects">
          <h2>Projects</h2>
          {DEFAULT_PROJECTS.filter((p) => p.web || p.repo).map((p) => (
            <a key={p.slug} href={p.web ?? `https://github.com/${p.repo}`} {...out}>
              {p.name}
            </a>
          ))}
        </nav>
        <nav aria-label="Elsewhere">
          <h2>Elsewhere</h2>
          {socials
            .filter((s) => s.url.startsWith('http'))
            .map((s) => (
              <a key={s.k} href={s.url} {...out}>
                {s.k}
              </a>
            ))}
        </nav>
      </div>
      <div className="supper-foot__meta">
        <span>© 2026 s7lver</span>
        <span>
          achievements {got}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="supper-foot__sign" aria-hidden>
        S7LVER
      </div>
    </footer>
  );
}
