'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/*
 * Galería de depuración: cada modelo escalado a 1 m por su lado más largo, en rejilla, flotando
 * y girando despacio, con su nombre debajo. Ratón para orbitar (derecho para desplazar, rueda
 * para acercar) y WASD / flechas para moverse; Q y E bajan y suben. Los modelos con animaciones
 * salen además en una fila delante, una copia por clip, cada una con el suyo en bucle.
 */

const GAP = 1.8;

function label(text: string) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 64 });
  const x = c.getContext('2d')!;
  x.font = '28px ui-monospace, Consolas, monospace';
  x.fillStyle = '#e8e2dc';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(1.6, 0.2, 1);
  return s;
}

export default function Gallery({ urls }: { urls: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let alive = true; // en desarrollo el efecto se monta dos veces: las cargas del primero no cuentan
    const r = new THREE.WebGLRenderer({ canvas: canvas.current!, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151212);
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.DirectionalLight(0xffffff, 1.5).translateY(5).translateZ(3));
    const grid = new THREE.GridHelper(80, 80, 0x3a3030, 0x241e1e);
    grid.position.y = -0.8;
    scene.add(grid);

    const cols = Math.ceil(Math.sqrt(urls.length));
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    const mid = ((cols - 1) * GAP) / 2;
    camera.position.set(mid, 2.5, mid + 6);
    const controls = new OrbitControls(camera, r.domElement);
    controls.target.set(mid, 0, mid);
    controls.enableDamping = true;

    const floaters: { o: THREE.Object3D; ph: number }[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    let row = 0;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    urls.forEach((url, i) => {
      const slot = new THREE.Group();
      slot.position.set((i % cols) * GAP, 0, Math.floor(i / cols) * GAP);
      const name = label(url.replace('/models/', '').replace('.glb', ''));
      name.position.y = -0.65;
      slot.add(name);
      scene.add(slot);
      loader.load(url, (g) => {
        if (!alive) return;
        const m = g.scene;
        m.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(m), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const k = 1 / Math.max(size.x, size.y, size.z, 1e-6);
        const pivot = new THREE.Group();
        m.scale.setScalar(k);
        m.position.copy(c).multiplyScalar(-k);
        pivot.add(m);
        slot.add(pivot);
        floaters.push({ o: pivot, ph: i * 0.7 });
        // una copia por animación, en fila delante de la rejilla
        g.animations.forEach((clip, k) => {
          const copy = cloneSkinned(pivot);
          copy.position.set(k * GAP, 0, -GAP * (2 + row));
          const name = label(clip.name);
          name.position.set(k * GAP, -0.65, -GAP * (2 + row));
          scene.add(copy, name);
          const mx = new THREE.AnimationMixer(copy);
          mx.clipAction(clip).play();
          mixers.push(mx);
        });
        if (g.animations.length) row++;
        setLoaded((n) => n + 1);
      });
    });

    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    const resize = () => {
      r.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    addEventListener('resize', resize);

    let raf = 0, last = performance.now();
    const fwd = new THREE.Vector3(), side = new THREE.Vector3(), move = new THREE.Vector3();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
      last = now;
      for (const m of mixers) m.update(dt);
      for (const f of floaters) {
        f.o.position.y = Math.sin(t * 1.2 + f.ph) * 0.06;
        f.o.rotation.y = t * 0.3 + f.ph;
      }
      // WASD: se mueven a la vez la cámara y el punto al que mira
      camera.getWorldDirection(fwd).setY(0).normalize();
      side.crossVectors(fwd, camera.up);
      move.set(0, 0, 0);
      if (keys.has('w') || keys.has('arrowup')) move.add(fwd);
      if (keys.has('s') || keys.has('arrowdown')) move.sub(fwd);
      if (keys.has('d') || keys.has('arrowright')) move.add(side);
      if (keys.has('a') || keys.has('arrowleft')) move.sub(side);
      if (keys.has('e')) move.y += 1;
      if (keys.has('q')) move.y -= 1;
      move.multiplyScalar(dt * (keys.has('shift') ? 9 : 3.5));
      camera.position.add(move);
      controls.target.add(move);
      controls.update();
      r.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('resize', resize);
      controls.dispose();
      pm.dispose();
      r.dispose();
    };
  }, [urls]);

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#151212' }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
      <p style={{ position: 'absolute', left: 16, top: 16, margin: 0, color: '#bdb4ae', font: '12px ui-monospace, Consolas, monospace' }}>
        {loaded}/{urls.length} · drag orbit · right-drag pan · wheel zoom · WASD move · Q/E down/up · shift faster
      </p>
    </main>
  );
}
