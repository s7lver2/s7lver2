import * as THREE from 'three';
import { tanker } from '../fonts';
import type { Presence } from './presence';

/*
 * Una ficha de los créditos («ficha del reparto»): el retrato en líneas, como los estandartes, y a
 * su lado el rol, el nombre y hasta tres líneas. Se dibuja en blanco sobre transparente en un
 * lienzo (que se redibuja cuando cambia Discord, sin texturas nuevas) y el shader la vuelve
 * holograma rojo: barrido, una onda de agua y, cada pocos segundos, un fallo (bandas que saltan,
 * canales separados, parpadeo). Aparece por bandas, como los hologramas del ritual.
 *
 * Dos composiciones en el mismo lienzo cuadrado: ancha (retrato a la izquierda, en la franja del
 * medio) y alta (retrato arriba, texto debajo) para pantallas estrechas.
 */
export interface CardData { role: string; name: string; avatar: HTMLImageElement | 'mark'; lines: { dot?: boolean; text: string }[] }

const S = 1024;
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
const STATUS: Record<NonNullable<Presence['status']>, string> = { online: 'online', idle: 'idle', dnd: 'do not disturb', offline: 'offline' };

/** La ficha de s7lver con lo que haya de Discord (lo que falta no ocupa sitio). */
export function presenceCard(p: Presence, avatar: HTMLImageElement): CardData {
  const lines: CardData['lines'] = [];
  if (p.status) lines.push({ dot: true, text: STATUS[p.status] + (p.custom ? ` · “${p.custom}”` : '') });
  else if (p.custom) lines.push({ text: `“${p.custom}”` });
  if (p.activity) lines.push({ text: p.activity });
  if (p.spotify) lines.push({ text: `♪ ${p.spotify.song} — ${p.spotify.artist}` });
  return { role: 'directed & coded by', name: p.name, avatar, lines };
}

export const CLAUDE_CARD: CardData = {
  role: 'co-written by',
  name: 'CLAUDE',
  avatar: 'mark',
  // lo que costó escribir la página, contado en las sesiones de Claude Code del proyecto (lecturas de
  // caché incluidas) a 31-10-2026: una estimación, no se actualiza sola
  lines: [{ dot: true, text: 'online · “making the oni sink”' }, { text: 'Opus 5.5 · Anthropic' }, { text: '≈1.1B tokens read · 3.3M written' }],
};

// el texto más largo que cabe en `w`, con «…» si no cabe entero
function fit(x: CanvasRenderingContext2D, s: string, w: number) {
  if (x.measureText(s).width <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (x.measureText(s.slice(0, m) + '…').width <= w) lo = m;
    else hi = m - 1;
  }
  return s.slice(0, lo).trimEnd() + '…';
}

export class Card {
  readonly mesh: THREE.Mesh;
  private canvas = Object.assign(document.createElement('canvas'), { width: S, height: S });
  private x = this.canvas.getContext('2d')!;
  private tex = new THREE.CanvasTexture(this.canvas);
  private mat: THREE.ShaderMaterial;
  private data: CardData;
  private tall = false;
  private glitchAt = 2 + Math.random() * 2;

  constructor(data: CardData) {
    this.data = data;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.tex },
        uRect: { value: new THREE.Vector4(0, 0.25, 1, 0.5) },
        uTime: { value: 0 },
        uShow: { value: 0 },
        uGlitch: { value: 0 },
        uWave: { value: 1 },
        uColor: { value: new THREE.Color(0xff1f1f).multiplyScalar(1.6) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime, uWave; varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // la onda del agua: ondula la ficha despacio (±1,5 cm)
          p.z += uWave * (sin(p.x * 3.0 + uTime * 1.2) * 0.012 + sin(p.y * 4.0 - uTime * 0.9) * 0.006);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec4 uRect; uniform float uTime, uShow, uGlitch; uniform vec3 uColor; varying vec2 vUv;
        float h(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
        void main() {
          float band = floor(vUv.y * 24.0);
          // aparece por bandas, cada una a su tiempo
          if (h(band + 3.0) * 0.7 > uShow * 1.1 - 0.1) discard;
          // el fallo: unas bandas saltan de lado y los canales se separan
          float f = floor(uTime * 24.0);
          float jump = uGlitch * step(0.7, h(band + f)) * (h(band * 1.7 + f) - 0.5) * 0.08;
          vec2 uv = uRect.xy + (vUv + vec2(jump, 0.0)) * uRect.zw;
          float ca = 0.002 + uGlitch * 0.012;
          float r = texture2D(uMap, uv + vec2(ca, 0.0)).a, g = texture2D(uMap, uv).a, b = texture2D(uMap, uv - vec2(ca, 0.0)).a;
          float lum = dot(texture2D(uMap, uv).rgb, vec3(0.3, 0.59, 0.11));
          float scan = 0.72 + 0.28 * sin(vUv.y * 900.0);
          float flick = 1.0 - uGlitch * 0.5 * step(0.5, h(f));
          vec3 c = uColor * vec3(r, g * 0.9, b) * lum * scan * flick * min(1.0, uShow * 1.5);
          if (max(c.r, max(c.g, c.b)) < 0.002) discard;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8, 32, 16), this.mat);
    this.draw();
    // el nombre va en Tanker: cuando esté cargada, se redibuja
    document.fonts?.load(`96px ${tanker.style.fontFamily}`).then(() => this.draw(), () => {});
  }

  set(data: CardData) {
    this.data = data;
    this.draw();
  }

  /** Ancha o alta (pantallas estrechas): cambia la composición y la forma del plano. */
  layout(tall: boolean) {
    if (tall === this.tall) return;
    this.tall = tall;
    this.mat.uniforms.uRect.value.set(0, tall ? 0 : 0.25, 1, tall ? 1 : 0.5);
    this.mesh.scale.set(tall ? 0.5 : 1, tall ? 1 : 1, 1); // 1,6 × 0,8 → 0,8 × 0,8
    this.draw();
  }

  /** `show`: cuánto se ve (0-1); con movimiento reducido, sin onda ni fallos. */
  update(t: number, show: number, reduced: boolean) {
    const u = this.mat.uniforms;
    u.uShow.value = show;
    u.uWave.value = reduced ? 0 : 1;
    u.uTime.value = reduced ? 0 : t;
    let g = 0;
    if (!reduced && show > 0) {
      if (t > this.glitchAt + 0.2) this.glitchAt = t + 2.5 + Math.random() * 1.5;
      g = t > this.glitchAt ? 1 : 0;
    }
    u.uGlitch.value = g;
  }

  private draw() {
    const x = this.x, d = this.data, tall = this.tall;
    x.clearRect(0, 0, S, S);
    x.fillStyle = x.strokeStyle = '#fff';
    // el retrato: a la izquierda en la franja del medio, o arriba en la alta
    // (en la alta, todo más grande: se ve en una pantalla estrecha)
    const r = tall ? 150 : 150, cx = tall ? S / 2 : 60 + r, cy = tall ? 30 + r : S / 2;
    const k = tall ? 1.45 : 1;
    x.save();
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.clip();
    const img = d.avatar;
    if (img === 'mark') {
      // la marca de Claude: 筆, el pincel (el que escribe), en el círculo
      x.font = `400 ${r * 1.25}px "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('筆', cx, cy + r * 0.05);
    } else if (img.complete && img.naturalWidth) x.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    // en líneas horizontales de 2 px con hueco de 1 px, como los estandartes
    x.globalCompositeOperation = 'destination-out';
    for (let y = cy - r; y < cy + r; y += 3) x.fillRect(cx - r, y + 2, r * 2, 1);
    x.restore();
    x.lineWidth = 3;
    x.beginPath();
    x.arc(cx, cy, r + 10, 0, Math.PI * 2);
    x.stroke();

    // el texto: a la derecha del retrato, o debajo y centrado
    const left = tall ? 60 : cx + r + 56, w = S - left - 50;
    x.textAlign = tall ? 'center' : 'left';
    const tx = tall ? S / 2 : left;
    let y = tall ? cy + r + 70 : S / 2 - 110 + (3 - d.lines.length) * 18;
    x.textBaseline = 'alphabetic';
    x.globalAlpha = 0.75;
    x.font = `600 ${22 * k}px ${MONO}`;
    x.letterSpacing = '0.35em';
    x.fillText(fit(x, d.role.toUpperCase(), w), tx, y);
    x.letterSpacing = '0px';
    x.globalAlpha = 1;
    y += 100 * k;
    x.font = `400 ${96 * k}px ${tanker.style.fontFamily}, Impact, sans-serif`;
    x.fillText(fit(x, d.name, w), tx, y);
    y += 60 * k;
    x.font = `400 ${26 * k}px ${MONO}`;
    for (const l of d.lines) {
      let text = l.text, at = tx;
      if (l.dot) {
        const off = tall ? -x.measureText(text).width / 2 - 20 : 7;
        x.beginPath();
        x.arc(at + off, y - 9, 7, 0, Math.PI * 2);
        x.fill();
        if (!tall) at += 26;
      }
      text = fit(x, text, w - (l.dot && !tall ? 26 : 0));
      x.fillText(text, at, y);
      y += 40 * k;
    }
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
