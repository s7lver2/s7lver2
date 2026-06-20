'use client';
import { useEffect, useState } from 'react';
import type { ConceptKey } from '@/app/lib/content-constants';

interface MachineCard {
  name: string; difficulty: string; os: string; date: string;
  concepts: string[]; conceptKeys: ConceptKey[]; youtube?: string;
}
interface Props { activeConcept: ConceptKey | null; onConceptHover: (c: ConceptKey | null) => void; }

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x.includes('fácil') || x.includes('easy')) return 'd-easy';
  if (x.includes('media') || x.includes('medium')) return 'd-med';
  if (x.includes('difícil') || x.includes('hard')) return 'd-hard';
  if (x.includes('insane')) return 'd-ins';
  return 'd-med';
}
function osIcon(os: string) {
  const x = os.toLowerCase();
  if (x.includes('win')) return '🪟';
  if (x.includes('linux')) return '🐧';
  return '💻';
}

export default function MachinesCarousel({ activeConcept, onConceptHover }: Props) {
  const [machines, setMachines] = useState<MachineCard[]>([]);

  useEffect(() => {
    fetch('/api/htb/machines')
      .then((r) => r.ok ? r.json() : { machines: [] })
      .then((d) => setMachines(Array.isArray(d.machines) ? d.machines : []))
      .catch(() => setMachines([]));
  }, []);

  if (machines.length === 0) return null;
  const doubled = [...machines, ...machines];

  return (
    <div className="mcaro" data-active={activeConcept ?? undefined}>
      <div className="eyebrow mono" style={{ marginTop: 30 }}>htb --recent</div>
      <div className="mcaro-mask">
        <div className="mtrack2">
          {doubled.map((m, i) => {
            const has = activeConcept ? m.conceptKeys.includes(activeConcept) : false;
            return (
              <div
                key={`${m.name}-${i}`}
                className={`mcard ${has ? 'has' : ''}`}
                onMouseEnter={() => onConceptHover(m.conceptKeys[0] ?? null)}
                onMouseLeave={() => onConceptHover(null)}
              >
                <div className="mtop">
                  <span className="mname">{m.name}</span>
                  <span className={`diff ${diffClass(m.difficulty)}`}>{m.difficulty}</span>
                </div>
                <div className="mos">{osIcon(m.os)} {m.os}</div>
                <div className="mtags">
                  {m.concepts.map((c) => <span key={c} className="mtag">{c}</span>)}
                </div>
                <div className="mfoot">
                  <span className="pwn">✓ pwned{m.date ? ` · ${new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}</span>
                  {m.youtube && <a href={m.youtube} target="_blank" rel="noopener noreferrer">▶ writeup</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
