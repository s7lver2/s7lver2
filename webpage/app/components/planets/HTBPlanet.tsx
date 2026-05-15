'use client';
import { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { GLSL_UTILS, PLANET_VERT } from './shaders/planetUtils';

const HTB_FRAG = /* glsl */`
  precision highp float;
  ${GLSL_UTILS}

  varying vec3 vNormal;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3  uSunDir;

  void main() {
    vec3 p = normalize(vPosition);

    // Continentes vs ocean: HTB tiene aspecto cyberpunk-naturaleza
    float terrain = fbm(p * 4.5 + uTime * 0.015);
    float grid    = fbm(p * 12.0 - uTime * 0.02 + 5.0); // detalles finos

    float land  = smoothstep(0.38, 0.45, terrain);
    float polar = smoothstep(0.75, 0.95, abs(p.y));

    // Paleta: verde esmeralda oscuro / negro / verde neón en bordes
    vec3 colOcean = vec3(0.01, 0.05, 0.03);
    vec3 colLand  = vec3(0.05, 0.22, 0.08);
    vec3 colForest= vec3(0.08, 0.38, 0.12);
    vec3 colNeon  = vec3(0.10, 0.90, 0.30);   // verde HTB característico
    vec3 colPolar = vec3(0.02, 0.12, 0.05);

    vec3 col = mix(colOcean, colLand,   land);
    col      = mix(col,      colForest, smoothstep(0.45, 0.6, terrain) * land);
    col      = mix(col,      colPolar,  polar);
    // Líneas neon en bordes de continente
    float edge = abs(terrain - 0.42) < 0.02 ? 1.0 : 0.0;
    col = mix(col, colNeon, edge * 0.6);

    // Grid tecnológico sutil
    col += colNeon * smoothstep(0.62, 0.65, grid) * 0.08 * land;

    // Iluminación
    float diff = clamp(dot(p, normalize(uSunDir)), 0.05, 1.0);
    col *= diff;

    // Especular en océanos
    vec3 refl = reflect(-normalize(uSunDir), p);
    float spec = pow(clamp(dot(refl, vec3(0,0,1)), 0.0, 1.0), 24.0) * (1.0 - land) * 0.6;
    col += vec3(0.1, 1.0, 0.3) * spec;

    // Atmósfera Fresnel verde neón
    float fr = fresnel(vNormal, vec3(0,0,1), 3.0);
    col += vec3(0.05, 0.8, 0.2) * fr * 1.1;

    col = col / (col + vec3(0.7));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const HTBMaterial = shaderMaterial(
  { uTime: 0, uSunDir: new THREE.Vector3(2, 1.5, 2) },
  PLANET_VERT,
  HTB_FRAG,
);
extend({ HTBMaterial });
declare global { namespace JSX { interface IntrinsicElements { hTBMaterial: any; } } }

function GreenPlanetMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial & { uTime: number }>(null!);

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.10;
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[1.88, 64, 64]} />
        <meshStandardMaterial color="#00ff44" transparent opacity={0.07} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.7, 128, 128]} />
        <hTBMaterial ref={matRef} uSunDir={[3, 2, 2]} />
      </mesh>
    </>
  );
}

export default function HTBPlanet() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.04} />
      <pointLight position={[8, 6, 8]}   intensity={4}   color="#ffffff" />
      <pointLight position={[-5, -3, 3]} intensity={1.2} color="#00ff44" />
      <GreenPlanetMesh />
    </Canvas>
  );
}