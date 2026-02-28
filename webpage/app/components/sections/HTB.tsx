'use client';
import { useEffect, useState } from 'react';
import { FaShieldAlt, FaFlag, FaSkull, FaTrophy, FaExternalLinkAlt, FaLinux, FaWindows, FaApple } from 'react-icons/fa';
import { SiFreebsd } from 'react-icons/si';

interface HTBProfile {
  id:          number;
  name:        string;
  rank:        string | number;
  points:      number;
  user_owns:   number;
  system_owns: number;
}

interface DiffStat {
  name:                  string;
  owned_machines:        number;
  total_machines:        number;
  completion_percentage: number;
}

interface OSStat {
  name:                  string;
  owned_machines:        number;
  total_machines:        number;
  completion_percentage: number;
}

interface HTBProgress {
  solved_tasks:         number;
  machine_owns:         { solved: number; total: number; completion_percentage: number };
  machine_difficulties: DiffStat[];
  machine_os:           OSStat[];
}

const diffColor: Record<string, string> = {
  easy:   'bg-green-400',
  medium: 'bg-yellow-400',
  hard:   'bg-red-400',
  insane: 'bg-purple-400',
};

const diffText: Record<string, string> = {
  easy:   'text-green-400',
  medium: 'text-yellow-400',
  hard:   'text-red-400',
  insane: 'text-purple-400',
};

function OSIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('windows')) return <FaWindows className="text-blue-400 shrink-0" />;
  if (n.includes('mac') || n.includes('osx')) return <FaApple className="text-gray-300 shrink-0" />;
  if (n.includes('free') || n.includes('bsd')) return <SiFreebsd className="text-red-400 shrink-0" />;
  return <FaLinux className="text-orange-400 shrink-0" />;
}

export default function HTBSection() {
  const [profile,  setProfile]  = useState<HTBProfile | null>(null);
  const [progress, setProgress] = useState<HTBProgress | null>(null);
  const [status,   setStatus]   = useState<'loading' | 'ok' | 'error'>('loading');
  const [errMsg,   setErrMsg]   = useState('');

  useEffect(() => {
    fetch('/api/htb')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.message ?? `HTTP ${r.status}`);
        return data;
      })
      .then((data) => {
        setProfile(data.profile ?? null);
        setProgress(data.progress ?? null);
        setStatus('ok');
      })
      .catch((e) => {
        setErrMsg(e.message);
        setStatus('error');
      });
  }, []);

  return (
    <section id="htb" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full border border-green-500/20 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400 tracking-widest uppercase">
              platform: hackthebox
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">HTB Stats</h2>
          <p className="text-gray-500 font-mono text-sm">// s7lver's hacking progress</p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 animate-pulse h-24" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
            <FaSkull className="text-4xl text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No se pudo conectar con HTB.</p>
            {errMsg && <p className="text-gray-700 text-xs font-mono mb-4">{errMsg}</p>}
            <a
              href="https://app.hackthebox.com/profile/1584434"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              Ver perfil en HTB <FaExternalLinkAlt className="text-xs" />
            </a>
          </div>
        )}

        {/* Data */}
        {status === 'ok' && profile && (
          <>
            {/* ── Stats cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Rank',         value: profile.rank,                          icon: <FaTrophy /> },
                { label: 'User Owns',    value: profile.user_owns,                     icon: <FaFlag /> },
                { label: 'System Owns',  value: profile.system_owns,                   icon: <FaSkull /> },
                { label: 'Points',       value: profile.points,                        icon: <FaShieldAlt /> },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                  <div className="text-green-400 text-xl mb-2 flex justify-center">{s.icon}</div>
                  <div className="text-2xl font-bold text-white font-mono mb-1">{s.value ?? '—'}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {progress && (
              <div className="grid md:grid-cols-2 gap-6">

                {/* ── Dificultades ── */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-5">
                    By Difficulty
                  </h3>
                  <div className="space-y-4">
                    {progress.machine_difficulties.map((d) => {
                      const key = d.name.toLowerCase();
                      return (
                        <div key={d.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-mono font-semibold ${diffText[key] ?? 'text-gray-400'}`}>
                              {d.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              {d.owned_machines} / {d.total_machines}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${diffColor[key] ?? 'bg-gray-400'}`}
                              style={{ width: `${Math.min(d.completion_percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── OS ── */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest mb-5">
                    By OS
                  </h3>
                  <div className="space-y-4">
                    {progress.machine_os
                      .filter((o) => o.owned_machines > 0)
                      .map((o) => (
                        <div key={o.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="flex items-center gap-2 text-xs font-mono text-gray-300">
                              <OSIcon name={o.name} />
                              {o.name}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              {o.owned_machines} owned
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-400/70 transition-all duration-700"
                              style={{ width: `${Math.min(o.completion_percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* HTB profile link */}
            <div className="text-center mt-8">
              <a
                href={`https://app.hackthebox.com/profile/${profile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-400 transition-colors font-mono"
              >
                @{profile.name} on HackTheBox <FaExternalLinkAlt className="text-xs" />
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}