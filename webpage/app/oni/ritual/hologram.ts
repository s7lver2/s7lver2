import * as THREE from 'three';
import type { SocialC } from '../../lib/content-constants';
import { iconShape, initialsTexture } from './icons';

/*
 * Un holograma junto a una estatua: un estandarte de luz, como los de antes (la tela colgando de
 * una barra, en un mástil, con el cordón y la punta abajo, y el ribete), que ondea con el viento, y
 * delante, como su emblema, el oni (la misma máscara, en luz roja) que se rompe en bandas
 * horizontales y se recompone en la marca de una red, y vuelta. Con el ratón encima (o fijado con
 * un toque) se queda en la marca. Sin red, es solo el oni.
 *
 * Todos comparten el mismo shader: cada uno clona el material solo para tener sus uniforms.
 */

const SIZE = 0.24; // alto del oni y ancho de la marca (m)
// el estandarte: ancho y alto de la tela (con la punta), y a qué altura queda la barra sobre el oni (m)
const FLAG_W = 0.34, FLAG_H = 1.05, FLAG_TOP = 0.3;
const BAND = 0.015;
// el bucle: oni, cambio, marca, cambio
const HOLD = 2.6, SWAP = 0.5;

const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
blank.needsUpdate = true;

const base = new THREE.ShaderMaterial({
  uniforms: {
    uMix: { value: 0 }, uTime: { value: 0 }, uRole: { value: 0 }, uShow: { value: 0 },
    uSide: { value: new THREE.Vector3(1, 0, 0) }, uFwd: { value: new THREE.Vector3(0, 0, 1) }, uMap: { value: blank },
    // el rojo de los ojos, más vivo (lineal)
    uColor: { value: new THREE.Color(0xff1f1f).multiplyScalar(1.6) },
  },
  vertexShader: `
    uniform float uMix, uRole, uTime; uniform vec3 uSide, uFwd;
    varying vec3 vW, vN; varying vec2 vUv; varying float vY, vFold;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vFold = 0.0;
      if (uRole > 1.5 && uRole < 2.5) {
        // la tela al viento: cosida a la barra arriba, cada vez más suelta hacia la punta; dos ondas
        // que corren hacia abajo, con ráfagas, y el bajo que se va un poco de lado
        float hang = max(0.0, 1.0 - uv.y), gust = 0.65 + 0.35 * sin(uTime * 0.6) * sin(uTime * 1.7 + 1.0);
        float ph = uv.x * 4.2 + hang * 3.2 - uTime * 2.4;
        float off = (sin(ph) * 0.05 + sin(uv.x * 9.0 - hang * 6.0 - uTime * 3.9 + 1.3) * 0.012) * pow(hang, 1.1) * gust;
        wp.xyz += uFwd * off + uSide * pow(hang, 1.6) * 0.06 * gust;
        // los pliegues: la pendiente de la onda, para iluminar un lado y apagar el otro
        vFold = cos(ph) * min(1.0, hang * 3.0);
      }
      vY = wp.y;
      // cada banda cambia en su momento y, mientras cambia, se desplaza de lado (hasta 3 cm)
      float band = floor(wp.y / ${BAND});
      float r = h1(band) * 0.6, b = smoothstep(r, r + 0.4, uMix);
      if (uRole < 1.5) wp.xyz += uSide * (h1(band + 7.0) * 2.0 - 1.0) * 0.03 * sin(b * 3.14159);
      vW = wp.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform float uMix, uTime, uRole, uShow; uniform vec3 uColor; uniform sampler2D uMap;
    varying vec3 vW, vN; varying vec2 vUv; varying float vY, vFold;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    void main() {
      float band = floor(vY / ${BAND});
      float r = h1(band) * 0.6, b = smoothstep(r, r + 0.4, uMix);
      // el oni está en las bandas que aún no han cambiado; la marca, en las que sí
      if (uRole < 1.5 && (uRole < 0.5 ? b : 1.0 - b) > 0.5) discard;
      vec2 u = vUv;
      // la punta del estandarte: abajo, en V hacia el suelo
      const float TIP = 0.17;
      if (uRole > 1.5 && uRole < 2.5 && u.y < TIP && abs(u.x - 0.5) > u.y / TIP * 0.5) discard;
      float a = texture2D(uMap, vUv).a;
      if (a < 0.1) discard;
      vec3 v = normalize(cameraPosition - vW);
      float rim = pow(max(0.0, 1.0 - abs(dot(normalize(vN), v))), 2.0);
      // líneas de escaneo con hueco entre ellas: se ve a través
      float scan = 0.3 + 0.7 * smoothstep(0.35, 0.65, fract(vY * 140.0 - uTime * 0.6));
      // un parpadeo leve, a saltos
      float flick = 1.0 - 0.08 * step(0.9, h1(floor(uTime * 18.0)));
      // el oni es una malla densa (capas que se suman): casi solo el borde; la marca es plana, con cuerpo
      float body = uRole < 0.5 ? 0.03 + rim * 0.55 : 0.35 + rim * 0.6;
      if (uRole > 1.5 && uRole < 2.5) {
        // la distancia (m) al contorno: los lados, arriba y los dos cortes de la punta
        float d = min(min(u.x, 1.0 - u.x) * ${FLAG_W.toFixed(3)}, (1.0 - u.y) * ${FLAG_H.toFixed(3)});
        if (u.y < TIP + 0.06) d = min(d, (u.y / TIP * 0.5 - abs(u.x - 0.5)) * ${(FLAG_W * 0.75).toFixed(3)});
        // el ribete ancho, un filo fino por dentro, y la tela apenas, con sus pliegues
        float trim = smoothstep(0.034, 0.026, d), line = smoothstep(0.004, 0.0, abs(d - 0.05));
        float cloth = 0.022 * (0.5 + 1.0 * (vFold * 0.5 + 0.5));
        body = (cloth + trim * 0.65 * (0.75 + 0.35 * vFold) + line * 0.35);
      } else if (uRole > 2.5) body = 0.45 + rim * 0.4; // el mástil, la barra y el cordón
      gl_FragColor = vec4(uColor * body * scan * flick * a * uShow, 1.0);
    }`,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.FrontSide,
});

export class Hologram {
  readonly group = new THREE.Group();
  hover = false;
  pinned = false;
  /** Si responde al puntero (solo los de la estatua que se mira). */
  active = false;
  /** Hacia dónde se gira, siguiendo al cursor (-1 a 1, de su izquierda a su derecha en pantalla). */
  lean = 0;
  private leanNow = 0;
  /** Escala del estandarte entero (la pone la escena según el encuadre). */
  size = 1;
  /** Cuánto se ven (0-1): en el final se apagan. */
  power = 1;
  /** Cuándo parpadean (dos cortes de 60 ms), en el reloj de la escena. */
  blinkAt = -9;
  /** Las mallas que recibe el raycast. */
  readonly hits: THREE.Object3D[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private t = Math.random() * (HOLD + SWAP) * 2;
  private mix = 0;
  private grow = 0;
  private growing = false;
  private from = new THREE.Vector3();
  private spin = Math.random() * 6;
  // el oni y la marca, el emblema, que se mece un poco delante de la tela
  private inner = new THREE.Group();
  /** El estandarte entero: tela, barra, mástil y cordón (la escena lo acorta en vertical). */
  readonly flag = new THREE.Group();

  constructor(face: THREE.Object3D, readonly social: SocialC | null) {
    const mat = (role: number) => {
      const m = base.clone();
      m.uniforms.uRole.value = role;
      m.uniforms.uMap.value = blank; // clone() copia las texturas: que todos usen la misma
      this.mats.push(m);
      return m;
    };
    // el oni: la máscara de la estatua (geometría compartida), con este material
    const oni = face.clone();
    oni.position.set(0, 0, 0);
    oni.quaternion.identity();
    oni.rotation.y = Math.PI;
    oni.scale.setScalar(SIZE / 2);
    const om = mat(0);
    oni.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = om;
        m.castShadow = false;
        m.renderOrder = 7;
      }
    });
    this.inner.add(oni);
    this.group.add(this.inner);
    this.hits.push(oni);
    // la tela cuelga de la barra; el mástil baja por detrás hasta el suelo y el cordón va de su
    // remate a las puntas de la barra
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(FLAG_W, FLAG_H, 16, 48), mat(2));
    cloth.position.set(0, FLAG_TOP - FLAG_H / 2, -0.05);
    cloth.renderOrder = 6;
    const sm = mat(3), rod = (len: number, r: number) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), sm);
    const bar = rod(FLAG_W + 0.08, 0.008);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, FLAG_TOP + 0.01, -0.05);
    // el mástil, en dos trozos: lo que asoma sobre la barra y lo que baja de la punta al suelo (la
    // luz se suma: por detrás de la tela se vería a través, cruzando el emblema)
    const top = rod(0.22, 0.007);
    top.position.set(0, FLAG_TOP + 0.11, -0.07);
    const low = FLAG_TOP - FLAG_H, foot = rod(1.45 + low, 0.007); // el holograma va a 1,45 m
    foot.position.set(0, (low - 1.45) / 2, -0.07);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), sm);
    knob.position.set(0, FLAG_TOP + 0.23, -0.07);
    this.flag.add(cloth, bar, top, foot, knob);
    for (const sx of [-1, 1]) {
      // el cordón: de lo alto del mástil a cada punta de la barra
      const a = new THREE.Vector3(0, FLAG_TOP + 0.2, -0.06), b = new THREE.Vector3((sx * (FLAG_W + 0.06)) / 2, FLAG_TOP + 0.01, -0.05);
      const cord = rod(a.distanceTo(b), 0.003);
      cord.position.copy(a).add(b).multiplyScalar(0.5);
      cord.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      this.flag.add(cord);
    }
    for (const m of this.flag.children) m.renderOrder = 6;
    this.group.add(this.flag);
    this.hits.push(cloth);
    if (!social) return;

    const im = mat(1);
    const shapes = iconShape(social.k);
    let icon: THREE.Mesh;
    if (shapes.length) {
      // la marca, extruida 2 cm; en SVG la y va hacia abajo: medio giro en x la endereza sin
      // darle la vuelta a las caras
      const k = SIZE / 24, g = new THREE.ExtrudeGeometry(shapes, { depth: 0.02 / k, bevelEnabled: false, curveSegments: 10 });
      g.translate(-12, -12, -0.01 / k);
      g.scale(k, k, k).rotateX(Math.PI);
      icon = new THREE.Mesh(g, im);
    } else {
      // sin marca conocida: sus iniciales en un plano partido en tiras (las bandas se desplazan)
      im.uniforms.uMap.value = initialsTexture(social.initials || social.k.slice(0, 2).toUpperCase());
      icon = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 24), im);
    }
    icon.renderOrder = 7;
    this.inner.add(icon);
    this.hits.push(icon);
  }

  /** Surge desde `face` (posición de mundo) hasta su sitio; `instant`, ya puesto. */
  appear(face: THREE.Vector3, instant = false) {
    if (this.growing || this.grow > 0) return;
    this.from.copy(face);
    this.grow = instant ? 1 : 0;
    this.growing = !instant;
  }

  /** `home`: su sitio en el mundo; `yaw`: hacia dónde mira su estatua; `right`: su lado (para las bandas). */
  update(dt: number, time: number, home: THREE.Vector3, yaw: number, right: THREE.Vector3, reduced: boolean) {
    if (this.growing) {
      this.grow = Math.min(1, this.grow + dt / 0.6);
      if (this.grow >= 1) this.growing = false;
    }
    const e = 1 - Math.pow(1 - this.grow, 3);
    this.group.position.lerpVectors(this.from, home, e);
    this.group.scale.setScalar(Math.max(e, 1e-3) * this.size);
    const b = time - this.blinkAt;
    this.group.visible = this.grow > 0 && this.power > 0 && !(b > 0 && (b < 0.06 || (b > 0.14 && b < 0.2)));
    // gira despacio sobre sí mismo, para que se lea que es un objeto, no un cartel
    if (!reduced) this.spin += dt;
    // el estandarte y su emblema se vuelven un poco hacia el cursor (el emblema, más)
    this.leanNow += (this.lean - this.leanNow) * (1 - Math.exp(-dt * 5));
    this.group.rotation.y = yaw + this.leanNow * 0.3;
    this.inner.rotation.y = Math.sin(this.spin * 0.5) * 0.25 + this.leanNow * 0.35;

    // a dónde va la mezcla: con el puntero encima, a la marca en 0,3 s; si no, el bucle
    let target: number, rate = 1 / SWAP;
    if (!this.social) target = 0;
    else if (this.hover || this.pinned) (target = 1), (rate = 1 / 0.3);
    else {
      this.t = (this.t + dt) % ((HOLD + SWAP) * 2);
      target = this.t < HOLD || this.t >= HOLD * 2 + SWAP ? 0 : 1;
    }
    this.mix = reduced ? target : this.mix + THREE.MathUtils.clamp(target - this.mix, -rate * dt, rate * dt);
    for (const m of this.mats) {
      m.uniforms.uMix.value = this.mix;
      m.uniforms.uTime.value = reduced ? 0 : time;
      m.uniforms.uShow.value = Math.min(1, this.grow * 1.5) * this.power;
      (m.uniforms.uSide.value as THREE.Vector3).copy(right);
      (m.uniforms.uFwd.value as THREE.Vector3).crossVectors(right, THREE.Object3D.DEFAULT_UP);
    }
  }

  dispose() {
    for (const m of this.mats) {
      if (m.uniforms.uMap.value !== blank) m.uniforms.uMap.value.dispose();
      m.dispose();
    }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.type !== 'BufferGeometry') m.geometry.dispose();
    });
  }
}
