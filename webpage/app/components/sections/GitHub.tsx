'use client';

import { useEffect, useState, useMemo } from 'react';
import { colorFor } from '@/lib/lang-colors';

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

export default function GitHubSection() {
  const [data, setData] = useState<GitHubData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="wrap">
        <span className="seclabel">GitHub</span>
        <div className="eyebrow mono">git log --stat</div>
        <h2 className="h2">GitHub activity</h2>

        {/* KPI tiles row */}
        <div className="row4">
          <div className="kpi">
            <div className="lab">Repos</div>
            <div className="val">{data.repos}</div>
          </div>
          <div className="kpi">
            <div className="lab">Stars</div>
            <div className="val g">{data.stars}</div>
          </div>
          <div className="kpi">
            <div className="lab">Followers</div>
            <div className="val">{data.followers}</div>
          </div>
          <div className="kpi">
            <div className="lab">Commits/yr</div>
            <div className="val">{data.commitsPerYear}</div>
          </div>
        </div>

        {/* Bento con heatmap + lenguajes + KPIs */}
        <div className="ghbento">
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
            <div className="langbar">
              {data.languages.map((lang) => (
                <span
                  key={lang.name}
                  style={{
                    width: `${lang.percentage}%`,
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
          <div className="kpi">
            <div className="lab">Repos</div>
            <div className="val">{data.repos}</div>
          </div>
          <div className="kpi">
            <div className="lab">Stars</div>
            <div className="val g">{data.stars}</div>
          </div>
          <div className="kpi">
            <div className="lab">Followers</div>
            <div className="val">{data.followers}</div>
          </div>
          <div className="kpi">
            <div className="lab">Commits/yr</div>
            <div className="val">{data.commitsPerYear}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
