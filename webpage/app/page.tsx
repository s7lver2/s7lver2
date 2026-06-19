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
import CommandPalette  from '@/components/CommandPalette';

export default function Home() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState<'nav' | 'term'>('nav');

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

  // Open terminal tab in palette
  const openTerminal = () => {
    setPaletteTab('term');
    setPaletteOpen(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // ⌘K / Ctrl+K for command palette (nav tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteTab('nav');
        setPaletteOpen((o) => !o);
      }

      // Backtick for terminal
      if (e.key === '`') {
        e.preventDefault();
        openTerminal();
      }
      if (e.key === 'Escape') {
        // Escape closes palette if open
        if (paletteOpen) {
          setPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen]);

  return (
    <>
      <Navbar onOpenTerminal={openTerminal} />

      <main className="min-h-screen">
        {/* Background ambient blobs */}
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/4  left-1/4  w-96 h-96 bg-primary-purple/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-blue/10  rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          <HeroSection     onOpenTerminal={openTerminal} />
          <SkillsSection   />
          <LanguagesSection />
          <ProjectsSection />
          <HTBSection      />
          <GitHubSection   />
          <SocialSection   />
        </div>
      </main>

      <Footer />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialTab={paletteTab}
        onNavigate={handleNavigateToSection}
      />
    </>
  );
}