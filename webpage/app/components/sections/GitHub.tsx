'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { colorFor } from '@/lib/lang-colors';
import { useReveal } from '@/lib/reveal';
import { useCountUp } from '@/lib/countup';
import LocCounter from './LocCounter';

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

const HEATMAP_WEEKS = 53;
const HEATMAP_CELLS = HEATMAP_WEEKS * 7; // 371 — a real year, unlike the old 196

type HeatCell = {
  date: string;
  level: number;
  count: number;
  /** null = the cron job hasn't seen public-event data for this day yet. */
  repos: string[] | null;
};

// Deterministic pseudo-random so SSR and the client produce the same grid.
function demoHeatmap(): HeatCell[] {
  const out: HeatCell[] = [];
  let seed = 1337;
  const today = new Date();
  for (let i = 0; i < HEATMAP_CELLS; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const level = seed % 5;
    const d = new Date(today);
    d.setDate(d.getDate() - (HEATMAP_CELLS - 1 - i));
    out.push({ date: d.toISOString().slice(0, 10), level, count: level * 2, repos: null });
  }
  return out;
}

function toYear(cells: HeatCell[]): HeatCell[] {
  if (cells.length >= HEATMAP_CELLS) return cells.slice(cells.length - HEATMAP_CELLS);
  const pad: HeatCell[] = Array.from({ length: HEATMAP_CELLS - cells.length }, () => ({
    date: '', level: 0, count: 0, repos: null,
  }));
  return [...pad, ...cells];
}

type GitHubData = {
  repos: number;
  stars: number;
  followers: number;
  commitsPerYear: number;
  languages: { name: string; percentage: number; color: string }[];
  heatmapDays: HeatCell[];
  /** repo full_name -> primary language, for the hover cross-highlight. */
  repoLangs: Record<string, string>;
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

function relDate(dateStr: string): string {
  if (!dateStr) return '';
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}

export default function GitHubSection() {
  const [data, setData] = useState<GitHubData | null>(null);
  const reveal = useReveal<HTMLDivElement>();
  const kpiReveal = useReveal<HTMLDivElement>();
  const bentoReveal = useReveal<HTMLDivElement>();
  const langReveal = useReveal<HTMLDivElement>();
  const [langsIn, setLangsIn] = useState(false);
  const [tip, setTip] = useState<string>('');
  const heatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // .langbar only exists once `data` is loaded, so this must re-run when
    // data arrives — deps of just [langReveal] never change (it's a stable
    // ref object) and the effect would fire once against a still-null node.
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
  }, [langReveal, data]);

  // Heatmap demo solo si el API no devuelve datos reales.
  // Deterministic (not Math.random) so SSR and the client agree — otherwise
  // React logs a hydration mismatch on every load.
  const generateHeatmap = useMemo(() => demoHeatmap(), []);

  useEffect(() => {
    fetch('/api/github')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.data) {
          const apiData = j.data;
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
            heatmapDays: apiData.heatmapDays?.length ? toYear(apiData.heatmapDays) : generateHeatmap,
            repoLangs: apiData.repoLangs || {},
          });
        } else {
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
            heatmapDays: generateHeatmap,
            repoLangs: {},
          });
        }
      })
      .catch(() => {
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
          heatmapDays: generateHeatmap,
          repoLangs: {},
        });
      });
  }, [generateHeatmap]);

  // Hover a language (legend or bar segment) → light up only the cells whose
  // repos use it, dim everything else — INCLUDING cells with no attribution
  // yet, per the explicit call: unattributed cells don't get a free pass.
  //
  // Cells carry an entrance animation (cell-in) followed by an infinite
  // ambient shimmer (heat-shimmer) — both animate `opacity`. Per the CSS
  // cascade, a running (or even paused) animation's effect on a property
  // outranks a plain inline style write to that same property; pausing the
  // animation does NOT hand control back to JS, it just freezes the
  // animation's current value. The only thing that outranks an animation
  // is an `!important` declaration, so that's what this sets — a plain
  // `el.style.opacity = ...` here would silently do nothing.
  const highlightLang = (lang: string | null) => {
    const container = heatRef.current;
    if (!container) return;
    const cells = container.querySelectorAll<HTMLElement>('.hcell');
    cells.forEach((el) => {
      if (!lang) { el.style.removeProperty('opacity'); return; }
      const langs = el.dataset.langs ? el.dataset.langs.split('|') : [];
      el.style.setProperty('opacity', langs.includes(lang) ? '1' : '.14', 'important');
    });
  };

  // This wrap stays mounted across the loading -> loaded transition so its
  // ref is a single stable DOM node — useReveal's IntersectionObserver is
  // set up once on mount and must keep observing the same element, or it
  // never fires and the section stays permanently opacity:0 (invisible).
  if (!data) {
    return (
      <section id="github" className="sec">
        <div className="wrap reveal" ref={reveal}>
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
            <div className="cap" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>Contributions · last year</span>
              <span className="mono" style={{ color: 'var(--dim)', fontSize: 11, minHeight: 14 }}>{tip}</span>
            </div>

            {/* Heatmap: grid 53×7. Each cell knows which repos (if any) the
                cron job has attributed to it, and lights up on language hover. */}
            <div className="heat" ref={heatRef}>
              {data.heatmapDays.map((cell, i) => {
                const langs = (cell.repos ?? [])
                  .map((r) => data.repoLangs[r])
                  .filter(Boolean) as string[];
                return (
                  <span
                    key={i}
                    className="hcell"
                    data-langs={langs.join('|')}
                    style={{
                      background: HEAT_COLORS[Math.min(cell.level, 4)],
                      outline: cell.repos ? '1px dashed rgba(94,234,212,.45)' : undefined,
                      outlineOffset: cell.repos ? -1 : undefined,
                      ['--i' as string]: i,
                    }}
                    onMouseEnter={() => {
                      if (!cell.date) return;
                      if (!cell.repos || !cell.repos.length) {
                        setTip(`${relDate(cell.date)} · ${cell.count} commits · sin datos de atribución todavía`);
                        return;
                      }
                      // We only know which repos were touched that day, not the
                      // real line-level diff per repo — so this is a share of
                      // that day's REPOS per language, not a byte-precise
                      // share of lines. Labelled "repos" in the tooltip so it
                      // never overclaims a precision we don't have.
                      const tally: Record<string, number> = {};
                      cell.repos.forEach((r) => {
                        const l = data.repoLangs[r];
                        if (l) tally[l] = (tally[l] || 0) + 1;
                      });
                      const entries = Object.entries(tally);
                      const langPct = entries.length
                        ? ' · ' + entries
                            .sort((a, b) => b[1] - a[1])
                            .map(([l, n]) => `${l} ${Math.round((n / cell.repos!.length) * 100)}%`)
                            .join(', ')
                        : '';
                      setTip(`${relDate(cell.date)} · ${cell.count} commits · ${cell.repos.join(', ')}${langPct}`);
                    }}
                    onMouseLeave={() => setTip('')}
                  />
                );
              })}
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
                  onMouseEnter={() => highlightLang(lang.name)}
                  onMouseLeave={() => highlightLang(null)}
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
                <span
                  key={lang.name}
                  onMouseEnter={() => highlightLang(lang.name)}
                  onMouseLeave={() => highlightLang(null)}
                  style={{ cursor: 'default' }}
                >
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

          <LocCounter />
        </div>
      </div>
    </section>
  );
}
