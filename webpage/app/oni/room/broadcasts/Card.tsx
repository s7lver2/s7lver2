import { tanker } from '../../fonts';
import type { Channel } from '../channels';

const ch = (n: number) => `CH ${String(n).padStart(2, '0')}`;

// la emisión por defecto: carta de ajuste del proyecto
export default function Card({ channel }: { channel: Channel }) {
  const run = channel.tags.join('   ·   ');
  return (
    <div className="bc-card">
      <span className="bc-card__ch">{ch(channel.number)}</span>
      <h2 className="bc-card__name" style={{ fontFamily: tanker.style.fontFamily }}>{channel.name}</h2>
      <p className="bc-card__tag">{channel.tagline}</p>
      {run && (
        <div className="bc-card__run" aria-hidden>
          <span>{run}   ·   {run}   ·   </span>
          <span>{run}   ·   {run}   ·   </span>
        </div>
      )}
    </div>
  );
}

// lo mismo, pintado en un canvas de 512×384 para la textura de la tele
export function paintCard(x: CanvasRenderingContext2D, c: Channel, t: number) {
  const W = 512, H = 384;
  // se pinta en 512×384 y se escala al lienzo que toque (la tele encuadrada usa uno mayor)
  x.setTransform(x.canvas.width / W, 0, 0, x.canvas.height / H, 0, 0);
  x.fillStyle = '#070303'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#c4221a'; x.font = '600 22px ui-monospace, Consolas, monospace'; x.textBaseline = 'top';
  x.fillText(ch(c.number), 28, 26);
  x.fillStyle = '#ffd9cf';
  let size = 92; x.font = `${size}px ${tanker.style.fontFamily}`;
  while (x.measureText(c.name).width > W - 56 && size > 36) x.font = `${(size -= 4)}px ${tanker.style.fontFamily}`;
  x.fillText(c.name, 28, 120);
  x.fillStyle = '#ff4a36'; x.font = '20px ui-monospace, Consolas, monospace';
  const words = c.tagline.split(' '); let line = '', y = 136 + size;
  for (const w of words) {
    if (x.measureText(line + w).width > W - 56) { x.fillText(line, 28, y); y += 26; line = ''; if (y > H - 80) break; }
    line += w + ' ';
  }
  if (y <= H - 80) x.fillText(line, 28, y);
  x.fillStyle = '#2a0605'; x.fillRect(0, H - 44, W, 44);
  const run = c.tags.join('   ·   ') + '   ·   ';
  x.fillStyle = '#ff4a36'; x.font = '600 18px ui-monospace, Consolas, monospace';
  const w = x.measureText(run).width || 1, off = (t * 60) % w;
  for (let px = -off; px < W; px += w) x.fillText(run, px, H - 32);
}
