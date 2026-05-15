'use client';
import { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GLSL_UTILS, PLANET_VERT } from './shaders/planetUtils';

const ICE_FRAG = /* glsl */`
  precision highp float;
  ${GLSL_UTILS}

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3  uSunDir;  // dirección del sol

  void main() {
    vec3 p = normalize(vPosition);

    // Terreno helado
    float terrain = fbm(p * 4.0 + uTime * 0.03);
    float iceCaps = smoothstep(0.6, 0.9, abs(p.y));
    float ocean   = smoothstep(0.35, 0.4, terrain);

    // Paleta: océano azul profundo, tierra azul-gris, casquetes blancos
    vec3 colOcean  = vec3(0.02, 0.06, 0.22);
    vec3 colLand   = vec3(0.15, 0.30, 0.55);
    vec3 colShelf  = vec3(0.25, 0.50, 0.80);
    vec3 colIce    = vec3(0.85, 0.92, 1.00);

    vec3 col = mix(colOcean, colLand,  ocean);
    col      = mix(col,      colShelf, smoothstep(0.4, 0.6, terrain));
    col      = mix(col,      colIce,   iceCaps);

    // Nubes
    float clouds = fbm(p * 5.0 - uTime * 0.05 + 10.0);
    float cloudMask = smoothstep(0.55, 0.70, clouds);
    col = mix(col, vec3(0.88, 0.94, 1.00), cloudMask * 0.75);

    // Iluminación difusa (sol)
    float diff = clamp(dot(p, normalize(uSunDir)), 0.0, 1.0);
    col *= 0.15 + 0.85 * diff;

    // Especular (oceano)
    vec3 reflDir = reflect(-normalize(uSunDir), p);
    float spec = pow(clamp(dot(reflDir, vec3(0,0,1)), 0.0, 1.0), 32.0) * (1.0 - ocean) * 0.5;
    col += vec3(0.6, 0.8, 1.0) * spec;

    // Atmósfera (Fresnel)
    float fr = fresnel(vNormal, vec3(0,0,1), 3.0);
    col += vec3(0.2, 0.5, 1.0) * fr * 0.9;

    col = col / (col + vec3(0.7));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const IceMaterial = shaderMaterial(
  { uTime: 0, uSunDir: new THREE.Vector3(1, 1, 1) },
  PLANET_VERT,
  ICE_FRAG,
);
extend({ IceMaterial });

declare global { namespace JSX { interface IntrinsicElements { iceMaterial: any; } } }

function IcePlanetMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial & { uTime: number }>(null!);

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.12;
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.7, 128, 128]} />
      <iceMaterial ref={matRef} uSunDir={[2, 1.5, 2]} />
    </mesh>
  );
}

// Atmósfera exterior
function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.85, 64, 64]} />
      <meshStandardMaterial
        color="#4080ff"
        transparent
        opacity={0.06}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function SkillsPlanet() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.05} />
      <pointLight position={[8, 6, 8]}   intensity={4}   color="#ffffff" />
      <pointLight position={[-4, -3, 2]} intensity={0.8} color="#2040aa" />
      <Atmosphere />
      <IcePlanetMesh />
    </Canvas>
  );
}