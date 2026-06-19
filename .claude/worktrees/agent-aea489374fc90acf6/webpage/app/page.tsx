'use client';
import { useEffect, useState } from 'react';

import Navbar          from '@/components/Navbar';
import HeroSection     from '@/components/sections/Hero';
import SkillsSection   from '@/components/sections/Skills';
import ProjectsSection from '@/components/sections/Projects';
import HTBSection      from '@/components/sections/HTB';
import ContactSection  from '@/components/sections/Contact';
import Footer          from '@/components/sections/Footer';
import Terminal        from '@/components/Terminal';

export default function Home() {
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Backtick global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
          <ProjectsSection />
          <HTBSection      />
          <ContactSection  />
        </div>
      </main>

      <Footer />

      <Terminal open={terminalOpen} onClose={() => setTerminalOpen(false)} />
    </>
  );
}