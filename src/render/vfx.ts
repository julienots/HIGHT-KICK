import * as THREE from 'three';
import { glowTexture } from './toon';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  size1: number;
  r: number;
  g: number;
  b: number;
  grav: number;
  drag: number;
}

const VERT = `attribute float size; attribute float alpha; attribute vec3 pcolor;
  varying float vA; varying vec3 vC;
  void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
    gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform sampler2D map; varying float vA; varying vec3 vC;
  void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if(gl_FragColor.a < 0.01) discard; }`;

class ParticlePool {
  ps: Particle[] = [];
  geo = new THREE.BufferGeometry();
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  points: THREE.Points;
  constructor(public cap: number, additive: boolean) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
  }
  spawn(p: Particle) {
    if (this.ps.length >= this.cap) this.ps.shift();
    this.ps.push(p);
  }
  update(dt: number) {
    const ps = this.ps;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02 && p.grav > 0) {
        p.y = 0.02;
        p.vy *= -0.3;
      }
      ps[w++] = p;
    }
    ps.length = w;
    for (let i = 0; i < w; i++) {
      const p = ps[i];
      const k = p.life / p.max;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r;
      this.col[i * 3 + 1] = p.g;
      this.col[i * 3 + 2] = p.b;
      this.size[i] = p.size1 + (p.size - p.size1) * k;
      this.alpha[i] = Math.min(1, k * 2.2);
    }
    for (let i = w; i < Math.min(this.cap, w + 64); i++) this.alpha[i] = 0;
    this.geo.setDrawRange(0, w);
    for (const k of ['position', 'pcolor', 'size', 'alpha']) (this.geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Fading {
  obj: THREE.Object3D;
  t: number;
  max: number;
  grow: number;
  baseScale: number;
  mat: THREE.Material & { opacity: number };
  opacity0: number;
  onUpdate?: (k: number) => void;
}

const tmpC = new THREE.Color();

/** VFX: additive & alpha particles, shockwave rings, flashes, lightning, cones, telegraphs. Pooled & capped by quality. */
export class VFX {
  glow: ParticlePool;
  smoke: ParticlePool;
  group = new THREE.Group();
  fading: Fading[] = [];
  density = 1;
  ringGeo = new THREE.RingGeometry(0.85, 1, 48);
  discGeo = new THREE.CircleGeometry(1, 40);
  boxGeo = new THREE.BoxGeometry(1, 1, 1);
  constructor(scene: THREE.Object3D, quality: string) {
    this.density = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : quality === 'ultra' ? 1.3 : 1;
    this.glow = new ParticlePool(Math.round(1400 * this.density) + 200, true);
    this.smoke = new ParticlePool(Math.round(500 * this.density) + 100, false);
    this.group.add(this.glow.points, this.smoke.points);
    scene.add(this.group);
  }
  private n(k: number) {
    return Math.max(1, Math.round(k * this.density));
  }
  burst(x: number, y: number, z: number, color: string, count: number, speed: number, opts: { up?: number; grav?: number; size?: number; life?: number; drag?: number; smoke?: boolean; spread?: number } = {}) {
    tmpC.set(color);
    const pool = opts.smoke ? this.smoke : this.glow;
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * (opts.spread ?? 1.4);
      const s = speed * (0.4 + Math.random() * 0.8);
      const life = (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      pool.spawn({
        x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + (opts.up ?? 2), vz: Math.sin(a) * Math.cos(e) * s, life, max: life,
        size: (opts.size ?? 0.6) * (0.7 + Math.random() * 0.6), size1: (opts.size ?? 0.6) * 0.2, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: opts.grav ?? 6, drag: opts.drag ?? 2,
      });
    }
  }
  trail(x: number, y: number, z: number, color: string, size = 0.45, life = 0.25) {
    tmpC.set(color);
    if (Math.random() > this.density) return;
    this.glow.spawn({ x: x + (Math.random() - 0.5) * 0.1, y, z: z + (Math.random() - 0.5) * 0.1, vx: 0, vy: 0.2, vz: 0, life, max: life, size, size1: 0.05, r: tmpC.r, g: tmpC.g, b: tmpC.b, grav: 0, drag: 0 });
  }
  dust(x: number, z: number, color = '#ffffff', n = 4) {
    this.burst(x, 0.15, z, color, n, 1.5, { up: 0.6, grav: 0.5, size: 0.9, life: 0.5, smoke: true, spread: 0.2 });
  }
  ring(x: number, z: number, r: number, color: string, dur = 0.45, y = 0.08) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.ringGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(r * 0.3);
    this.group.add(mesh);
    this.fading.push({ obj: mesh, t: 0, max: dur, grow: r, baseScale: r * 0.3, mat: m, opacity0: 0.85 });
  }
  disc(x: number, z: number, r: number, color: string, dur = 0.35, opacity = 0.5) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.discGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.07, z);
    mesh.scale.setScalar(r);
    this.group.add(mesh);
    this.fading.push({ obj: mesh, t: 0, max: dur, grow: 0, baseScale: r, mat: m, opacity0: opacity });
  }
  flash(x: number, y: number, z: number, color: string, size = 2.5, dur = 0.18) {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    this.group.add(s);
    this.fading.push({ obj: s, t: 0, max: dur, grow: size * 0.5, baseScale: size, mat: m as any, opacity0: 1 });
  }
  cone(x: number, z: number, dx: number, dz: number, range: number, angle: number, color: string) {
    const geo = new THREE.CircleGeometry(range, 24, Math.PI / 2 - angle / 2, angle);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(dz, dx) * -1;
    mesh.position.set(x, 0.1, z);
    this.group.add(mesh);
    this.fading.push({ obj: mesh, t: 0, max: 0.25, grow: 0, baseScale: 1, mat: m, opacity0: 0.55, onUpdate: () => geo });
    mesh.userData.dispose = geo;
    for (let i = 0; i < 6; i++) {
      const a = Math.atan2(dz, dx) + (Math.random() - 0.5) * angle;
      const s = range * (0.4 + Math.random() * 0.6);
      this.burst(x + Math.cos(a) * s, 0.6, z + Math.sin(a) * s, color, 2, 2, { up: 1, size: 0.5, life: 0.3 });
    }
  }
  line(x: number, z: number, dx: number, dz: number, range: number, width: number, color: string) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.boxGeo, m);
    mesh.scale.set(width, 0.15, range);
    mesh.position.set(x + (dx * range) / 2, 0.15, z + (dz * range) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.group.add(mesh);
    this.fading.push({ obj: mesh, t: 0, max: 0.5, grow: 0, baseScale: 1, mat: m, opacity0: 0.6, onUpdate: (k) => (mesh.scale.y = 0.15 + (1 - k) * 2) });
    for (let s = 0; s < range; s += 1.2) this.burst(x + dx * s, 0.4, z + dz * s, color, 2, 2.5, { up: 2, size: 0.7, life: 0.5 });
  }
  lightning(pts: { x: number; y: number; z: number }[], color: string) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      let px = a.x,
        py = a.y,
        pz = a.z;
      const segs = 6;
      for (let s = 1; s <= segs; s++) {
        const k = s / segs;
        const jit = s === segs ? 0 : 0.45;
        const nx = a.x + (b.x - a.x) * k + (Math.random() - 0.5) * jit,
          ny = a.y + (b.y - a.y) * k + (Math.random() - 0.5) * jit,
          nz = a.z + (b.z - a.z) * k + (Math.random() - 0.5) * jit;
        this.beam(px, py, pz, nx, ny, nz, color, 0.12, 0.25);
        px = nx;
        py = ny;
        pz = nz;
      }
      this.flash(b.x, b.y, b.z, color, 2, 0.2);
    }
  }
  beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: string, w = 0.12, dur = 0.2) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(this.boxGeo, m);
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.scale.set(w, w, len);
    mesh.lookAt(bx, by, bz);
    this.group.add(mesh);
    this.fading.push({ obj: mesh, t: 0, max: dur, grow: 0, baseScale: 1, mat: m, opacity0: 1, onUpdate: () => mesh.scale.set(w, w, len) });
  }
  /** telegraph circle that fills up over its duration */
  warn(x: number, z: number, r: number, dur: number, color: string) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(this.discGeo, m);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.06, z);
    disc.scale.setScalar(0.01);
    const m2 = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(this.ringGeo, m2);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.07, z);
    ring.scale.setScalar(r);
    this.group.add(disc, ring);
    this.fading.push({ obj: disc, t: 0, max: dur, grow: 0, baseScale: 0.01, mat: m, opacity0: 0.35, onUpdate: (k) => disc.scale.setScalar(Math.max(0.01, r * (1 - k))) });
    this.fading.push({ obj: ring, t: 0, max: dur, grow: 0, baseScale: r, mat: m2, opacity0: 0.9, onUpdate: () => ring.scale.setScalar(r) });
  }
  explosion(x: number, z: number, r: number, color: string, big = false) {
    this.flash(x, 1, z, color, r * 2.2, 0.22);
    this.flash(x, 1, z, '#ffffff', r * 1.2, 0.12);
    this.ring(x, z, r * 1.1, color, 0.4);
    this.burst(x, 0.6, z, color, big ? 40 : 18, 6 + r * 2, { up: 4, size: big ? 1 : 0.7, life: 0.7 });
    this.burst(x, 0.4, z, '#5a4a4a', big ? 16 : 6, 3, { up: 2.5, size: 1.6, life: 0.9, smoke: true, grav: -0.5, drag: 1.5 });
  }
  update(dt: number) {
    this.glow.update(dt);
    this.smoke.update(dt);
    const keep: Fading[] = [];
    for (const f of this.fading) {
      f.t += dt;
      const k = Math.min(1, f.t / f.max);
      f.mat.opacity = f.opacity0 * (1 - k);
      if (f.grow) f.obj.scale.setScalar(f.baseScale + f.grow * k);
      f.onUpdate?.(k);
      if (k >= 1) {
        this.group.remove(f.obj);
        f.mat.dispose();
        if (f.obj.userData.dispose) f.obj.userData.dispose.dispose();
      } else keep.push(f);
    }
    this.fading = keep;
  }
  dispose() {
    this.group.removeFromParent();
  }
}
