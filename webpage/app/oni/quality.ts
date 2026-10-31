import * as THREE from 'three';

/**
 * Sombras suaves solo donde compilar sale gratis. Sin compilación en paralelo (Firefox) cada
 * programa se compila en el hilo principal, y con sombras PCF cuesta dos o tres veces más que con
 * las básicas (~0,4 s frente a ~0,15 s, medido): con el grano y el bloom no se nota la diferencia.
 */
export const shadowType = (r: THREE.WebGLRenderer) =>
  r.extensions.has('KHR_parallel_shader_compile') ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;

/** Los escalones de densidad de píxeles: de la de partida (hasta 1,75) a 0,75. */
const FLOOR = 0.75, STEP = 0.25;

/**
 * Resolución adaptable: si un segundo entero va por debajo de ~45 fps (más de 22 ms por fotograma),
 * baja la densidad de píxeles un escalón y redimensiona; deja 1,5 s para que se asiente antes de
 * volver a medir. No vuelve a subir (oscilaría). El renderer es el mismo de escena en escena, así
 * que lo que baja en una se queda para las siguientes. Lo que se ve lento en un navegador (Firefox,
 * un portátil) pasa a ir fluido, un poco más blando.
 */
export function governor(renderer: THREE.WebGLRenderer, resize: () => void) {
  let acc = 0, n = 0, wait = 1.5;
  return (dt: number) => {
    if (dt <= 0 || (wait -= dt) > 0) return;
    acc += dt;
    n++;
    if (acc < 1) return;
    const ms = (acc / n) * 1000, pr = renderer.getPixelRatio();
    acc = n = 0;
    if (ms <= 22 || pr <= FLOOR) return;
    renderer.setPixelRatio(Math.max(FLOOR, pr - STEP));
    resize();
    wait = 1.5;
  };
}
