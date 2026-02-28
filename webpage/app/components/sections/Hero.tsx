'use client';
import { useEffect, useState } from 'react';
import { FaTerminal } from 'react-icons/fa';
import {
  FaNodeJs, FaPython, FaDocker, FaGitAlt,
} from 'react-icons/fa';
import {
  SiTypescript, SiNextdotjs, SiGo, SiLinux, SiRust,
} from 'react-icons/si';

const phrases      = ["I'm s7lver", "Call me s7lver", "Code with s7lver", "Build with s7lver"];
const typingSpeed  = 80;
const deleteSpeed  = 50;
const pauseTime    = 1800;

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

interface HeroProps {
  onOpenTerminal?: () => void;
}

export default function HeroSection({ onOpenTerminal = () => {} }: HeroProps) {
  const [mounted, setMounted]                   = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText]           = useState('');
  const [isDeleting, setIsDeleting]             = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const full = phrases[currentPhraseIndex];
    if (!isDeleting && displayText.length < full.length) {
      timer = setTimeout(() => setDisplayText(full.slice(0, displayText.length + 1)), typingSpeed);
    } else if (isDeleting && displayText.length > 0) {
      timer = setTimeout(() => setDisplayText(full.slice(0, displayText.length - 1)), deleteSpeed);
    } else if (!isDeleting && displayText === full) {
      timer = setTimeout(() => setIsDeleting(true), pauseTime);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentPhraseIndex((p) => (p + 1) % phrases.length);
    }
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentPhraseIndex]);

  // Tab title typewriter
  useEffect(() => {
    let i = 0, isDel = false, idx = 0;
    let t: NodeJS.Timeout;
    const tick = () => {
      const full = phrases[idx] + ' ✦';
      if      (!isDel && i < full.length)      { document.title = full.slice(0, ++i); t = setTimeout(tick, typingSpeed); }
      else if (isDel  && i > 0)                { document.title = full.slice(0, --i); t = setTimeout(tick, deleteSpeed); }
      else if (!isDel && i === full.length)    { t = setTimeout(() => { isDel = true; tick(); }, pauseTime); }
      else                                     { isDel = false; idx = (idx + 1) % phrases.length; tick(); }
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="about"
      className={`min-h-screen flex flex-col items-center justify-center px-6 sm:px-8 pt-20 transition-opacity duration-1000 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="w-full max-w-5xl mx-auto text-center space-y-10 md:space-y-14">
        {/* Badge */}
        <div className="inline-block px-5 py-2 rounded-full border border-white/10 bg-white/5">
          <span className="text-sm sm:text-base text-gray-400 font-medium">Developer & Creator</span>
        </div>

        {/* Typewriter title */}
        <div className="flex justify-center items-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight font-mono">
            <span className="text-gradient inline-block text-center" style={{ minWidth: '18ch' }}>
              {displayText}<span className="animate-pulse">|</span>
            </span>
          </h1>
        </div>

        <p className="text-lg sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-4">
          Building the future with vibe coding
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200"
          >
            View Projects
          </button>

          {/* Start Hacking — terminal trigger */}
          <button
            onClick={onOpenTerminal}
            className="group flex items-center gap-2 px-6 py-2.5 rounded-lg border border-green-500/30 bg-green-500/5 text-sm text-green-400 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-300 transition-all duration-200 font-mono"
          >
            <FaTerminal className="text-xs group-hover:animate-pulse" />
            Start Hacking
          </button>
        </div>

        {/* Tech icons */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 pt-8 md:pt-10 max-w-4xl mx-auto">
          {technologies.map((tech, index) => (
            <div
              key={tech.name}
              className="group flex flex-col items-center gap-2"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="text-3xl sm:text-4xl text-gray-500 group-hover:text-white transition-all duration-300">
                {tech.icon}
              </div>
              <span className="text-xs sm:text-sm text-gray-600 group-hover:text-gray-400 transition-colors">
                {tech.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 sm:bottom-12 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}