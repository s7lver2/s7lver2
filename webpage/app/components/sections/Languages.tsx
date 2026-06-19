'use client';
import { SiTypescript, SiNextdotjs, SiRust, SiGo, SiPython, SiJavascript, SiReact, SiCss3, SiDocker, SiLinux, SiGit, SiPostgresql } from 'react-icons/si';
import { useReveal } from '@/lib/reveal';

interface Language {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const ROW_A: Language[] = [
  { name: 'TypeScript', icon: <SiTypescript />, color: '#3178c6' },
  { name: 'Next.js', icon: <SiNextdotjs />, color: '#ffffff' },
  { name: 'Rust', icon: <SiRust />, color: '#dea584' },
  { name: 'Go', icon: <SiGo />, color: '#00add8' },
  { name: 'Python', icon: <SiPython />, color: '#3776ab' },
  { name: 'JavaScript', icon: <SiJavascript />, color: '#f7df1e' },
];

const ROW_B: Language[] = [
  { name: 'React', icon: <SiReact />, color: '#61dafb' },
  { name: 'CSS3', icon: <SiCss3 />, color: '#1572b6' },
  { name: 'Docker', icon: <SiDocker />, color: '#2496ed' },
  { name: 'Linux', icon: <SiLinux />, color: '#fcc624' },
  { name: 'Git', icon: <SiGit />, color: '#f05032' },
  { name: 'PostgreSQL', icon: <SiPostgresql />, color: '#4169e1' },
];

function MarqueeRow({ languages, isEven }: { languages: Language[]; isEven: boolean }) {
  const doubled = [...languages, ...languages];

  return (
    <div className="mrow">
      <div className="mtrack">
        {doubled.map((lang, idx) => (
          <div key={idx} className="lang" style={{ '--lc': lang.color } as React.CSSProperties}>
            <div className="lic">{lang.icon}</div>
            <span>{lang.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LanguagesSection() {
  const reveal = useReveal();

  return (
    <section id="languages" className="section py-24 px-4">
      <div className="wrap">
        <div ref={reveal} className="reveal">
          {/* Eyebrow */}
          <div className="eyebrow">ls -la tech/</div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Languages & tools</h2>

          {/* Marquee */}
          <div className="marq">
            <MarqueeRow languages={ROW_A} isEven={false} />
            <MarqueeRow languages={ROW_B} isEven={true} />
          </div>
        </div>
      </div>
    </section>
  );
}
