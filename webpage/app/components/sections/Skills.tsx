'use client';
import React from 'react';
import { useReveal } from '@/lib/reveal';
import ScrambleText from '@/components/ScrambleText';
import { type SkillC, type ConceptKey, DEFAULT_SKILLS } from '@/app/lib/content-constants';
import MachinesCarousel from './Machines';

function polarToCartesian(i: number, r: number, axesLength: number, cx = 150, cy = 150) {
  const angle = (-Math.PI / 2) + (i * Math.PI * 2) / axesLength;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

function generatePolygonPoints(radius: number, axes: SkillC[]) {
  return axes.map((_, i) => {
    const [x, y] = polarToCartesian(i, radius, axes.length);
    return `${x},${y}`;
  }).join(' ');
}

function generateDataPoints(axes: SkillC[], cx = 150, cy = 150) {
  return axes.map((axis, i) => {
    const r = 110 * axis.value;
    return polarToCartesian(i, r, axes.length, cx, cy);
  });
}

interface Props {
  machinesEnabled?: boolean;
}

export default function SkillsSection({ machinesEnabled = true }: Props) {
  const reveal = useReveal();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [axes, setAxes] = React.useState<SkillC[]>(DEFAULT_SKILLS);
  const [activeConcept, setActiveConcept] = React.useState<ConceptKey | null>(null);

  React.useEffect(() => {
    fetch('/api/content/skills')
      .then((r) => r.ok ? r.json() : null)
      .then((d: SkillC[] | null) => { if (Array.isArray(d) && d.length) setAxes(d); })
      .catch(() => {});
  }, []);

  const dataPoints = generateDataPoints(axes);
  const dataPolygon = dataPoints.map(p => `${p[0]},${p[1]}`).join(' ');

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !svg.classList.contains('revealed')) return;

    const polygon = svg.querySelector('[data-polygon]') as SVGPolygonElement;
    if (polygon) {
      polygon.animate(
        [
          { transform: 'scale(0)', opacity: '0' },
          { transform: 'scale(1.06)', opacity: '1', offset: 0.8 },
          { transform: 'scale(1)', opacity: '1' }
        ],
        { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
  }, [reveal]);

  return (
    <section id="skills" className="section py-24 px-4">
      <div className="wrap">
        <div ref={reveal} className="reveal skillblk" data-active={activeConcept ?? undefined}>
          <div className="eyebrow">cat skills.md</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-8"><ScrambleText text="Security skills" /></h2>

          <div className="radarwrap">
            <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: '340px' }} ref={svgRef}>
              <defs>
                <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.22" />
                </linearGradient>
              </defs>

              <polygon points={generatePolygonPoints(110, axes)} fill="none" stroke="rgba(255, 255, 255, 0.08)" />
              <polygon points={generatePolygonPoints(82.5, axes)} fill="none" stroke="rgba(255, 255, 255, 0.07)" />
              <polygon points={generatePolygonPoints(55, axes)} fill="none" stroke="rgba(255, 255, 255, 0.06)" />
              <polygon points={generatePolygonPoints(27.5, axes)} fill="none" stroke="rgba(255, 255, 255, 0.05)" />

              <g stroke="rgba(255, 255, 255, 0.08)">
                {axes.map((_, i) => {
                  const [x, y] = polarToCartesian(i, 110, axes.length);
                  return (
                    <line
                      key={`axis-${i}`}
                      x1="150"
                      y1="150"
                      x2={x}
                      y2={y}
                      className={`axline ${activeConcept === axes[i].conceptKey ? 'on' : ''}`}
                      data-c={axes[i].conceptKey}
                    />
                  );
                })}
              </g>

              <polygon
                data-polygon="true"
                points={dataPolygon}
                fill="url(#radarFill)"
                stroke="#8b5cf6"
                strokeWidth="2"
                style={{ transformOrigin: '150px 150px' }}
              />

              {dataPoints.map((point, i) => (
                <circle
                  key={`point-${i}`}
                  className={`pt ${activeConcept === axes[i].conceptKey ? 'on' : ''}`}
                  data-c={axes[i].conceptKey}
                  cx={point[0]}
                  cy={point[1]}
                  r="3.5"
                  fill={axes[i].color}
                  onMouseEnter={() => setActiveConcept(axes[i].conceptKey)}
                  onMouseLeave={() => setActiveConcept(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <animate attributeName="r" values="3.5;6.5;3.5" dur="2s" begin={`${0.6 + i * 0.14}s`} repeatCount="indefinite" />
                </circle>
              ))}

              <g fontFamily="monospace" fontSize="9" fill="#9ca3af">
                {axes.map((axis, i) => {
                  const [x, y] = polarToCartesian(i, 133, axes.length);
                  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                  if (i === 1 || i === 2) textAnchor = 'start';
                  if (i === 4 || i === 5) textAnchor = 'end';
                  return (
                    <text key={`label-${i}`} x={x} y={y} textAnchor={textAnchor}>
                      {axis.name}
                    </text>
                  );
                })}
              </g>
            </svg>

            <div>
              {axes.map((axis, i) => (
                <div
                  key={axis.name}
                  className={`rl ${activeConcept === axis.conceptKey ? 'on' : ''}`}
                  data-c={axis.conceptKey}
                  onMouseEnter={() => setActiveConcept(axis.conceptKey)}
                  onMouseLeave={() => setActiveConcept(null)}
                >
                  <span className="rl-dot" style={{ background: axis.color }} />
                  <span className="rl-nm">
                    {axis.name}
                    <span className="rl-tools">{axis.tools}</span>
                  </span>
                  <span className="rl-pc">{Math.round(axis.value * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <MachinesCarousel activeConcept={activeConcept} onConceptHover={setActiveConcept} enabled={machinesEnabled} />
        </div>
      </div>
    </section>
  );
}