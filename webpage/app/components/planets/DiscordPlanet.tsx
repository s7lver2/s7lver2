'use client';
import { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GLSL_UTILS, PLANET_VERT } from './shaders/planetUtils';

const DISCORD_FRAG = /* glsl */`
  precision highp float;
  ${GLSL_UTILS}

  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3  uSunDir;

  void main() {
    vec3 p = normalize(vPosition);

    // Bandas de tormenta (como Neptuno)
    float lat    = p.y;
    float bands  = sin(lat * 8.0 + fbm(p * 3.0 + uTime * 0.04) * 2.5) * 0.5 + 0.5;
    float swirl  = fbm(p * 5.0 - uTime * 0.06 + 7.0);
    float storm  = fbm(p * 9.0 + uTime * 0.02 + 13.0);

    // Paleta: morado profundo, índigo, azul-violeta
    vec3 colDeep   = vec3(0.04, 0.01, 0.12);
    vec3 colMid    = vec3(0.18, 0.05, 0.45);
    vec3 colBright = vec3(0.40, 0.15, 0.85);
    vec3 colSwirl  = vec3(0.55, 0.25, 1.00);

    vec3 col = mix(colDeep, colMid,    bands);
    col      = mix(col,     colBright, swirl * 0.6);
    col      = mix(col,     colSwirl,  storm * 0.4);

    // Gran tormenta ovalada (como ojo de Júpiter pero morada)
    vec2 stormCenter = vec2(0.3, 0.2);
    float distStorm = length(vec2(p.x - stormCenter.x, p.y - stormCenter.y) * vec2(2.0, 3.0));
    float eye = smoothstep(0.25, 0.0, distStorm);
    col = mix(col, vec3(0.8, 0.5, 1.0), eye * 0.8);

    // Iluminación
    float diff = clamp(dot(p, normalize(uSunDir)), 0.05, 1.0);
    col *= diff;

    // Atmósfera morada intensa
    float fr = fresnel(vNormal, vec3(0,0,1), 2.5);
    col += vec3(0.5, 0.15, 1.0) * fr * 1.5;

    col = col / (col + vec3(0.65));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const DiscordMaterial = shaderMaterial(
  { uTime: 0, uSunDir: new THREE.Vector3(2, 1, 1) },
  PLANET_VERT,
  DISCORD_FRAG,
);
extend({ DiscordMaterial });
declare global { namespace JSX { interface IntrinsicElements { discordMaterial: any; } } }

function PurplePlanetMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial & { uTime: number }>(null!);

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.13;
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[1.88, 64, 64]} />
        <meshStandardMaterial color="#7020cc" transparent opacity={0.10} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.7, 128, 128]} />
        <discordMaterial ref={matRef} uSunDir={[3, 2, 1]} />
      </mesh>
    </>
  );
}

export default function DiscordPlanet() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.05} />
      <pointLight position={[8, 6, 8]}   intensity={4}   color="#ffffff" />
      <pointLight position={[-5, -3, 4]} intensity={2}   color="#8030ff" />
      <PurplePlanetMesh />
    </Canvas>
  );
}