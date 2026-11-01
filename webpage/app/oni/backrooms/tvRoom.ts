import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/*
 * La entrada al juego: un cuarto a oscuras con la moqueta y el papel de las backrooms (ya estás
 * dentro, aunque aún no lo sepas) y un televisor de antena en el suelo, encendido. Mientras se
 * descarga todo, la cámara se le acerca; en la pantalla, nieve y la carga de los 90. Al terminar, la
 * cámara se lanza contra el cristal: se cierra la vista, la nieve se come la imagen y estás dentro.
 */

const TV_W = 0.62; // el ancho de la tele, en metros
const EYE = 1.35;
const START = 2.5, NEAR = 1.05, WALK = 0.6; // de dónde sale la cámara, desde dónde ya se puede meter y a qué paso

export class TvRoom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.02, 30);
  private cv = Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
  private ctx = this.cv.getContext('2d')!;
  private tex = new THREE.CanvasTexture(this.cv);
  private screenMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, fog: false });
  private glow = new THREE.PointLight(0xbcd2ff, 0, 7, 1.2);
  private noise = this.ctx.createImageData(160, 120);
  private small = Object.assign(document.createElement('canvas'), { width: 160, height: 120 });
  private z = START; // la cámara, a z de la tele
  private dived = 0; // 0 → 1 mientras se mete dentro
  private screen = new THREE.Vector3(0, 0.3, 0.2); // el centro del cristal (se mide al cargar la tele)
  private screenH = 0.3;
  private screenW = 0.4;
  private ready = false;
  speed = 1;

  constructor(private reduced: boolean) {
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 1.5, 6);
    // el cuarto: 4 × 5 m, techo bajo, con las texturas de las backrooms muy apagadas
    const tl = new THREE.TextureLoader(), tile = (url: string, rx: number, ry: number) => {
      const t = tl.load(url);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile('/models/backrooms/tex/carpet.webp', 3, 4), color: 0x6a6252, roughness: 1 }));
    floor.position.z = 1.5;
    const wallMat = new THREE.MeshStandardMaterial({ map: tile('/models/backrooms/tex/wall.webp', 3, 2), color: 0x7a7258, roughness: 0.95, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 5), wallMat);
    room.position.set(0, 1.25, 1.5);
    this.scene.add(floor, room, this.glow, new THREE.AmbientLight(0x403a30, 0.06));
    // la tele (la de antena de la sala de vigilancia), en el suelo y mirando a la cámara
    const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    gl.load('/models/surveilance_room/antennatv.glb', (g) => {
      const tv = g.scene;
      tv.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeVertexNormals(); // la simplificación le dejó normales rotas
        const mat = m.material as THREE.MeshStandardMaterial;
        if (/^TV_Screen_PBR$/.test(mat.name)) m.material = this.screenMat;
        else mat.emissiveIntensity = Math.min(mat.emissiveIntensity ?? 0, 1); // el piloto viene a x50
      });
      tv.rotation.y = -Math.PI / 2; // su frente es +x
      tv.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(tv), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), k = TV_W / s.x;
      tv.scale.setScalar(k);
      tv.position.set(-c.x * k, -b.min.y * k, -c.z * k);
      this.scene.add(tv);
      tv.updateMatrixWorld(true);
      // dónde está el cristal, para mirarlo y meterse justo en él
      tv.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.material !== this.screenMat) return;
        const sb = new THREE.Box3().setFromObject(m);
        sb.getCenter(this.screen);
        this.screen.z = sb.max.z;
        this.screenH = sb.max.y - sb.min.y;
        this.screenW = sb.max.x - sb.min.x;
        // sus UV son de un atlas: la imagen entera, proyectada de frente sobre el cristal
        const p = m.geometry.getAttribute('position'), uv = new Float32Array(p.count * 2), v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
          uv[i * 2] = (v.x - sb.min.x) / (sb.max.x - sb.min.x);
          uv[i * 2 + 1] = (v.y - sb.min.y) / this.screenH;
        }
        m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      });
      // la sombra donde apoya (sin luces con sombra: una mancha oscura, suave)
      const blob = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), bx = blob.getContext('2d')!;
      const grad = bx.createRadialGradient(32, 32, 4, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,0.85)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      bx.fillStyle = grad;
      bx.fillRect(0, 0, 64, 64);
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(TV_W * 1.3, (s.z / s.x) * TV_W * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
      shadow.position.y = 0.003;
      this.scene.add(shadow);
      this.glow.position.set(this.screen.x, this.screen.y + 0.1, this.screen.z + 0.5);
      this.ready = true;
    }, undefined, () => {
      // sin tele, al menos su pantalla flotando en lo oscuro: que la entrada no se quede esperando
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.35), this.screenMat);
      sc.position.copy(this.screen);
      this.screenH = 0.35;
      this.screenW = 0.46;
      this.scene.add(sc);
      this.ready = true;
    });
    if (reduced) this.z = NEAR;
  }

  /** La pantalla de la tele: nieve y, encima, la carga en letra blanca con su barra de bloques; al meterse, solo nieve. */
  private draw(t: number, progress: number, failed: boolean, snow: number) {
    const x = this.ctx, d = this.noise.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * (120 + 135 * snow);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    this.small.getContext('2d')!.putImageData(this.noise, 0, 0);
    x.imageSmoothingEnabled = false;
    x.drawImage(this.small, 0, 0, 320, 240);
    if (snow < 0.5) {
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.fillRect(0, 0, 320, 240);
      x.fillStyle = '#ecebe4';
      x.font = 'bold 18px monospace';
      x.fillText('BACKROOMS', 22, 50);
      x.font = '11px monospace';
      if (failed) x.fillText('Failed to load. Press any key.', 22, 80);
      else {
        x.fillText('Loading assets...', 22, 80);
        x.fillText('this may take a while.', 22, 96);
        for (let i = 0; i < 20; i++) {
          x.fillStyle = i < Math.floor(progress * 20) ? '#ecebe4' : '#2a2a26';
          x.fillRect(22 + i * 13, 114, 10, 12);
        }
        x.fillStyle = '#8d8b80';
        x.fillText(`${String(Math.round(progress * 100)).padStart(3, ' ')}%`, 22, 146);
      }
    }
    // líneas de barrido
    x.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = (t * 40) % 3 | 0; y < 240; y += 3) x.fillRect(0, y, 320, 1);
    this.tex.needsUpdate = true;
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Un fotograma: la cámara se acerca (más deprisa con `speed`) o, tras `dive`, se lanza contra la pantalla. */
  update(dt: number, t: number, progress: number, failed: boolean) {
    // al lanzarse: acelera (sale despacio y llega de golpe)
    const k = this.dived * this.dived * this.dived;
    this.draw(t, progress, failed, Math.min(1, this.dived * 1.8));
    // la tele parpadea con lo que enseña (sin tele aún, nada se ve)
    this.glow.intensity = this.ready ? 3.2 + Math.sin(t * 23) * 0.4 + (Math.random() - 0.5) * 0.7 + k * 6 : 0;
    if (!this.reduced && this.ready) this.z = Math.max(NEAR, this.z - dt * WALK * this.speed);
    // a la distancia en que el cristal llena la vista, y la vista cerrándose
    this.camera.fov = THREE.MathUtils.lerp(50, 30, k);
    this.camera.updateProjectionMatrix();
    // al final, la nieve de lado a lado (lo que pida más cerca: el alto o el ancho del cristal)
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fill = this.screen.z + Math.min(this.screenH / 2 / tan, this.screenW / 2 / (tan * this.camera.aspect)) * 0.8;
    const z = THREE.MathUtils.lerp(this.z, fill, k), y = THREE.MathUtils.lerp(EYE - (START - this.z) * 0.35, this.screen.y, k);
    const sway = this.reduced ? 0 : (1 - k) * 0.012, shake = this.reduced ? 0 : k * 0.006;
    this.camera.position.set(this.screen.x + Math.sin(t * 0.7) * sway + (Math.random() - 0.5) * shake, y + Math.sin(t * 1.3) * sway, z);
    this.camera.lookAt(this.screen.x, this.screen.y, this.screen.z);
  }

  /** Ya está lo bastante cerca para meterse (el paseo hasta la tele siempre se ve). */
  get near() {
    return this.ready && (this.reduced || this.z <= NEAR + 0.01);
  }

  /** Meterse en la tele: avanza `dived` de 0 a 1 en `secs`. */
  dive(dt: number, secs: number) {
    this.dived = Math.min(1, this.dived + dt / secs);
    return this.dived >= 1;
  }

  dispose() {
    this.tex.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
  }
}
