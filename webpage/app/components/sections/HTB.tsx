'use client';

import { useEffect, useState } from 'react';
import { useReveal } from '@/lib/reveal';
import { useCountUp } from '@/lib/countup';

type HTBProfile = {
  id: number;
  name: string;
  rank: string;
  points: number;
  user_owns: number;
  system_owns: number;
};

type DiffStat = {
  name: string;
  owned_machines: number;
  total_machines: number;
  completion_percentage: number;
};

type OSStat = {
  name: string;
  owned_machines: number;
  total_machines: number;
  completion_percentage: number;
};

type RecentOwn = { name: string; kind: 'user' | 'system' | 'both'; when: string };

type HTBResponse = {
  profile: HTBProfile | null;
  progress: {
    machine_owns: { solved: number; total: number; completion_percentage: number };
    machine_difficulties: DiffStat[];
    machine_os: OSStat[];
  } | null;
  recentOwns?: RecentOwn[];
  configured?: boolean;
};

function CountKpi({ label, value }: { label: string; value: number }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="htbkv" ref={ref}>
      <span className="k">{label}</span>
      <span className="v">{shown.toLocaleString()}</span>
    </div>
  );
}

function relDate(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}

const KIND_LABEL: Record<RecentOwn['kind'], string> = {
  both: 'user+system owned',
  system: 'system owned',
  user: 'user owned',
};
const KIND_COLOR: Record<RecentOwn['kind'], string> = {
  both: '#22c55e',
  system: '#5eead4',
  user: '#eab308',
};

/** A single terminal-style line that types itself in via CSS width/steps. */
function TermLine({ own, i }: { own: RecentOwn; i: number }) {
  const text = `▸ ${own.name} — ${KIND_LABEL[own.kind]} · ${relDate(own.when)}`;
  return (
    <div
      className="htbterm-line"
      style={{ '--chars': text.length, animationDelay: `${i * 260}ms` } as React.CSSProperties}
    >
      <span style={{ color: KIND_COLOR[own.kind] }}>{text}</span>
    </div>
  );
}

export default function HTB() {
  const [profile, setProfile] = useState<HTBProfile | null>(null);
  const [progress, setProgress] = useState<HTBResponse['progress']>(null);
  const [recentOwns, setRecentOwns] = useState<RecentOwn[]>([]);
  const [loading, setLoading] = useState(true);
  const reveal = useReveal<HTMLDivElement>();
  const heroReveal = useReveal<HTMLDivElement>();
  const barsReveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    fetch('/api/htb')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HTBResponse | null) => {
        if (data?.profile && data?.progress) {
          setProfile(data.profile);
          setProgress(data.progress);
          setRecentOwns(data.recentOwns ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // The wrap below stays mounted in every state (loading / empty / data) so
  // its ref is a single stable DOM node — useReveal's IntersectionObserver is
  // set up once on mount and must keep observing the same element, or it
  // never fires and the section stays permanently opacity:0.
  if (loading) {
    return (
      <section id="htb" className="sec">
        <div className="wrap reveal" ref={reveal}>
          <span className="seclabel">HackTheBox</span>
          <p className="mono" style={{ color: 'var(--dim)', marginTop: 12 }}>Loading…</p>
        </div>
      </section>
    );
  }

  // Not configured, or upstream unavailable. Show the section with an empty
  // state — never a status code, and never nothing at all.
  if (!profile || !progress) {
    return (
      <section id="htb" className="sec">
        <div className="wrap reveal" ref={reveal}>
          <span className="seclabel">HackTheBox</span>
          <div className="eyebrow mono">htb --stats</div>
          <h2 className="h2">HackTheBox</h2>
          <p className="mono" style={{ color: 'var(--dim)', marginTop: 14 }}>
            ◌ Sin datos por ahora.
          </p>
        </div>
      </section>
    );
  }

  const diffData = { easy: 0, medium: 0, hard: 0, insane: 0 };
  progress.machine_difficulties.forEach((d) => {
    const key = d.name.toLowerCase();
    if (key.includes('easy')) diffData.easy = d.owned_machines;
    else if (key.includes('medium')) diffData.medium = d.owned_machines;
    else if (key.includes('hard')) diffData.hard = d.owned_machines;
    else if (key.includes('insane')) diffData.insane = d.owned_machines;
  });

  const osData = { linux: 0, windows: 0, freebsd: 0, macos: 0 };
  progress.machine_os.forEach((o) => {
    const key = o.name.toLowerCase();
    if (key.includes('linux')) osData.linux = o.owned_machines;
    else if (key.includes('windows')) osData.windows = o.owned_machines;
    else if (key.includes('freebsd') || key.includes('bsd')) osData.freebsd = o.owned_machines;
    else if (key.includes('mac') || key.includes('osx')) osData.macos = o.owned_machines;
  });

  const totalDiff = diffData.easy + diffData.medium + diffData.hard + diffData.insane;
  const totalOS = osData.linux + osData.windows + osData.freebsd + osData.macos;

  // Ring: real % of the machine catalog owned (machine_owns.completion_percentage),
  // not a fabricated "progress to next rank" — HTB doesn't expose rank
  // thresholds through the API, so the ring only ever shows a number we can
  // actually stand behind.
  const pct = Math.min(100, progress.machine_owns.completion_percentage);
  const R = 46;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (pct / 100) * CIRC;

  return (
    <section id="htb" className="sec">
      <div className="wrap reveal" ref={reveal}>
        <span className="seclabel">HackTheBox</span>
        <div className="eyebrow">htb --stats</div>
        <h2 className="h2">HackTheBox</h2>

        {/* Hero: progress ring + inline KPIs, and the recent-owns terminal feed */}
        <div className="htbhero reveal reveal-stagger" style={{ marginTop: 24 }} ref={heroReveal}>
          <div className="htbring-wrap">
            <svg className="htbring" width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
              <circle
                className="prog"
                cx="60" cy="60" r={R} fill="none" stroke="#9fef00" strokeWidth="8"
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ strokeDasharray: CIRC, '--offset': `${offset}px` } as React.CSSProperties}
              />
              <text x="60" y="56" textAnchor="middle" className="rank">{profile.rank}</text>
              <text x="60" y="74" textAnchor="middle" className="pct">{pct}% owned</text>
            </svg>
            <div className="htbkvs">
              <CountKpi label="User owns" value={profile.user_owns} />
              <CountKpi label="System owns" value={profile.system_owns} />
              <CountKpi label="Points" value={profile.points} />
            </div>
          </div>

          <div className="htbterm">
            <div className="htbterm-head"><span className="dot r" /><span className="dot y" /><span className="dot g" /><span>htb --recent-owns</span></div>
            <div className="htbterm-body">
              {recentOwns.length > 0
                ? recentOwns.map((o, i) => <TermLine key={`${o.name}-${o.when}`} own={o} i={i} />)
                : <div className="htbterm-line" style={{ '--chars': 20 } as React.CSSProperties}>▸ sin actividad reciente</div>}
              <span className="htbterm-cursor">▍</span>
            </div>
          </div>
        </div>

        {/* Bar cards */}
        <div className="row2 reveal reveal-stagger" ref={barsReveal}>
          <div className="card">
            <div className="cap">Owns by difficulty</div>
            {[
              { label: 'Easy', value: diffData.easy, color: '#22c55e', total: totalDiff },
              { label: 'Medium', value: diffData.medium, color: '#eab308', total: totalDiff },
              { label: 'Hard', value: diffData.hard, color: '#f97316', total: totalDiff },
              { label: 'Insane', value: diffData.insane, color: '#ef4444', total: totalDiff },
            ].map(b => (
              <div key={b.label} className="bar">
                <div className="t">
                  <span className="n">{b.label}</span>
                  <span style={{ color: b.color }}>{b.value}</span>
                </div>
                <div className="track">
                  <div className="fill" style={{ '--w': `${totalDiff > 0 ? (b.value / totalDiff) * 100 : 0}%`, background: b.color } as React.CSSProperties}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="cap">Owns by OS</div>
            {[
              { label: 'Linux', value: osData.linux, color: '#5eead4', total: totalOS },
              { label: 'Windows', value: osData.windows, color: '#60a5fa', total: totalOS },
              { label: 'FreeBSD', value: osData.freebsd, color: '#f59e0b', total: totalOS },
              { label: 'macOS', value: osData.macos, color: '#9ca3af', total: totalOS },
            ].map(b => (
              <div key={b.label} className="bar">
                <div className="t">
                  <span className="n">{b.label}</span>
                  <span className="mono">{b.value}</span>
                </div>
                <div className="track">
                  <div className="fill" style={{ '--w': `${totalOS > 0 ? (b.value / totalOS) * 100 : 0}%`, background: b.color } as React.CSSProperties}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
