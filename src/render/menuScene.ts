import * as THREE from 'three';
import { getJacker } from '../data/jackers';
import { SKIN_MAP } from '../data/skins';
import { getBeast } from '../data/beasts';
import { makeSky } from './arenaView';
import { animateRig, buildCreature, type Rig } from './models';
import { makeLights, type Renderer } from './renderer';
import { glowTexture, toon, shade } from './toon';
import { mutatePalette } from './mutation';

/** The living "small world" behind the main menu: floating island, hero on a pedestal, pets, clouds. */
export class MenuScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 900);
  hero: Rig | null = null;
  heroKey = '';
  pet: Rig | null = null;
  petKey = '';
  t = 0;
  actionT = 0;
  action = 'idle';
  nextAction = 4;
  anims: ((t: number, dt: number) => void)[] = [];
  /** 0 = home layout (hero centre-left), 1 = detail layout (hero left, bigger) */
  layout = 0;
  lookX = 0;
  private sparkles: THREE.Points;
  constructor(private renderer: Renderer) {
    this.scene.add(makeSky('#5fb8ff', '#ffe9c9'));
    this.scene.fog = new THREE.Fog('#bfe6ff', 40, 160);
    makeLights(this.scene, '#fff4dc', '#bfe0ff', renderer.shadows, 12);
    // floating island
    const island = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 8.6, 1.2, 40), toon('#7ed957'));
    top.position.y = -0.6;
    top.receiveShadow = true;
    const under = new THREE.Mesh(new THREE.ConeGeometry(8.6, 9, 12), toon('#8a5a33'));
    under.rotation.x = Math.PI;
    under.position.y = -5.7;
    island.add(top, under);
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 32), toon('#ffe760'));
    ped.position.y = 0.25;
    ped.receiveShadow = true;
    const pedRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.12, 8, 40), toon('#ffb300'));
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.y = 0.5;
    island.add(ped, pedRing);
    // trees, rocks, flowers
    const rng = (i: number) => Math.abs(Math.sin(i * 91.7 + 3.1));
    for (let i = 0; i < 9; i++) {
      const a = -0.3 + i * 0.7;
      const r = 5.6 + rng(i) * 2.2;
      const x = Math.sin(a) * r,
        z = -Math.abs(Math.cos(a)) * r - 0.5;
      if (i % 3 === 0) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + rng(i + 2) * 0.5, 0), toon('#9a9aa8'));
        rock.position.set(x, 0.2, z);
        island.add(rock);
      } else {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 2.2, 8), toon('#8a5a33'));
        trunk.position.set(x, 1.1, z);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rng(i) * 0.5, 1), toon(['#3fae3a', '#5fd63a', '#7ac943'][i % 3]));
        crown.position.set(x, 2.8, z);
        island.add(trunk, crown);
        this.anims.push((t) => (crown.rotation.z = Math.sin(t * 1.3 + i) * 0.05));
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = rng(i * 3) * Math.PI * 2;
      const r = 2.5 + rng(i * 5) * 5.5;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), toon(['#ff8ad8', '#ffe94d', '#ffffff', '#7ff7ff'][i % 4]));
      f.position.set(Math.sin(a) * r, 0.08, Math.cos(a) * r * 0.8);
      island.add(f);
    }
    // gravity core decoration floating behind
    const coreOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), toon('#7ff7ff', { emissive: '#38c8ff' }));
    coreOrb.position.set(4.5, 4.5, -5);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#7ff7ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(4);
    glow.position.copy(coreOrb.position);
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.3, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: i ? '#ff5ad6' : '#ffd23a' }));
      r.position.copy(coreOrb.position);
      rings.push(r);
      island.add(r);
    }
    island.add(coreOrb, glow);
    this.anims.push((t) => {
      coreOrb.position.y = glow.position.y = 4.5 + Math.sin(t * 1.2) * 0.3;
      coreOrb.rotation.y = t * 0.8;
      rings.forEach((r, i) => {
        r.position.y = coreOrb.position.y;
        r.rotation.x = t * (0.8 + i * 0.4);
        r.rotation.y = t * (0.5 + i * 0.3);
      });
    });
    this.scene.add(island);
    // other floating islets & clouds
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const s = 1.5 + rng(i + 7) * 2;
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.9, 0.6, 16), toon('#7ed957'));
      const u2 = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s * 2.2, 8), toon('#8a5a33'));
      u2.rotation.x = Math.PI;
      u2.position.y = -s * 1.1 - 0.3;
      g.add(t2, u2);
      g.position.set(-28 + i * 14, 2 + rng(i) * 8, -30 - rng(i + 1) * 20);
      this.scene.add(g);
      const y0 = g.position.y;
      this.anims.push((t) => (g.position.y = y0 + Math.sin(t * 0.5 + i) * 0.5));
    }
    const cloudMat = new THREE.MeshToonMaterial({ color: '#ffffff' });
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), cloudMat);
        m.position.set(k * 2.4 - 2.4, rng(i + k) * 0.8, 0);
        m.scale.setScalar(0.7 + rng(i * 2 + k) * 0.6);
        c.add(m);
      }
      const z = -20 - rng(i) * 40,
        y = -6 + rng(i + 3) * 18;
      const sp = 0.6 + rng(i + 9);
      const x0 = -60 + rng(i + 4) * 120;
      c.position.set(x0, y, z);
      this.scene.add(c);
      this.anims.push((t) => (c.position.x = ((x0 + t * sp + 60) % 120) - 60));
    }
    // sparkles
    const n = 80;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng(i) - 0.5) * 18;
      pos[i * 3 + 1] = rng(i + 1) * 8;
      pos[i * 3 + 2] = (rng(i + 2) - 0.5) * 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff7a8', size: 0.25, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.sparkles);
  }

  setHero(jackerId: string, skinId?: string) {
    const key = jackerId + ':' + (skinId ?? '');
    if (key === this.heroKey) return;
    this.heroKey = key;
    if (this.hero) this.scene.remove(this.hero.root);
    const j = getJacker(jackerId);
    const sk = skinId ? SKIN_MAP[skinId] : undefined;
    this.hero = buildCreature(j.model, sk?.palette ?? j.palette, { accessory: sk?.accessory, glow: sk?.glow });
    this.hero.root.position.y = 0.5;
    this.hero.model.scale.multiplyScalar(1.35);
    this.hero.scale *= 1.35;
    this.scene.add(this.hero.root);
    this.action = 'super';
    this.actionT = 0;
  }
  setPet(speciesId: string | null, stage = 2, mutation = 'none') {
    const key = speciesId ? `${speciesId}:${stage}:${mutation}` : '';
    if (key === this.petKey) return;
    this.petKey = key;
    if (this.pet) this.scene.remove(this.pet.root);
    this.pet = null;
    if (!speciesId) return;
    const sp = getBeast(speciesId);
    this.pet = buildCreature(sp.model, mutatePalette(sp.palette, mutation), { accessory: stage >= 4 ? 'crown' : 'none' });
    this.pet.model.scale.multiplyScalar(0.55 + stage * 0.08);
    this.pet.scale *= 0.55 + stage * 0.08;
    this.scene.add(this.pet.root);
  }
  /** Trigger a reaction when the hero is tapped. */
  poke() {
    this.action = Math.random() < 0.5 ? 'super' : 'victory';
    this.actionT = 0;
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    for (const a of this.anims) a(t, dt);
    if (this.hero) {
      this.actionT += dt;
      this.nextAction -= dt;
      if (this.nextAction <= 0 && this.action === 'idle') {
        this.action = ['attack', 'skill', 'emote', 'victory'][Math.floor(Math.random() * 4)];
        this.actionT = 0;
        this.nextAction = 4 + Math.random() * 4;
      }
      if ((this.action === 'victory' || this.action === 'emote') && this.actionT > 2) this.action = 'idle';
      if (this.action !== 'idle' && this.action !== 'victory' && this.action !== 'emote' && this.actionT > 0.9) this.action = 'idle';
      // look at camera, glance around
      const look = Math.sin(t * 0.4) * 0.35 + this.lookX * 0.4;
      animateRig(this.hero, { speed: 0, air: false, action: this.action, actionT: this.actionT, carrying: false, stunned: false, t, hurtT: 0, lookYaw: look, victory: 'dance' }, dt);
      this.hero.root.rotation.y = 0.12 + Math.sin(t * 0.3) * 0.08;
    }
    if (this.pet) {
      const a = t * 0.6;
      this.pet.root.position.set(3.2 + Math.sin(a) * 1.4, 0, -0.6 + Math.cos(a) * 1.1);
      this.pet.root.rotation.y = a + Math.PI / 2;
      animateRig(this.pet, { speed: 0.5, air: false, action: 'idle', actionT: 0, carrying: false, stunned: false, t: t + 3, hurtT: 0 }, dt);
    }
    this.sparkles.rotation.y = t * 0.05;
    const aspect = this.renderer.aspect;
    this.camera.aspect = aspect;
    const portrait = aspect < 1;
    const off = this.layout === 1 ? 2.4 : 0.8;
    const dist = portrait ? 19 : this.layout === 1 ? 11 : 14;
    this.camera.fov = portrait ? 46 : 34;
    this.camera.position.set(off + Math.sin(t * 0.15) * 0.4, 3.6, dist);
    this.camera.lookAt(off, 1.7, 0);
    this.camera.updateProjectionMatrix();
  }
}

export { shade };
