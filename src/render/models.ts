import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModelDef, Palette } from '../data/jackers';
import type { Accessory } from '../data/skins';
import { outlineMaterial, outlinesOn, shade, vertexToon, blobShadow, toon } from './toon';

// ------------------------------------------------------------ geometry cache
const geoCache = new Map<string, THREE.BufferGeometry>();
function base(kind: string): THREE.BufferGeometry {
  let g = geoCache.get(kind);
  if (g) return g;
  switch (kind) {
    case 'sphere':
      g = new THREE.SphereGeometry(1, 14, 10);
      break;
    case 'pebble':
      g = new RoundedBoxGeometry(1, 1, 1, 3, 0.4);
      break;
    case 'sphereLo':
      g = new THREE.SphereGeometry(1, 10, 8);
      break;
    case 'cone':
      g = new THREE.ConeGeometry(1, 1, 12);
      break;
    case 'cyl':
      g = new THREE.CylinderGeometry(1, 1, 1, 12);
      break;
    case 'box':
      g = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'rbox':
      g = new RoundedBoxGeometry(1, 1, 1, 2, 0.18);
      break;
    case 'torus':
      g = new THREE.TorusGeometry(1, 0.25, 8, 20);
      break;
    case 'octa':
      g = new THREE.OctahedronGeometry(1, 0);
      break;
    case 'capsule':
      g = new THREE.CapsuleGeometry(0.5, 1, 4, 10);
      break;
    case 'halfSphere':
      g = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      break;
    default:
      throw new Error('geo ' + kind);
  }
  g.deleteAttribute('uv');
  const ni = g.index ? g.toNonIndexed() : g;
  geoCache.set(kind, ni);
  return ni;
}

type V3 = [number, number, number];
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

class PartGroup {
  geos: THREE.BufferGeometry[] = [];
  glow: { geo: THREE.BufferGeometry; color: string }[] = [];
  add(kind: string, color: string, pos: V3, scale: V3 | number, rot: V3 = [0, 0, 0]) {
    const g = base(kind).clone();
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    tmpE.set(rot[0], rot[1], rot[2]);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(new THREE.Vector3(...pos), tmpQ, new THREE.Vector3(s[0], s[1], s[2]));
    g.applyMatrix4(tmpM);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.geos.push(g);
    return this;
  }
  addGlow(kind: string, color: string, pos: V3, scale: V3 | number, rot: V3 = [0, 0, 0]) {
    const g = base(kind).clone();
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
    tmpE.set(rot[0], rot[1], rot[2]);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(new THREE.Vector3(...pos), tmpQ, new THREE.Vector3(s[0], s[1], s[2]));
    g.applyMatrix4(tmpM);
    this.glow.push({ geo: g, color });
    return this;
  }
  build(mat: THREE.Material, outline: boolean, thick: number): THREE.Group {
    const grp = new THREE.Group();
    if (this.geos.length) {
      const merged = mergeGeometries(this.geos, false)!;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      grp.add(mesh);
      if (outline && outlinesOn) {
        const o = new THREE.Mesh(merged, outlineMaterial(thick));
        grp.add(o);
      }
    }
    for (const gl of this.glow) {
      const m = new THREE.Mesh(gl.geo, new THREE.MeshBasicMaterial({ color: gl.color, transparent: true, opacity: 0.95 }));
      m.userData.glow = true;
      grp.add(m);
    }
    return grp;
  }
}

export interface Rig {
  root: THREE.Group;
  /** scaled model container (animations apply inside) */
  model: THREE.Group;
  hips: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tail: THREE.Group;
  wings: THREE.Group[];
  eyes: THREE.Group;
  brows: THREE.Group[];
  extras: THREE.Group;
  sparks: THREE.Group | null;
  material: THREE.MeshToonMaterial;
  height: number;
  plan: string;
  shadow: THREE.Mesh;
  scale: number;
}

export interface BuildOpts {
  accessory?: Accessory;
  glow?: string;
  outline?: boolean;
  bigHead?: number;
}

/** Procedural stylised creature/character builder (chunky silhouettes, big expressive eyes). */
export function buildCreature(m: ModelDef, p: Palette, opts: BuildOpts = {}): Rig {
  const mat = vertexToon();
  const outline = opts.outline !== false;
  const thick = 0.035;
  const b = m.body;
  const h = m.head * (opts.bigHead ?? 1);
  const dark = shade(p.main, -0.18);
  const G = () => new PartGroup();
  const body = G(),
    head = G(),
    armL = G(),
    armR = G(),
    legL = G(),
    legR = G(),
    tail = G(),
    wingL = G(),
    wingR = G(),
    eyes = G(),
    browL = G(),
    browR = G(),
    extra = G(),
    sparks = G();

  // ---- layout per body plan
  let headPos: V3 = [0, 1.3, 0];
  let R = 0.5 * h;
  let tailPos: V3 = [0, 0.5, -0.4 * b];
  let armPosL: V3 = [0.42 * b, 0.82, 0];
  let legPos: [V3, V3] = [
    [0.18, 0.32, 0],
    [-0.18, 0.32, 0],
  ];
  let height = 1.8;
  switch (m.plan) {
    case 'biped': {
      body.add('sphere', p.main, [0, 0.62, 0], [0.42 * b, 0.42 * b, 0.36 * b]);
      body.add('sphere', p.belly, [0, 0.58, 0.18 * b], [0.28 * b, 0.3 * b, 0.2 * b]);
      headPos = [0, 0.62 + 0.36 * b + 0.42 * h, 0.02];
      for (const [g, s] of [
        [legL, 1],
        [legR, -1],
      ] as const) {
        g.add('cyl', p.main, [0, -0.14, 0], [0.11, 0.3, 0.11]);
        g.add('sphere', p.second, [0, -0.3, 0.05], [0.14, 0.09, 0.18]);
        void s;
      }
      for (const [g, s] of [
        [armL, 1],
        [armR, -1],
      ] as const) {
        g.add('capsule', p.main, [0.04 * s, -0.16, 0], [0.18, 0.28, 0.18], [0, 0, 0.25 * s]);
        g.add('sphere', p.belly, [0.08 * s, -0.36, 0], 0.1);
      }
      height = headPos[1] + R + 0.2;
      break;
    }
    case 'bot': {
      body.add('rbox', p.main, [0, 0.66, 0], [0.8 * b, 0.7 * b, 0.6 * b]);
      body.add('rbox', p.belly, [0, 0.64, 0.28 * b], [0.5 * b, 0.4 * b, 0.1]);
      headPos = [0, 0.66 + 0.35 * b + 0.42 * h, 0];
      for (const g of [legL, legR]) g.add('rbox', p.second, [0, -0.15, 0], [0.22, 0.32, 0.26]);
      for (const g of [armL, armR]) g.add('rbox', p.main, [0, -0.2, 0], [0.18, 0.4, 0.18]);
      height = headPos[1] + R + 0.2;
      break;
    }
    case 'quad': {
      body.add('sphere', p.main, [0, 0.66, -0.05], [0.42 * b, 0.38 * b, 0.6 * b]);
      body.add('sphere', p.belly, [0, 0.52, 0.05], [0.3 * b, 0.25 * b, 0.45 * b]);
      headPos = [0, 0.95 + 0.1 * h, 0.5 * b + 0.12];
      R = 0.44 * h;
      tailPos = [0, 0.75, -0.62 * b];
      // diagonal gait: legL = front-left + back-right, legR = front-right + back-left
      legL.add('cyl', p.main, [0.24 * b, -0.14, 0.32 * b], [0.11, 0.32, 0.11]).add('sphere', p.second, [0.24 * b, -0.3, 0.36 * b], [0.13, 0.08, 0.16]);
      legL.add('cyl', p.main, [-0.24 * b, -0.14, -0.38 * b], [0.11, 0.32, 0.11]).add('sphere', p.second, [-0.24 * b, -0.3, -0.34 * b], [0.13, 0.08, 0.16]);
      legR.add('cyl', p.main, [-0.24 * b, -0.14, 0.32 * b], [0.11, 0.32, 0.11]).add('sphere', p.second, [-0.24 * b, -0.3, 0.36 * b], [0.13, 0.08, 0.16]);
      legR.add('cyl', p.main, [0.24 * b, -0.14, -0.38 * b], [0.11, 0.32, 0.11]).add('sphere', p.second, [0.24 * b, -0.3, -0.34 * b], [0.13, 0.08, 0.16]);
      legPos = [
        [0, 0.32, 0],
        [0, 0.32, 0],
      ];
      armPosL = [0.3, 0.6, 0.3];
      height = headPos[1] + R + 0.2;
      break;
    }
    case 'blob': {
      R = 0.62 * h;
      headPos = [0, 0.7, 0];
      // the head *is* the body
      for (const g of [legL, legR]) g.add('sphere', p.second, [0, -0.28, 0.08], [0.16, 0.1, 0.2]);
      for (const [g, s] of [
        [armL, 1],
        [armR, -1],
      ] as const)
        g.add('sphere', p.main, [0.06 * s, -0.05, 0], [0.13, 0.18, 0.13]);
      armPosL = [R * 0.92, 0.6, 0.05];
      legPos = [
        [0.22, 0.3, 0],
        [-0.22, 0.3, 0],
      ];
      tailPos = [0, 0.5, -R * 0.9];
      height = 0.7 + R + 0.25;
      break;
    }
    case 'bird': {
      body.add('sphere', p.main, [0, 0.72, -0.02], [0.4 * b, 0.48 * b, 0.4 * b]);
      body.add('sphere', p.belly, [0, 0.66, 0.16 * b], [0.28 * b, 0.36 * b, 0.26 * b]);
      headPos = [0, 0.72 + 0.4 * b + 0.32 * h, 0.06];
      R = 0.44 * h;
      for (const g of [legL, legR]) {
        g.add('cyl', '#ffb03a', [0, -0.15, 0], [0.05, 0.3, 0.05]);
        g.add('sphere', '#ffb03a', [0, -0.3, 0.06], [0.11, 0.05, 0.15]);
      }
      legPos = [
        [0.14, 0.32, 0],
        [-0.14, 0.32, 0],
      ];
      wingL.add('sphere', p.second, [0.18, -0.12, -0.05], [0.12, 0.34, 0.26], [0, 0, -0.3]);
      wingR.add('sphere', p.second, [-0.18, -0.12, -0.05], [0.12, 0.34, 0.26], [0, 0, 0.3]);
      armPosL = [0.32 * b, 0.95, 0];
      tailPos = [0, 0.6, -0.36 * b];
      height = headPos[1] + R + 0.2;
      break;
    }
    case 'octo': {
      R = 0.6 * h;
      headPos = [0, 1.0, 0];
      // tentacles in two alternating groups
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const g = i % 2 ? legL : legR;
        for (let k = 0; k < 3; k++) {
          const rr = 0.32 + k * 0.17;
          g.add('sphere', k === 2 ? p.second : p.main, [Math.sin(a) * rr, -0.12 - k * 0.12, Math.cos(a) * rr], 0.16 - k * 0.035);
        }
      }
      legPos = [
        [0, 0.55, 0],
        [0, 0.55, 0],
      ];
      for (const [g, s] of [
        [armL, 1],
        [armR, -1],
      ] as const) {
        g.add('sphere', p.main, [0.12 * s, -0.1, 0.08], 0.13).add('sphere', p.main, [0.22 * s, -0.25, 0.1], 0.1).add('sphere', p.second, [0.28 * s, -0.38, 0.12], 0.08);
      }
      armPosL = [0.42, 0.7, 0.2];
      height = 1.0 + R + 0.25;
      break;
    }
    case 'golem': {
      body.add('pebble', p.main, [0, 0.84, 0], [1.0 * b, 0.9 * b, 0.76 * b]);
      body.add('pebble', p.belly, [0, 0.76, 0.32 * b], [0.58 * b, 0.5 * b, 0.16]);
      // rock bumps for a hand-made feel
      body.add('sphere', shade(p.main, -0.12), [0.32 * b, 1.18 * b, -0.12], [0.2, 0.14, 0.2]);
      body.add('sphere', shade(p.main, 0.08), [-0.36 * b, 0.6, 0.28 * b], [0.14, 0.1, 0.1]);
      body.add('sphere', shade(p.main, -0.08), [-0.28 * b, 1.2 * b, -0.2], [0.16, 0.12, 0.16]);
      headPos = [0, 0.84 + 0.42 * b + 0.24 * h, 0.14];
      R = 0.38 * h;
      for (const g of [legL, legR]) g.add('pebble', p.second, [0, -0.12, 0.02], [0.34, 0.34, 0.38]);
      legPos = [
        [0.27 * b, 0.3, 0],
        [-0.27 * b, 0.3, 0],
      ];
      for (const [g, s] of [
        [armL, 1],
        [armR, -1],
      ] as const) {
        g.add('pebble', p.main, [0.1 * s, -0.28, 0], [0.34, 0.6, 0.34]);
        g.add('pebble', p.second, [0.12 * s, -0.66, 0.04], [0.46, 0.4, 0.46]);
      }
      armPosL = [0.62 * b, 1.1, 0];
      tailPos = [0, 0.6, -0.4 * b];
      height = headPos[1] + R + 0.25;
      break;
    }
    case 'serpent': {
      for (let k = 0; k < 4; k++) body.add('sphere', k % 2 ? p.main : dark, [0, 0.38 + (k === 0 ? 0.15 : 0), 0.2 - k * 0.38], 0.4 - k * 0.06);
      body.add('sphere', p.belly, [0, 0.3, 0.3], [0.3, 0.25, 0.3]);
      body.add('sphere', p.main, [0, 0.82, 0.32], [0.3, 0.38, 0.3]);
      headPos = [0, 1.25, 0.45];
      R = 0.46 * h;
      tailPos = [0, 0.3, -1.25];
      armPosL = [0.3, 0.6, 0.3];
      height = headPos[1] + R + 0.2;
      break;
    }
  }

  // ---- head
  if (m.plan !== 'blob') head.add('sphere', p.main, [0, 0, 0], [R, R * 0.95, R * 0.95]);
  else {
    head.add('sphere', p.main, [0, 0, 0], [R, R * 0.92, R]);
    head.add('sphere', p.belly, [0, -0.22 * R, 0.35 * R], [R * 0.7, R * 0.6, R * 0.7]);
  }
  const muzzle = m.plan === 'quad' || (m.plan === 'biped' && m.ears !== 'none' && !m.extras.includes('beak'));
  if (muzzle) {
    head.add('sphere', p.belly, [0, -0.28 * R, 0.72 * R], [0.42 * R, 0.32 * R, 0.32 * R]);
    head.add('sphere', '#2a1a2a', [0, -0.12 * R, 1.0 * R], [0.12 * R, 0.09 * R, 0.08 * R]);
  }
  // eyes (big, expressive)
  const eyeScale = (m.extras.includes('big_eyes') ? 1.3 : 1) * (m.plan === 'blob' ? 1.2 : 1);
  const ez = m.plan === 'blob' ? 0.82 * R : 0.8 * R;
  for (const s of [1, -1]) {
    const ex = 0.36 * R * s;
    eyes.add('sphere', '#ffffff', [ex, 0.1 * R, ez], [0.2 * R * eyeScale, 0.25 * R * eyeScale, 0.12 * R]);
    eyes.add('sphere', p.eye === '#ffffff' ? '#38c8ff' : p.eye, [ex * 0.96, 0.08 * R, ez + 0.08 * R], [0.13 * R * eyeScale, 0.17 * R * eyeScale, 0.07 * R]);
    eyes.add('sphere', '#0b0820', [ex * 0.95, 0.07 * R, ez + 0.12 * R], [0.07 * R * eyeScale, 0.1 * R * eyeScale, 0.04 * R]);
    eyes.add('sphere', '#ffffff', [ex * 0.88 + 0.04 * R * s, 0.17 * R, ez + 0.16 * R], [0.045 * R, 0.05 * R, 0.02 * R]);
  }
  browL.add('box', shade(p.main, -0.35), [0, 0, 0], [0.26 * R, 0.065 * R, 0.07 * R]);
  browR.add('box', shade(p.main, -0.35), [0, 0, 0], [0.26 * R, 0.065 * R, 0.07 * R]);
  if (!m.extras.includes('beak') && !m.extras.includes('beak_long') && m.plan !== 'bird') {
    head.add('sphere', '#3a0f20', [0, -0.38 * R, 0.86 * R], [0.14 * R, 0.07 * R, 0.06 * R]);
    head.add('sphere', '#ff6a8a', [0, -0.4 * R, 0.88 * R], [0.07 * R, 0.035 * R, 0.04 * R]);
  }
  // cheeks
  head.add('sphere', '#ff8aa8', [0.55 * R, -0.22 * R, 0.68 * R], [0.12 * R, 0.07 * R, 0.05 * R]);
  head.add('sphere', '#ff8aa8', [-0.55 * R, -0.22 * R, 0.68 * R], [0.12 * R, 0.07 * R, 0.05 * R]);

  // ears
  for (const s of [1, -1]) {
    switch (m.ears) {
      case 'pointy':
        head.add('cone', p.main, [0.52 * R * s, 0.82 * R, -0.05 * R], [0.24 * R, 0.6 * R, 0.16 * R], [0, 0, -0.38 * s]);
        head.add('cone', p.belly, [0.5 * R * s, 0.78 * R, 0.03 * R], [0.13 * R, 0.4 * R, 0.08 * R], [0, 0, -0.38 * s]);
        break;
      case 'round':
        head.add('sphere', p.main, [0.62 * R * s, 0.68 * R, -0.05 * R], [0.26 * R, 0.26 * R, 0.12 * R]);
        head.add('sphere', p.belly, [0.62 * R * s, 0.68 * R, 0.02 * R], [0.15 * R, 0.15 * R, 0.08 * R]);
        break;
      case 'long':
        head.add('sphere', p.main, [0.38 * R * s, 1.05 * R, -0.12 * R], [0.14 * R, 0.55 * R, 0.1 * R], [0, 0, -0.25 * s]);
        break;
      case 'fin':
        head.add('cone', p.second, [0.95 * R * s, 0.15 * R, -0.05 * R], [0.24 * R, 0.55 * R, 0.08 * R], [0, 0, -1.25 * s]);
        break;
      case 'tuft':
        head.add('cone', p.second, [0.32 * R * s, 0.98 * R, -0.05 * R], [0.12 * R, 0.4 * R, 0.1 * R], [0, 0, -0.35 * s]);
        break;
    }
  }
  // horns
  switch (m.horns) {
    case 'small':
      for (const s of [1, -1]) head.add('cone', '#fff3d6', [0.3 * R * s, 0.88 * R, 0.15 * R], [0.1 * R, 0.32 * R, 0.1 * R], [0.2, 0, -0.2 * s]);
      break;
    case 'big':
      head.add('cone', '#fff3d6', [0, 0.05 * R, 1.15 * R], [0.2 * R, 0.6 * R, 0.2 * R], [1.2, 0, 0]);
      head.add('cone', '#fff3d6', [0, 0.35 * R, 0.95 * R], [0.12 * R, 0.32 * R, 0.12 * R], [0.7, 0, 0]);
      break;
    case 'single':
      head.add('cone', p.accent, [0, 1.0 * R, 0.35 * R], [0.12 * R, 0.6 * R, 0.12 * R], [0.35, 0, 0]);
      break;
    case 'antlers':
      for (const s of [1, -1]) {
        head.add('cyl', p.accent, [0.35 * R * s, 1.05 * R, -0.05 * R], [0.05 * R, 0.6 * R, 0.05 * R], [0, 0, -0.35 * s]);
        head.add('cyl', p.accent, [0.6 * R * s, 1.3 * R, -0.05 * R], [0.04 * R, 0.35 * R, 0.04 * R], [0, 0, -1.0 * s]);
        head.add('octa', p.accent, [0.48 * R * s, 1.5 * R, -0.05 * R], [0.1 * R, 0.16 * R, 0.1 * R]);
      }
      break;
    case 'crystal':
      head.add('octa', p.accent, [0, 1.0 * R, 0], [0.18 * R, 0.4 * R, 0.18 * R]);
      head.add('octa', p.accent, [0.3 * R, 0.85 * R, -0.1 * R], [0.12 * R, 0.28 * R, 0.12 * R], [0, 0, -0.4]);
      head.add('octa', p.accent, [-0.3 * R, 0.85 * R, -0.1 * R], [0.12 * R, 0.28 * R, 0.12 * R], [0, 0, 0.4]);
      break;
    case 'antenna':
      for (const s of [1, -1]) {
        head.add('cyl', '#2b2f5a', [0.25 * R * s, 1.1 * R, 0], [0.025 * R, 0.5 * R, 0.025 * R], [0, 0, -0.3 * s]);
        head.addGlow('sphere', p.accent, [0.4 * R * s, 1.38 * R, 0], 0.1 * R);
      }
      break;
  }

  // tail
  switch (m.tail) {
    case 'fluffy':
      tail.add('sphere', p.main, [0, 0.05, -0.15], [0.16, 0.16, 0.22]).add('sphere', p.main, [0, 0.22, -0.38], [0.22, 0.22, 0.28]).add('sphere', p.belly, [0, 0.45, -0.52], [0.18, 0.2, 0.18]);
      break;
    case 'thin':
      tail.add('cyl', p.main, [0, 0.15, -0.25], [0.05, 0.55, 0.05], [-0.9, 0, 0]).add('sphere', p.accent, [0, 0.34, -0.48], 0.09);
      break;
    case 'flame':
      tail.add('cyl', p.main, [0, 0.08, -0.2], [0.07, 0.4, 0.07], [-1.0, 0, 0]);
      tail.addGlow('cone', '#ffb03a', [0, 0.3, -0.4], [0.16, 0.42, 0.16], [-0.5, 0, 0]);
      tail.addGlow('cone', '#fff27a', [0, 0.26, -0.38], [0.09, 0.26, 0.09], [-0.5, 0, 0]);
      break;
    case 'leaf':
      tail.add('sphere', '#5fd63a', [0, 0.15, -0.3], [0.08, 0.3, 0.18], [-0.6, 0, 0]);
      break;
    case 'stub':
      tail.add('sphere', p.main, [0, 0, -0.06], 0.12);
      break;
    case 'fan':
      for (let i = -2; i <= 2; i++) tail.add('sphere', i % 2 ? p.second : p.accent, [i * 0.08, 0.12, -0.12], [0.06, 0.28, 0.1], [-0.5, 0, i * 0.3]);
      break;
  }

  // extras
  const ex = m.extras;
  const headTop = R * 0.95;
  if (ex.includes('scarf')) {
    body.add('torus', p.accent, [0, headPos[1] - R * 0.85, 0], [0.3 * b, 0.3 * b, 0.4], [Math.PI / 2, 0, 0]);
    body.add('box', p.accent, [0.12, headPos[1] - R * 1.1, -0.25 * b], [0.1, 0.3, 0.06], [0.4, 0, 0.2]);
  }
  if (ex.includes('moss')) {
    for (const [x, y, z] of [
      [0.2, 0.75, -0.1],
      [-0.25, 0.65, 0.05],
      [0.0, 0.85, 0.1],
    ] as V3[])
      head.add('sphere', '#5fd63a', [x * R, y * R, z * R], [0.25 * R, 0.12 * R, 0.25 * R]);
  }
  if (ex.includes('flower')) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.add('sphere', '#ff8ad8', [0.35 * R + Math.sin(a) * 0.1 * R, headTop + 0.02, Math.cos(a) * 0.1 * R], [0.09 * R, 0.04 * R, 0.09 * R]);
    }
    head.add('sphere', '#ffe94d', [0.35 * R, headTop + 0.05, 0], 0.06 * R);
  }
  if (ex.includes('crown')) addCrown(head, headTop, R, '#ffd23a');
  if (ex.includes('goggles')) {
    for (const s of [1, -1]) head.add('torus', '#2b2f5a', [0.28 * R * s, 0.55 * R, 0.68 * R], [0.14 * R, 0.14 * R, 0.2], [-0.5, 0, 0]);
    head.add('torus', '#2b2f5a', [0, 0.45 * R, 0], [R * 0.98, R * 0.98, 0.3], [Math.PI / 2 - 0.2, 0, 0]);
  }
  if (ex.includes('mask')) head.add('sphere', '#1b1440', [0, 0.1 * R, 0.55 * R], [0.75 * R, 0.22 * R, 0.4 * R]);
  if (ex.includes('helmet')) {
    head.add('halfSphere', p.accent, [0, 0.12 * R, 0], [R * 1.05, R * 0.95, R * 1.05]);
    head.add('box', '#ffd23a', [0, 0.95 * R, 0], [0.08 * R, 0.4 * R, 0.9 * R]);
  }
  if (ex.includes('gills'))
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) head.add('cyl', p.second, [0.85 * R * s, (0.3 - i * 0.25) * R, -0.1 * R], [0.05 * R, 0.4 * R, 0.05 * R], [0, 0, (-1.2 + i * 0.35) * s]);
  if (ex.includes('beak') || m.plan === 'bird') {
    head.add('cone', '#ffb03a', [0, -0.12 * R, 0.98 * R], [0.18 * R, 0.4 * R, 0.14 * R], [Math.PI / 2, 0, 0]);
  }
  if (ex.includes('beak_long')) head.add('cone', '#2b2f3a', [0, -0.12 * R, 1.25 * R], [0.07 * R, 0.9 * R, 0.07 * R], [Math.PI / 2, 0, 0]);
  if (ex.includes('mane'))
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      head.add('sphere', p.second, [Math.sin(a) * R * 0.95, Math.cos(a) * R * 0.95, -0.25 * R], [0.3 * R, 0.3 * R, 0.25 * R]);
    }
  if (ex.includes('spots')) for (const [x, z] of [[0.2, 0.1], [-0.25, -0.15], [0.1, -0.3]]) body.add('sphere', shade(p.main, -0.2), [x, 0.85, z], [0.1, 0.05, 0.1]);
  if (ex.includes('wings') && m.plan !== 'bird') {
    wingL.add('sphere', p.second, [0.3, 0.1, 0], [0.4, 0.06, 0.25], [0, 0.2, 0.3]);
    wingR.add('sphere', p.second, [-0.3, 0.1, 0], [0.4, 0.06, 0.25], [0, -0.2, -0.3]);
  }
  if (ex.includes('spikes')) for (let i = 0; i < 3; i++) body.add('cone', p.accent, [0, 0.95 + (m.plan === 'quad' ? -0.05 : 0.05), 0.15 - i * 0.25], [0.08, 0.22, 0.08], [-0.3, 0, 0]);
  if (ex.includes('armor')) {
    body.add('rbox', p.second, [0, 0.95, -0.05], [0.7 * b, 0.12, 0.8 * b]);
  }
  if (ex.includes('claws'))
    for (const [g, s] of [
      [armL, 1],
      [armR, -1],
    ] as const) {
      g.add('sphere', p.main, [0.15 * s, -0.75, 0.2], [0.28, 0.2, 0.32]);
      g.add('cone', p.second, [0.15 * s, -0.68, 0.48], [0.1, 0.3, 0.08], [Math.PI / 2, 0, 0]);
    }
  if (ex.includes('shell')) body.add('halfSphere', p.second, [0, 1.0, -0.15], [0.55 * b, 0.4, 0.5 * b]);
  if (ex.includes('feather_crown')) for (let i = -1; i <= 1; i++) head.add('sphere', i ? p.accent : p.second, [i * 0.25 * R, headTop + 0.1, -0.1 * R], [0.07 * R, 0.4 * R, 0.07 * R], [0, 0, i * 0.4]);
  if (ex.includes('core_belly')) body.addGlow('sphere', p.belly, [0, 0.66, 0.38 * b], 0.16);
  if (ex.includes('fur')) for (let i = 0; i < 6; i++) head.add('sphere', p.main, [Math.sin(i) * R * 0.7, (0.6 + (i % 2) * 0.2) * R, Math.cos(i * 2) * 0.3 * R], 0.22 * R);
  if (ex.includes('backpack')) body.add('rbox', p.second, [0, 0.75, -0.38 * b], [0.4, 0.45, 0.22]);
  if (ex.includes('crystals')) for (let i = 0; i < 3; i++) body.add('octa', p.accent, [(i - 1) * 0.22, 1.05 + (i === 1 ? 0.15 : 0), -0.1], [0.1, 0.25, 0.1]);
  if (ex.includes('helmet_glass')) {
    /* added as a transparent mesh below */
  }
  if (ex.includes('sparks')) for (let i = 0; i < 4; i++) sparks.addGlow('sphere', p.accent, [Math.sin(i * 1.57) * 0.75, 0.9 + (i % 2) * 0.4, Math.cos(i * 1.57) * 0.75], 0.07);

  // skin accessory
  switch (opts.accessory) {
    case 'crown':
      addCrown(head, headTop, R, '#ffd23a');
      break;
    case 'cap':
      head.add('halfSphere', p.accent, [0, 0.28 * R, 0], [R * 1.02, R * 0.7, R * 1.02]);
      head.add('cyl', p.accent, [0, 0.32 * R, 0.85 * R], [0.55 * R, 0.04 * R, 0.5 * R]);
      break;
    case 'shades':
      for (const s of [1, -1]) head.add('box', '#14121f', [0.36 * R * s, 0.12 * R, 0.96 * R], [0.36 * R, 0.24 * R, 0.06 * R]);
      head.add('box', '#14121f', [0, 0.18 * R, 0.96 * R], [0.3 * R, 0.05 * R, 0.05 * R]);
      break;
    case 'halo':
      head.addGlow('torus', '#fff3a8', [0, headTop + 0.35, 0], [0.4 * R, 0.4 * R, 0.4], [Math.PI / 2, 0, 0]);
      break;
    case 'scarf':
      body.add('torus', p.second, [0, headPos[1] - R * 0.85, 0], [0.32 * b, 0.32 * b, 0.45], [Math.PI / 2, 0, 0]);
      break;
    case 'helmet':
      head.add('halfSphere', p.second, [0, 0.15 * R, 0], [R * 1.06, R * 0.95, R * 1.06]);
      for (const s of [1, -1]) head.add('cone', p.accent, [0.7 * R * s, 0.75 * R, 0], [0.1 * R, 0.4 * R, 0.1 * R], [0, 0, -0.6 * s]);
      break;
    case 'flowers':
      for (let i = 0; i < 4; i++) head.add('sphere', ['#ff8ad8', '#ffe94d', '#7ff7ff', '#ff5a4d'][i], [Math.sin(i * 1.2 - 1.8) * R * 0.8, 0.75 * R, Math.cos(i * 1.2 - 1.8) * R * 0.6], 0.12 * R);
      break;
    case 'horns':
      for (const s of [1, -1]) head.add('cone', '#c4202f', [0.4 * R * s, 0.9 * R, 0.1 * R], [0.12 * R, 0.45 * R, 0.12 * R], [0.1, 0, -0.45 * s]);
      break;
    case 'mask':
      head.add('sphere', '#c4202f', [0, 0.1 * R, 0.6 * R], [0.78 * R, 0.22 * R, 0.42 * R]);
      break;
    case 'headphones':
      head.add('torus', '#2b2f5a', [0, 0.1 * R, 0], [R * 1.05, R * 1.05, 0.25], [0, Math.PI / 2, 0]);
      for (const s of [1, -1]) head.add('cyl', p.accent, [1.0 * R * s, 0, 0], [0.28 * R, 0.16 * R, 0.28 * R], [0, 0, Math.PI / 2]);
      break;
    case 'tophat':
      head.add('cyl', '#1b1b24', [0, headTop + 0.05, 0], [0.55 * R, 0.04, 0.55 * R]);
      head.add('cyl', '#1b1b24', [0, headTop + 0.3, 0], [0.35 * R, 0.5 * R, 0.35 * R]);
      head.add('cyl', p.accent, [0, headTop + 0.14, 0], [0.36 * R, 0.08 * R, 0.36 * R]);
      break;
  }

  // ---- assemble hierarchy
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const hips = new THREE.Group();
  model.add(hips);
  hips.add(body.build(mat, outline, thick));
  const headG = new THREE.Group();
  headG.position.set(...headPos);
  headG.add(head.build(mat, outline, thick));
  const eyesG = eyes.build(mat, false, thick);
  headG.add(eyesG);
  const browLG = browL.build(mat, false, thick);
  const browRG = browR.build(mat, false, thick);
  browLG.position.set(0.36 * R, 0.42 * R * (eyeScale > 1 ? 1.15 : 1), 0.86 * R);
  browRG.position.set(-0.36 * R, 0.42 * R * (eyeScale > 1 ? 1.15 : 1), 0.86 * R);
  headG.add(browLG, browRG);
  if (ex.includes('helmet_glass')) {
    const glass = new THREE.Mesh(base('sphere'), new THREE.MeshPhongMaterial({ color: '#bff6ff', transparent: true, opacity: 0.28, shininess: 120, depthWrite: false }));
    glass.scale.setScalar(R * 1.28);
    headG.add(glass);
  }
  hips.add(headG);
  const mk = (pg: PartGroup, pos: V3) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.add(pg.build(mat, outline, thick));
    hips.add(g);
    return g;
  };
  const armLG = mk(armL, armPosL);
  const armRG = mk(armR, [-armPosL[0], armPosL[1], armPosL[2]]);
  const legLG = new THREE.Group();
  legLG.position.set(...legPos[0]);
  legLG.add(legL.build(mat, outline, thick));
  model.add(legLG);
  const legRG = new THREE.Group();
  legRG.position.set(...legPos[1]);
  legRG.add(legR.build(mat, outline, thick));
  model.add(legRG);
  const tailG = mk(tail, tailPos);
  const wingLG = mk(wingL, [armPosL[0] * 0.8, armPosL[1] + 0.1, -0.1]);
  const wingRG = mk(wingR, [-armPosL[0] * 0.8, armPosL[1] + 0.1, -0.1]);
  const extrasG = mk(extra, [0, 0, 0]);
  let sparksG: THREE.Group | null = null;
  if (sparks.glow.length) {
    sparksG = sparks.build(mat, false, thick);
    model.add(sparksG);
  }
  if (opts.glow) {
    const aura = new THREE.Mesh(base('sphereLo'), new THREE.MeshBasicMaterial({ color: opts.glow, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    aura.scale.set(0.9, height * 0.55, 0.9);
    aura.position.y = height * 0.45;
    aura.userData.aura = true;
    model.add(aura);
  }
  const scale = m.size;
  model.scale.setScalar(scale);
  const shadow = blobShadow(1.6 * scale * Math.max(1, b));
  root.add(shadow);
  return {
    root, model, hips, head: headG, armL: armLG, armR: armRG, legL: legLG, legR: legRG, tail: tailG, wings: [wingLG, wingRG], eyes: eyesG, brows: [browLG, browRG], extras: extrasG,
    sparks: sparksG, material: mat, height: height * scale, plan: m.plan, shadow, scale,
  };
}

function addCrown(g: PartGroup, top: number, R: number, color: string) {
  g.add('cyl', color, [0, top + 0.05, 0], [0.38 * R, 0.16 * R, 0.38 * R]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add('cone', color, [Math.sin(a) * 0.32 * R, top + 0.2 * R, Math.cos(a) * 0.32 * R], [0.08 * R, 0.22 * R, 0.08 * R]);
  }
  g.add('sphere', '#ff4d6d', [0, top + 0.05, 0.38 * R], 0.07 * R);
}

// ------------------------------------------------------------ animation
export type AnimState = { speed: number; air: boolean; action: string; actionT: number; carrying: boolean; stunned: boolean; t: number; hurtT: number; victory?: string; lookYaw?: number };

/** Procedural animation: breathing, blinking, look-around, run cycle, squash & stretch, attacks, emotes. */
export function animateRig(r: Rig, s: AnimState, dt: number) {
  const t = s.t;
  const run = Math.min(1, s.speed);
  const a = s.action;
  const at = s.actionT;
  // reset
  r.hips.position.set(0, 0, 0);
  r.hips.rotation.set(0, 0, 0);
  r.model.scale.setScalar(r.scale);
  r.head.rotation.set(0, 0, 0);
  r.armL.rotation.set(0, 0, 0);
  r.armR.rotation.set(0, 0, 0);
  r.legL.rotation.set(0, 0, 0);
  r.legR.rotation.set(0, 0, 0);
  r.tail.rotation.set(0, Math.sin(t * 3) * 0.3, 0);
  const breath = Math.sin(t * 2.2) * 0.025;
  // idle breathing + look around
  r.hips.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
  r.head.rotation.y = (s.lookYaw ?? Math.sin(t * 0.6) * 0.25 * (1 - run)) + 0;
  r.head.rotation.x = Math.sin(t * 0.9) * 0.04;
  // blink
  const blink = t % 3.7 < 0.12 ? 0.15 : 1;
  r.eyes.scale.y = blink;
  // brows (expression)
  let browTilt = 0.0,
    browY = 0;
  if (a === 'attack' || a === 'super' || a === 'skill') browTilt = 0.35;
  if (s.hurtT > 0) browTilt = -0.3;
  if (a === 'victory') ((browTilt = -0.2), (browY = 0.04));
  if (a === 'defeat') browTilt = -0.45;
  r.brows[0].rotation.z = browTilt;
  r.brows[1].rotation.z = -browTilt;
  r.brows[0].position.y = r.brows[0].userData.y0 ?? (r.brows[0].userData.y0 = r.brows[0].position.y);
  r.brows[1].position.y = r.brows[1].userData.y0 ?? (r.brows[1].userData.y0 = r.brows[1].position.y);
  r.brows[0].position.y += browY;
  r.brows[1].position.y += browY;
  // locomotion
  if (run > 0.05 && !s.air) {
    const ph = t * (10 + run * 4);
    const sw = Math.sin(ph) * 0.7 * run;
    r.legL.rotation.x = sw;
    r.legR.rotation.x = -sw;
    r.armL.rotation.x = -sw * 0.8;
    r.armR.rotation.x = sw * 0.8;
    const bounce = Math.abs(Math.sin(ph)) * 0.12 * run;
    r.hips.position.y = bounce;
    r.hips.rotation.x = 0.12 * run;
    const sq = 1 + (bounce - 0.06) * 0.6;
    r.hips.scale.y *= sq;
    for (const w of r.wings) w.rotation.z = Math.sin(t * 18) * 0.35 * (w === r.wings[0] ? 1 : -1);
  } else {
    r.armL.rotation.z = -0.05 + Math.sin(t * 2.2) * 0.04;
    r.armR.rotation.z = 0.05 - Math.sin(t * 2.2) * 0.04;
    for (const w of r.wings) w.rotation.z = Math.sin(t * 3) * 0.1 * (w === r.wings[0] ? 1 : -1);
  }
  if (r.plan === 'octo') {
    // tentacles always undulate
    r.legL.rotation.y = Math.sin(t * 3) * 0.15;
    r.legR.rotation.y = -Math.sin(t * 3) * 0.15;
    r.legL.rotation.x = r.legR.rotation.x = 0;
    r.hips.position.y += Math.sin(t * 2.5) * 0.06;
  }
  if (s.air) {
    r.legL.rotation.x = -0.6;
    r.legR.rotation.x = -0.4;
    r.armL.rotation.z = -1.2;
    r.armR.rotation.z = 1.2;
    for (const w of r.wings) w.rotation.z = Math.sin(t * 22) * 0.6 * (w === r.wings[0] ? 1 : -1);
    r.hips.scale.set(0.92, 1.1, 0.92);
  }
  if (s.carrying) {
    r.armL.rotation.z = -2.6;
    r.armR.rotation.z = 2.6;
  }
  // actions
  if (a === 'attack' && at < 0.25) {
    const k = Math.sin((at / 0.25) * Math.PI);
    r.armR.rotation.x = -1.6 * k;
    r.hips.rotation.x = 0.25 * k;
    r.hips.position.z = 0.15 * k;
    r.hips.scale.set(1 + 0.08 * k, 1 - 0.08 * k, 1 + 0.08 * k);
  } else if (a === 'skill' && at < 0.4) {
    const k = Math.sin((at / 0.4) * Math.PI);
    r.hips.rotation.y = k * Math.PI * 0.5;
    r.armL.rotation.z = -1.3 * k;
    r.armR.rotation.z = 1.3 * k;
    r.hips.scale.set(1 + 0.12 * k, 1 - 0.1 * k, 1 + 0.12 * k);
  } else if (a === 'super' && at < 0.7) {
    const k = at / 0.7;
    const up = Math.sin(k * Math.PI);
    r.hips.position.y += up * 0.6;
    r.hips.rotation.y = k * Math.PI * 2;
    r.armL.rotation.z = -2.4 * up;
    r.armR.rotation.z = 2.4 * up;
    r.model.scale.setScalar(r.scale * (1 + 0.15 * up));
  } else if (a === 'victory') {
    const v = s.victory ?? 'jump';
    if (v === 'jump') {
      const k = Math.abs(Math.sin(at * 5));
      r.hips.position.y = k * 0.6;
      r.armL.rotation.z = -2.5;
      r.armR.rotation.z = 2.5 + Math.sin(at * 10) * 0.2;
    } else if (v === 'spin') {
      r.hips.rotation.y = at * 8;
      r.armL.rotation.z = -1.5;
      r.armR.rotation.z = 1.5;
      r.hips.position.y = Math.abs(Math.sin(at * 4)) * 0.3;
    } else if (v === 'flex') {
      r.armL.rotation.z = -1.4;
      r.armR.rotation.z = 1.4;
      r.armL.rotation.x = -0.8 - Math.sin(at * 6) * 0.2;
      r.armR.rotation.x = -0.8 + Math.sin(at * 6) * 0.2;
      r.hips.scale.set(1.05, 1 + Math.sin(at * 6) * 0.04, 1.05);
    } else if (v === 'dance') {
      r.hips.rotation.z = Math.sin(at * 8) * 0.25;
      r.hips.position.y = Math.abs(Math.sin(at * 8)) * 0.2;
      r.armL.rotation.z = -1.2 + Math.sin(at * 8) * 0.8;
      r.armR.rotation.z = 1.2 + Math.sin(at * 8) * 0.8;
      r.head.rotation.z = Math.sin(at * 8) * 0.2;
    } else {
      r.hips.position.y = 0.5 + Math.sin(at * 2) * 0.15;
      r.hips.rotation.y = at * 1.5;
      r.armL.rotation.z = -1;
      r.armR.rotation.z = 1;
    }
  } else if (a === 'defeat') {
    r.hips.rotation.x = 0.35;
    r.head.rotation.x = 0.5;
    r.armL.rotation.z = 0.2;
    r.armR.rotation.z = -0.2;
    r.hips.position.y = -0.1;
    r.hips.scale.y *= 0.92;
  } else if (a === 'emote' && at < 1.5) {
    r.hips.position.y = Math.abs(Math.sin(at * 7)) * 0.3;
    r.armR.rotation.z = 2.4 + Math.sin(at * 14) * 0.3;
  }
  if (s.hurtT > 0) {
    const k = s.hurtT / 0.18;
    r.hips.scale.set(1 + 0.15 * k, 1 - 0.15 * k, 1 + 0.15 * k);
    r.material.emissive.setRGB(k * 0.9, k * 0.9, k * 0.9);
  } else r.material.emissive.setRGB(0, 0, 0);
  if (s.stunned) r.head.rotation.z = Math.sin(t * 12) * 0.25;
  if (r.sparks) {
    r.sparks.rotation.y = t * 3;
    r.sparks.children.forEach((c) => (c.visible = Math.sin(t * 20 + c.id) > -0.3));
  }
  // flame tail flicker
  r.tail.children.forEach((c) =>
    c.children.forEach((m) => {
      if (m.userData.glow) m.scale.setScalar(1 + Math.sin(t * 20 + m.id) * 0.1);
    }),
  );
  void dt;
}

// ------------------------------------------------------------ eggs
const eggGeo = new THREE.SphereGeometry(0.5, 18, 14);
eggGeo.scale(1, 1.28, 1);
export function buildEgg(color: string, accent: string, phase: number): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(eggGeo, toon('#fff8e8'));
  shell.position.y = 0.6;
  g.add(shell);
  const o = new THREE.Mesh(eggGeo, outlineMaterial(0.04));
  o.position.y = 0.6;
  g.add(o);
  // element spots
  const spotM = toon(color);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + i;
    const yy = 0.45 + (i % 3) * 0.18;
    const s = new THREE.Mesh(base('sphere'), spotM);
    s.scale.set(0.12, 0.12, 0.05);
    const rr = 0.48 * Math.sqrt(1 - ((yy - 0.6) / 0.64) ** 2);
    s.position.set(Math.sin(a) * rr, yy, Math.cos(a) * rr);
    s.lookAt(0, yy, 0);
    g.add(s);
  }
  if (phase >= 1) {
    // cracks + peeking eyes
    const crackM = toon('#3a2a2a');
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(base('box'), crackM);
      c.scale.set(0.2, 0.03, 0.03);
      c.position.set(-0.24 + i * 0.16, 0.72 + (i % 2 ? 0.05 : -0.05), 0.47);
      c.rotation.z = i % 2 ? 0.6 : -0.6;
      g.add(c);
    }
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(base('sphere'), toon('#ffffff'));
      e.scale.set(0.09, 0.11, 0.04);
      e.position.set(0.13 * s, 0.86, 0.45);
      g.add(e);
      const pu = new THREE.Mesh(base('sphere'), toon('#1b1440'));
      pu.scale.set(0.05, 0.06, 0.03);
      pu.position.set(0.13 * s, 0.85, 0.48);
      g.add(pu);
    }
  }
  const glow = new THREE.Mesh(base('sphereLo'), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(0.95);
  glow.position.y = 0.6;
  glow.userData.glow = true;
  g.add(glow);
  return g;
}
