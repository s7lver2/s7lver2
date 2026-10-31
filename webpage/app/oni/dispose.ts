import * as THREE from 'three';

/**
 * Suelta de la GPU todo lo que cuelga de `root`: geometrías, materiales y sus texturas. Las escenas
 * comparten un solo renderer de la habitación a la cena, y material.dispose() no suelta las
 * texturas: sin esto, al llegar a la cena seguían en memoria las de todas las anteriores. Una
 * textura compartida con la escena siguiente (la máscara, cacheada) se vuelve a subir sola al usarse.
 */
export function disposeDeep(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
      for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u) for (const k in u) if ((u[k].value as THREE.Texture)?.isTexture) (u[k].value as THREE.Texture).dispose();
      mat.dispose();
    }
  });
}
