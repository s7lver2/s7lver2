'use client';
import { useEffect, useState } from 'react';
import { FaTerminal } from 'react-icons/fa';
import { FaNodeJs, FaPython, FaDocker, FaGitAlt } from 'react-icons/fa';
import { SiTypescript, SiNextdotjs, SiGo, SiLinux, SiRust } from 'react-icons/si';
import dynamic from 'next/dynamic';

// Cargado dinámicamente para evitar SSR con WebGL
const HeroStar = dynamic(() => import('../planets/HeroStar'), { ssr: false });

const phrases     = ["I'm s7lver", "Call me s7lver", "Code with s7lver", "Build with s7lver"];
const typingSpeed = 80;
const deleteSpeed = 50;
const pauseTime   = 1800;

const technologies = [
  { icon: <SiTypescript />, name: 'TypeScript' },
  { icon: <SiNextdotjs />, name: 'Next.js' },
  { icon: <SiRust />,       name: 'Rust' },
  { icon: <SiGo />,         name: 'Go' },
  { icon: <FaNodeJs />,     name: 'Node.js' },
  { icon: <FaPython />,     name: 'Python' },
  { icon: <SiLinux />,      name: 'Linux' },
  { icon: <FaDocker />,     name: 'Docker' },
  { icon: <FaGitAlt />,     name: 'Git' },
];

interface HeroProps { onOpenTerminal?: () => void; }

export default function HeroSection({ onOpenTerminal = () => {} }: HeroProps) {
  const [mounted, setMounted]               = useState(false);
  const [phraseIdx, setPhraseIdx]           = useState(0);
  const [displayText, setDisplayText]       = useState('');
  const [isDeleting, setIsDeleting]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Typewriter
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const full = phrases[phraseIdx];
    if (!isDeleting && displayText.length < full.length) {
      timer = setTimeout(() => setDisplayText(full.slice(0, displayText.length + 1)), typingSpeed);
    } else if (isDeleting && displayText.length > 0) {
      timer = setTimeout(() => setDisplayText(full.slice(0, displayText.length - 1)), deleteSpeed);
    } else if (!isDeleting && displayText === full) {
      timer = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setPhraseIdx((p) => (p + 1) % phrases.length);
    }
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, phraseIdx]);

  // Tab title
  useEffect(() => {
    let i = 0, isDel = false, idx = 0;
    let t: NodeJS.Timeout;
    const tick = () => {
      const full = phrases[idx] + ' ✦';
      if      (!isDel && i < full.length)   { document.title = full.slice(0, ++i); t = setTimeout(tick, typingSpeed); }
      else if (isDel  && i > 0)             { document.title = full.slice(0, --i); t = setTimeout(tick, deleteSpeed); }
      else if (!isDel && i === full.length) { t = setTimeout(() => { isDel = true; tick(); }, pauseTime); }
      else                                  { isDel = false; idx = (idx + 1) % phrases.length; tick(); }
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="about"
      className="relative min-h-screen flex flex-col items-center justify-center px-6 sm:px-8 pt-20 overflow-hidden"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s' }}
    >
      {/* Canvas de fondo con estrella y starfield */}
      <HeroStar />

      {/* Contenido sobre el canvas */}
      <div className="relative z-10 w-full max-w-5xl mx-auto text-center space-y-10 md:space-y-14">
        <div className="inline-block px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="badge animate-up" style={{ marginBottom: 24, animationDelay: '0.05s' }}>
            Developer & Creator
          </div>
        </div>

        <div className="flex justify-center items-center">
          <h1 className="t-display animate-up" style={{ animationDelay: '0.1s' }}>
            <span
              className="inline-block text-center"
              style={{
                minWidth: '18ch',
                color: 'white',
                textShadow: '0 0 40px rgba(139,92,246,0.8), 0 0 80px rgba(59,130,246,0.4)',
              }}
            >
              {displayText}<span className="animate-pulse">|</span>
            </span>
          </h1>
        </div>

        <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed px-4"
           style={{ textShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
          Building the future with vibe coding
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <a href="#projects" className="btn btn-primary animate-up" style={{ animationDelay: '0.3s' }}>
            View Projects
          </a>
          <button onClick={onOpenTerminal} className="btn btn-secondary animate-up" style={{ animationDelay: '0.35s' }}>
            $ start hacking
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 pt-8 md:pt-10 max-w-4xl mx-auto">
          {technologies.map((tech, index) => (
            <div
              key={tech.name}
              className="group flex flex-col items-center gap-2"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="text-3xl sm:text-4xl text-gray-400 group-hover:text-white transition-all duration-300 drop-shadow-lg">
                {tech.icon}
              </div>
              <span className="text-xs sm:text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
                {tech.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 sm:bottom-12 animate-bounce z-10">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}