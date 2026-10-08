import * as THREE from 'three';
import { setOutlinesEnabled } from './toon';

export type Quality = 'low' | 'medium' | 'high' | 'ultra';

/** Shared WebGL renderer with quality presets (pixel ratio, shadows, outlines). */
export class Renderer {
  r: THREE.WebGLRenderer;
  quality: Quality = 'high';
  performance = false;
  shadows = false;
  constructor(public canvas: HTMLCanvasElement) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.NoToneMapping;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setQuality(q: Quality, performance: boolean) {
    this.quality = performance ? 'low' : q;
    this.performance = performance;
    this.shadows = this.quality === 'high' || this.quality === 'ultra';
    this.r.shadowMap.enabled = this.shadows;
    setOutlinesEnabled(this.quality !== 'low');
    this.resize();
  }
  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    switch (this.quality) {
      case 'low':
        return Math.min(dpr, 0.85);
      case 'medium':
        return Math.min(dpr, 1.25);
      case 'high':
        return Math.min(dpr, 1.75);
      case 'ultra':
        return Math.min(dpr, 2.5);
    }
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.r.setPixelRatio(this.pixelRatio());
    this.r.setSize(w, h, false);
  }
  get aspect() {
    return window.innerWidth / Math.max(1, window.innerHeight);
  }
}

export function makeLights(scene: THREE.Scene, light: string, ambient: string, shadows: boolean, size = 30) {
  const hemi = new THREE.HemisphereLight(ambient, '#3a2a4a', 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(light, 2.1);
  sun.position.set(-12, 30, 14);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera as THREE.OrthographicCamera;
    c.left = -size;
    c.right = size;
    c.top = size;
    c.bottom = -size;
    c.near = 1;
    c.far = 90;
    sun.shadow.bias = -0.0015;
  }
  scene.add(sun);
  scene.add(sun.target);
  const rim = new THREE.DirectionalLight('#bfe6ff', 0.6);
  rim.position.set(10, 8, -20);
  scene.add(rim);
  return { hemi, sun, rim };
}
