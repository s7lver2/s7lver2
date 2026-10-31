import * as THREE from 'three';

/*
 * Lo que hace que la grabación parezca de una cámara de verdad y no un render limpio: el gran
 * angular barato (barril), una imagen blanda de sensor pequeño, el modo noche por infrarrojos
 * (casi gris, con un resto del color para que el rojo aún se lea), las luces que se desbordan
 * en horizontal como en un CCD, y el rótulo de la cámara grabado encima, sin deformar.
 * Entra y sale en lineal: va antes del revelado, en la tele y a pantalla completa.
 */
export const CctvLensShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tOsd: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(640, 480) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tOsd;
    uniform vec2 uRes;
    varying vec2 vUv;
    void main() {
      // barril: las esquinas justo en el borde, sin negro (0,16 de curva y un 10 % de zoom)
      vec2 c = vUv - 0.5, a = vec2(uRes.x / uRes.y, 1.0);
      vec2 uv = 0.5 + c * (1.0 + 0.16 * dot(c * a, c * a)) * 0.9;
      // blando: el píxel y sus cuatro vecinos, más tirado en horizontal (el arrastre de la señal)
      vec2 px = 1.0 / uRes;
      vec3 col = texture2D(tDiffuse, uv).rgb * 0.4
        + (texture2D(tDiffuse, uv + vec2(px.x * 1.3, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(px.x * 1.3, 0.0)).rgb) * 0.2
        + (texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb) * 0.1;
      // el desborde de las luces fuertes, a lo largo de la fila
      vec3 bleed = vec3(0.0);
      for (int i = 1; i <= 6; i++) {
        float o = float(i) * px.x * 3.0;
        bleed += max(texture2D(tDiffuse, uv + vec2(o, 0.0)).rgb - 0.35, 0.0) + max(texture2D(tDiffuse, uv - vec2(o, 0.0)).rgb - 0.35, 0.0);
      }
      col += bleed * 0.05;
      // infrarrojos: casi gris, algo frío, con un 22 % del color de la escena
      float l = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(vec3(l) * vec3(0.94, 1.0, 1.03), col, 0.22);
      // el rótulo: va después de la lente, recto
      vec4 o = texture2D(tOsd, vUv);
      col = mix(col, vec3(0.42), o.a);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** El rótulo de la cámara (número arriba, fecha y hora abajo), en un lienzo que se repinta cada segundo. */
export function cctvOsd(cam: number) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 480 });
  const x = canvas.getContext('2d')!, tex = new THREE.CanvasTexture(canvas);
  let last = '';
  const draw = () => {
    const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
    const time = `${p(d.getMonth() + 1)}-${p(d.getDate())}-${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    if (time === last) return;
    last = time;
    x.clearRect(0, 0, 640, 480);
    x.font = "500 15px ui-monospace, 'Cascadia Mono', Consolas, monospace";
    x.fillStyle = '#fff';
    x.textBaseline = 'top';
    x.fillText(`CAM ${p(cam)}`, 34, 28);
    x.textBaseline = 'bottom';
    x.fillText(time, 34, 452);
    tex.needsUpdate = true;
  };
  draw();
  return { tex, draw, dispose: () => tex.dispose() };
}
