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
import ProgressRail    from '@/components/ProgressRail';
import { track } from '@/lib/track';

export default function Home() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState<'nav' | 'term'>('nav');
  const [trackedSections, setTrackedSections] = useState(new Set<string>());

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
        setPaletteOpen((o) => {
          const newOpen = !o;
          if (newOpen) {
            track('cmdk_open', { detail: 'nav' });
          }
          return newOpen;
        });
      }

      // Backtick for terminal
      if (e.key === '`') {
        e.preventDefault();
        track('cmdk_open', { detail: 'term' });
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

  // Track scroll depth
  useEffect(() => {
    let throttleTimer: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        const sections = ['hero', 'skills', 'projects', 'htb', 'github', 'contact'];
        let deepestSection = 'hero';
        let maxVisibility = 0;

        for (const section of sections) {
          const el = document.getElementById(section);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const visibility = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
          if (visibility > maxVisibility) {
            maxVisibility = visibility;
            deepestSection = section;
          }
        }

        const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
        const depth = pageHeight > 0 ? Math.round((window.scrollY / pageHeight) * 100) : 0;

        if (!trackedSections.has(deepestSection)) {
          track('scroll_depth', { section: deepestSection, depth });
          setTrackedSections((prev) => new Set([...prev, deepestSection]));
        }

        throttleTimer = null;
      }, 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [trackedSections]);

  return (
    <>
      <Navbar onOpenTerminal={openTerminal} />
      <ProgressRail />

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