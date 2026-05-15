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
import DiscordPresenceSection from '@/components/sections/DiscordPresence';
import dynamic from 'next/dynamic';
import SpaceWarp from '@/components/SpaceWarp';



// Página interna de Discord (SPA, sin redirect)
function DiscordWorld({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="discord-page-in min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f0522 0%, #1e0a4a 50%, #0a0a1a 100%)' }}
    >
      {/* Partículas moradas de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-purple-500"
            style={{
              width: Math.random() * 4 + 1,
              height: Math.random() * 4 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center space-y-8 px-6">
        <p className="text-xs font-mono text-purple-500 tracking-widest uppercase">
          — welcome to s7lver's discord world —
        </p>
        <h1 className="text-6xl md:text-8xl font-bold text-white"
            style={{ textShadow: '0 0 60px rgba(139,92,246,0.8)' }}>
          hola mundo
        </h1>
        <p className="text-gray-400 font-mono">
          {/* Aquí se expandirá en el futuro con Discord presence, servidor, etc */}
          más contenido próximamente...
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono text-sm hover:bg-purple-500/20 transition-all"
        >
          ← volver
        </button>
      </div>
    </div>
  );
}


export default function Home() {
  const [terminalOpen,    setTerminalOpen]    = useState(false);
  const [discordOpen,     setDiscordOpen]     = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '`') setTerminalOpen(o => !o);
      if (e.key === 'Escape') {
        setTerminalOpen(false);
        setDiscordOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (discordOpen) {
    return <DiscordWorld onBack={() => setDiscordOpen(false)} />;
  }

  return (
    <>
      <Navbar onOpenTerminal={() => setTerminalOpen(true)} />

      {/* ── Hero ──────────────────────────────────────── */}
      <HeroSection onOpenTerminal={() => setTerminalOpen(true)} />

      {/* Viaje Hero → Skills (destino: azul Skills) */}
      <SpaceWarp
        destination="→ security.skills"
        accentRgb={[107, 164, 224]}
      />

      {/* ── Skills ────────────────────────────────────── */}
      <SkillsSection />

      {/* Viaje Skills → Projects (destino: naranja Projects) */}
      <SpaceWarp
        destination="→ projects.work"
        accentRgb={[251, 146, 60]}
      />

      {/* ── Projects ──────────────────────────────────── */}
      <ProjectsSection />

      {/* Viaje Projects → HTB (destino: verde HTB) */}
      <SpaceWarp
        destination="→ hackthebox.com"
        accentRgb={[34, 197, 94]}
      />

      {/* ── HTB ───────────────────────────────────────── */}
      <HTBSection onOpenTerminal={() => setTerminalOpen(true)} />

      {/* Viaje HTB → Discord (destino: morado Discord) */}
      <SpaceWarp
        destination="→ discord.world"
        accentRgb={[139, 92, 246]}
      />

      {/* ── Discord ───────────────────────────────────── */}
      <DiscordPresenceSection />

      {/* Viaje Discord → Contact (destino: rosa Contact) */}
      <SpaceWarp
        destination="→ meet.me"
        accentRgb={[236, 72, 153]}
      />

      {/* ── Contact ───────────────────────────────────── */}
      <ContactSection />

      <Footer />

      <Terminal open={terminalOpen} onClose={() => setTerminalOpen(false)} />
    </>
  );
}