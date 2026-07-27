'use client';
import { useEffect, useState } from 'react';

import Navbar          from '@/components/Navbar';
import HeroSection     from '@/components/sections/Hero';
import SkillsSection   from '@/components/sections/Skills';
import LanguagesSection from '@/components/sections/Languages';
import ProjectsGraphSection from '@/components/sections/ProjectsGraph';
import HTBSection      from '@/components/sections/HTB';
import GitHubSection   from '@/components/sections/GitHub';
import SocialSection   from '@/components/sections/Social';
import Footer          from '@/components/sections/Footer';
import CommandPalette  from '@/components/CommandPalette';
import ProgressRail    from '@/components/ProgressRail';
import { track } from '@/lib/track';
import { useParallax } from '@/lib/parallax';
import { useAmpFade } from '@/lib/ampFade';

interface Flags {
  terminal: boolean;
  machines: boolean;
  timeline: boolean;
  maintenance: boolean;
}

const THEMES: Record<string, { color1: string; color2: string }> = {
  morado: { color1: '#8b5cf6', color2: '#3b82f6' },
  azul: { color1: '#3b82f6', color2: '#06b6d4' },
  verde: { color1: '#22c55e', color2: '#06b6d4' },
  mono: { color1: '#ffffff', color2: '#a0a0a0' },
};

export default function Home() {
  // Depth cue only: translate-only, rAF-throttled, disabled under
  // prefers-reduced-motion. Rejected in v5 over motion-sickness risk; the
  // user explicitly chose it back in for v6, constrained to these two
  // decorative (non-text, non-interactive) blob layers only.
  const parallax1 = useParallax(0.08);
  const parallax2 = useParallax(0.16);
  // Subtle scroll-linked fade for every section boundary — no pinning
  // anywhere (see the note above the JSX for why real sticky pinning was
  // reverted), transform/opacity/filter only.
  const fadeHero       = useAmpFade<HTMLDivElement>();
  const fadeSkills     = useAmpFade<HTMLDivElement>();
  const fadeLanguages = useAmpFade<HTMLDivElement>();
  const fadeProjects  = useAmpFade<HTMLDivElement>();
  const fadeHTB        = useAmpFade<HTMLDivElement>();
  const fadeGithub     = useAmpFade<HTMLDivElement>();
  const fadeSocial     = useAmpFade<HTMLDivElement>();
  const fadeFooter     = useAmpFade<HTMLDivElement>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState<'nav' | 'term'>('nav');
  const [trackedSections, setTrackedSections] = useState(new Set<string>());
  const [flags, setFlags] = useState<Flags>({ terminal: true, machines: true, timeline: true, maintenance: false });

  // Fetch flags and apply theme on mount
  useEffect(() => {
    fetch('/api/flags')
      .then(r => r.json())
      .then(data => {
        if (data.flags) setFlags(data.flags);
        if (data.theme && THEMES[data.theme]) {
          const themeConfig = THEMES[data.theme];
          document.documentElement.style.setProperty('--brand-1', themeConfig.color1);
          document.documentElement.style.setProperty('--brand-2', themeConfig.color2);
        }
      })
      .catch(() => {});
  }, []);

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

      // ⌘K / Ctrl+K for command palette (nav tab) — only if terminal flag is true
      if (flags.terminal && (e.metaKey || e.ctrlKey) && e.key === 'k') {
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

      // Backtick for terminal — only if terminal flag is true
      if (flags.terminal && e.key === '`') {
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
  }, [paletteOpen, flags.terminal]);

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
      {flags.timeline && <ProgressRail />}

      <main className="min-h-screen">
        {/* Background ambient blobs */}
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div ref={parallax1} className="parallax-layer absolute top-1/4  left-1/4  w-96 h-96 bg-primary-purple/10 rounded-full blur-[120px]" />
          <div ref={parallax2} className="parallax-layer absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-blue/10  rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          {/* Real position:sticky pinning was tried for the hero->skills
              handoff and reverted: on this site's body (overflow-x: hidden
              already set, unrelated to this feature) combining
              position:sticky with a min-height:100vh child promotes body
              into its own scroll container in some engines, decoupling
              window.scrollY from what the user actually sees scroll — the
              page reads as stuck. Every boundary now uses the same subtle,
              non-pinning amplified-fade transition (useAmpFade / .amp-fade):
              transform/opacity/filter only, never touches scrollTop, never
              preventDefault. Tuned down from the first pass per explicit
              request ("mucho más sutil"). */}
          <div ref={fadeHero}      className="amp-fade"><HeroSection     onOpenTerminal={openTerminal} /></div>
          <div ref={fadeSkills}    className="amp-fade"><SkillsSection   machinesEnabled={flags.machines} /></div>
          <div ref={fadeLanguages} className="amp-fade"><LanguagesSection /></div>
          <div ref={fadeProjects}  className="amp-fade"><ProjectsGraphSection /></div>
          <div ref={fadeHTB}       className="amp-fade"><HTBSection      /></div>
          <div ref={fadeGithub}    className="amp-fade"><GitHubSection   /></div>
          <div ref={fadeSocial}    className="amp-fade"><SocialSection   /></div>
        </div>
      </main>

      <div ref={fadeFooter} className="amp-fade"><Footer /></div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialTab={paletteTab}
        onNavigate={handleNavigateToSection}
      />
    </>
  );
}