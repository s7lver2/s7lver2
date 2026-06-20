'use client';

import { useEffect, useState } from 'react';
import HeroBackground from '@/components/HeroBackground';
import { useReveal } from '@/lib/reveal';
import { DEFAULT_HOME } from '@/lib/content-constants';

interface HeroProps {
  onOpenTerminal?: () => void;
}

export default function HeroSection({ onOpenTerminal = () => {} }: HeroProps) {
  const reveal = useReveal();
  const [title, setTitle] = useState(DEFAULT_HOME.heroTitle);
  const [subtitle, setSubtitle] = useState(DEFAULT_HOME.heroSubtitle);

  // Fetch home content from KV with fallback
  useEffect(() => {
    fetch('/api/content/home')
      .then((r) => r.ok ? r.json() : null)
      .then((d: typeof DEFAULT_HOME | null) => {
        if (d && d.heroTitle && d.heroSubtitle) {
          setTitle(d.heroTitle);
          setSubtitle(d.heroSubtitle);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="hero" id="hero">
      <HeroBackground />
      <div className="wrap">
        <div className="block reveal" ref={reveal}>
          <div className="cmd mono">whoami<span className="cur"></span></div>
          <h1>
            Hi, I&apos;m <span className="grad">s7lver</span>
            <br />
            {subtitle}
          </h1>
          <div className="cta">
            <button
              className="btn btn-p"
              onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Projects →
            </button>
            <button
              className="btn btn-d"
              onClick={onOpenTerminal}
            >
              $ start hacking
            </button>
          </div>
        </div>
      </div>
      <div className="scrolldown" aria-hidden="true">
        <span>scroll</span>
        <div className="mouse"></div>
      </div>
    </section>
  );
}