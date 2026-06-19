'use client';
import React from 'react';
import { useReveal } from '@/lib/reveal';

type Project = {
  slug: string;
  name: string;
  desc: string;
  status: 'done' | 'beta' | 'dev';
  ac: string;
  tags: string[];
  web?: string;
  shot?: string;
};

const PROJECTS: Project[] = [
  {
    slug: 'file-meet',
    name: 'file-meet',
    desc: 'P2P file sharing CLI in Go. Zero config, end-to-end encrypted transfers over a single command.',
    status: 'done',
    ac: '#00add8',
    tags: ['Go', 'WebRTC', 'CLI'],
    web: 'https://github.com/s7lver2/file-meet',
    shot: '/projects/file-meet.png',
  },
  {
    slug: 'ZephyrOS',
    name: 'ZephyrOS',
    desc: 'Minimal security-focused Linux distro for old systems and edge computing.',
    status: 'beta',
    ac: '#a3e635',
    tags: ['Linux', 'Bash', 'Arch'],
    web: 'https://github.com/s7lver2/ZephyrOS',
    shot: '/projects/ZephyrOS.png',
  },
  {
    slug: 'tsuki',
    name: 'tsuki',
    desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.',
    status: 'dev',
    ac: '#dea584',
    tags: ['Rust', 'LLVM', 'Embedded'],
  },
  {
    slug: 'CodeDotJS',
    name: 'CodeDotJS',
    desc: 'Reactive JS framework, no vDOM, <5kb.',
    status: 'dev',
    ac: '#3178c6',
    tags: ['TypeScript', 'Vite'],
    web: 'https://CodeDotjs.vercel.app',
    shot: '/projects/CodeDotJS.png',
  },
];

function Card({ p }: { p: Project }) {
  return (
    <div className="pcard" style={{ '--ac': p.ac } as React.CSSProperties}>
      {p.shot && (
        <div className="pthumb">
          <img src={p.shot} alt={p.name} loading="lazy" />
          <div className="pwin"></div>
          {p.web && <span className="plive">↗ live</span>}
        </div>
      )}
      {!p.shot && (
        <div className="pthumb">
          <div className="pgrad"></div>
          <div className="pwin"></div>
        </div>
      )}

      <span className={`st2 s-${p.status}`}>{p.status}</span>
      <div className="path mono">~/projects/<b>{p.slug}</b></div>
      <div className="nm">{p.name}</div>
      <div className="de">{p.desc}</div>
      <div className="tw">
        {p.tags.map((t) => (
          <span key={t} className="tg">{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsSection() {
  const reveal = useReveal();

  return (
    <section id="projects" className="sec">
      <div className="wrap" ref={reveal}>
        <span className="seclabel">Projects</span>
        <div className="eyebrow mono">ls ~/projects</div>
        <h2 className="h2">Selected work</h2>

        <div className="pmarq">
          <div className="ptrack">
            {PROJECTS.map((p) => (
              <Card key={p.slug} p={p} />
            ))}
            {PROJECTS.map((p) => (
              <Card key={`${p.slug}-clone`} p={p} />
            ))}
          </div>
        </div>

        <div className="commits">
          <div className="cblock">
            <div className="path mono">~/<b>commits</b> --year</div>
            <div className="big grad">1,204</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--dim)' }}>🔥 12-day streak</div>
          </div>
          <div className="spark">
            {[38, 60, 46, 78, 54, 92, 66, 100, 58, 84, 72, 88].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }}></i>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}