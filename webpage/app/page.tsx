'use client';
import { useEffect, useState } from 'react';

import Navbar          from '@/components/Navbar';
import HeroSection     from '@/components/sections/Hero';
import SkillsSection   from '@/components/sections/Skills';
import LanguagesSection from '@/components/sections/Languages';
import ProjectsSection from '@/components/sections/Projects';
import HTBSection      from '@/components/sections/HTB';
import GitHubSection   from '@/components/sections/GitHub';
import SocialSection   from '@/components/sections/Social';
import Footer          from '@/components/sections/Footer';
import Terminal        from '@/components/Terminal';
import CommandPalette  from '@/components/CommandPalette';

export default function Home() {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Handle terminal navigation to sections
  const handleNavigateToSection = (section: string) => {
    const sectionMap: Record<string, string> = {
      hero: 'hero',
      skills: 'skills',
      projects: 'projects',
      htb: 'htb',
      github: 'github',
      contact: 'contact',
    };

    const elementId = sectionMap[section];
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // ⌘K / Ctrl+K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        setTerminalOpen(false); // Close terminal when opening palette
      }

      // Backtick for terminal
      if (e.key === '`') setTerminalOpen((o) => !o);
      if (e.key === 'Escape') setTerminalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Navbar onOpenTerminal={() => setTerminalOpen(true)} />

      <main className="min-h-screen">
        {/* Background ambient blobs */}
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/4  left-1/4  w-96 h-96 bg-primary-purple/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-blue/10  rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          <HeroSection     onOpenTerminal={() => setTerminalOpen(true)} />
          <SkillsSection   />
          <LanguagesSection />
          <ProjectsSection />
          <HTBSection      />
          <GitHubSection   />
          <SocialSection   />
        </div>
      </main>

      <Footer />

      <Terminal
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        onNavigate={handleNavigateToSection}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
}