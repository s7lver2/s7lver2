import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { makePenthouse, GLASS, CEIL } from './penthouse';

/*
 * La sala: la mesa de banquete cruzando el plano, en el ático (penthouse.ts), y la luz. Medidas en m;
 * la mesa va centrada en el origen, con el borde de delante (el de la cámara) en +z.
 */

/** La mesa (la de banquete, estirada a lo largo para los trece). */
export const TABLE = { w: 6.6, d: 0.96, top: 0.73 };
export const BG = new THREE.Color(0x070303);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glbs = new Map<string, Promise<THREE.Group>>();
/** Un glb, cargado una vez; cada llamada devuelve un clon (comparte geometría y texturas). */
export async function glb(url: string) {
  if (!glbs.has(url)) glbs.set(url, loader.loadAsync(url).then((g) => g.scene));
  const g = (await glbs.get(url)!).clone();
  g.traverse((o) => void (o.castShadow = o.receiveShadow = (o as THREE.Mesh).isMesh));
  return g;
}

/**
 * El ático (ver penthouse.ts) con la mesa de banquete (5,24 m de serie, estirada a lo largo) y, abajo
 * al otro lado del cristal, la ciudad: el modelo, enorme y lejos, con sus ventanas encendidas.
 */
export async function makeHall(low: boolean) {
  const ph = makePenthouse(low);
  const [table, city] = await Promise.all([glb('/models/supper/table.glb'), glb('/models/supper/city.glb')]);
  table.scale.set(TABLE.w / 5.24, 1, 1);
  // la ciudad: unos 110 m de ancho, empezando a 12 m del cristal; las torres más altas asoman
  // por encima de las cabezas de los robots, por el ventanal. De noche, su propia textura la
  // alumbra (las ventanas) y nada más: sin niebla ni sombras
  city.scale.setScalar(12);
  const b = new THREE.Box3().setFromObject(city);
  city.position.set(-(b.min.x + b.max.x) / 2, 16 - b.max.y, GLASS - 12 - b.max.z);
  city.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = false;
    const mt = m.material as THREE.MeshStandardMaterial;
    mt.color.multiplyScalar(0.05);
    mt.emissiveMap = mt.map;
    mt.emissive.set(0x3a1e18);
    mt.fog = false;
  });
  ph.group.add(table, city);
  return ph;
}

/**
 * La luz, a oscuras: un foco cálido y estrecho sobre el del centro (el único que da sombra), dos
 * más débiles sobre cada lado, y por detrás, muy poco, lo que entra por el ventanal. Lo demás, negro.
 */
export function makeLights(low: boolean) {
  const g = new THREE.Group();
  const spot = (x: number, color: number, power: number, angle: number, shadow: boolean) => {
    const s = new THREE.SpotLight(color, power, 9, THREE.MathUtils.degToRad(angle), 0.6, 1.8);
    s.position.set(x, CEIL - 0.2, 0.6);
    s.target.position.set(x, 0.8, -0.4);
    s.castShadow = shadow;
    if (shadow) {
      s.shadow.mapSize.setScalar(low ? 1024 : 2048);
      s.shadow.bias = -0.0004;
      s.shadow.normalBias = 0.02;
    }
    g.add(s, s.target);
    return s;
  };
  spot(0, 0xffc58a, 30, 15, true);
  spot(-2.1, 0xff8a5a, 20, 24, false);
  spot(2.1, 0xff8a5a, 20, 24, false);
  // los contraluces: detrás de cada trío, altos, recortan a los que pelean (negros) con un filo frío
  // contra el rojo del fondo; así la pelea se lee aunque la sala esté a oscuras
  for (const x of [-2.4, -1.1, 1.1, 2.4]) {
    const r = new THREE.SpotLight(0xc8d2e6, 15, 6, 0.5, 0.85, 1.5);
    r.position.set(x, 2.6, -1.8);
    r.target.position.set(x, 1.15, 0);
    g.add(r, r.target);
  }
  // la ciudad por el ventanal: un contraluz frío y apagado que recorta a los robots (negros) contra
  // el cristal, y el rojo de los neones desde abajo
  const city = new THREE.DirectionalLight(0x8a96a8, 0.55);
  city.position.set(-1.5, 8, GLASS - 4);
  const neon = new THREE.DirectionalLight(0xff2a18, 1.1);
  neon.position.set(1.5, -0.5, GLASS - 4);
  const fill = new THREE.HemisphereLight(0x2a1512, 0x000000, 0.05);
  g.add(city, neon, fill);
  return g;
}

/** Las sillas: las de la biblioteca (madera oscura de respaldo alto). */
export const chair = () => glb('/models/library/chair.glb');
