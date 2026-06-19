'use client';
import React, { useEffect, useState } from 'react';
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
  span: 'p1' | 'p2' | 'p3' | 'p4';
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
    span: 'p1',
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
    span: 'p2',
  },
  {
    slug: 'tsuki',
    name: 'tsuki',
    desc: 'Arduino compiler & toolchain — tiny language to optimized AVR code.',
    status: 'dev',
    ac: '#dea584',
    tags: ['Rust', 'LLVM', 'Embedded'],
    span: 'p3',
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
    span: 'p4',
  },
];

function generateScreenshot(accentColor: string): string {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = 440;
  c.height = 300;
  const x = c.getContext('2d');
  if (!x) return '';

  x.fillStyle = '#0c0c12';
  x.fillRect(0, 0, 440, 300);

  x.fillStyle = '#15151d';
  x.fillRect(0, 0, 440, 30);

  x.fillStyle = accentColor;
  x.beginPath();
  x.arc(18, 15, 5, 0, Math.PI * 2);
  x.fill();

  x.fillStyle = '#2a2a35';
  x.fillRect(44, 10, 140, 10);

  const g = x.createLinearGradient(0, 30, 440, 180);
  g.addColorStop(0, accentColor);
  g.addColorStop(1, '#0c0c12');
  x.globalAlpha = 0.55;
  x.fillStyle = g;
  x.fillRect(0, 30, 440, 150);
  x.globalAlpha = 1;

  x.fillStyle = '#fff';
  x.fillRect(34, 74, 210, 24);
  x.fillStyle = 'rgba(255,255,255,.6)';
  x.fillRect(34, 110, 280, 11);
  x.fillRect(34, 128, 190, 11);

  x.fillStyle = accentColor;
  x.fillRect(34, 156, 96, 28);

  for (let i = 0; i < 3; i++) {
    x.fillStyle = '#16161f';
    x.fillRect(34 + i * 134, 212, 116, 66);
    x.globalAlpha = 0.7;
    x.fillStyle = accentColor;
    x.fillRect(46 + i * 134, 224, 32, 8);
    x.globalAlpha = 1;
    x.fillStyle = '#2a2a35';
    x.fillRect(46 + i * 134, 240, 86, 7);
    x.fillRect(46 + i * 134, 252, 64, 7);
  }

  return c.toDataURL();
}

export default function Projects() {
  const reveal = useReveal();

  return (
    <section id="projects" className="sec">
      <div className="wrap" ref={reveal}>
        <span className="seclabel">Projects</span>
        <div className="eyebrow mono">ls ~/projects</div>
        <h2 className="h2">Selected work</h2>

        <div className="bento">
          {PROJECTS.map((p) => {
            const screenshotUrl = p.shot ? p.shot : generateScreenshot(p.ac);
            return (
              <div
                key={p.slug}
                className={`tile ${p.span} ${p.web ? 'web' : ''}`}
                style={{ '--ac': p.ac } as React.CSSProperties}
              >
                {p.web && (
                  <>
                    <div className="shot" style={{ backgroundImage: `url(${screenshotUrl})` }}></div>
                    <div className="shade"></div>
                    <span className="live">↗ live</span>
                  </>
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
          })}

          <div className="tile p5" style={{ '--ac': '#8b5cf6' } as React.CSSProperties}>
            <div>
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
      </div>
    </section>
  );
}