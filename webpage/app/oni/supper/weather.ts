import * as THREE from 'three';
import { cookieShader, windowLight } from '../roomScene';
import { GLASS } from './penthouse';

/*
 * El tiempo de fuera, como en la habitación del principio: la luz de la ciudad entra por el ventanal
 * con las gotas del cristal proyectadas (resbalan por el mantel, el suelo y los robots) y la sombra de
 * los pilares y los montantes en el suelo. Muy de vez en cuando, relámpagos (dos o tres golpes) que
 * encienden la sala de blanco un instante; y cada poco, un foco de fuera (un dron, un helicóptero)
 * que barre la sala de lado a lado. Detrás del cristal, la lluvia cayendo contra la ciudad.
 */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** La lluvia de fuera: rayas finas que caen entre el cristal y la ciudad, iluminadas por ella. */
function makeRain(n: number) {
  const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = rand(-14, 14), z = GLASS - rand(0.6, 9), y = rand(-2, 9);
    pos.set([x, y, z, x, y, z], i * 6);
    seed.set([i, i], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `
      uniform float uTime; attribute float aSeed; varying float vA;
      float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        vec3 p = position;
        // cae de 9 m a -2 m, cada gota a su ritmo; el segundo vértice, 0,35 m más arriba (la raya)
        float speed = 7.0 + h1(aSeed) * 4.0;
        p.y = 9.0 - mod(uTime * speed + h1(aSeed + 3.0) * 11.0, 11.0) + float(gl_VertexID % 2) * 0.35;
        p.x += p.y * 0.05;
        vA = 0.15 + 0.25 * h1(aSeed + 7.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uFlash; varying float vA;
      void main() { gl_FragColor = vec4(mix(vec3(0.75, 0.55, 0.5), vec3(1.0), uFlash), vA * (1.0 + uFlash * 2.0)); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  return l;
}

export function makeWeather(renderer: THREE.WebGLRenderer, o: { reduced: boolean; low: boolean }) {
  const group = new THREE.Group();
  // las gotas del cristal, pintadas en una textura que proyectan las luces de fuera
  const cookieRT = new THREE.WebGLRenderTarget(256, 256);
  const cookieMat = new THREE.ShaderMaterial(cookieShader);
  const cookieScene = new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cookieMat));
  const cookieCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

  // el neón de la ciudad: rojo, desde arriba y detrás del cristal, sobre la mesa
  const neon = windowLight(0xff3020, 0.42, cookieRT.texture, o.low ? 1024 : 2048);
  neon.position.set(-3, 9, GLASS - 7);
  neon.target.position.set(0.4, 0, 1.2);
  // el relámpago: blanco, desde más lejos y más alto
  const bolt = windowLight(0xe8ecf2, 0.5, cookieRT.texture, 1024);
  bolt.position.set(4, 14, GLASS - 12);
  bolt.target.position.set(0, 0, 0.5);
  // el foco que barre: un dron que pasa por fuera, de un lado al otro
  const sweep = windowLight(0xfff0e0, 0.12, cookieRT.texture, 1024);
  sweep.position.set(-12, 6, GLASS - 5);
  sweep.target.position.set(0, 0.6, 0);
  if (o.low) bolt.castShadow = sweep.castShadow = false;
  group.add(neon, neon.target, bolt, bolt.target, sweep, sweep.target);
  const rain = makeRain(o.low ? 600 : 1600);
  group.add(rain);

  let flash = 0, nextBolt = 6, seq: number[] = [], nextSweep = 4, sweepT = -1;
  return {
    group,
    /** Lo que no debe salir en el reflejo del suelo (la lluvia de fuera ya se ve detrás). */
    rain,
    /** Avanza; devuelve el relámpago (0-1) para que el cielo y la ciudad se enciendan con él. */
    update(t: number, dt: number) {
      const anim = o.reduced ? 0 : t;
      // relámpagos: dos o tres golpes seguidos, cada 10-24 s
      if (!o.reduced) {
        if (t > nextBolt && !seq.length) {
          let at = t;
          for (let i = 0, n = Math.random() < 0.5 ? 2 : 3; i < n; i++) seq.push(at, rand(0.5, 1)), (at += rand(0.07, 0.18));
          nextBolt = t + rand(10, 24);
        }
        if (seq.length && t >= seq[0]) (flash = Math.max(flash, seq[1])), seq.splice(0, 2);
        flash = Math.max(0, flash - dt * 6);
        // el dron: cruza en 6 s, cada 14-26 s
        if (sweepT < 0 && t > nextSweep) sweepT = 0;
        if (sweepT >= 0) {
          sweepT += dt / 6;
          const k = sweepT;
          sweep.position.x = -12 + 24 * k;
          sweep.target.position.set(-4 + 8 * k, 0.6, 0.4);
          sweep.intensity = Math.sin(Math.min(1, k) * Math.PI) * 9;
          if (k >= 1) (sweepT = -1), (sweep.intensity = 0), (nextSweep = t + rand(14, 26));
        }
      }
      neon.intensity = 5 * (1 + Math.sin(anim * 0.35) * 0.05) * (1 + flash * 0.3);
      bolt.intensity = flash * 16;
      cookieMat.uniforms.uTime.value = anim;
      rain.material.uniforms.uTime.value = anim;
      rain.material.uniforms.uFlash.value = flash;
      rain.visible = !o.reduced;
      // la textura de las gotas, nueva cada fotograma (resbalan)
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(cookieRT);
      renderer.render(cookieScene, cookieCam);
      renderer.setRenderTarget(prev);
      return flash;
    },
    dispose() {
      cookieRT.dispose();
      cookieMat.dispose();
      rain.geometry.dispose();
      rain.material.dispose();
    },
  };
}

