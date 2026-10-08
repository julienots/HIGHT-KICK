import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ArenaDef } from '../data/arenas';
import { GRAVITY_INFO } from '../data/gravity';
import { C, type Grid } from '../sim/grid';
import type { World } from '../sim/world';
import { glowTexture, outlineMaterial, shade, toon } from './toon';
import { Rng } from '../core/rng';

const TEAM_COLORS = ['#2f8cff', '#ff3d5a'];

/** Sky dome with vertical gradient. */
export function makeSky(top: string, bottom: string) {
  const geo = new THREE.SphereGeometry(400, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; float k = smoothstep(-0.35, 0.6, h); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  return m;
}

/** Swaying foliage material (vertex shader wind). */
function swayMaterial(color: string) {
  const m = new THREE.MeshToonMaterial({ color });
  const uniforms = { uTime: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wp = instanceMatrix * vec4(position,1.0);
       float sway = sin(uTime*2.0 + wp.x*0.7 + wp.z*0.5) * 0.08 * max(0.0, position.y + 0.5);
       transformed.x += sway; transformed.z += sway*0.5;`,
    );
  };
  (m as any).uniformsRef = uniforms;
  return m;
}

interface Anim {
  update(t: number, dt: number): void;
}

/** Builds and animates the 3D arena from the simulation grid (instanced for low draw calls). */
export class ArenaView {
  group = new THREE.Group();
  anims: Anim[] = [];
  crateMesh!: THREE.InstancedMesh;
  crateTop!: THREE.InstancedMesh;
  crateCells: number[] = [];
  crateVersion = '';
  floorMesh!: THREE.InstancedMesh;
  floorTop!: THREE.InstancedMesh;
  floorCells: number[] = [];
  floorColor: THREE.Color[] = [];
  sway: any[] = [];
  nodeViews = new Map<number, { g: THREE.Group; crystal: THREE.Mesh; ring: THREE.Mesh; mat: THREE.MeshBasicMaterial }>();
  platformViews = new Map<number, THREE.Group>();
  hazardMats: THREE.MeshToonMaterial[] = [];
  spikes: THREE.InstancedMesh | null = null;
  coreGroup = new THREE.Group();
  collapseWarn: THREE.InstancedMesh | null = null;
  ambient: THREE.Points | null = null;
  ambientVel: Float32Array | null = null;
  theme: ArenaDef['theme'];
  rng = new Rng(7);
  decoDensity: number;

  constructor(public world: World, quality: string) {
    this.theme = world.arena.theme;
    this.decoDensity = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
    this.build();
  }

  private build() {
    const w = this.world,
      gr = w.grid,
      th = this.theme;
    const cell = gr.cell;
    // ---------- floor tiles (top slab + earthy underside)
    const walk: number[] = [];
    for (let i = 0; i < gr.cells.length; i++) {
      const t = gr.cells[i];
      if (t !== C.Pit && t !== C.Track) walk.push(i);
    }
    this.floorCells = walk;
    const topGeo = new RoundedBoxGeometry(cell * 0.985, 0.4, cell * 0.985, 1, 0.08);
    const underGeo = new THREE.BoxGeometry(cell, 1.6, cell);
    const topMat = new THREE.MeshToonMaterial({ color: '#ffffff' });
    const underMat = toon(th.groundSide);
    this.floorTop = new THREE.InstancedMesh(topGeo, topMat, walk.length);
    this.floorMesh = new THREE.InstancedMesh(underGeo, underMat, walk.length);
    this.floorTop.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    walk.forEach((i, k) => {
      const c = i % gr.w,
        r = Math.floor(i / gr.w);
      const p = gr.center(c, r);
      const t = gr.cells[i];
      m4.makeTranslation(p.x, -0.2, p.z);
      this.floorTop.setMatrixAt(k, m4);
      m4.makeTranslation(p.x, -1.2, p.z);
      this.floorMesh.setMatrixAt(k, m4);
      this.floorTop.setColorAt(k, new THREE.Color(this.tileColor(t, c, r)));
      this.floorColor[k] = new THREE.Color(this.tileColor(t, c, r));
    });
    this.group.add(this.floorTop, this.floorMesh);
    // hanging rocks under the island edges (floating island look)
    const rockGeo = new THREE.ConeGeometry(1, 1, 6);
    const edges: THREE.Vector3[] = [];
    for (const i of walk) {
      const c = i % gr.w,
        r = Math.floor(i / gr.w);
      const isEdge = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dc, dr]) => !gr.inBounds(c + dc, r + dr) || gr.isPit(gr.get(c + dc, r + dr)));
      if (isEdge && this.rng.chance(0.55)) edges.push(new THREE.Vector3(gr.center(c, r).x, -2, gr.center(c, r).z));
    }
    const rocks = new THREE.InstancedMesh(rockGeo, toon(shade(th.groundSide, -0.08)), edges.length);
    edges.forEach((v, k) => {
      const s = 0.7 + this.rng.next() * 0.6;
      m4.compose(new THREE.Vector3(v.x, -2 - s * 1.2, v.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, this.rng.next() * 3, 0)), new THREE.Vector3(s * 1.1, s * 2.4, s * 1.1));
      rocks.setMatrixAt(k, m4);
    });
    this.group.add(rocks);

    // ---------- walls
    const wallCells: number[] = [];
    for (let i = 0; i < gr.cells.length; i++) if (gr.cells[i] === C.Wall) wallCells.push(i);
    const wallGeo = new RoundedBoxGeometry(cell, 1.5, cell, 2, 0.16);
    const capGeo = new RoundedBoxGeometry(cell * 1.02, 0.35, cell * 1.02, 2, 0.12);
    const walls = new THREE.InstancedMesh(wallGeo, toon(th.wallSide), wallCells.length);
    const caps = new THREE.InstancedMesh(capGeo, toon(th.wallTop), wallCells.length);
    const wallOut = new THREE.InstancedMesh(wallGeo, outlineMaterial(0.05), wallCells.length);
    walls.castShadow = caps.castShadow = true;
    wallCells.forEach((i, k) => {
      const p = gr.center(i % gr.w, Math.floor(i / gr.w));
      m4.makeTranslation(p.x, 0.75, p.z);
      walls.setMatrixAt(k, m4);
      wallOut.setMatrixAt(k, m4);
      m4.makeTranslation(p.x, 1.55, p.z);
      caps.setMatrixAt(k, m4);
    });
    this.group.add(walls, caps, wallOut);

    // ---------- crates (destructible) — rebuilt when the grid changes
    const isCrystal = w.arena.mechanic === 'crystals';
    const crateGeo = isCrystal ? new THREE.OctahedronGeometry(1.05, 0) : new RoundedBoxGeometry(cell * 0.86, 1.2, cell * 0.86, 2, 0.12);
    if (isCrystal) crateGeo.scale(0.8, 1.2, 0.8);
    const crateMat = isCrystal ? toon(th.crate, { emissive: th.crate }) : toon(th.crate);
    this.crateMesh = new THREE.InstancedMesh(crateGeo, crateMat, gr.cells.length);
    this.crateTop = new THREE.InstancedMesh(new RoundedBoxGeometry(cell * 0.7, 0.12, cell * 0.7, 1, 0.05), toon(th.crateTop), gr.cells.length);
    this.crateMesh.castShadow = true;
    this.group.add(this.crateMesh);
    if (!isCrystal) this.group.add(this.crateTop);
    this.syncCrates();

    // ---------- bushes (sway)
    const bushCells: number[] = [];
    for (let i = 0; i < gr.cells.length; i++) if (gr.cells[i] === C.Bush) bushCells.push(i);
    if (bushCells.length) {
      const bmat = swayMaterial(th.bush);
      this.sway.push(bmat);
      const bgeo = new THREE.IcosahedronGeometry(0.75, 1);
      const bushes = new THREE.InstancedMesh(bgeo, bmat, bushCells.length * 4);
      let k = 0;
      for (const i of bushCells) {
        const p = gr.center(i % gr.w, Math.floor(i / gr.w));
        for (let j = 0; j < 4; j++) {
          const s = 0.8 + this.rng.next() * 0.4;
          m4.compose(new THREE.Vector3(p.x + (j % 2 ? 0.45 : -0.45), 0.55 + this.rng.next() * 0.2, p.z + (j < 2 ? 0.45 : -0.45)), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.1, s));
          bushes.setMatrixAt(k++, m4);
        }
      }
      this.group.add(bushes);
    }

    // ---------- hazards
    const hz: number[] = [];
    for (let i = 0; i < gr.cells.length; i++) if (gr.cells[i] === C.Hazard) hz.push(i);
    if (hz.length && w.arena.hazard === 'spikes') {
      const sg = new THREE.ConeGeometry(0.22, 0.8, 6);
      this.spikes = new THREE.InstancedMesh(sg, toon('#e8e8f0'), hz.length * 4);
      let k = 0;
      for (const i of hz) {
        const p = gr.center(i % gr.w, Math.floor(i / gr.w));
        for (let j = 0; j < 4; j++) {
          m4.makeTranslation(p.x + (j % 2 ? 0.5 : -0.5), 0.3, p.z + (j < 2 ? 0.5 : -0.5));
          this.spikes.setMatrixAt(k++, m4);
        }
      }
      this.group.add(this.spikes);
    }

    // ---------- jump pads
    for (const p of w.pads) {
      const g = new THREE.Group();
      g.position.set(p.x, 0.02, p.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.25, 20), toon('#3a3f6a'));
      base.position.y = 0.12;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 20), toon('#ffd23a', { emissive: '#ff9a00' }));
      top.position.y = 0.28;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      arrow.rotation.x = Math.PI / 2;
      arrow.position.y = 0.45;
      const dir = Math.atan2(w.core.x - p.x, w.core.z - p.z);
      arrow.rotation.z = 0;
      const ag = new THREE.Group();
      ag.rotation.y = dir;
      ag.add(arrow);
      arrow.position.z = 0.1;
      g.add(base, top, ag);
      this.group.add(g);
      this.anims.push({ update: (t) => ((top.position.y = 0.28 + Math.abs(Math.sin(t * 4)) * 0.08), (ag.position.y = Math.sin(t * 4) * 0.08)) });
    }

    // ---------- portals
    for (const p of w.portals) {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.15, 10, 28), toon('#8a4dff', { emissive: '#8a4dff' }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#c45cff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      swirl.rotation.x = -Math.PI / 2;
      swirl.position.y = 0.12;
      g.add(ring, swirl);
      this.group.add(g);
      this.anims.push({ update: (t) => ((swirl.rotation.z = t * 3), swirl.scale.setScalar(0.9 + Math.sin(t * 5) * 0.1)) });
    }

    // ---------- bases (team nests)
    for (const team of [0, 1]) {
      const bc = w.baseCenter[team];
      if (!bc || !isFinite(bc.x)) continue;
      const g = new THREE.Group();
      g.position.set(bc.x, 0, bc.z);
      const col = TEAM_COLORS[team];
      const nest = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.35, 8, 32), toon(shade(col, -0.1)));
      nest.rotation.x = -Math.PI / 2;
      nest.position.y = 0.15;
      const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      glowDisc.rotation.x = -Math.PI / 2;
      glowDisc.position.y = 0.05;
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), toon('#e8e0f2'));
        pole.position.set(s * 2.9, 1.5, 0);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshToonMaterial({ color: col, side: THREE.DoubleSide }));
        flag.position.set(s * 2.9 + 0.55, 2.6, 0);
        g.add(pole, flag);
        this.anims.push({ update: (t) => ((flag.rotation.y = Math.sin(t * 3 + s) * 0.3), (flag.position.y = 2.6 + Math.sin(t * 2) * 0.05)) });
      }
      g.add(nest, glowDisc);
      this.group.add(g);
      this.anims.push({ update: (t) => ((glowDisc.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 3) * 0.08) });
    }

    // ---------- gravity nodes
    for (const n of w.nodes) {
      const info = GRAVITY_INFO[n.gtype];
      const g = new THREE.Group();
      g.position.set(n.x, 0, n.z);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.25, 6), toon('#2b2f5a'));
      plate.position.y = 0.12;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), toon(info.color, { emissive: info.color }));
      crystal.position.y = 1.6;
      crystal.scale.set(1, 1.5, 1);
      const mat = new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.3, 32), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.3;
      g.add(plate, crystal, ring, new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.25, 6), outlineMaterial(0.05)));
      this.group.add(g);
      this.nodeViews.set(n.id, { g, crystal, ring, mat });
    }

    // ---------- gravity core
    const core = this.coreGroup;
    core.position.set(w.core.x, 0, w.core.z);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.5, 8), toon('#3a3f6a'));
    pedestal.position.y = 0.25;
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), toon('#7ff7ff', { emissive: '#38c8ff' }));
    orb.position.y = 2.6;
    const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#7ff7ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    orbGlow.scale.setScalar(3.5);
    orbGlow.position.y = 2.6;
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.25, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: ['#ff5ad6', '#ffd23a', '#7ff7ff'][i] }));
      r.position.y = 2.6;
      rings.push(r);
      core.add(r);
    }
    core.add(pedestal, orb, orbGlow);
    this.group.add(core);
    this.anims.push({
      update: (t) => {
        orb.rotation.y = t;
        orb.position.y = orbGlow.position.y = 2.6 + Math.sin(t * 1.5) * 0.2;
        rings.forEach((r, i) => {
          r.rotation.x = t * (0.7 + i * 0.3) + i;
          r.rotation.y = t * (0.5 + i * 0.2);
          r.position.y = orb.position.y;
        });
        const pulse = this.world.event?.id === 'core_overload' ? 1.5 + Math.sin(t * 20) * 0.5 : 1;
        orbGlow.scale.setScalar(3.5 * pulse);
      },
    });

    // ---------- moving platforms
    for (const p of w.platforms) {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new RoundedBoxGeometry(p.w, 0.5, cell * 0.95, 2, 0.1), toon(th.wallTop));
      slab.position.y = -0.25;
      const under = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 6), toon('#38c8ff', { emissive: '#38c8ff' }));
      under.rotation.x = Math.PI;
      under.position.y = -1.1;
      g.add(slab, under);
      this.group.add(g);
      this.platformViews.set(p.id, g);
    }

    // ---------- capture zones (gravity war)
    for (const z of w.captures) {
      const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.25, z.r, 48), m);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(z.x, 0.06, z.z);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(z.r, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(z.x, 0.05, z.z);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 3, 8), toon('#e8e0f2'));
      beacon.position.set(z.x, 1.5, z.z);
      const flag = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      flag.position.set(z.x, 3.2, z.z);
      this.group.add(ring, fill, beacon, flag);
      this.anims.push({
        update: (t) => {
          const col = z.owner === 0 ? TEAM_COLORS[0] : z.owner === 1 ? TEAM_COLORS[1] : '#ffffff';
          m.color.set(col);
          (fill.material as THREE.MeshBasicMaterial).color.set(z.progress < 0 ? TEAM_COLORS[0] : z.progress > 0 ? TEAM_COLORS[1] : '#ffffff');
          (fill.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.abs(z.progress) * 0.2;
          (flag.material as THREE.MeshBasicMaterial).color.set(col);
          flag.rotation.y = t * 2;
          flag.position.y = 3.2 + Math.sin(t * 2) * 0.15;
        },
      });
    }

    this.buildDecor();
    this.buildAmbient();
  }

  tileColor(t: C, c: number, r: number) {
    const th = this.theme;
    const checker = (c + r) % 2 === 0 ? th.groundA : th.groundB;
    switch (t) {
      case C.Base0:
        return (c + r) % 2 ? '#5aa8ff' : '#4d9cf5';
      case C.Base1:
        return (c + r) % 2 ? '#ff6b80' : '#f55f74';
      case C.Hazard:
        return this.world.arena.hazard === 'lava' ? '#ff5a1f' : this.world.arena.hazard === 'electric' ? '#2b3a6a' : shade(checker, -0.12);
      case C.Slow:
        return th.slow;
      case C.Bridge:
        return '#b9773a';
      case C.Core:
        return shade(checker, 0.06);
      case C.Node:
        return shade(checker, -0.05);
      default:
        return checker;
    }
  }

  syncCrates() {
    const gr = this.world.grid;
    let key = '';
    const cells: number[] = [];
    for (let i = 0; i < gr.cells.length; i++)
      if (gr.cells[i] === C.Crate) {
        cells.push(i);
        key += i + ',';
      }
    if (key === this.crateVersion) return;
    this.crateVersion = key;
    const m4 = new THREE.Matrix4();
    const isCrystal = this.world.arena.mechanic === 'crystals';
    cells.forEach((i, k) => {
      const p = gr.center(i % gr.w, Math.floor(i / gr.w));
      m4.makeTranslation(p.x, isCrystal ? 1.2 : 0.6, p.z);
      this.crateMesh.setMatrixAt(k, m4);
      m4.makeTranslation(p.x, 1.24, p.z);
      this.crateTop.setMatrixAt(k, m4);
    });
    this.crateMesh.count = this.crateTop.count = cells.length;
    this.crateMesh.instanceMatrix.needsUpdate = this.crateTop.instanceMatrix.needsUpdate = true;
  }

  /** Collapsing floor (survival): warn then drop tiles. */
  syncFloor(warnCells: Set<number>, t: number) {
    const gr = this.world.grid;
    const m4 = new THREE.Matrix4();
    let changed = false;
    const tmp = new THREE.Color();
    this.floorCells.forEach((i, k) => {
      if (gr.cells[i] === C.Pit) {
        const p = gr.center(i % gr.w, Math.floor(i / gr.w));
        const fall = ((this as any)['fall' + i] = ((this as any)['fall' + i] ?? 0) + 0.05);
        m4.makeTranslation(p.x, -0.2 - fall * fall * 6, p.z);
        this.floorTop.setMatrixAt(k, m4);
        m4.makeTranslation(p.x, -1.2 - fall * fall * 6, p.z);
        this.floorMesh.setMatrixAt(k, m4);
        changed = true;
      } else if (warnCells.has(i)) {
        tmp.copy(this.floorColor[k]).lerp(new THREE.Color('#ff3d3d'), 0.5 + Math.sin(t * 16) * 0.3);
        this.floorTop.setColorAt(k, tmp);
        changed = true;
      }
    });
    if (changed) {
      this.floorTop.instanceMatrix.needsUpdate = this.floorMesh.instanceMatrix.needsUpdate = true;
      if (this.floorTop.instanceColor) this.floorTop.instanceColor.needsUpdate = true;
    }
  }

  private buildDecor() {
    const w = this.world,
      gr = w.grid,
      th = this.theme;
    const rng = this.rng;
    const hw = gr.halfW,
      hh = gr.halfH;
    // decor island ring around the arena
    const ringGeo = new THREE.CylinderGeometry(1, 0.6, 1, 10);
    const decorIsland = new THREE.Mesh(ringGeo, toon(th.groundSide));
    decorIsland.scale.set(hw + 9, 6, hh + 9);
    decorIsland.position.y = -4.2;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), toon(shade(th.groundA, -0.06)));
    top.scale.set(hw + 9, 0.6, hh + 9);
    top.position.y = -1.0;
    // the island is an ellipse slightly below the arena so the play area reads as a raised stage
    this.group.add(decorIsland, top);
    const pts: THREE.Vector3[] = [];
    const N = Math.round(70 * this.decoDensity);
    for (let i = 0; i < N; i++) {
      const a = rng.next() * Math.PI * 2;
      const rr = 1.05 + rng.next() * 0.22;
      const x = Math.sin(a) * (hw + 2) * rr,
        z = Math.cos(a) * (hh + 2) * rr;
      if (Math.abs(x) < hw + 1 && Math.abs(z) < hh + 1) continue;
      // keep the camera side (+z) clear so decor never hides the action
      if (z > hh - 4 && Math.abs(x) < hw + 14) continue;
      pts.push(new THREE.Vector3(x, -0.7, z));
    }
    const kind = th.decor;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const makeInst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Vector3[], scaleFn: (i: number) => THREE.Vector3, yOff = 0) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((v, i) => {
        q.setFromEuler(new THREE.Euler(0, rng.next() * 6.28, 0));
        const s = scaleFn(i);
        m4.compose(new THREE.Vector3(v.x, v.y + yOff * s.y, v.z), q, s);
        im.setMatrixAt(i, m4);
      });
      this.group.add(im);
      return im;
    };
    const trees = pts.filter((_, i) => i % 3 !== 2);
    const rocks = pts.filter((_, i) => i % 3 === 2);
    const S = (a: number, b: number) => () => {
      const s = a + rng.next() * (b - a);
      return new THREE.Vector3(s, s, s);
    };
    switch (kind) {
      case 'jungle':
      case 'valley':
      case 'storm': {
        const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3, 8);
        makeInst(trunk, toon('#8a5a33'), trees, S(0.8, 1.4), 1.5);
        const leafMat = swayMaterial(kind === 'storm' ? '#3fae5a' : kind === 'valley' ? '#7ac943' : '#3fae3a');
        this.sway.push(leafMat);
        makeInst(new THREE.IcosahedronGeometry(1.6, 1), leafMat, trees, S(0.9, 1.5), 3.4);
        makeInst(new THREE.DodecahedronGeometry(1, 0), toon('#9a9aa8'), rocks, S(0.6, 1.3), 0.4);
        if (kind !== 'storm') {
          const flowers = pts.map((p) => new THREE.Vector3(p.x * 0.97 + rng.range(-1, 1), -0.45, p.z * 0.97 + rng.range(-1, 1)));
          makeInst(new THREE.SphereGeometry(0.2, 6, 4), toon('#ff8ad8'), flowers, S(0.8, 1.3), 0.2);
        }
        break;
      }
      case 'volcano': {
        makeInst(new THREE.ConeGeometry(1.4, 3, 6), toon('#4a3a3a'), trees, S(0.8, 1.6), 1.5);
        makeInst(new THREE.DodecahedronGeometry(1, 0), toon('#3a2a2a'), rocks, S(0.6, 1.4), 0.4);
        const lava = new THREE.Mesh(new THREE.RingGeometry(hw + 4, hw + 6, 48), new THREE.MeshBasicMaterial({ color: '#ff5a1f' }));
        lava.rotation.x = -Math.PI / 2;
        lava.scale.set(1, (hh + 5) / (hw + 5), 1);
        lava.position.y = -0.48;
        this.group.add(lava);
        this.anims.push({ update: (t) => (lava.material as THREE.MeshBasicMaterial).color.setHSL(0.05 + Math.sin(t * 2) * 0.015, 1, 0.55) });
        break;
      }
      case 'snow': {
        makeInst(new THREE.ConeGeometry(1.2, 3.4, 8), toon('#2f7a5a'), trees, S(0.8, 1.4), 1.7);
        makeInst(new THREE.ConeGeometry(0.9, 1.4, 8), toon('#ffffff'), trees, S(0.8, 1.4), 3.1);
        makeInst(new THREE.SphereGeometry(1, 8, 6), toon('#ffffff'), rocks, S(0.7, 1.4), 0.1);
        break;
      }
      case 'space':
      case 'cosmos': {
        makeInst(new THREE.CylinderGeometry(0.15, 0.3, 4, 6), toon('#5a6a99'), trees, S(0.7, 1.3), 2);
        const lights = trees.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        makeInst(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: kind === 'space' ? '#38f0ff' : '#ff5ad6' }), lights, S(0.7, 1.3), 4.2);
        makeInst(new THREE.OctahedronGeometry(1, 0), toon('#7a5aff', { emissive: '#3a1a8a' }), rocks, S(0.6, 1.4), 0.8);
        // planets in the sky
        for (let i = 0; i < 3; i++) {
          const pl = new THREE.Mesh(new THREE.SphereGeometry(8 + i * 5, 24, 16), toon(['#ff7af5', '#38c8ff', '#ffd23a'][i]));
          pl.position.set(-80 + i * 70, 30 + i * 10, -120 - i * 20);
          this.group.add(pl);
          if (i === 1) {
            const ring = new THREE.Mesh(new THREE.RingGeometry(18, 24, 40), new THREE.MeshBasicMaterial({ color: '#ffe8a8', side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
            ring.position.copy(pl.position);
            ring.rotation.x = 1.2;
            this.group.add(ring);
          }
        }
        break;
      }
      case 'crystal': {
        makeInst(new THREE.OctahedronGeometry(1, 0), toon('#7ff7ff', { emissive: '#2a8a9a' }), trees, () => {
          const s = 0.8 + rng.next() * 1.2;
          return new THREE.Vector3(s, s * 2.5, s);
        }, 1);
        makeInst(new THREE.OctahedronGeometry(1, 0), toon('#ff7af5', { emissive: '#8a2a8a' }), rocks, () => {
          const s = 0.6 + rng.next();
          return new THREE.Vector3(s, s * 2, s);
        }, 1);
        break;
      }
      case 'city': {
        const cols = ['#ffffff', '#ffd9b0', '#e8e0f2', '#ffb38a'];
        cols.forEach((col, ci) => {
          const list = trees.filter((_, i) => i % 4 === ci);
          makeInst(new RoundedBoxGeometry(2, 1, 2, 2, 0.2), toon(col), list, () => {
            const s = 0.8 + rng.next() * 0.6;
            return new THREE.Vector3(s, 2 + rng.next() * 4, s);
          }, 0.5);
        });
        makeInst(new THREE.ConeGeometry(1.3, 1.4, 4), toon('#ff7a5a'), trees, S(0.8, 1.2), 0);
        // balloons
        for (let i = 0; i < Math.round(8 * this.decoDensity); i++) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), toon(['#ff5a8a', '#ffd23a', '#38c8ff', '#4dff7a'][i % 4]));
          const a = rng.next() * Math.PI * 2;
          const r0 = hw + 10 + rng.next() * 12;
          b.position.set(Math.sin(a) * r0, 8 + rng.next() * 8, Math.cos(a) * (hh + 10));
          this.group.add(b);
          const y0 = b.position.y;
          this.anims.push({ update: (t) => (b.position.y = y0 + Math.sin(t * 0.7 + i) * 0.8) });
        }
        break;
      }
      case 'ruins': {
        makeInst(new THREE.CylinderGeometry(0.6, 0.7, 4, 10), toon('#e8dcc0'), trees, () => {
          const s = 0.8 + rng.next() * 0.5;
          return new THREE.Vector3(s, 0.5 + rng.next() * 1.2, s);
        }, 2);
        makeInst(new RoundedBoxGeometry(1.6, 1, 1.6, 1, 0.1), toon('#b9a57a'), rocks, S(0.7, 1.2), 0.5);
        const vines = swayMaterial('#5a9a3a');
        this.sway.push(vines);
        makeInst(new THREE.IcosahedronGeometry(0.8, 1), vines, rocks, S(0.6, 1), 1.4);
        break;
      }
    }
    // clouds drifting below / around
    const cloudMat = new THREE.MeshToonMaterial({ color: kind === 'volcano' ? '#6a4a4a' : kind === 'space' || kind === 'cosmos' || kind === 'crystal' ? '#5a3a9a' : '#ffffff', transparent: true, opacity: 0.9 });
    const cloudGeo = new THREE.IcosahedronGeometry(3, 1);
    for (let i = 0; i < Math.round(14 * this.decoDensity); i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(cloudGeo, cloudMat);
        m.position.set(k * 3 - 3, rng.next(), rng.next() * 2);
        m.scale.setScalar(0.7 + rng.next() * 0.6);
        c.add(m);
      }
      const a = rng.next() * Math.PI * 2;
      const r0 = 45 + rng.next() * 40;
      c.position.set(Math.sin(a) * r0, -14 - rng.next() * 12, Math.cos(a) * r0);
      this.group.add(c);
      const speed = 0.02 + rng.next() * 0.03;
      this.anims.push({
        update: (t) => {
          const aa = a + t * speed;
          c.position.x = Math.sin(aa) * r0;
          c.position.z = Math.cos(aa) * r0;
        },
      });
    }
    // little birds/critters circling
    if (['jungle', 'valley', 'storm', 'city', 'ruins', 'snow'].includes(kind)) {
      for (let i = 0; i < Math.round(5 * this.decoDensity); i++) {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), toon(kind === 'snow' ? '#2b2f5a' : '#ffffff'));
        const wl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.25), toon('#ffffff'));
        wl.position.x = 0.3;
        const wr = wl.clone();
        wr.position.x = -0.3;
        bird.add(body, wl, wr);
        this.group.add(bird);
        const r0 = 20 + rng.next() * 15,
          h0 = 7 + rng.next() * 5,
          sp = 0.25 + rng.next() * 0.2,
          ph = rng.next() * 6;
        this.anims.push({
          update: (t) => {
            const a = t * sp + ph;
            bird.position.set(Math.sin(a) * r0, h0 + Math.sin(t * 2 + ph), Math.cos(a) * r0 * 1.3);
            bird.rotation.y = a + Math.PI / 2;
            wl.rotation.z = Math.sin(t * 12 + ph) * 0.6;
            wr.rotation.z = -wl.rotation.z;
          },
        });
      }
    }
    // water plane for storm island / frozen ring
    if (kind === 'storm' || kind === 'snow') {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshToonMaterial({ color: kind === 'storm' ? '#2a6aaa' : '#bfe6ff', transparent: true, opacity: 0.9 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = -8;
      this.group.add(water);
      this.anims.push({ update: (t) => (water.position.y = -8 + Math.sin(t * 0.8) * 0.3) });
    }
  }

  private buildAmbient() {
    const th = this.theme;
    const n = Math.round(260 * this.decoDensity);
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const gr = this.world.grid;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * gr.halfW * 3;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * gr.halfH * 3;
      const p = th.particles;
      vel[i * 3] = p === 'rain' ? -1 : (Math.random() - 0.5) * 0.6;
      vel[i * 3 + 1] = p === 'snow' ? -1.2 : p === 'rain' ? -16 : p === 'embers' ? 1.2 : p === 'leaves' ? -0.6 : (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const colors: Record<string, string> = { pollen: '#fff7a8', embers: '#ff8a3a', snow: '#ffffff', stars: '#cfe8ff', leaves: '#9ae05a', sparkles: '#ff9af0', rain: '#bfe0ff', crystals: '#7ff7ff', clouds: '#ffffff', dust: '#fff0c9' };
    const mat = new THREE.PointsMaterial({ color: colors[th.particles], size: th.particles === 'rain' ? 0.12 : 0.28, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
    this.ambient = new THREE.Points(geo, mat);
    this.ambient.frustumCulled = false;
    this.ambientVel = vel;
    this.group.add(this.ambient);
  }

  update(t: number, dt: number) {
    for (const a of this.anims) a.update(t, dt);
    for (const m of this.sway) m.uniformsRef.uTime.value = t;
    this.syncCrates();
    const w = this.world;
    // nodes
    for (const n of w.nodes) {
      const v = this.nodeViews.get(n.id);
      if (!v) continue;
      const ready = n.cd <= 0;
      v.crystal.rotation.y = t * (n.activeT > 0 ? 6 : 1.5);
      v.crystal.position.y = 1.6 + Math.sin(t * 2 + n.id) * 0.15;
      v.crystal.scale.set(ready ? 1 : 0.6, ready ? 1.5 : 0.9, ready ? 1 : 0.6);
      v.mat.opacity = ready ? 0.45 + Math.sin(t * 4) * 0.2 : 0.12;
      v.ring.scale.setScalar(ready ? 1 + Math.sin(t * 3) * 0.06 : 1);
      if (n.activeT > 0) v.mat.color.set(n.team === 0 ? TEAM_COLORS[0] : TEAM_COLORS[1]);
      else v.mat.color.set(GRAVITY_INFO[n.gtype].color);
    }
    for (const p of w.platforms) {
      const g = this.platformViews.get(p.id);
      if (g) g.position.set(p.x, 0, p.z);
    }
    if (this.spikes) this.spikes.position.y = w.hazardOn ? 0 : -0.75;
    // ambient particles
    if (this.ambient && this.ambientVel) {
      const pos = this.ambient.geometry.attributes.position as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      const v = this.ambientVel;
      const gr = this.world.grid;
      for (let i = 0; i < a.length; i += 3) {
        a[i] += (v[i] + Math.sin(t + i) * 0.2) * dt;
        a[i + 1] += v[i + 1] * dt;
        a[i + 2] += v[i + 2] * dt;
        if (a[i + 1] < -1) a[i + 1] = 14;
        if (a[i + 1] > 15) a[i + 1] = 0;
        if (Math.abs(a[i]) > gr.halfW * 1.6) a[i] *= -0.9;
        if (Math.abs(a[i + 2]) > gr.halfH * 1.6) a[i + 2] *= -0.9;
      }
      pos.needsUpdate = true;
    }
  }
}

export { TEAM_COLORS };
