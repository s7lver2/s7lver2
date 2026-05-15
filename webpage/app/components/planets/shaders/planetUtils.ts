// app/components/planets/shaders/planetUtils.ts
// Funciones GLSL compartidas entre todos los planetas.
// Se usan como template literal para inyectar en fragmentShader.

export const GLSL_UTILS = /* glsl */`
  // ---- Hash & Noise ----
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0 + 113.0 * i.z;
    return mix(
      mix(mix(hash(n),      hash(n+1.0),   f.x),
          mix(hash(n+57.0), hash(n+58.0),  f.x), f.y),
      mix(mix(hash(n+113.0),hash(n+114.0), f.x),
          mix(hash(n+170.0),hash(n+171.0), f.x), f.y),
      f.z
    );
  }

  // Fractal Brownian Motion — 6 octavas
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3  shift = vec3(100.0);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Fresnel — simula scattering atmosférico
  float fresnel(vec3 normal, vec3 viewDir, float power) {
    return pow(1.0 - clamp(dot(normalize(normal), normalize(viewDir)), 0.0, 1.0), power);
  }
`;

// Vertex shader estándar para planetas (pasa uv, normal, posición al frag)
export const PLANET_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;

  void main() {
    vUv       = uv;
    vNormal   = normalize(normalMatrix * normal);
    vPosition = position;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;