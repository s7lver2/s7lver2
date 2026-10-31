/*
 * El cristal roto de la cámara, dibujado encima de la imagen: grietas que salen del punto del
 * impacto, cada una quebrada en tramos, trozos de anillo entre ellas y el polvo blanco del golpe.
 * Se pinta en un lienzo transparente que va delante de la cámara de seguridad.
 */
export function crackOverlay(canvas: HTMLCanvasElement) {
  const x = canvas.getContext('2d')!, W = canvas.width, H = canvas.height;
  return {
    hit(u: number, v: number) {
      const cx = u * W, cy = v * H, rays = 14 + ((Math.random() * 6) | 0);
      x.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 2) * W * 0.05;
        x.fillStyle = `rgba(235,240,245,${0.15 + Math.random() * 0.5})`;
        x.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5, 1.5);
      }
      const ends: [number, number][] = [];
      for (let i = 0; i < rays; i++) {
        let a = (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, px = cx, py = cy;
        const len = W * (0.25 + Math.random() * 0.8);
        x.beginPath();
        x.moveTo(px, py);
        for (let s = 0; s < len; ) {
          const step = 10 + Math.random() * 40;
          a += (Math.random() - 0.5) * 0.5;
          px += Math.cos(a) * step;
          py += Math.sin(a) * step;
          s += step;
          x.lineTo(px, py);
          if (s < W * 0.3) ends.push([px, py]);
        }
        // la grieta: una línea oscura y, encima, el filo que coge la luz
        x.strokeStyle = 'rgba(10,10,12,0.75)';
        x.lineWidth = 2.2;
        x.stroke();
        x.strokeStyle = 'rgba(230,236,244,0.55)';
        x.lineWidth = 0.9;
        x.stroke();
      }
      x.strokeStyle = 'rgba(220,228,238,0.45)';
      x.lineWidth = 1;
      for (let i = 0; i < ends.length; i++) {
        if (Math.random() < 0.55) continue;
        const [ax, ay] = ends[i], [bx, by] = ends[(i + 3) % ends.length];
        if (Math.hypot(ax - bx, ay - by) > W * 0.12) continue;
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(bx, by);
        x.stroke();
      }
    },
    dispose() {
      x.clearRect(0, 0, W, H);
    },
  };
}
