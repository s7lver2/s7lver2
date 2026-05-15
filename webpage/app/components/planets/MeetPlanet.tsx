'use client';
import { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GLSL_UTILS, PLANET_VERT } from './shaders/planetUtils';

const MEET_FRAG = /* glsl */`
  precision highp float;
  ${GLSL_UTILS}

  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3  uSunDir;

  void main() {
    vec3 p = normalize(vPosition);

    // Bandas horizontales suaves (como Venus rosa)
    float lat    = p.y;
    float bands  = sin(lat * 6.0 + fbm(p * 2.5 + uTime * 0.03) * 1.8) * 0.5 + 0.5;
    float clouds = fbm(p * 4.0 + uTime * 0.04 + 3.0);
    float detail = fbm(p * 8.0 - uTime * 0.02 + 9.0);

    vec3 colDeep  = vec3(0.25, 0.03, 0.08);
    vec3 colMid   = vec3(0.65, 0.18, 0.35);
    vec3 colLight = vec3(0.90, 0.50, 0.65);
    vec3 colCloud = vec3(1.00, 0.80, 0.88);

    vec3 col = mix(colDeep, colMid,   bands);
    col      = mix(col,     colLight, smoothstep(0.5, 0.75, clouds));
    col      = mix(col,     colCloud, smoothstep(0.6, 0.75, detail) * 0.5);

    // Casquetes polares rosados muy claros
    float polar = smoothstep(0.70, 0.92, abs(p.y));
    col = mix(col, vec3(1.0, 0.85, 0.90), polar * 0.7);

    // Iluminación
    float diff = clamp(dot(p, normalize(uSunDir)), 0.05, 1.0);
    col *= diff;

    // Especular brillante (planeta con nubes = muy reflectante)
    vec3 refl = reflect(-normalize(uSunDir), p);
    float spec = pow(clamp(dot(refl, vec3(0,0,1)), 0.0, 1.0), 12.0) * 0.8;
    col += vec3(1.0, 0.75, 0.85) * spec;

    // Atmósfera rosa
    float fr = fresnel(vNormal, vec3(0,0,1), 2.5);
    col += vec3(1.0, 0.4, 0.6) * fr * 1.2;

    col = col / (col + vec3(0.65));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MeetMaterial = shaderMaterial(
  { uTime: 0, uSunDir: new THREE.Vector3(2, 1, 1) },
  PLANET_VERT,
  MEET_FRAG,
);
extend({ MeetMaterial });
declare global { namespace JSX { interface IntrinsicElements { meetMaterial: any; } } }

function PinkPlanetMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial & { uTime: number }>(null!);

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.09;
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[1.88, 64, 64]} />
        <meshStandardMaterial color="#ff80a0" transparent opacity={0.09} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.7, 128, 128]} />
        <meetMaterial ref={matRef} uSunDir={[3, 2, 1]} />
      </mesh>
    </>
  );
}

export default function MeetPlanet() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.05} />
      <pointLight position={[8, 6, 8]}   intensity={4.5} color="#ffffff" />
      <pointLight position={[-5, -3, 4]} intensity={1.5} color="#ff60a0" />
      <PinkPlanetMesh />
    </Canvas>
  );
}