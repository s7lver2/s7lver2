// webpage/app/admin/overview/page.tsx
'use client';
import { useState, useEffect, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import KPICard from '../components/KPICard';
import type { Stats } from '@/app/lib/analytics';

const TT: CSSProperties = { background: 'rgba(6,3,12,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, fontFamily: 'monospace', fontSize: 10, color: '#e9d5ff', padding: '6px 10px' };
const PIE_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#6d28d9', '#8b5cf6', '#4c1d95'];
const AXIS_TICK = { fontSize: 8, fill: 'rgba(233,213,255,0.3)' } as const;

function Sec({ title, children, style }: { title: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 12, padding: '18px 20px', ...style }}>
      <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

function Bar({ value, max, color = '#7c3aed' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value / Math.max(max, 1)) * 100}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function fmt(s: number) { return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 > 0 ? s % 60 + 's' : ''}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }); }

export default function OverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => { if (r.status === 401) { router.push('/admin/login'); return null; } return r.json(); })
      .then(d => { if (d) { setStats(d); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'monospace', fontSize: 10, color: 'rgba(233,213,255,0.3)' }}>loading…</div>;
  if (!stats) return null;

  const topPageMax = stats.byPage[0]?.count ?? 1;
  const topCountryMax = stats.byCountry[0]?.count ?? 1;
  const topRefMax = stats.byReferrer[0]?.count ?? 1;
  const deviceTotal = stats.byDevice.reduce((a, b) => a + b.count, 0);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 26, color: '#e9d5ff', lineHeight: 1.1 }}>overview</div>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.3)', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>all-time summary</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <KPICard label="total visits" value={stats.total.toLocaleString()} delta={stats.deltaTotal} sub="vs yesterday" accent />
        <KPICard label="unique visitors" value={stats.unique.toLocaleString()} sparkData={stats.byDay.map(d => d.count)} sub="by IP" />
        <KPICard label="active · last hour" value={stats.activeLastHour} sub="visitors" />
        <KPICard label="bounce rate" value={`${stats.bounceRate}%`} sub={stats.bounceRate < 50 ? 'good' : stats.bounceRate < 70 ? 'ok' : 'high'} />
        <KPICard label="avg session" value={fmt(stats.avgDuration)} sub="duration" />
      </div>

      {/* Chart + device donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 10, marginBottom: 14 }}>
        <Sec title="visits · last 7 days">
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={stats.byDay} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT} labelFormatter={(l: unknown) => typeof l === 'string' ? fmtDate(l) : String(l ?? '')} formatter={(v: unknown) => [String(v ?? ''), 'visits'] as const} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Sec>
        <Sec title="devices">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <PieChart width={120} height={100}>
              <Pie data={stats.byDevice} dataKey="count" cx={60} cy={50} innerRadius={30} outerRadius={48} paddingAngle={3}>
                {stats.byDevice.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
            </PieChart>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {stats.byDevice.map((d, i) => (
                <div key={d.device} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.55)' }}>{d.device}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff' }}>{deviceTotal > 0 ? Math.round((d.count / deviceTotal) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Sec>
      </div>

      {/* Pages + Countries + Referrers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Sec title="top pages">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.byPage.slice(0, 6).map(p => (
              <div key={p.page} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{p.page}</span>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff', flexShrink: 0 }}>{p.count}</span>
                </div>
                <Bar value={p.count} max={topPageMax} />
              </div>
            ))}
          </div>
        </Sec>
        <Sec title="top countries">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.byCountry.slice(0, 6).map(c => (
              <div key={c.code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                    {c.code && <img src={`https://flagcdn.com/16x12/${c.code.toLowerCase()}.png`} alt={c.code} style={{ width: 14, height: 10, objectFit: 'cover', marginRight: 5, borderRadius: 1, verticalAlign: 'middle', display: 'inline-block' }} />}
                    {c.country}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff', flexShrink: 0 }}>{c.count}</span>
                </div>
                <Bar value={c.count} max={topCountryMax} color="#a855f7" />
              </div>
            ))}
          </div>
        </Sec>
        <Sec title="referrers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.byReferrer.length === 0 && <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.25)' }}>no referrers yet</div>}
            {stats.byReferrer.slice(0, 6).map(r => (
              <div key={r.referrer} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{r.referrer}</span>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff', flexShrink: 0 }}>{r.count}</span>
                </div>
                <Bar value={r.count} max={topRefMax} color="#c084fc" />
              </div>
            ))}
          </div>
        </Sec>
      </div>

      {/* Recent sessions + Browsers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
        <Sec title="recent sessions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.sessions.length === 0 && <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.25)' }}>no sessions yet</div>}
            {stats.sessions.slice(0, 5).map(sess => (
              <div key={sess.sessionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 8, gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sess.city ? `${sess.city}, ` : ''}{sess.country ?? '—'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, color: 'rgba(233,213,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sess.pages.join(' → ')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, color: 'rgba(233,213,255,0.35)' }}>{fmt(sess.duration)}</div>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 8, color: 'rgba(139,92,246,0.6)' }}>
                    {sess.browser ?? ''}{sess.os ? ` · ${sess.os}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Sec>
        <Sec title="browsers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stats.byBrowser.slice(0, 6).map((b, i) => (
              <div key={b.browser} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.6)' }}>{b.browser}</span>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#e9d5ff' }}>{b.count}</span>
                </div>
                <Bar value={b.count} max={stats.byBrowser[0]?.count ?? 1} color={PIE_COLORS[i % PIE_COLORS.length]} />
              </div>
            ))}
          </div>
        </Sec>
      </div>
    </div>
  );
}