'use client';

import { useEffect, useState, useMemo } from 'react';
import { colorFor } from '@/lib/lang-colors';
import { useReveal } from '@/lib/reveal';
import { useCountUp } from '@/lib/countup';

type Lang = { name: string; pct: number };
type Data = {
  login: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  totalStars: number;
  languages: Lang[];
};

const HEAT_COLORS = [
  'rgba(139, 92, 246, .05)',  // 0: casi invisible
  'rgba(139, 92, 246, .28)',  // 1: tenue
  'rgba(139, 92, 246, .5)',   // 2: medio
  'rgba(139, 92, 246, .75)',  // 3: fuerte
  '#a78bfa',                   // 4: intenso
];

type GitHubData = {
  repos: number;
  stars: number;
  followers: number;
  commitsPerYear: number;
  languages: { name: string; percentage: number; color: string }[];
  heatmap: number[];
};

function CountKpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="kpi" ref={ref}>
      <div className="lab">{label}</div>
      <div className={accent ? 'val g' : 'val'}>{shown.toLocaleString()}</div>
    </div>
  );
}

export default function GitHubSection() {
  const [data, setData] = useState<GitHubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reveal = useReveal<HTMLDivElement>();
  const kpiReveal = useReveal<HTMLDivElement>();
  const bentoReveal = useReveal<HTMLDivElement>();
  const langReveal = useReveal<HTMLDivElement>();
  const [langsIn, setLangsIn] = useState(false);

  useEffect(() => {
    const node = langReveal.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLangsIn(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setLangsIn(true); obs.unobserve(e.target); }
    }, { threshold: 0.25 });
    obs.observe(node);
    return () => obs.unobserve(node);
  }, [langReveal]);

  // Heatmap demo solo si el API no devuelve datos reales
  const generateHeatmap = useMemo(() => {
    return Array.from({ length: 196 }, () => Math.floor(Math.random() * 5));
  }, []);

  useEffect(() => {
    fetch('/api/github')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.data) {
          const apiData = j.data;
          // Transformar datos reales del API a nuestro formato
          const languages = (apiData.languages || []).map((l: Lang) => ({
            name: l.name,
            percentage: l.pct,
            color: colorFor(l.name),
          }));

          setData({
            repos: apiData.publicRepos || 0,
            stars: apiData.totalStars || 0,
            followers: apiData.followers || 0,
            commitsPerYear: apiData.commitsPerYear ?? 0,
            languages,
            heatmap: apiData.heatmap?.length ? apiData.heatmap : generateHeatmap,
          });
        } else {
          // Si no hay API, mostrar datos demo
          setData({
            repos: 24,
            stars: 158,
            followers: 42,
            commitsPerYear: 342,
            languages: [
              { name: 'TypeScript', percentage: 45, color: '#3178c6' },
              { name: 'JavaScript', percentage: 30, color: '#f1e05a' },
              { name: 'Rust', percentage: 15, color: '#dea584' },
              { name: 'Python', percentage: 10, color: '#3572A5' },
            ],
            heatmap: generateHeatmap,
          });
        }
      })
      .catch(() => {
        // Si falla el fetch, usar datos demo
        setData({
          repos: 24,
          stars: 158,
          followers: 42,
          commitsPerYear: 342,
          languages: [
            { name: 'TypeScript', percentage: 45, color: '#3178c6' },
            { name: 'JavaScript', percentage: 30, color: '#f1e05a' },
            { name: 'Rust', percentage: 15, color: '#dea584' },
            { name: 'Python', percentage: 10, color: '#3572A5' },
          ],
          heatmap: generateHeatmap,
        });
      });
  }, [generateHeatmap]);

  if (error) {
    return (
      <section id="github" className="sec">
        <div className="wrap">
          <p className="mono" style={{ color: 'var(--dim)', marginTop: '8px' }}>
            Error: {error}
          </p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section id="github" className="sec">
        <div className="wrap">
          <p className="mono" style={{ color: 'var(--dim)', marginTop: '8px' }}>
            Loading…
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="github" className="sec">
      <div className="wrap reveal" ref={reveal}>
        <span className="seclabel">GitHub</span>
        <div className="eyebrow mono">git log --stat</div>
        <h2 className="h2">GitHub activity</h2>

        {/* KPI tiles row */}
        <div className="row4 reveal reveal-stagger" ref={kpiReveal}>
          <CountKpi label="Repos" value={data.repos} />
          <CountKpi label="Stars" value={data.stars} accent />
          <CountKpi label="Followers" value={data.followers} />
          <CountKpi label="Commits/yr" value={data.commitsPerYear} />
        </div>

        {/* Bento con heatmap + lenguajes + KPIs */}
        <div className="ghbento reveal reveal-stagger" ref={bentoReveal}>
          <div className="card heatbig">
            <div className="cap">Contributions · last year</div>

            {/* Heatmap: grid 28×7 (4 semanas × 7 días) */}
            <div className="heat">
              {data.heatmap.map((intensity, i) => (
                <span
                  key={i}
                  style={{ background: HEAT_COLORS[Math.min(intensity, 4)] }}
                />
              ))}
            </div>

            {/* Language bar */}
            <div className="cap" style={{ marginTop: '20px' }}>
              Top languages
            </div>
            <div className="langbar" ref={langReveal}>
              {data.languages.map((lang) => (
                <span
                  key={lang.name}
                  style={{
                    width: langsIn ? `${lang.percentage}%` : 0,
                    background: lang.color,
                  }}
                />
              ))}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '13px',
                marginTop: '11px',
                fontSize: '11px',
                color: 'var(--mut)',
              }}
            >
              {data.languages.map((lang) => (
                <span key={lang.name}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '9px',
                      height: '9px',
                      borderRadius: '2px',
                      background: lang.color,
                      marginRight: '5px',
                    }}
                  />
                  {lang.name} {lang.percentage}%
                </span>
              ))}
            </div>
          </div>

          {/* KPI tiles alrededor del heatmap */}
          <CountKpi label="Repos" value={data.repos} />
          <CountKpi label="Stars" value={data.stars} accent />
          <CountKpi label="Followers" value={data.followers} />
          <CountKpi label="Commits/yr" value={data.commitsPerYear} />
        </div>
      </div>
    </section>
  );
}
