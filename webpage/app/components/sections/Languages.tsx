'use client';
import { SiTypescript, SiNextdotjs, SiRust, SiGo, SiPython, SiJavascript, SiReact, SiCss3, SiDocker, SiLinux, SiGit, SiPostgresql } from 'react-icons/si';
import { useReveal } from '@/lib/reveal';
import ScrambleText from '@/components/ScrambleText';

interface Language {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const TOOLS: Language[] = [
  { name: 'TypeScript', icon: <SiTypescript />, color: '#3178c6' },
  { name: 'Next.js', icon: <SiNextdotjs />, color: '#ffffff' },
  { name: 'Rust', icon: <SiRust />, color: '#dea584' },
  { name: 'Go', icon: <SiGo />, color: '#00add8' },
  { name: 'Python', icon: <SiPython />, color: '#3776ab' },
  { name: 'JavaScript', icon: <SiJavascript />, color: '#f7df1e' },
  { name: 'React', icon: <SiReact />, color: '#61dafb' },
  { name: 'CSS3', icon: <SiCss3 />, color: '#1572b6' },
  { name: 'Docker', icon: <SiDocker />, color: '#2496ed' },
  { name: 'Linux', icon: <SiLinux />, color: '#fcc624' },
  { name: 'Git', icon: <SiGit />, color: '#f05032' },
  { name: 'PostgreSQL', icon: <SiPostgresql />, color: '#4169e1' },
];

export default function LanguagesSection() {
  const reveal = useReveal();

  return (
    <section id="languages" className="section py-24 px-4">
      <div className="wrap">
        <div ref={reveal} className="reveal">
          <div className="eyebrow">ls -la tech/</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-2"><ScrambleText text="Languages & tools" /></h2>

          <div className="toolsmarq">
            <div className="toolstrack">
              {[...TOOLS, ...TOOLS].map((tool, idx) => (
                <div
                  key={idx}
                  className="toolbox"
                  style={{ '--gc': tool.color } as React.CSSProperties}
                  title={tool.name}
                >
                  {tool.icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
