'use client';

import HeroBackground from '@/components/HeroBackground';
import { useReveal } from '@/lib/reveal';

interface HeroProps {
  onOpenTerminal?: () => void;
}

export default function HeroSection({ onOpenTerminal = () => {} }: HeroProps) {
  const reveal = useReveal();

  return (
    <section className="hero" id="hero">
      <HeroBackground />
      <div className="wrap">
        <div className="block reveal" ref={reveal}>
          <div className="cmd mono">whoami<span className="cur"></span></div>
          <h1>
            Hi, I&apos;m <span className="grad">s7lver</span>
            <br />
            Developer &amp; Cybersecurity Student
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