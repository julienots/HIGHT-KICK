import * as THREE from 'three';
import { getBeast, STAGE_INFO, STAGES } from '../data/beasts';
import { ELEMENT_INFO } from '../data/elements';
import { GRAVITY_INFO } from '../data/gravity';
import { MATCH_EVENTS } from '../data/modes';
import { SKIN_MAP } from '../data/skins';
import type { FxEvent, Unit, Wild } from '../sim/entities';
import { C } from '../sim/grid';
import type { World } from '../sim/world';
import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { damp } from '../core/math';
import { ArenaView, makeSky, TEAM_COLORS } from './arenaView';
import { animateRig, buildCreature, buildEgg, type Rig } from './models';
import { makeLights, type Renderer } from './renderer';
import { glowTexture, toon } from './toon';
import { VFX } from './vfx';

interface UnitView {
  u: Unit;
  rig: Rig;
  ring: THREE.Mesh;
  hurtT: number;
  lastHp: number;
  label: HTMLDivElement;
  hpFill: HTMLDivElement;
  hpText: HTMLSpanElement;
  ammo?: HTMLDivElement;
  shieldEl: THREE.Mesh;
  wasAir: boolean;
  stepT: number;
  emoteEl: HTMLDivElement;
  stunEl: THREE.Group;
}

interface WildView {
  w: Wild;
  rig: Rig;
  label: HTMLDivElement;
  hpFill: HTMLDivElement;
  hurtT: number;
  lastHp: number;
}

export interface MatchViewHooks {
  onFx(e: FxEvent): void;
}

const tmpV = new THREE.Vector3();

/** Renders a World: syncs simulation state to 3D, plays VFX/SFX/haptics, drives the camera. */
export class MatchView {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  arena: ArenaView;
  vfx: VFX;
  units = new Map<number, UnitView>();
  wilds = new Map<number, WildView>();
  eggs = new Map<number, { g: THREE.Group; phase: number; inner: THREE.Object3D; rig?: Rig; ring: THREE.Mesh }>();
  projs = new Map<number, THREE.Object3D>();
  zones = new Map<number, THREE.Group>();
  turrets = new Map<number, THREE.Group>();
  pickups = new Map<number, THREE.Object3D>();
  t = 0;
  camTarget = new THREE.Vector3();
  camZoom = 1;
  shake = 0;
  superCam = 0;
  followId = -1;
  collapseWarn = new Set<number>();
  lights: ReturnType<typeof makeLights>;
  private projGeo = new THREE.SphereGeometry(1, 10, 8);
  private projMats = new Map<string, THREE.MeshBasicMaterial>();
  private dmgPool: HTMLDivElement[] = [];
  private dmgActive: { el: HTMLDivElement; x: number; y: number; z: number; t: number; vy: number }[] = [];
  playerSuperReady = false;

  constructor(public renderer: Renderer, public world: World, public overlay: HTMLElement, public hooks: MatchViewHooks, public opts: { damageNumbers: boolean; screenShake: boolean }) {
    const th = world.arena.theme;
    this.camera = new THREE.PerspectiveCamera(42, renderer.aspect, 0.5, 900);
    this.scene.add(makeSky(th.sky, th.skyBottom));
    this.scene.fog = new THREE.Fog(th.fog, 70, 200);
    this.lights = makeLights(this.scene, th.light, th.ambient, renderer.shadows, 34);
    this.arena = new ArenaView(world, renderer.quality);
    this.scene.add(this.arena.group);
    this.vfx = new VFX(this.scene, renderer.quality);
    for (const u of world.units) this.addUnit(u);
    const p = world.player;
    if (p) {
      this.followId = p.id;
      this.camTarget.set(p.x, 0, p.z);
    }
    this.updateCamera(1);
  }

  private teamColor(team: number) {
    const myTeam = this.world.player?.team ?? 0;
    return team === myTeam ? TEAM_COLORS[0] : TEAM_COLORS[1];
  }

  private addUnit(u: Unit) {
    const skin = SKIN_MAP[u.skin];
    (u as any).fxColor = skin?.fx ?? u.def.palette.accent;
    const big = this.world.modifiers.has('bigHeads') ? 1.6 : 1;
    const rig = buildCreature(u.def.model, skin?.palette ?? u.def.palette, { accessory: skin?.accessory, glow: skin?.glow, bigHead: big, outline: this.renderer.quality !== 'low' });
    this.scene.add(rig.root);
    const isMe = u === this.world.player;
    const ringMat = new THREE.MeshBasicMaterial({ color: this.teamColor(u.team), transparent: true, opacity: isMe ? 0.95 : 0.7, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, isMe ? 1.0 : 0.92, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    rig.root.add(ring);
    const shieldEl = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#7ff7ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    shieldEl.scale.setScalar(rig.height * 0.75);
    shieldEl.position.y = rig.height * 0.5;
    shieldEl.visible = false;
    rig.root.add(shieldEl);
    const stunEl = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#ffe94d' }));
      s.position.set(Math.sin((i / 3) * 6.28) * 0.5, 0, Math.cos((i / 3) * 6.28) * 0.5);
      stunEl.add(s);
    }
    stunEl.position.y = rig.height + 0.25;
    stunEl.visible = false;
    rig.root.add(stunEl);
    // DOM label
    const label = document.createElement('div');
    const ally = u.team === (this.world.player?.team ?? 0);
    label.className = 'ulabel ' + (isMe ? 'me' : ally ? 'ally' : 'enemy');
    label.innerHTML = `<div class="uname"><span class="ulvl">${u.level}</span>${escapeHtml(u.name)}</div><div class="hpbar"><div class="hpfill"></div><span class="hptext"></span></div>${isMe ? '<div class="ammobar"></div>' : ''}<div class="uemote"></div>`;
    this.overlay.appendChild(label);
    const ammo = label.querySelector('.ammobar') as HTMLDivElement | null;
    if (ammo) for (let i = 0; i < u.def.attack.ammo; i++) ammo.appendChild(Object.assign(document.createElement('i'), {}));
    this.units.set(u.id, {
      u, rig, ring, hurtT: 0, lastHp: u.hp, label, hpFill: label.querySelector('.hpfill') as HTMLDivElement, hpText: label.querySelector('.hptext') as HTMLSpanElement, ammo: ammo ?? undefined,
      shieldEl, wasAir: false, stepT: 0, emoteEl: label.querySelector('.uemote') as HTMLDivElement, stunEl,
    });
  }

  private addWild(w: Wild) {
    const sp = getBeast(w.speciesId);
    const rig = buildCreature({ ...sp.model, size: w.size }, sp.palette, { accessory: w.isBoss ? 'crown' : 'none', glow: w.isBoss ? ELEMENT_INFO[sp.element].color : undefined });
    this.scene.add(rig.root);
    const label = document.createElement('div');
    label.className = 'ulabel wild' + (w.isBoss ? ' boss' : '');
    label.innerHTML = `<div class="uname">${w.isBoss ? '👑 TITAN ' : ''}${sp.name}</div><div class="hpbar"><div class="hpfill"></div></div>`;
    this.overlay.appendChild(label);
    this.wilds.set(w.id, { w, rig, label, hpFill: label.querySelector('.hpfill') as HTMLDivElement, hurtT: 0, lastHp: w.hp });
  }

  private eggView(id: number) {
    const e = this.world.eggs.find((x) => x.id === id)!;
    let v = this.eggs.get(id);
    if (v && v.phase === e.phase) return v;
    if (v) this.scene.remove(v.g);
    const sp = getBeast(e.speciesId);
    const col = ELEMENT_INFO[sp.element].color;
    const g = new THREE.Group();
    let inner: THREE.Object3D;
    let rig: Rig | undefined;
    if (e.phase < 2) inner = buildEgg(col, col, e.phase);
    else {
      const stage = STAGES[e.phase];
      rig = buildCreature(sp.model, sp.palette, { accessory: e.phase >= 4 ? 'crown' : 'none', glow: e.phase >= 3 ? (e.phase >= 4 ? '#ffd23a' : col) : undefined, outline: this.renderer.quality !== 'low' });
      rig.root.remove(rig.shadow);
      rig.model.scale.setScalar(sp.model.size * STAGE_INFO[stage].scale * 0.75);
      rig.scale = sp.model.size * STAGE_INFO[stage].scale * 0.75;
      inner = rig.root;
    }
    g.add(inner);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: ['#ffffff', '#4dff7a', '#2bb8ff', '#c45cff', '#ffd23a'][e.phase], transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: ['#ffffff', '#4dff7a', '#2bb8ff', '#c45cff', '#ffd23a'][e.phase], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    beacon.scale.set(1.2, 6, 1);
    beacon.position.y = 3;
    beacon.userData.beacon = true;
    g.add(beacon);
    this.scene.add(g);
    v = { g, phase: e.phase, inner, rig, ring };
    this.eggs.set(id, v);
    return v;
  }

  private projMat(color: string) {
    let m = this.projMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.projMats.set(color, m);
    }
    return m;
  }

  // ------------------------------------------------------------ frame
  update(dt: number) {
    this.t += dt;
    const w = this.world;
    for (const e of w.fx) this.handleFx(e);
    this.arena.update(this.t, dt);
    // units
    for (const v of this.units.values()) this.syncUnit(v, dt);
    // wilds
    for (const wd of w.wilds) if (!this.wilds.has(wd.id)) this.addWild(wd);
    for (const [id, v] of this.wilds) {
      const wd = v.w;
      if (!w.wilds.includes(wd)) {
        this.scene.remove(v.rig.root);
        v.label.remove();
        this.wilds.delete(id);
        continue;
      }
      v.rig.root.position.set(wd.x, wd.y, wd.z);
      v.rig.root.rotation.y = damp(v.rig.root.rotation.y, wd.facing, 10, dt);
      if (wd.hp < v.lastHp) v.hurtT = 0.18;
      v.lastHp = wd.hp;
      v.hurtT = Math.max(0, v.hurtT - dt);
      v.rig.root.visible = wd.alive || wd.deadT > 0.8;
      animateRig(v.rig, { speed: 0.6, air: wd.liftT > 0, action: wd.action, actionT: wd.actionT, carrying: false, stunned: wd.stunT > 0, t: this.t + id, hurtT: v.hurtT }, dt);
      if (!wd.alive) v.rig.root.scale.setScalar(Math.max(0.01, (wd.deadT - 0.8) / 0.4));
      this.placeLabel(v.label, wd.x, wd.y + v.rig.height + 0.5, wd.z, wd.alive);
      v.hpFill.style.width = `${(100 * Math.max(0, wd.hp)) / wd.maxHp}%`;
    }
    // eggs
    const live = new Set<number>();
    for (const e of w.eggs) {
      live.add(e.id);
      const v = this.eggView(e.id);
      v.g.position.set(e.x, e.y, e.z);
      const carried = !!e.carrier;
      v.ring.visible = !carried && e.y < 0.5;
      v.g.children.forEach((c) => c.userData.beacon && (c.visible = !carried));
      if (e.phase < 2) {
        v.inner.rotation.z = Math.sin(this.t * (e.phase ? 9 : 2)) * (e.phase ? 0.18 : 0.05);
        v.inner.position.y = carried ? 0 : Math.abs(Math.sin(this.t * 2)) * 0.15;
        v.inner.scale.setScalar(carried ? 0.85 : 1);
      } else if (v.rig) {
        if (e.carrier) v.rig.root.rotation.y = e.carrier.facing;
        animateRig(v.rig, { speed: carried ? 0 : 0.2, air: carried, action: 'idle', actionT: 0, carrying: false, stunned: false, t: this.t + e.id, hurtT: 0 }, dt);
      }
      if (!carried && Math.random() < 0.15 * this.vfx.density) this.vfx.trail(e.x + (Math.random() - 0.5), 0.3 + Math.random(), e.z + (Math.random() - 0.5), ['#ffffff', '#4dff7a', '#2bb8ff', '#c45cff', '#ffd23a'][e.phase], 0.35, 0.8);
    }
    for (const [id, v] of this.eggs)
      if (!live.has(id)) {
        this.scene.remove(v.g);
        this.eggs.delete(id);
      }
    // projectiles
    const pl = new Set<number>();
    for (const p of w.projectiles) {
      pl.add(p.id);
      let m = this.projs.get(p.id);
      if (!m) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(this.projGeo, this.projMat('#ffffff'));
        core.scale.setScalar(p.radius * (p.lob ? 1.3 : 0.75));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: p.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(p.radius * (p.lob ? 5 : 4));
        g.add(core, halo);
        if (p.lob) {
          const ball = new THREE.Mesh(this.projGeo, toon(p.color));
          ball.scale.setScalar(p.radius * 1.5 + (p.lob.big ? 0.6 : 0.25));
          g.add(ball);
        }
        this.scene.add(g);
        this.projs.set(p.id, g);
        m = g;
      }
      m.position.set(p.x, p.y, p.z);
      this.vfx.trail(p.x, p.y, p.z, p.color, p.radius * 2.2, p.lob ? 0.35 : 0.18);
    }
    for (const [id, m] of this.projs)
      if (!pl.has(id)) {
        this.scene.remove(m);
        this.projs.delete(id);
      }
    // zones
    const zl = new Set<number>();
    for (const z of w.zones) {
      zl.add(z.id);
      let g = this.zones.get(z.id);
      if (!g) {
        g = this.makeZone(z.gtype, z.r, z.team);
        this.scene.add(g);
        this.zones.set(z.id, g);
      }
      g.position.set(z.x, 0, z.z);
      const k = Math.min(1, z.t / 0.2) * Math.min(1, (z.dur - z.t) / 0.3);
      g.scale.setScalar(Math.max(0.01, k));
      g.children[0].rotation.z = this.t * (z.gtype === 'repulsion' ? -4 : 3);
      if (g.children[2]) g.children[2].rotation.y = this.t * 6;
      const col = z.gtype === 'heal' ? '#4dff7a' : z.gtype === 'burn' ? '#ff7a1f' : z.gtype === 'storm' ? '#c6f5d8' : (GRAVITY_INFO as any)[z.gtype]?.color ?? '#fff';
      if (Math.random() < 0.6 * this.vfx.density) {
        const a = Math.random() * 6.28,
          r = Math.random() * z.r;
        const up = z.gtype === 'reverse' || z.gtype === 'heal' || z.gtype === 'burn' || z.gtype === 'low' ? 3 : 0.5;
        this.vfx.burst(z.x + Math.sin(a) * r, 0.2, z.z + Math.cos(a) * r, col, 1, 0.5, { up, grav: 0, size: 0.5, life: 0.8, drag: 0.5 });
      }
    }
    for (const [id, g] of this.zones)
      if (!zl.has(id)) {
        this.scene.remove(g);
        this.zones.delete(id);
      }
    // turrets
    const tl = new Set<number>();
    for (const tu of w.turrets) {
      tl.add(tu.id);
      let g = this.turrets.get(tu.id);
      if (!g) {
        g = new THREE.Group();
        if (tu.decoy) {
          const holo = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 4, 10), new THREE.MeshBasicMaterial({ color: tu.color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
          holo.position.y = 0.9;
          g.add(holo);
        } else {
          const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8), toon('#4a4f6a'));
          base.position.y = 0.25;
          const head = new THREE.Group();
          const hb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), toon(tu.color));
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8), toon('#2b2f3a'));
          barrel.rotation.x = Math.PI / 2;
          barrel.position.z = 0.45;
          head.add(hb, barrel);
          head.position.y = 0.85;
          g.add(base, head);
        }
        this.scene.add(g);
        this.turrets.set(tu.id, g);
      }
      g.position.set(tu.x, 0, tu.z);
      if (g.children[1]) g.children[1].rotation.y = tu.facing;
      if (tu.decoy) g.children[0].position.y = 0.9 + Math.sin(this.t * 6) * 0.1;
    }
    for (const [id, g] of this.turrets)
      if (!tl.has(id)) {
        this.scene.remove(g);
        this.turrets.delete(id);
      }
    // pickups
    const pk = new Set<number>();
    for (const p of w.pickups) {
      pk.add(p.id);
      let m = this.pickups.get(p.id);
      if (!m) {
        const g = new THREE.Group();
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), toon(p.kind === 'heal' ? '#4dff7a' : '#ffd23a', { emissive: p.kind === 'heal' ? '#1a8a3a' : '#a07a00' }));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: p.kind === 'heal' ? '#4dff7a' : '#ffd23a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(1.6);
        g.add(core, halo);
        this.scene.add(g);
        this.pickups.set(p.id, g);
        m = g;
      }
      m.position.set(p.x, 0.8 + Math.sin(this.t * 3 + p.id) * 0.15, p.z);
      m.rotation.y = this.t * 2;
    }
    for (const [id, m] of this.pickups)
      if (!pk.has(id)) {
        this.scene.remove(m);
        this.pickups.delete(id);
      }
    // survival collapse warnings
    if (this.collapseWarn.size) {
      for (const i of [...this.collapseWarn]) if (w.grid.cells[i] === C.Pit) this.collapseWarn.delete(i);
      this.arena.syncFloor(this.collapseWarn, this.t);
    } else if (w.cfg.mode === 'survival') this.arena.syncFloor(this.collapseWarn, this.t);
    this.vfx.update(dt);
    this.updateDamageNumbers(dt);
    this.updateCamera(dt);
    // super ready notification
    const p = w.player;
    if (p) {
      const ready = p.superCharge >= 1;
      if (ready && !this.playerSuperReady) audio.sfx('superReady');
      this.playerSuperReady = ready;
    }
    audio.intensity = Math.min(1, 0.4 + (w.event ? 0.3 : 0) + (w.duration - w.time < 30 ? 0.3 : 0));
  }

  private makeZone(gtype: string, r: number, team: number) {
    const g = new THREE.Group();
    const col = gtype === 'heal' ? '#4dff7a' : gtype === 'burn' ? '#ff7a1f' : gtype === 'storm' ? '#c6f5d8' : (GRAVITY_INFO as any)[gtype]?.color ?? '#ffffff';
    const tex = spiralTexture();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.09;
    const edge = new THREE.Mesh(new THREE.RingGeometry(r - 0.15, r, 48), new THREE.MeshBasicMaterial({ color: team === (this.world.player?.team ?? 0) ? '#7fd0ff' : '#ff7a8a', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.1;
    g.add(disc, edge);
    if (gtype === 'storm') {
      const tw = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.6 + i * 0.35, 0.08, 6, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        t.rotation.x = Math.PI / 2;
        t.position.y = 0.4 + i * 0.7;
        tw.add(t);
      }
      g.add(tw);
    } else if (gtype === 'reverse' || gtype === 'low') {
      const col2 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4, 32, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      col2.position.y = 2;
      g.add(col2);
    }
    return g;
  }

  private syncUnit(v: UnitView, dt: number) {
    const u = v.u;
    const rig = v.rig;
    const alive = u.alive;
    const falling = u.falling;
    rig.root.visible = alive || falling;
    if (!alive && !falling) {
      v.label.style.display = 'none';
      return;
    }
    // bushes: enemies hidden, allies translucent
    const myTeam = this.world.player?.team ?? 0;
    const hidden = u.team !== myTeam && !this.world.visibleTo(myTeam, u);
    rig.root.visible = !hidden;
    rig.root.position.set(u.x, u.y, u.z);
    rig.root.rotation.y = u.facing;
    rig.shadow.position.y = 0.03 - u.y;
    rig.shadow.scale.setScalar(Math.max(0.4, 1 - u.y * 0.12));
    const speed = Math.hypot(u.vx, u.vz) / Math.max(1, u.baseSpeed);
    if (u.hp < v.lastHp - 1) {
      v.hurtT = 0.18;
      if (u === this.world.player && v.lastHp - u.hp > 50) {
        haptics.impact();
        if (this.opts.screenShake) this.shake = Math.max(this.shake, 0.25);
      }
    }
    v.lastHp = u.hp;
    v.hurtT = Math.max(0, v.hurtT - dt);
    const victoryType = SKIN_MAP[u.skin]?.victory ?? 'jump';
    animateRig(rig, { speed: u.dash ? 1.4 : speed, air: u.airborne || falling, action: u.emoteT > 0 && u.action !== 'victory' ? 'emote' : u.action, actionT: u.actionT, carrying: !!u.carrying, stunned: u.stunT > 0, t: this.t + u.id * 1.7, hurtT: v.hurtT, victory: victoryType }, dt);
    if (u.inBush && u.team === myTeam) rig.root.traverse((o: any) => o.material && o.material.transparent !== undefined);
    v.shieldEl.visible = u.shield > 0;
    if (v.shieldEl.visible) (v.shieldEl.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(this.t * 8) * 0.06;
    v.stunEl.visible = u.stunT > 0 || u.liftT > 0;
    v.stunEl.rotation.y = this.t * 5;
    if (u.invulnT > 0) rig.root.visible = rig.root.visible && Math.sin(this.t * 30) > -0.3;
    // footsteps dust
    if (speed > 0.4 && !u.airborne) {
      v.stepT -= dt;
      if (v.stepT <= 0) {
        v.stepT = 0.22;
        const cell = this.world.grid.at(u.x, u.z);
        this.vfx.dust(u.x, u.z, cell === C.Slow ? '#bfe6ff' : '#f2ead8', 2);
      }
    }
    if (u.dash) this.vfx.trail(u.x, 0.8, u.z, (u as any).fxColor, 0.9, 0.3);
    if (u.buffT > 0 && Math.random() < 0.3) this.vfx.trail(u.x + (Math.random() - 0.5), 0.3, u.z + (Math.random() - 0.5), '#ffd23a', 0.4, 0.4);
    if (u.burnT > 0 && Math.random() < 0.5) this.vfx.burst(u.x, 1, u.z, '#ff7a1f', 1, 1, { up: 2, grav: 0, size: 0.5, life: 0.4 });
    if (v.wasAir && !u.airborne && !falling) {
      this.vfx.dust(u.x, u.z, '#ffffff', 6);
    }
    v.wasAir = u.airborne;
    // label
    this.placeLabel(v.label, u.x, u.y + rig.height + 0.45, u.z, !hidden && alive);
    const pct = Math.max(0, u.hp) / u.maxHp;
    v.hpFill.style.width = `${pct * 100}%`;
    v.hpFill.classList.toggle('low', pct < 0.35);
    v.hpText.textContent = String(Math.ceil(Math.max(0, u.hp)));
    v.label.classList.toggle('carrier', !!u.carrying);
    v.label.classList.toggle('shielded', u.shield > 0);
    if (v.ammo) {
      const cells = v.ammo.children;
      for (let i = 0; i < cells.length; i++) {
        const f = Math.max(0, Math.min(1, u.ammo - i));
        (cells[i] as HTMLElement).style.setProperty('--f', String(f));
      }
    }
    v.emoteEl.textContent = u.emoteT > 0 ? u.emote : '';
    v.emoteEl.style.display = u.emoteT > 0 ? 'block' : 'none';
  }

  private placeLabel(el: HTMLElement, x: number, y: number, z: number, visible: boolean) {
    if (!visible) {
      el.style.display = 'none';
      return;
    }
    tmpV.set(x, y, z).project(this.camera);
    if (tmpV.z > 1) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const sx = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
  }

  private updateCamera(dt: number) {
    const w = this.world;
    let follow: { x: number; z: number } | null = null;
    const fu = this.units.get(this.followId)?.u;
    if (fu && (fu.alive || fu.falling)) follow = fu;
    else {
      // spectate an ally (or the base) while dead
      const ally = w.units.find((u) => u.alive && u.team === (w.player?.team ?? 0));
      follow = ally ?? w.baseCenter[w.player?.team ?? 0] ?? { x: 0, z: 0 };
    }
    let zoom = 1;
    const boss = w.wilds.find((x) => x.isBoss && x.alive);
    if (boss) zoom = 1.25;
    if (w.state === 'ended') zoom = 0.55;
    if (this.superCam > 0) {
      this.superCam -= dt;
      zoom *= 0.82;
    }
    const portrait = this.renderer.aspect < 1;
    if (portrait) zoom *= 1.45;
    this.camZoom = damp(this.camZoom, zoom, 3, dt);
    const fx = follow.x,
      fz = follow.z;
    // look-ahead toward the move direction
    const la = fu && fu.alive ? 1.2 : 0;
    this.camTarget.x = damp(this.camTarget.x, fx + (fu?.vx ?? 0) * 0.12 * la, 6, dt);
    this.camTarget.z = damp(this.camTarget.z, fz + (fu?.vz ?? 0) * 0.12 * la, 6, dt);
    const gr = w.grid;
    this.camTarget.x = Math.max(-gr.halfW + 6, Math.min(gr.halfW - 6, this.camTarget.x));
    const height = 21 * this.camZoom,
      back = 13 * this.camZoom;
    let cx = this.camTarget.x,
      cy = height,
      cz = this.camTarget.z + back;
    if (w.state === 'ended') {
      // victory orbit
      const a = this.t * 0.4;
      cx = this.camTarget.x + Math.sin(a) * 9;
      cz = this.camTarget.z + Math.cos(a) * 9;
      cy = 6;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.8;
      cx += (Math.random() - 0.5) * s;
      cy += (Math.random() - 0.5) * s;
      cz += (Math.random() - 0.5) * s;
    }
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.camTarget.x, w.state === 'ended' ? 1 : 0, this.camTarget.z - (w.state === 'ended' ? 0 : 1));
    this.camera.aspect = this.renderer.aspect;
    this.camera.updateProjectionMatrix();
    const sun = this.lights.sun;
    sun.position.set(this.camTarget.x - 12, 30, this.camTarget.z + 14);
    sun.target.position.set(this.camTarget.x, 0, this.camTarget.z);
  }

  // ------------------------------------------------------------ damage numbers
  private damageNumber(x: number, y: number, z: number, text: string, cls: string) {
    if (!this.opts.damageNumbers) return;
    let el = this.dmgPool.pop();
    if (!el) {
      el = document.createElement('div');
      this.overlay.appendChild(el);
    }
    el.className = 'dmgnum ' + cls;
    el.textContent = text;
    el.style.display = 'block';
    this.dmgActive.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z, t: 0, vy: 2.2 });
  }
  private updateDamageNumbers(dt: number) {
    const keep = [];
    for (const d of this.dmgActive) {
      d.t += dt;
      d.y += d.vy * dt;
      d.vy -= 3 * dt;
      if (d.t > 0.8) {
        d.el.style.display = 'none';
        this.dmgPool.push(d.el);
        continue;
      }
      tmpV.set(d.x, d.y, d.z).project(this.camera);
      const sx = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
      const sc = d.t < 0.1 ? 0.6 + d.t * 6 : 1.2 - (d.t - 0.1) * 0.4;
      d.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${sc})`;
      d.el.style.opacity = String(d.t > 0.55 ? 1 - (d.t - 0.55) / 0.25 : 1);
      keep.push(d);
    }
    this.dmgActive = keep;
  }

  // ------------------------------------------------------------ FX events
  private handleFx(e: FxEvent) {
    const w = this.world;
    const me = w.player;
    const unit = (id: number) => this.units.get(id)?.u;
    const vfx = this.vfx;
    switch (e.t) {
      case 'shoot': {
        const u = unit(e.u);
        vfx.flash(e.x + e.dx * 0.9, 1, e.z + e.dz * 0.9, e.color, 1.4, 0.1);
        if (u === me || (u && dist2(u, me) < 300)) audio.sfx(e.kind === 'spread' ? 'spread' : e.kind === 'lob' ? 'lob' : e.kind === 'melee' ? 'melee' : 'shoot', u ? u.def.voice * 0.4 + 0.7 : 1, u === me ? 1 : 0.45);
        if (u === me) haptics.attack();
        break;
      }
      case 'hit': {
        const col = e.heal ? '#4dff7a' : e.color;
        if (!e.heal) {
          vfx.burst(e.x, 1 + e.y, e.z, col, 5, 4, { up: 2, size: 0.5, life: 0.35 });
          vfx.flash(e.x, 1 + e.y, e.z, '#ffffff', 1.1, 0.08);
        }
        if (e.dmg >= 1 && (e.byPlayer || e.onPlayer || e.heal) && (e.dmg > 40 || e.heal)) {
          this.damageNumber(e.x, 2.2 + e.y, e.z, (e.heal ? '+' : '') + e.dmg, e.heal ? 'heal' : e.onPlayer ? 'taken' : e.crit ? 'crit' : 'dealt');
        }
        if (e.byPlayer && !e.heal) audio.sfx(e.crit ? 'crit' : 'hit', 1, 0.8);
        if (e.onPlayer && !e.heal && e.dmg > 50) audio.sfx('hurt', 1, 0.7);
        break;
      }
      case 'boom':
        vfx.explosion(e.x, e.z, e.r, e.color, e.big);
        if (e.r > 1 && me && dist2(e, me) < 400) {
          audio.sfx('explode', 1, e.big ? 1 : 0.5);
          if (e.big && this.opts.screenShake) this.shake = Math.max(this.shake, 0.35);
        }
        break;
      case 'ring':
        vfx.ring(e.x, e.z, e.r, e.color, 0.45);
        vfx.disc(e.x, e.z, e.r, e.color, 0.3, 0.3);
        break;
      case 'cone':
        vfx.cone(e.x, e.z, e.dx, e.dz, e.range, e.angle, e.color);
        break;
      case 'line':
        vfx.line(e.x, e.z, e.dx, e.dz, e.range, e.width, e.color);
        audio.sfx('explode', 1.4, 0.6);
        break;
      case 'chain':
        vfx.lightning(e.pts.map((p) => ({ x: p.x, y: 1, z: p.z })), e.color);
        audio.sfx('lightning', 1, 0.7);
        break;
      case 'dash': {
        const u = unit(e.u);
        vfx.burst(e.x, 0.5, e.z, e.color, 10, 3, { up: 1, size: 0.6, life: 0.4 });
        if (u === me || (u && dist2(u, me) < 200)) audio.sfx('dash', 1, u === me ? 1 : 0.5);
        break;
      }
      case 'blink':
        vfx.burst(e.fx, 1, e.fz, e.color, 14, 4, { up: 1, size: 0.6, life: 0.4 });
        vfx.burst(e.x, 1, e.z, e.color, 14, 4, { up: 1, size: 0.6, life: 0.4 });
        vfx.flash(e.x, 1, e.z, e.color, 3, 0.2);
        audio.sfx('blink', 1, 0.7);
        break;
      case 'heal':
        vfx.ring(e.x, e.z, e.r, '#4dff7a', 0.6);
        vfx.burst(e.x, 0.5, e.z, '#4dff7a', 16, 2, { up: 3, grav: 0, size: 0.6, life: 0.8 });
        audio.sfx('heal', 1, 0.7);
        break;
      case 'shield': {
        const u = unit(e.u);
        if (u) vfx.burst(u.x, 1, u.z, e.color, 10, 2, { up: 1, grav: 0, size: 0.5, life: 0.5 });
        if (u === me) audio.sfx('shield');
        break;
      }
      case 'death': {
        vfx.explosion(e.x, e.z, 1.8, e.color, true);
        vfx.burst(e.x, 1, e.z, '#ffffff', 20, 7, { up: 4, size: 0.4, life: 0.8 });
        const killer = unit(e.killer);
        audio.sfx('death', 1, e.u === me?.id ? 1 : 0.6);
        if (killer === me) {
          audio.sfx('kill');
          haptics.impact();
        }
        if (e.u === me?.id && this.opts.screenShake) this.shake = 0.5;
        break;
      }
      case 'respawn': {
        const u = unit(e.u);
        if (u) {
          vfx.ring(u.x, u.z, 2, this.teamColor(u.team), 0.6);
          vfx.burst(u.x, 0.4, u.z, this.teamColor(u.team), 18, 2, { up: 5, grav: 0, size: 0.6, life: 0.7 });
          if (u === me) audio.sfx('respawn');
        }
        break;
      }
      case 'pickup': {
        const u = unit(e.u);
        if (u) vfx.burst(u.x, 2, u.z, '#ffffff', 14, 3, { up: 3, size: 0.5 });
        audio.sfx('pickup', 1, u === me ? 1 : 0.5);
        break;
      }
      case 'drop':
        audio.sfx('drop', 1, 0.6);
        break;
      case 'deliver': {
        const col = this.teamColor(e.team);
        vfx.ring(e.x, e.z, 4, col, 0.8);
        vfx.burst(e.x, 1, e.z, '#ffd23a', 40, 8, { up: 8, size: 0.7, life: 1 });
        vfx.burst(e.x, 1, e.z, col, 30, 6, { up: 6, size: 0.7, life: 1 });
        audio.sfx(e.team === me?.team ? 'deliver' : 'enemyDeliver');
        if (e.u === me?.id) haptics.victory();
        break;
      }
      case 'evolve': {
        vfx.flash(e.x, 1.5, e.z, '#ffffff', 4, 0.3);
        vfx.burst(e.x, 1, e.z, ['#ffffff', '#4dff7a', '#2bb8ff', '#c45cff', '#ffd23a'][e.phase], 30, 5, { up: 5, size: 0.7, life: 0.9 });
        audio.sfx('evolve', 1, 0.8);
        if (e.phase >= 4) haptics.rare();
        break;
      }
      case 'node': {
        const col = (GRAVITY_INFO as any)[e.gtype]?.color ?? '#ffffff';
        vfx.ring(e.x, e.z, 6, col, 0.7);
        vfx.flash(e.x, 1.5, e.z, col, 6, 0.3);
        vfx.burst(e.x, 1, e.z, col, 40, 7, { up: 4, size: 0.8, life: 0.9 });
        audio.sfx('node');
        if (this.opts.screenShake && me && dist2(e, me) < 300) this.shake = Math.max(this.shake, 0.3);
        break;
      }
      case 'event':
        audio.sfx('event');
        break;
      case 'warn':
        if (e.r > 0) vfx.warn(e.x, e.z, e.r, e.dur, e.color);
        break;
      case 'strike': {
        if (e.kind === 'lightning') {
          vfx.lightning(
            [
              { x: e.x + 1, y: 14, z: e.z - 1 },
              { x: e.x, y: 0.3, z: e.z },
            ],
            '#fff7a8',
          );
          vfx.ring(e.x, e.z, e.r, '#ffe94d', 0.3);
          audio.sfx('lightning', 1, me && dist2(e, me) < 200 ? 0.8 : 0.3);
        } else {
          vfx.explosion(e.x, e.z, e.r, e.kind === 'pulse' ? '#7ff7ff' : e.kind === 'slam' ? '#ff4d6d' : '#ff7a1f', true);
          audio.sfx('explode', 1, me && dist2(e, me) < 300 ? 0.9 : 0.3);
          if (this.opts.screenShake && me && dist2(e, me) < 150) this.shake = Math.max(this.shake, 0.35);
        }
        break;
      }
      case 'jump': {
        const u = unit(e.u);
        if (u) vfx.burst(u.x, 0.3, u.z, '#ffffff', 10, 3, { up: 2, size: 0.6 });
        audio.sfx('jump', 1, u === me ? 1 : 0.4);
        break;
      }
      case 'land':
        audio.sfx('land', 1, e.u === me?.id ? 1 : 0.3);
        break;
      case 'portal':
        audio.sfx('portal', 1, e.u === me?.id ? 1 : 0.4);
        break;
      case 'crate':
        vfx.burst(e.x, 0.8, e.z, e.color, 16, 5, { up: 4, size: 0.6, life: 0.6, smoke: true, grav: 9 });
        audio.sfx('crate', 1, 0.5);
        break;
      case 'wildDeath':
        vfx.explosion(e.x, e.z, 1.6, '#ffd23a', e.rarity >= 3);
        audio.sfx('kill', 0.8, 0.6);
        break;
      case 'super': {
        const u = unit(e.u);
        if (u) {
          vfx.flash(u.x, 1.5, u.z, (u as any).fxColor, 5, 0.3);
          vfx.burst(u.x, 1, u.z, (u as any).fxColor, 30, 6, { up: 4, size: 0.8 });
        }
        audio.sfx('super', u ? 0.8 + u.def.voice * 0.2 : 1, u === me ? 1 : 0.5);
        if (u) audio.sfx('voice', u.def.voice, u === me ? 0.9 : 0.4);
        if (u === me) {
          haptics.super();
          this.superCam = 0.6;
          if (this.opts.screenShake) this.shake = 0.3;
        }
        break;
      }
      case 'skill': {
        const u = unit(e.u);
        audio.sfx('skill', u ? 0.8 + u.def.voice * 0.2 : 1, u === me ? 0.9 : 0.4);
        break;
      }
      case 'gadget':
        audio.sfx('shield', 1.3, 0.6);
        break;
      case 'boss':
        audio.sfx('boss');
        if (this.opts.screenShake) this.shake = 0.4;
        break;
      case 'collapse':
        for (const i of e.cells) this.collapseWarn.add(i);
        audio.sfx('warn');
        break;
      case 'capture':
        audio.sfx(e.team === me?.team ? 'deliver' : 'enemyDeliver', 1, 0.7);
        break;
      case 'emote':
        audio.sfx('voice', unit(e.u)?.def.voice ?? 1, 0.6);
        break;
    }
    this.hooks.onFx(e);
  }

  dispose() {
    for (const v of this.units.values()) v.label.remove();
    for (const v of this.wilds.values()) v.label.remove();
    for (const d of [...this.dmgActive.map((x) => x.el), ...this.dmgPool]) d.remove();
    this.scene.traverse((o: any) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    });
  }
}

function dist2(a: { x: number; z: number }, b: { x: number; z: number } | null | undefined) {
  if (!b) return 1e9;
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

let spiralTex: THREE.Texture | null = null;
function spiralTexture() {
  if (spiralTex) return spiralTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 5;
  for (let arm = 0; arm < 4; arm++) {
    g.beginPath();
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const a = arm * (Math.PI / 2) + t * 4;
      const r = t * 60;
      const x = 64 + Math.cos(a) * r,
        y = 64 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  spiralTex = new THREE.CanvasTexture(c);
  return spiralTex;
}

export { MATCH_EVENTS };
