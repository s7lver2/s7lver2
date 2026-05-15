'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const DiscordPlanet = dynamic(() => import('../planets/DiscordPlanet'), { ssr: false });

interface DiscordPresenceProps { onEnterDiscord: () => void; }

type Phase = 'idle' | 'zooming' | 'flashing';

export default function DiscordPresenceSection({ onEnterDiscord }: DiscordPresenceProps) {
  const [phase, setPhase] = useState<Phase>('idle');

  const handleClick = () => {
    if (phase !== 'idle') return;
    setPhase('zooming');

    // Tras el zoom (1.1s) → flash
    setTimeout(() => setPhase('flashing'), 1100);
    // Tras el flash (0.4s) → mostrar Discord world
    setTimeout(() => onEnterDiscord(), 1500);
  };

  return (
    <section id="discord" className="section-planet">
      {/* Flash overlay */}
      {phase === 'flashing' && (
        <div className="fixed inset-0 z-[100] pointer-events-none discord-flash-anim"
             style={{ background: 'white' }} />
      )}

      <div className="w-full max-w-6xl mx-auto px-6 flex flex-col items-center gap-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full border border-purple-500/20 bg-purple-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-mono text-purple-400 tracking-widest uppercase">discord.world</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-2">Discord</h2>
          <p className="text-gray-500 font-mono text-sm">// click the planet to enter</p>
        </div>

        {/* Planeta */}
        <div
          onClick={handleClick}
          className={`cursor-pointer ${phase === 'zooming' ? 'discord-zoom-anim' : ''}`}
          style={{
            width: 360,
            height: 360,
            transformOrigin: 'center center',
            // Asegurar que el zoom pasa por encima de todo
            position: 'relative',
            zIndex: 50,
          }}
        >
          <DiscordPlanet />
        </div>

        {phase === 'idle' && (
          <p className="text-gray-400 font-mono text-sm animate-pulse">click the planet to enter</p>
        )}
      </div>
    </section>
  );
}