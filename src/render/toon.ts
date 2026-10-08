import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
/** 3-band cartoon shading ramp (soft Supercell-like toon look). */
export function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: string, opts: { emissive?: string; transparent?: boolean; opacity?: number } = {}) {
  const k = color + (opts.emissive ?? '') + (opts.opacity ?? '');
  let m = toonCache.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = 0.6;
    }
    if (opts.transparent) {
      m.transparent = true;
      m.opacity = opts.opacity ?? 0.5;
      m.depthWrite = false;
    }
    toonCache.set(k, m);
  }
  return m;
}

/** Vertex coloured toon material (one per character, so hit flashes stay per-instance). */
export function vertexToon() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  m.emissive = new THREE.Color(0x000000);
  return m;
}

const outlineMats = new Map<string, THREE.ShaderMaterial>();
/** Inverted-hull outline: vertices pushed along normals, back faces only. */
export function outlineMaterial(thickness = 0.04, color = '#1b1035') {
  const k = thickness + color;
  let m = outlineMats.get(k);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: { uThick: { value: thickness }, uColor: { value: new THREE.Color(color) } },
      vertexShader: `uniform float uThick;
        void main(){
          vec3 p = position + normal * uThick;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor,1.0); }`,
      side: THREE.BackSide,
    });
    outlineMats.set(k, m);
  }
  return m;
}

export function setOutlinesEnabled(enabled: boolean) {
  outlinesOn = enabled;
}
export let outlinesOn = true;

/** Soft round blob shadow texture. */
let blobTex: THREE.Texture | null = null;
export function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
const blobMat = new Map<number, THREE.MeshBasicMaterial>();
export function blobShadow(size: number, opacity = 1) {
  let m = blobMat.get(opacity);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, opacity });
    blobMat.set(opacity, m);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}

/** Radial glow sprite texture used by particles and auras. */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * (amt < 0 ? 1.05 : 1)), Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}
