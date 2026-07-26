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

type HTBResponse = {
  profile: HTBProfile | null;
  progress: {
    machine_difficulties: DiffStat[];
    machine_os: OSStat[];
  } | null;
  configured?: boolean;
};

function CountKpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="kpi" ref={ref}>
      <div className="lab">{label}</div>
      <div className="val">{shown.toLocaleString()}</div>
      {sub && <div className="dd">{sub}</div>}
    </div>
  );
}

export default function HTB() {
  const [profile, setProfile] = useState<HTBProfile | null>(null);
  const [progress, setProgress] = useState<{ machine_difficulties: DiffStat[]; machine_os: OSStat[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const reveal = useReveal<HTMLDivElement>();
  const kpiReveal = useReveal<HTMLDivElement>();
  const barsReveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    fetch('/api/htb')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HTBResponse | null) => {
        if (data?.profile && data?.progress) {
          setProfile(data.profile);
          setProgress(data.progress);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section id="htb" className="sec">
        <div className="wrap">
          <span className="seclabel">HackTheBox</span>
          <p className="mono" style={{ color: 'var(--dim)', marginTop: 12 }}>Loading…</p>
        </div>
      </section>
    );
  }

  // Not configured, or upstream unavailable: render nothing rather than an error.
  if (!profile || !progress) return null;

  // Mapear dificultades del API a nuestro formato
  const diffMap: Record<string, keyof typeof diffData> = {};
  let diffData = {
    easy: 0,
    medium: 0,
    hard: 0,
    insane: 0,
  };

  progress.machine_difficulties.forEach((d) => {
    const key = d.name.toLowerCase();
    if (key.includes('easy')) diffData.easy = d.owned_machines;
    else if (key.includes('medium')) diffData.medium = d.owned_machines;
    else if (key.includes('hard')) diffData.hard = d.owned_machines;
    else if (key.includes('insane')) diffData.insane = d.owned_machines;
  });

  // Mapear OSs
  let osData = {
    linux: 0,
    windows: 0,
    freebsd: 0,
    macos: 0,
  };

  progress.machine_os.forEach((o) => {
    const key = o.name.toLowerCase();
    if (key.includes('linux')) osData.linux = o.owned_machines;
    else if (key.includes('windows')) osData.windows = o.owned_machines;
    else if (key.includes('freebsd') || key.includes('bsd')) osData.freebsd = o.owned_machines;
    else if (key.includes('mac') || key.includes('osx')) osData.macos = o.owned_machines;
  });

  const totalDiff = diffData.easy + diffData.medium + diffData.hard + diffData.insane;
  const totalOS = osData.linux + osData.windows + osData.freebsd + osData.macos;

  return (
    <section id="htb" className="sec">
      <div className="wrap reveal" ref={reveal}>
        <span className="seclabel">HackTheBox</span>
        <div className="eyebrow">htb --stats</div>
        <h2 className="h2">HackTheBox</h2>

        {/* KPI tiles */}
        <div className="row4 reveal reveal-stagger" ref={kpiReveal}>
          <div className="kpi">
            <div className="lab">Rank</div>
            <div className="val g">{profile.rank}</div>
            <div className="dd">▲ top 4%</div>
          </div>
          <CountKpi label="User owns" value={profile.user_owns} sub="+6 week" />
          <CountKpi label="System owns" value={profile.system_owns} sub="+4 week" />
          <CountKpi label="Points" value={profile.points} sub="▲ climbing" />
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
              { label: 'Linux', value: osData.linux, color: 'linear-gradient(90deg, #8b5cf6, #3b82f6)', total: totalOS },
              { label: 'Windows', value: osData.windows, color: 'linear-gradient(90deg, #8b5cf6, #3b82f6)', total: totalOS },
              { label: 'FreeBSD', value: osData.freebsd, color: 'linear-gradient(90deg, #8b5cf6, #3b82f6)', total: totalOS },
              { label: 'macOS', value: osData.macos, color: 'linear-gradient(90deg, #8b5cf6, #3b82f6)', total: totalOS },
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