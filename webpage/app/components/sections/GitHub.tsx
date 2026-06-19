'use client';
import { useEffect, useState } from 'react';
import { FaGithub, FaStar, FaUsers, FaBook } from 'react-icons/fa';
import { useReveal } from '@/lib/reveal';

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

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Go: '#00add8',
  Python: '#3572A5',
  C: '#555555',
  'C++': '#f34b7d',
  Shell: '#89e051',
};
const colorFor = (name: string) => LANG_COLORS[name] || '#a371f7';

export default function GitHubSection() {
  const reveal = useReveal();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');

  useEffect(() => {
    fetch('/api/github')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setData(j.data);
          setState('ok');
        } else {
          setState('error');
        }
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <section id="github" className="section">
      <div className="container-page">
        <div ref={reveal} className="reveal">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-gradient">GitHub</span> activity
          </h2>
          <p className="text-gray-400 mb-8">Open source &amp; code stats.</p>
        </div>

        {state === 'loading' && (
          <p className="text-gray-500 font-mono text-sm">Loading GitHub stats…</p>
        )}
        {state === 'error' && (
          <p className="text-gray-500 font-mono text-sm">
            GitHub stats unavailable right now.
          </p>
        )}

        {state === 'ok' && data && (
          <div ref={reveal} className="reveal">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: <FaBook />, label: 'Public repos', value: data.publicRepos },
                { icon: <FaStar />, label: 'Total stars', value: data.totalStars },
                { icon: <FaUsers />, label: 'Followers', value: data.followers },
                { icon: <FaGithub />, label: 'Following', value: data.following },
              ].map((k) => (
                <div key={k.label} className="card-glass card-hover p-5">
                  <div className="text-primary-purple text-lg mb-2">{k.icon}</div>
                  <div className="text-2xl font-bold">{k.value.toLocaleString()}</div>
                  <div className="text-gray-500 font-mono text-xs mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {data.languages.length > 0 && (
              <div className="card-glass p-5 mt-4">
                <div className="text-gray-500 font-mono text-xs mb-3">
                  Top languages
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  {data.languages.map((l) => (
                    <span
                      key={l.name}
                      style={{ width: `${l.pct}%`, background: colorFor(l.name) }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 font-mono text-xs text-gray-400">
                  {data.languages.map((l) => (
                    <span key={l.name} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: colorFor(l.name) }}
                      />
                      {l.name} {l.pct}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            <a
              href={`https://github.com/${data.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 font-mono text-sm text-gray-300 hover:text-white transition-colors"
            >
              <FaGithub /> github.com/{data.login} →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
