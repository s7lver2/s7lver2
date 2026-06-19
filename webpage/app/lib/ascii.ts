'use client';

/** Downsamplea un canvas a una rejilla cols×rows y mapea luminancia a una rampa ASCII. */
export function toAscii(src: HTMLCanvasElement, cols: number, rows: number): string {
  const ctx = src.getContext('2d');
  if (!ctx) return '';
  const d = ctx.getImageData(0, 0, src.width, src.height).data;
  const ramp = ' .:-=+*#%@';
  const sx = src.width / cols, sy = src.height / rows;
  let out = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = (i * sx) | 0, x1 = ((i + 1) * sx) | 0;
      const y0 = (j * sy) | 0, y1 = ((j + 1) * sy) | 0;
      let s = 0, n = 0;
      for (let y = y0; y < y1; y += 2)
        for (let x = x0; x < x1; x += 2) {
          const o = (y * src.width + x) * 4;
          s += 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
          n++;
        }
      const l = n ? s / n : 0;
      out += ramp[Math.min(ramp.length - 1, ((l / 256) * ramp.length) | 0)];
    }
    out += '\n';
  }
  return out;
}

/** Carga una imagen mismo-origen en un canvas (para luego pasarla a toAscii). */
export function loadImageToCanvas(url: string, w = 160, h = 160): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      if (!x) return reject(new Error('no ctx'));
      x.fillStyle = '#0a0a12'; x.fillRect(0, 0, w, h);
      x.drawImage(img, 0, 0, w, h);
      resolve(c);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Genera un canvas con un avatar simple (gradiente + texto). */
export function generateAvatarCanvas(color: string, text: string, w = 160, h = 160): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (!x) throw new Error('no ctx');

  // Gradiente de color a fondo
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, color);
  g.addColorStop(1, '#0a0a12');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);

  // Texto centrado
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold ${Math.floor(w * 0.48)}px Arial`;
  x.fillText(text, w / 2, h / 2 + Math.floor(h * 0.025));

  return c;
}
