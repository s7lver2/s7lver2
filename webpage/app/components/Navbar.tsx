'use client';
import { useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

interface NavbarProps {
  onOpenTerminal?: () => void;
}

const sections = [
  { id: 'about',    label: 'Introduction' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb',      label: 'HTB' },
  { id: 'contact',  label: 'Contact' },
];

export default function Navbar({ onOpenTerminal = () => {} }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    // Check on mount too
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
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
            onClick={() => scrollToSection('about')}
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
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                {label}
              </button>
            ))}

            <a
              href="https://github.com/s7lver2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaGithub className="text-xl" />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}