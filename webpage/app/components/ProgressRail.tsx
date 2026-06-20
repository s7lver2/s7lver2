'use client';
import { useEffect, useState } from 'react';

const NODES = [
  { id: 'hero', label: 'Home' },
  { id: 'skills', label: 'Skills' },
  { id: 'languages', label: 'Languages' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb', label: 'HackTheBox' },
  { id: 'github', label: 'GitHub' },
  { id: 'contact', label: 'Contact' },
];

export default function ProgressRail() {
  const [active, setActive] = useState('hero');
  const [shown, setShown] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    NODES.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el); });

    const onScroll = () => {
      const hero = document.getElementById('hero');
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
      setShown(heroBottom < 80);
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const activeIdx = NODES.findIndex((n) => n.id === active);

  return (
    <div className={`prail ${shown ? 'prail-on' : ''}`} aria-hidden="true">
      <div className="prail-line"><div className="prail-fill" style={{ height: `${progress}%` }} /></div>
      {NODES.map((n, i) => (
        <button
          key={n.id}
          className={`prnode ${i < activeIdx ? 'done' : ''} ${n.id === active ? 'active' : ''}`}
          onClick={() => document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="prdot" />
          <span className="prlabel">{n.label}</span>
        </button>
      ))}
    </div>
  );
}
