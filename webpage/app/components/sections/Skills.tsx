'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, PolarRadiusAxis,
} from 'recharts';
import SkillsPlanet from '../planets/SkillsPlanet';


const SKILLS = [
  { subject: 'Pentesting',     value: 85, color: '#f87171', tools: ['Burp Suite', 'SQLMap', 'Hydra', 'Hashcat', 'Mimikatz', 'Impacket', 'Evil-WinRM'] },
  { subject: 'CTF / Exploit',  value: 80, color: '#facc15', tools: ['Buffer Overflow', 'Rev Engineering', 'Cryptography', 'Steganography', 'pwntools', 'Ghidra'] },
  { subject: 'Networking',     value: 75, color: '#22d3ee', tools: ['Nmap', 'Wireshark', 'Netcat', 'tcpdump', 'Masscan', 'Responder'] },
  { subject: 'Web Exploit',    value: 88, color: '#a78bfa', tools: ['Path Traversals', 'SSRF', 'XSS', 'SQLi', 'LFI/RFI', 'Wfuzz'] },
  { subject: 'OSINT / Recon',  value: 72, color: '#34d399', tools: ['Subfinder', 'Amass', 'Gobuster', 'Enum4linux', 'OSINT Framework'] },
];

// Custom dot que respeta el hover global
function CustomDot(props: any) {
  const { cx, cy, index, hoveredIdx } = props;
  const isHovered = hoveredIdx === index || hoveredIdx === null;
  return (
    <circle
      cx={cx} cy={cy} r={isHovered ? 5 : 3}
      fill={isHovered ? SKILLS[index]?.color ?? '#fff' : '#555'}
      opacity={hoveredIdx !== null && hoveredIdx !== index ? 0.2 : 1}
      style={{ transition: 'all 0.25s' }}
    />
  );
}

export default function SkillsSection() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <section id="skills" className="section-planet">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full border border-blue-500/20 bg-blue-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-mono text-blue-400 tracking-widest uppercase">
              sys: cybersec.skills loaded
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Security Skills</h2>
          <p className="text-gray-500 font-mono text-sm">// tools & techniques I wield</p>
        </div>

        {/* Layout: planeta (45%) | radar (55%) */}
        <div className="grid lg:grid-cols-[45%_55%] gap-8 items-center">
          {/* Planeta izquierda */}
          <div className="flex justify-center">
            <div style={{ width: 360, height: 360 }}>
              <SkillsPlanet />
            </div>
          </div>

          {/* Radar + leyenda derecha */}
          <div className="flex flex-col gap-6">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={SKILLS} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={({ payload, x, y }: any) => {
                    const idx = SKILLS.findIndex(s => s.subject === payload.value);
                    const dim = hoveredIdx !== null && hoveredIdx !== idx;
                    return (
                      <text
                        x={x} y={y}
                        fill={dim ? 'rgba(156,163,175,0.25)' : SKILLS[idx]?.color ?? '#fff'}
                        fontSize={11}
                        fontFamily="monospace"
                        textAnchor="middle"
                        style={{ transition: 'fill 0.25s', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="rgba(139,92,246,0.8)"
                  fill="rgba(139,92,246,0.15)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Leyenda con hover */}
            <div className="flex flex-wrap gap-3 justify-center">
              {SKILLS.map((s, i) => (
                <button
                  key={s.subject}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.25 : 1,
                    transition: 'opacity 0.25s',
                    borderColor: s.color + '60',
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/5 text-xs font-mono text-gray-300 cursor-default"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.subject}
                </button>
              ))}
            </div>

            {/* Tools del skill con hover */}
            {hoveredIdx !== null && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-mono mb-3" style={{ color: SKILLS[hoveredIdx].color }}>
                  // {SKILLS[hoveredIdx].subject} tools
                </p>
                <div className="flex flex-wrap gap-2">
                  {SKILLS[hoveredIdx].tools.map(t => (
                    <span
                      key={t}
                      className="px-2.5 py-1 text-xs font-mono rounded-md bg-white/5 border border-white/10 text-gray-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}