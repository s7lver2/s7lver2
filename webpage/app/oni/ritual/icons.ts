import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { IconType } from 'react-icons';
import {
  SiBluesky, SiDiscord, SiGithub, SiHackthebox, SiInstagram, SiLinkedin, SiMastodon, SiReddit, SiTiktok, SiTwitch, SiX, SiYoutube,
} from 'react-icons/si';

/*
 * Las marcas de las redes, de verdad (Simple Icons, vía react-icons): el `d` de sus trazados se
 * saca llamando al componente y leyendo el árbol, sin pintarlo, y three lo convierte en formas.
 */
const ICONS: Record<string, IconType> = {
  github: SiGithub, discord: SiDiscord, twitter: SiX, x: SiX, tiktok: SiTiktok, instagram: SiInstagram, htb: SiHackthebox,
  linkedin: SiLinkedin, youtube: SiYoutube, twitch: SiTwitch, reddit: SiReddit, mastodon: SiMastodon, bluesky: SiBluesky,
};

type Node = { props?: { d?: string; children?: unknown } } | Node[] | null | undefined;
const paths = (n: Node, out: string[] = []): string[] => {
  if (Array.isArray(n)) n.forEach((c) => paths(c, out));
  else if (n?.props) {
    if (n.props.d) out.push(n.props.d);
    paths(n.props.children as Node, out);
  }
  return out;
};

/** Las formas de la marca de `k` en su caja de 24×24 (y hacia abajo, como en SVG); [] si no hay. */
export function iconShape(k: string): THREE.Shape[] {
  const I = ICONS[k.toLowerCase()];
  if (!I) return [];
  const d = paths(I({}) as Node);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${d.map((p) => `<path d="${p}"/>`).join('')}</svg>`;
  return new SVGLoader().parse(svg).paths.flatMap((p) => SVGLoader.createShapes(p));
}

/** Para una red sin marca: sus iniciales en la letra de la web, blancas sobre transparente. */
export function initialsTexture(text: string) {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), x = c.getContext('2d')!;
  const family = getComputedStyle(document.body).getPropertyValue('--font-tanker').trim() || 'Impact';
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `400 ${text.length > 2 ? 110 : 150}px ${family}, Impact, sans-serif`;
  x.fillText(text, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
