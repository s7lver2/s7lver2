'use client';
import { useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

interface NavbarProps {
  onOpenTerminal?: () => void;
}

const sections = [
  { id: 'hero',     label: 'Home' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb',      label: 'HTB' },
  { id: 'contact',  label: 'Contact' },
];

export default function Navbar({ onOpenTerminal = () => {} }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState('hero');

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    // Check on mount too
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Scroll-spy effect
  useEffect(() => {
    const ids = ['hero', 'skills', 'projects', 'htb', 'contact'];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
        border-b
        ${scrolled
          ? 'bg-black/80 backdrop-blur-lg border-white/10'
          : 'bg-transparent border-transparent'
        }`}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => scrollToSection('hero')}
            className="text-xl font-bold group"
          >
            <span className="text-white  group-hover:text-gradient transition-all duration-300">s</span>
            <span className="text-purple group-hover:text-gradient transition-all duration-300">7</span>
            <span className="text-white  group-hover:text-gradient transition-all duration-300">lver</span>
          </button>

          <div className="hidden md:flex items-center space-x-8">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`transition-colors text-sm ${
                  activeId === id
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}

            <a
              id="github"
              href="https://github.com/s7lver2"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${
                activeId === 'github'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <FaGithub className="text-xl" />
            </a>

            <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-gray-500 border border-white/10 rounded px-2 py-1">
              ⌘K
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}