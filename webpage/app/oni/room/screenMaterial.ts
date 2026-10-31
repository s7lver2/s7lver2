import * as THREE from 'three';

/*
 * El cristal de cada tele. Las coordenadas de pantalla salen de la posición en el mundo, no
 * de los UV del modelo (cada modelo los trae a su manera): cada pantalla sabe su centro, sus
 * ejes y su tamaño, y hacia dónde le queda el mando.
 *
 * uMode: 0 estática · 1 emisión (tFeed) · 2 su flechita hacia el mando · 3 su trozo de un
 * programa del muro entero (tWall, proyectado desde la silla: sentado, las teles juntas lo forman)
 */

const vert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform sampler2D tFeed, tWall;
uniform mat4 uWallVP; // la vista desde la silla
uniform float uMode, uOff, uTime, uFocus, uSeed, uMono, uFlat, uCctv, uSteady, uGain;
uniform vec3 uCenter, uRight, uUp;
uniform vec2 uSize;
uniform vec2 uDir; // hacia el mando, en los ejes de esta pantalla
uniform float uDist; // distancia al mando: la onda de las flechas viaja hacia él
varying vec3 vW;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 d = vW - uCenter;
  vec2 uv = vec2(dot(d, uRight) / uSize.x, dot(d, uUp) / uSize.y) + 0.5;
  // el cristal abombado: el centro se acerca, las esquinas se van
  vec2 c = uv - 0.5;
  // uFlat = 1: la imagen plana y entera (la llegada sale de esta pantalla vista de frente)
  float glass = 1.0 - uFlat;
  uv = 0.5 + c * (1.0 + dot(c, c) * 0.28 * glass);
  float edge = mix(smoothstep(0.0, 0.035, uv.x) * smoothstep(1.0, 0.965, uv.x) * smoothstep(0.0, 0.035, uv.y) * smoothstep(1.0, 0.965, uv.y), 1.0, uFlat);

  // estática de antena: nieve fina que se arrastra en horizontal, cada línea con su ganancia,
  // motas brillantes sueltas, un brillo que rueda despacio y la banda de interferencia que baja
  float t = floor(uTime * 30.0);
  vec2 px = floor(uv * vec2(240.0, 190.0));
  vec2 jt = vec2(t * 13.1, t * 7.7) + uSeed * 17.0;
  float n = hash(px + jt);
  float sn = mix(n, hash(px - vec2(1.0, 0.0) + jt), 0.45);
  float gain = 0.7 + 0.6 * hash(vec2(px.y, t) + uSeed);
  sn = pow(sn, 1.7) * gain + step(0.985, n) * 0.6;
  float roll = 0.55 + 0.25 * sin(uv.y * 4.0 - uTime * 1.9 + uSeed * 6.0);
  float band = smoothstep(0.1, 0.0, abs(fract(uv.y * 0.6 - uTime * 0.21 + uSeed) - 0.5));
  vec3 stat = vec3(0.92, 0.95, 1.0) * (sn * roll + band * 0.4 * hash(vec2(px.y, t * 3.0)));

  vec3 col = stat;
  // cortes de señal: cada tele, a su ritmo, rueda en vertical y suelta un golpe de estática
  float slot = floor(uTime / 5.0 + uSeed * 13.0);
  float cut = step(0.72, hash(vec2(slot, uSeed))) * step(fract(uTime / 5.0 + uSeed * 13.0), 0.06) * (1.0 - uFlat) * (1.0 - uSteady) * step(uMode, 1.5);
  uv.y = fract(uv.y + cut * uTime * 3.0);
  if (uMode > 0.5 && uMode < 1.5) {
    // la imagen de cámara de seguridad lleva siempre su estática: banda de tracking y grano (de
    // frente, en la llegada, no: ahí la pone el filtro de la sala, igual que la del virus)
    float trk = uCctv * (1.0 - uFlat) * smoothstep(0.03, 0.0, abs(uv.y - fract(-uTime * 0.08 + uSeed)));
    col = texture2D(tFeed, clamp(uv + vec2(trk * (hash(vec2(floor(uv.y * 300.0), t)) - 0.5) * 0.03, 0.0), 0.0, 1.0)).rgb;
    // con ganancia, una curva que levanta las sombras sin quemar las luces
    if (uGain > 1.0) col = 1.0 - exp(-col * uGain);
    col += uCctv * (1.0 - uFlat) * ((n - 0.5) * 0.16 + trk * 0.12);
    // fósforo rojo: terminales, radar y demás, del negro al rojo y el trazo más vivo casi rosa
    if (uMono > 0.5) {
      float l = dot(col, vec3(0.3, 0.59, 0.11)) * 1.25 + (n - 0.5) * 0.08;
      col = mix(vec3(1.0, 0.068, 0.037) * l * 1.3, vec3(1.0, 0.55, 0.45), smoothstep(0.75, 1.1, l));
    }
  }
  if (uMode > 2.5) {
    // el programa del muro: todas las teles juntas forman una imagen
    vec4 wp = uWallVP * vec4(vW, 1.0);
    col = texture2D(tWall, wp.xy / wp.w * 0.5 + 0.5).rgb * 1.35 + (n - 0.5) * 0.05;
  } else if (uMode > 1.5) {
    // cada tele dibuja su flecha en píxel gordo, empujando hacia el mando
    vec2 g = (floor(uv * vec2(24.0, 18.0)) + 0.5) / vec2(24.0, 18.0) - 0.5;
    g.x *= uSize.x / uSize.y;
    vec2 dir = normalize(uDir + 1e-4);
    vec2 q = vec2(dot(g, dir), dot(g, vec2(-dir.y, dir.x)));
    float wave = 0.5 + 0.5 * sin(uTime * 4.0 + uDist * 2.6);
    q.x -= wave * 0.06;
    float shaft = step(abs(q.y), 0.07) * step(-0.32, q.x) * step(q.x, 0.06);
    float head = step(0.06, q.x) * step(q.x, 0.34) * step(abs(q.y), (0.34 - q.x) * 1.15);
    float mine = max(shaft, head);
    vec3 red = mix(vec3(0.55, 0.016, 0.01), vec3(1.0, 0.068, 0.037), head) * (0.45 + 0.75 * wave); // #c4221a y #ff4a36 en lineal
    col = mix(stat * 0.18, red, mine);
  }
  // durante un viaje de la cámara (o un corte de señal), golpe de ruido encima
  col = mix(col, stat * 1.6, max(uFocus, cut * 0.85));

  // líneas de barrido y viñeteado
  col *= 1.0 - glass * (0.18 - 0.18 * sin(uv.y * 520.0));
  col *= 1.0 - dot(c, c) * 0.9 * glass;

  // apagado: la imagen se aplasta en una línea y la línea en un punto blanco
  if (uOff > 0.0) {
    float sy = max(0.004, 1.0 - uOff * 2.0);
    float sx = uOff < 0.5 ? 1.0 : max(0.0, 1.0 - (uOff - 0.5) * 2.2);
    float inside = step(abs(uv.y - 0.5), sy * 0.5) * step(abs(uv.x - 0.5), sx * 0.5);
    float white = smoothstep(0.2, 0.6, uOff);
    col = mix(col, vec3(1.6, 1.5, 1.45), white) * inside * (1.0 - smoothstep(0.85, 1.0, uOff));
  }
  gl_FragColor = vec4(col * edge, 1.0);
}`;

export function createScreenMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      tFeed: { value: null },
      tWall: { value: null },
      uWallVP: { value: new THREE.Matrix4() },
      uMode: { value: 0 },
      uOff: { value: 0 },
      uTime: { value: 0 },
      uFocus: { value: 0 },
      uSeed: { value: Math.random() },
      uMono: { value: 0 },
      uFlat: { value: 0 },
      uCctv: { value: 0 },
      uSteady: { value: 0 }, // 1 en la tele encuadrada: sin cortes de señal
      uGain: { value: 1 }, // brillo de tFeed (la grabación de la biblioteca llega oscura)
      uDir: { value: new THREE.Vector2(0, -1) },
      uDist: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uRight: { value: new THREE.Vector3(1, 0, 0) },
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uSize: { value: new THREE.Vector2(1, 1) },
    },
    toneMapped: false,
  });
}
