'use client';
import React, { useState, useEffect } from 'react';
import ScrambleText from '@/components/ScrambleText';
import { toAscii, loadImageToCanvas, generateAvatarCanvas } from '@/lib/ascii';
import { track } from '@/lib/track';
import { DEFAULT_PROJECTS } from '@/lib/content-constants';

type Project = {
  slug: string;
  name?: string;
  desc: string;
  status: 'done' | 'beta' | 'dev';
  ac: string;
  tags: string[];
  web?: string;
  shot?: string;
  stars?: number;
  forks?: number;
  langs?: [string, number, string][];
};

function wrapText(text: string, w: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  words.forEach((word) => {
    if ((cur + ' ' + word).trim().length > w) {
      if (cur) lines.push(cur.trim());
      cur = word;
    } else {
      cur = (cur + ' ' + word).trim();
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

export default function ProjectsSection() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS.map((p) => ({
    slug: p.slug,
    name: p.name,
    desc: p.desc,
    status: p.status,
    ac: p.ac,
    tags: p.tags,
    web: p.web,
    shot: p.shot,
  })));
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [commits, setCommits] = useState({ total: 1204, streak: 12, spark: [38, 60, 46, 78, 54, 92, 66, 100, 58, 84, 72, 88], live: false });

  // Fetch projects from KV with fallback to defaults
  useEffect(() => {
    fetch('/api/content/projects')
      .then((r) => r.ok ? r.json() : null)
      .then((d: Project[] | null) => {
        if (Array.isArray(d) && d.length) {
          setProjects(d);
        }
      })
      .catch(() => {});
  }, []);

  // Build ASCII logos per project (real logo file if present, else generated emblem)
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const pr of projects) {
        try {
          const canvas = await loadImageToCanvas(`/projects/${pr.slug}-logo.png`, 120, 120);
          out[pr.slug] = toAscii(canvas, 34, 13);
        } catch {
          try {
            const canvas = generateAvatarCanvas(pr.ac, pr.slug.slice(0, 2).toUpperCase(), 120, 120);
            out[pr.slug] = toAscii(canvas, 34, 13);
          } catch {
            out[pr.slug] = '';
          }
        }
      }
      if (alive) setLogos(out);
    })();
    return () => { alive = false; };
  }, [projects]);

  // Real GitHub activity (falls back to demo on failure)
  useEffect(() => {
    fetch('/api/github')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.data && typeof j.data.commitsPerYear === 'number') {
          setCommits({
            total: j.data.commitsPerYear,
            streak: j.data.streak ?? 0,
            spark: j.data.spark?.length ? j.data.spark : [],
            live: true,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as any).tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % projects.length);
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + projects.length) % projects.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects.length]);

  const p = projects[selectedIdx];
  const total = p.langs ? p.langs.reduce((s, l) => s + l[1], 0) : 0;

  return (
    <section id="projects" className="sec">
      <div className="wrap">
        <span className="seclabel">Projects</span>
        <div className="eyebrow mono">ls ~/projects</div>
        <h2 className="h2"><ScrambleText text="Selected work" /></h2>

        <div className="win" style={{ marginTop: '28px' }}>
          <div className="winbar">
            <div className="dots">
              <i className="r"></i>
              <i className="y"></i>
              <i className="g"></i>
            </div>
            <div className="wintitle"><b>s7lver@portfolio</b>:~$ projects</div>
            <div className="kbadge">lazygit-style</div>
          </div>
          <div className="tui" style={{ '--ac': p.ac } as React.CSSProperties}>
            <div className="tui-grid">
              <div className="pane left">
                <div className="pane-t"><span className="n">[1]</span> projects</div>
                <div className="lhdr"><span></span><span>NAME</span><span>STATUS</span></div>
                {projects.map((pr, i) => (
                  <div
                    key={pr.slug}
                    className={`prow ${i === selectedIdx ? 'on' : ''}`}
                    onMouseEnter={() => setSelectedIdx(i)}
                    onClick={() => {
                      setSelectedIdx(i);
                      if (pr.web) {
                        track('project_click', { detail: pr.slug });
                      }
                    }}
                  >
                    <span className="car">▶</span>
                    <span className="pn">{pr.slug}</span>
                    <span className="pst">{pr.status}</span>
                  </div>
                ))}
              </div>
              <div className="pane right active">
                <div className="pane-t"><span className="n">[2]</span> {p.slug}/README.md</div>
                {logos[p.slug] && (
                  <pre className="batlogo" style={{ color: p.ac }}>{logos[p.slug]}</pre>
                )}
                <div className="bat">
                  <div className="bl">
                    <span className="bln">1</span>
                    <span className="bc mdh1"><span className="hh"># </span>{p.slug}</span>
                  </div>
                  <div className="bl"><span className="bln">2</span><span className="bc"></span></div>
                  {wrapText(p.desc, 48).map((ln, i) => (
                    <div key={i} className="bl">
                      <span className="bln">{3 + i}</span>
                      <span className="bc">{ln}</span>
                    </div>
                  ))}
                  <div className="bl"><span className="bln">{5 + wrapText(p.desc, 48).length}</span><span className="bc"></span></div>
                  <div className="bl">
                    <span className="bln">{6 + wrapText(p.desc, 48).length}</span>
                    <span className="bc mdh2">## languages</span>
                  </div>
                  {(p.langs || []).map((lang, i) => {
                    const f = Math.round((lang[1] / 100) * 16);
                    const bar = '█'.repeat(f) + '░'.repeat(16 - f);
                    return (
                      <div key={lang[0]} className="bl">
                        <span className="bln">{7 + wrapText(p.desc, 48).length + i}</span>
                        <span className="bc">
                          {lang[0].padEnd(11, ' ')}
                          <span className="blk" style={{ color: lang[2] }}>{bar}</span> {lang[1]}%
                        </span>
                      </div>
                    );
                  })}
                  <div className="bl">
                    <span className="bln">{7 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"></span>
                  </div>
                  <div className="bl">
                    <span className="bln">{8 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc mdh2">## meta</span>
                  </div>
                  <div className="bl">
                    <span className="bln">{9 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"><span className="b">·</span> stars   <span className="num">{p.stars || 0}</span></span>
                  </div>
                  <div className="bl">
                    <span className="bln">{10 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"><span className="b">·</span> forks   <span className="num">{p.forks || 0}</span></span>
                  </div>
                  <div className="bl">
                    <span className="bln">{11 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"><span className="b">·</span> status  <span className="k2">{p.status}</span></span>
                  </div>
                  <div className="bl">
                    <span className="bln">{12 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"><span className="b">·</span> stack   {p.tags.map((t) => <span key={t} className="str">{t}</span>)}</span>
                  </div>
                  <div className="bl">
                    <span className="bln">{13 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"></span>
                  </div>
                  <div className="bl">
                    <span className="bln">{14 + wrapText(p.desc, 48).length + (p.langs?.length || 0)}</span>
                    <span className="bc"><span className="k2">$</span> git clone <span className="str">git@github.com:s7lver2/{p.slug}.git</span><span className="batcur"></span></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="statusline">
              <span className="sl-mode">NORMAL</span>
              <span className="sl-ctx">~/projects/{p.slug}</span>
              <span className="sl-ctx">{selectedIdx + 1}/{projects.length}</span>
              <span className="sl-keys">
                <span><b>↑↓</b> move</span>
                <span><b>↵</b> open</span>
                <span><b>/</b> filter</span>
              </span>
            </div>
          </div>
        </div>

        <div className="commits">
          <div className="cblock">
            <div className="path mono">~/<b>commits</b> --year</div>
            <div className="big grad">{commits.total.toLocaleString()}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--dim)' }}>
              🔥 {commits.streak}-day streak{!commits.live && ' · demo'}
            </div>
          </div>
          {commits.spark.length > 0 && (
            <div className="spark">
              {commits.spark.map((h, i) => (
                <i key={i} style={{ height: `${h}%` }}></i>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}