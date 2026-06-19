'use client';
import { useReveal } from '@/lib/reveal';

type Axis = { name: string; value: number; color: string; tools: string };

const AXES: Axis[] = [
  { name: 'Web Exploit', value: 0.92, color: '#f87171', tools: 'Burp · SQLMap · Wfuzz' },
  { name: 'Network',     value: 0.85, color: '#22d3ee', tools: 'Nmap · Wireshark · tcpdump' },
  { name: 'Recon',       value: 0.80, color: '#a3e635', tools: 'Amass · Subfinder · OSINT' },
  { name: 'Active Dir',  value: 0.75, color: '#8b5cf6', tools: 'BloodHound · Impacket' },
  { name: 'Reversing',   value: 0.68, color: '#f472b6', tools: 'Ghidra · gdb · radare2' },
  { name: 'Crypto',      value: 0.60, color: '#fde047', tools: 'hashcat · John' },
];

function polarToCartesian(i: number, r: number, cx = 150, cy = 150) {
  const angle = (-Math.PI / 2) + (i * Math.PI * 2) / AXES.length;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

function generatePolygonPoints(radius: number) {
  return AXES.map((_, i) => {
    const [x, y] = polarToCartesian(i, radius);
    return `${x},${y}`;
  }).join(' ');
}

function generateDataPoints(cx = 150, cy = 150) {
  return AXES.map((axis, i) => {
    const r = 110 * axis.value;
    return polarToCartesian(i, r, cx, cy);
  });
}

export default function SkillsSection() {
  const reveal = useReveal();
  const dataPoints = generateDataPoints();
  const dataPolygon = dataPoints.map(p => `${p[0]},${p[1]}`).join(' ');

  return (
    <section id="skills" className="section py-24 px-4">
      <div className="wrap">
        <div ref={reveal} className="reveal">
          {/* Eyebrow */}
          <div className="eyebrow">cat skills.md</div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold mb-8">Security skills</h2>

          {/* Radar + Legend */}
          <div className="radarwrap">
            {/* SVG Radar */}
            <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: '340px' }}>
              {/* Rings */}
              <polygon
                points={generatePolygonPoints(110)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
              />
              <polygon
                points={generatePolygonPoints(82.5)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.07)"
              />
              <polygon
                points={generatePolygonPoints(55)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
              />

              {/* Axes */}
              <g stroke="rgba(255, 255, 255, 0.08)">
                {AXES.map((_, i) => {
                  const [x, y] = polarToCartesian(i, 110);
                  return <line key={`axis-${i}`} x1="150" y1="150" x2={x} y2={y} />;
                })}
              </g>

              {/* Data polygon */}
              <polygon
                points={dataPolygon}
                fill="rgba(139, 92, 246, 0.28)"
                stroke="#8b5cf6"
                strokeWidth="2"
              />

              {/* Data points (circles) */}
              {dataPoints.map((point, i) => (
                <circle
                  key={`point-${i}`}
                  cx={point[0]}
                  cy={point[1]}
                  r="3.5"
                  fill={AXES[i].color}
                />
              ))}

              {/* Labels */}
              <g fontFamily="monospace" fontSize="9" fill="#9ca3af">
                {AXES.map((axis, i) => {
                  const [x, y] = polarToCartesian(i, 130);
                  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                  if (i === 1) textAnchor = 'start';
                  if (i === 2) textAnchor = 'start';
                  if (i === 4) textAnchor = 'end';
                  if (i === 5) textAnchor = 'end';

                  return (
                    <text
                      key={`label-${i}`}
                      x={x}
                      y={y}
                      textAnchor={textAnchor}
                    >
                      {axis.name}
                    </text>
                  );
                })}
              </g>
            </svg>

            {/* Legend */}
            <div>
              {AXES.map((axis) => (
                <div key={axis.name} className="rl">
                  <span
                    className="rl-dot"
                    style={{ background: axis.color }}
                  />
                  <span className="rl-nm">
                    {axis.name}
                    <span className="rl-tools">{axis.tools}</span>
                  </span>
                  <span className="rl-pc">{Math.round(axis.value * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}