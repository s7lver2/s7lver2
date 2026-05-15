// webpage/app/admin/geography/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Stats } from '@/app/lib/analytics'

const TT = { background: 'rgba(5,0,7,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#fee0f4', padding: '6px 10px' }
const S: React.CSSProperties = { fontFamily: 'var(--font-body)' }

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function Bar100({ value, max, color = '#7c3aed' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.round((value / Math.max(max, 1)) * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  )
}

export default function GeographyPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => { if (r.status === 401) { router.replace('/admin/login'); return null } return r.json() as Promise<Stats> })
      .then(d => { if (d) { setStats(d); setLoading(false) } })
      .catch(() => router.replace('/admin/login'))
  }, [router])

  if (loading) return <div style={{ ...S, fontSize: 14, color: 'rgba(254,240,244,0.3)', paddingTop: 60, textAlign: 'center' }}>loading…</div>
  if (!stats) return null

  const maxCountry = stats.byCountry[0]?.count ?? 1

  // Cities derived from recent visits for the selected country
  const cityMap = new Map<string, number>()
  if (selected) {
    for (const v of stats.recent) {
      if (v.countryCode === selected && v.city) {
        cityMap.set(v.city, (cityMap.get(v.city) ?? 0) + 1)
      }
    }
  }
  const cities = [...cityMap.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10)

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 26, color: 'var(--text)', margin: 0 }}>geography</h1>
        <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
          geographic traffic distribution
        </div>
      </div>

      {/* Map replacement: bar chart of top countries */}
      <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ ...S, fontSize: 8, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)', padding: '14px 16px 0' }}>
          world distribution
        </div>
        <div style={{ padding: '8px 16px 16px' }}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.byCountry.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 10 }}>
              <XAxis type="number" tick={{ fill: 'rgba(233,213,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="country" tick={{ fill: 'rgba(233,213,255,0.45)', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={70} />
              <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(139,92,246,0.07)' }} />
              <Bar dataKey="count" name="visits" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="geo-grid">
        {/* Country table */}
        <Sec title="countries">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['country', 'visits', '%', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', ...S, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(139,92,246,0.55)', paddingBottom: 10, paddingRight: 12, borderBottom: '1px solid rgba(139,92,246,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.byCountry.map(c => (
                  <tr
                    key={c.code}
                    onClick={() => setSelected(selected === c.code ? null : c.code)}
                    style={{ cursor: 'pointer', background: selected === c.code ? 'rgba(139,92,246,0.07)' : 'transparent' }}
                  >
                    <td style={{ ...S, fontSize: 10, color: 'var(--text)', padding: '7px 12px 7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>{c.country}</td>
                    <td style={{ ...S, fontSize: 10, color: 'rgba(254,240,244,0.6)', padding: '7px 12px 7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{c.count}</td>
                    <td style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.35)', padding: '7px 12px 7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>{Math.round(c.count / stats.total * 100)}%</td>
                    <td style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', width: '40%' }}>
                      <Bar100 value={c.count} max={maxCountry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sec>

        {/* City breakdown or bar chart */}
        <Sec title={selected ? `cities — ${stats.byCountry.find(c => c.code === selected)?.country ?? selected}` : 'visits by country'}>
          {selected ? (
            cities.length === 0 ? (
              <div style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.25)', fontStyle: 'italic' }}>no city data</div>
            ) : (
              <div>
                {cities.map((c, i) => (
                  <div key={c.city} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < cities.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ ...S, fontSize: 10, color: 'var(--text)', flex: '0 0 100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.city}</span>
                    <Bar100 value={c.count} max={cities[0].count} color="#a855f7" />
                    <span style={{ ...S, fontSize: 9, color: 'rgba(254,240,244,0.4)', flex: '0 0 24px', textAlign: 'right' }}>{c.count}</span>
                  </div>
                ))}
                <div style={{ ...S, fontSize: 8, color: 'rgba(254,240,244,0.2)', marginTop: 12, cursor: 'pointer' }} onClick={() => setSelected(null)}>← all countries</div>
              </div>
            )
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.byCountry.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 10 }}>
                <XAxis type="number" tick={{ fill: 'rgba(233,213,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="country" tick={{ fill: 'rgba(233,213,255,0.45)', fontSize: 9, fontFamily: 'Space Mono, monospace' }} tickLine={false} axisLine={false} width={65} />
                <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(139,92,246,0.07)' }} />
                <Bar dataKey="count" name="visits" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Sec>
      </div>

      <style>{`
        @media (max-width: 768px) { .geo-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}