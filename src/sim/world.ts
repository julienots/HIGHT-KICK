import { getArena, type ArenaDef } from '../data/arenas';
import { getBeast, BEASTS } from '../data/beasts';
import { elementMultiplier, type Element } from '../data/elements';
import type { GravityType } from '../data/gravity';
import { getJacker, JACKERS } from '../data/jackers';
import { MATCH_EVENTS, MODE_MAP, type MatchEventId } from '../data/modes';
import { RARITIES } from '../data/rarities';
import { SKINS, defaultSkin, SKIN_MAP } from '../data/skins';
import { Rng } from '../core/rng';
import { angleOf, clamp, dist, len, norm } from '../core/math';
import { C, Grid } from './grid';
import {
  Unit, type CaptureZone, type Egg, type FxEvent, type GravityNode, type MatchConfig, type Pickup, type Platform, type Projectile,
  type Strike, type Turret, type Wild, type Zone,
} from './entities';
import { tickAbilities } from './abilities';
import { BotBrain, botProfile } from './ai';
import { ModeRules, createRules } from './modes';

export type Target = Unit | Wild | Turret;

export const EGG_POINTS = [1, 2, 4, 7, 12];
export const EGG_PHASE_NAMES = ['EGG', 'HATCHLING', 'BEAST', 'ELITE BEAST', 'TITAN'];
const EGG_SPEED = [1, 0.96, 0.9, 0.82, 0.72];
const BOT_NAMES = ['Zorg', 'Pixel', 'Miko', 'Nova', 'Rex', 'Lumi', 'Bolt', 'Kiki', 'Taro', 'Yuzu', 'Momo', 'Juno', 'Rocco', 'Pip', 'Vega', 'Suki', 'Gizmo', 'Nala'];

export interface DamageOpts {
  element?: Element;
  slow?: number;
  slowT?: number;
  knockX?: number;
  knockZ?: number;
  knock?: number;
  stun?: number;
  burn?: number;
  isSuper?: boolean;
  isAbility?: boolean;
  noCharge?: boolean;
  color?: string;
  critReady?: boolean;
}

export class World {
  cfg: MatchConfig;
  arena: ArenaDef;
  grid: Grid;
  rng: Rng;
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  eggs: Egg[] = [];
  wilds: Wild[] = [];
  turrets: Turret[] = [];
  nodes: GravityNode[] = [];
  platforms: Platform[] = [];
  strikes: Strike[] = [];
  captures: CaptureZone[] = [];
  pickups: Pickup[] = [];
  portals: { x: number; z: number; pair: number }[] = [];
  pads: { x: number; z: number }[] = [];
  eggSpawns: { x: number; z: number }[] = [];
  baseCells: { x: number; z: number }[][] = [[], []];
  baseCenter: { x: number; z: number }[] = [];
  core = { x: 0, z: 0, eventT: 30, pulse: 0 };
  score = [0, 0];
  time = 0;
  duration: number;
  target: number;
  state: 'intro' | 'playing' | 'overtime' | 'ended' = 'intro';
  introT = 3;
  winner = -1;
  endReason = '';
  event: { id: MatchEventId; t: number; dur: number; data: any } | null = null;
  fx: FxEvent[] = [];
  player: Unit | null = null;
  gravityScale = 1;
  globalLowG = false;
  modifiers: Set<string>;
  rules: ModeRules;
  hazardOn = true;
  hazardT = 0;
  mechT = 0;
  wind = { x: 0, z: 0, t: 0 };
  collapseR = 99;
  private nextId = 1;
  eggRespawnT = 0;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.arena = getArena(cfg.arena);
    this.grid = new Grid(this.arena);
    this.rng = new Rng(cfg.seed);
    const mode = MODE_MAP[cfg.mode];
    this.duration = mode.duration;
    this.target = mode.target;
    this.modifiers = new Set(cfg.modifiers ?? []);
    if (cfg.mode === 'chaos' && !cfg.modifiers?.length) {
      const pool = ['doubleSuper', 'lowGravity', 'fastEggs', 'bigHeads', 'meteors'];
      this.rng.shuffle(pool);
      pool.slice(0, 2).forEach((m) => this.modifiers.add(m));
    }
    this.gravityScale = this.arena.gravity / 30;
    if (this.modifiers.has('lowGravity')) this.gravityScale *= 0.5;
    this.scanGrid();
    this.rules = createRules(this);
    this.spawnTeams();
    this.rules.setup();
  }

  id() {
    return this.nextId++;
  }
  emit(e: FxEvent) {
    this.fx.push(e);
  }
  get g() {
    return 30 * this.gravityScale * (this.globalLowG ? 0.35 : 1);
  }

  // ------------------------------------------------------------------ setup
  private scanGrid() {
    const gr = this.grid;
    const nodeCells = gr.find(C.Node);
    // order: by row, nodes mirrored get same type
    const types = this.arena.nodeTypes;
    // mirrored nodes (top/bottom) share a type so both teams get the same tools
    const key = (p: { c: number; r: number }) => Math.min(p.r, gr.h - 1 - p.r) * 100 + p.c;
    const keys = [...new Set(nodeCells.map(key))].sort((a, b) => a - b);
    nodeCells.forEach((p) => {
      const pos = gr.center(p.c, p.r);
      this.nodes.push({ id: this.id(), x: pos.x, z: pos.z, gtype: types[keys.indexOf(key(p)) % types.length], cd: 4, activeT: 0, team: -1 });
    });
    for (const p of gr.find(C.Core)) Object.assign(this.core, gr.center(p.c, p.r));
    for (const p of gr.find(C.Spawn)) this.eggSpawns.push(gr.center(p.c, p.r));
    for (const p of gr.find(C.Pad)) this.pads.push(gr.center(p.c, p.r));
    const portals = gr.find(C.Portal);
    portals.forEach((p) => {
      const mate = portals.findIndex((q) => q.r === p.r && q.c === gr.w - 1 - p.c);
      this.portals.push({ ...gr.center(p.c, p.r), pair: mate });
    });
    for (const t of [0, 1]) {
      const cells = gr.find(t === 0 ? C.Base0 : C.Base1).map((p) => gr.center(p.c, p.r));
      this.baseCells[t] = cells;
      const cx = cells.reduce((a, b) => a + b.x, 0) / Math.max(1, cells.length);
      const cz = cells.reduce((a, b) => a + b.z, 0) / Math.max(1, cells.length);
      this.baseCenter[t] = { x: cx, z: cz };
    }
    // moving platforms: contiguous track segments
    for (let r = 0; r < gr.h; r++) {
      let c = 0;
      while (c < gr.w) {
        if (gr.get(c, r) === C.Track) {
          const start = c;
          while (c < gr.w && gr.get(c, r) === C.Track) c++;
          const a = gr.center(start, r),
            b = gr.center(c - 1, r);
          const w = 2.2;
          this.platforms.push({ id: this.id(), row: r, minX: a.x - gr.cell / 2 + w / 2, maxX: b.x + gr.cell / 2 - w / 2, x: a.x, z: a.z, w, dir: start === 0 ? 1 : -1, speed: 2.6 });
        } else c++;
      }
    }
  }

  baseSpawnPoint(team: number, i: number) {
    const bc = this.baseCenter[team];
    const dir = team === 0 ? -1 : 1;
    const offs = [-2.2, 2.2, 0, -4, 4];
    let x = bc.x + offs[i % offs.length],
      z = bc.z + dir * 0.5;
    if (!this.grid.walkable(this.grid.at(x, z))) {
      x = bc.x;
      z = bc.z;
    }
    return { x, z };
  }

  makeUnit(team: number, jackerId: string, level: number, isBot: boolean, name: string, skin?: string, load?: { gadget: 0 | 1; starPower: 0 | 1; special: 0 | 1; useStarPower: boolean; useGadget: boolean; useSpecial: boolean }, bonus?: { hp: number; dmg: number }) {
    const def = getJacker(jackerId);
    const passives = [def.passive];
    const lv = load ?? { gadget: 0, starPower: 0, special: 0, useGadget: level >= 7, useStarPower: level >= 10, useSpecial: level >= 14 };
    if (lv.useStarPower) passives.push(def.starPowers[lv.starPower]);
    const gadget = lv.useGadget ? def.gadgets[lv.gadget] : null;
    const special = lv.useSpecial ? def.specials[lv.special] : null;
    const u = new Unit(this.id(), team, def, level, skin ?? defaultSkin(jackerId), name, isBot, passives, gadget, special, bonus);
    if (this.modifiers.has('bigHeads')) u.radius *= 1.1;
    this.units.push(u);
    return u;
  }

  private spawnTeams() {
    const cfg = this.cfg;
    const mode = MODE_MAP[cfg.mode];
    const size = cfg.teamSize ?? mode.teamSize;
    const p = cfg.player;
    const botLv = Math.max(1, Math.min(20, cfg.botLevel ?? p.level));
    const diffLv = { easy: -2, normal: 0, hard: 1, expert: 3, master: 5 }[cfg.difficulty];
    const used = new Set<string>([p.jackerId]);
    const pickJ = () => {
      const pool = JACKERS.filter((j) => !used.has(j.id));
      const j = pool[Math.floor(this.rng.next() * pool.length)] ?? JACKERS[0];
      used.add(j.id);
      return j.id;
    };
    const pickSkin = (jid: string) => {
      const skins = SKINS.filter((s) => s.jackerId === jid);
      return this.rng.chance(0.4) ? this.rng.pick(skins).id : defaultSkin(jid);
    };
    const names = this.rng.shuffle(BOT_NAMES.slice());
    const teams = cfg.mode === 'boss_raid' ? [0] : [0, 1];
    for (const team of teams) {
      for (let i = 0; i < size; i++) {
        let u: Unit;
        if (team === 0 && i === 0) {
          u = this.makeUnit(0, p.jackerId, p.level, !!cfg.allBots, p.name, SKIN_MAP[p.skin] ? p.skin : undefined, p, p.bonus);
          this.player = u;
        } else {
          const jid = pickJ();
          const lv = clamp(botLv + (team === 1 ? diffLv : Math.min(0, diffLv)) + this.rng.int(-1, 1), 1, 20);
          u = this.makeUnit(team, jid, lv, true, names[(team * 3 + i) % names.length], pickSkin(jid));
        }
        const sp = this.baseSpawnPoint(team, i);
        u.x = sp.x;
        u.z = sp.z;
        u.facing = team === 0 ? Math.PI : 0;
        if (u.isBot) u.brain = new BotBrain(this, u, botProfile(team === 1 || cfg.mode === 'boss_raid' ? cfg.difficulty : allyDifficulty(cfg.difficulty)));
      }
    }
  }

  // ------------------------------------------------------------------ queries
  enemiesOf(team: number): Target[] {
    const out: Target[] = [];
    for (const u of this.units) if (u.alive && u.team !== team) out.push(u);
    for (const w of this.wilds) if (w.alive && w.team !== team) out.push(w);
    for (const t of this.turrets) if (t.alive && t.team !== team) out.push(t);
    return out;
  }
  visibleTo(team: number, t: Target) {
    if (t.kind !== 'unit') return true;
    if (!t.inBush || t.revealT > 0) return true;
    for (const u of this.units) if (u.alive && u.team === team && dist(u, t) < 3.6) return true;
    return false;
  }
  nearestEnemy(u: { x: number; z: number; team: number }, range: number, needLos = true, prefer?: (t: Target) => number): Target | null {
    let best: Target | null = null,
      bs = Infinity;
    for (const t of this.enemiesOf(u.team)) {
      const d = dist(u, t);
      if (d > range) continue;
      if (!this.visibleTo(u.team, t)) continue;
      if (t.kind === 'unit' && t.liftT > 0 && t.y > 1.5 && false) continue;
      if (needLos && !this.grid.los(u.x, u.z, t.x, t.z)) continue;
      let s = d;
      if (t.kind === 'unit' && t.carrying) s -= 4;
      if (t.kind === 'turret' && t.decoy) s -= 6;
      if (t.kind === 'wild' && !t.isBoss) s += 3;
      if (prefer) s += prefer(t);
      if (s < bs) {
        bs = s;
        best = t;
      }
    }
    return best;
  }
  unitsNear(x: number, z: number, r: number, filter?: (u: Unit) => boolean) {
    return this.units.filter((u) => u.alive && Math.hypot(u.x - x, u.z - z) <= r + u.radius && (!filter || filter(u)));
  }
  targetsNear(x: number, z: number, r: number, team: number): Target[] {
    return this.enemiesOf(team).filter((t) => Math.hypot(t.x - x, t.z - z) <= r + ('radius' in t ? (t as any).radius : 0.6));
  }
  isOnBase(team: number, x: number, z: number) {
    return this.grid.at(x, z) === (team === 0 ? C.Base0 : C.Base1);
  }

  // ------------------------------------------------------------------ combat
  damage(src: Unit | null, target: Target, amount: number, o: DamageOpts = {}) {
    if (!target.alive || this.state === 'ended') return 0;
    if (target.kind === 'unit') {
      if (target.invulnT > 0) return 0;
      if (src && src.team === target.team) return 0;
    }
    let dmg = amount;
    let crit = false;
    if (src) {
      dmg *= src.dmgMult * src.buffDmg;
      if (o.element) {
        const tel = target.kind === 'turret' ? null : (target as Unit | Wild).element;
        if (tel) dmg *= elementMultiplier(o.element, tel);
      }
      const ex = src.hasPassive('executioner');
      if (ex && target.hp < target.maxHp * 0.5) dmg *= 1 + ex.value;
      const fc = src.hasPassive('firstHitCrit');
      if (fc && !o.isSuper && o.critReady) {
        dmg *= 1 + fc.value;
        crit = true;
      }
      src.lastActT = this.time;
      src.revealT = Math.max(src.revealT, 0.8);
    }
    if (target.kind === 'unit') {
      const dr = target.hasPassive('damageReduction');
      if (dr) dmg *= 1 - dr.value;
      if (target.carrying && target.carrying.phase >= 4) dmg *= 0.75;
      if (target.shield > 0) {
        const a = Math.min(target.shield, dmg);
        target.shield -= a;
        dmg -= a;
      }
      target.lastHurtT = this.time;
      target.revealT = Math.max(target.revealT, 0.6);
      if (src) {
        target.lastDamager = src;
        target.lastDamagerT = this.time;
        const th = target.hasPassive('thorns');
        if (th && dist(src, target) < 4 && !o.isAbility) this.damage(null, src, amount * th.value, { noCharge: true });
      }
    } else if (target.kind === 'wild') {
      if (src) {
        target.aggro = src;
        target.lastDamager = src;
      }
      target.hitFlash = 0.12;
    }
    dmg = Math.max(0, dmg);
    target.hp -= dmg;
    if (src) {
      src.stats.damage += dmg;
      const ls = src.hasPassive('lifesteal');
      if (ls) this.heal(src, dmg * ls.value, null, true);
      if (!o.isSuper && !o.noCharge) {
        let rate = 1 / src.def.superCost;
        const sc = src.hasPassive('superCharge');
        if (sc) rate *= 1 + sc.value;
        if (src.special?.kind === 'superFast') rate *= 1 + src.special.value;
        if (this.modifiers.has('doubleSuper')) rate *= 2;
        if (target.kind === 'turret') rate *= 0.3;
        src.superCharge = Math.min(1, src.superCharge + dmg * rate * (o.isAbility ? 0.5 : 1));
      }
      if (o.burn) {
        const tu = target as any;
        if (target.kind === 'unit') {
          tu.burnT = 2;
          tu.burnDps = o.burn / 2;
          tu.burnSrc = src;
        }
      }
    }
    const kx = o.knockX ?? 0,
      kz = o.knockZ ?? 0;
    if (o.knock && target.kind !== 'turret') {
      const immune = target.kind === 'unit' && target.carrying && target.carrying.phase >= 4;
      const bossRes = target.kind === 'wild' && target.isBoss ? 0.1 : 1;
      if (!immune) {
        const n = norm(kx, kz);
        target.ex += n.x * o.knock * bossRes;
        target.ez += n.z * o.knock * bossRes;
      }
    }
    if (o.slow && target.kind !== 'turret') {
      target.slowT = Math.max(target.slowT, o.slowT ?? 1.5);
      if (target.kind === 'unit') target.slowAmt = Math.max(target.slowAmt, o.slow);
    }
    if (o.stun && target.kind !== 'turret') {
      const res = target.kind === 'wild' && target.isBoss ? 0.25 : 1;
      target.stunT = Math.max(target.stunT, o.stun * res);
    }
    const isPlayerSrc = !!src && src === this.player;
    const isPlayerTgt = target === this.player;
    this.emit({ t: 'hit', x: target.x, z: target.z, y: target.kind === 'unit' ? target.y : 0, color: o.color ?? '#fff', dmg: Math.round(dmg), crit, target: target.id, team: target.team, byPlayer: isPlayerSrc, onPlayer: isPlayerTgt });
    if (target.hp <= 0) this.kill(target, src);
    return dmg;
  }

  heal(u: Unit, amount: number, src: Unit | null, silent = false) {
    if (!u.alive || amount <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    const done = u.hp - before;
    if (src) src.stats.healing += done;
    if (!silent && done > 1) this.emit({ t: 'hit', x: u.x, z: u.z, y: u.y, color: '#4dff7a', dmg: Math.round(done), crit: false, target: u.id, team: u.team, heal: true, byPlayer: src === this.player, onPlayer: u === this.player });
  }

  kill(target: Target, src: Unit | null) {
    if (!target.alive) return;
    target.alive = false;
    target.hp = 0;
    if (target.kind === 'unit') {
      const u = target;
      u.stats.deaths++;
      const killer = src ?? (this.time - u.lastDamagerT < 5 ? u.lastDamager : null);
      if (killer && killer.team !== u.team) {
        killer.stats.kills++;
        killer.superCharge = Math.min(1, killer.superCharge + 0.15);
      }
      this.dropEgg(u);
      u.dash = null;
      u.respawns++;
      u.respawnT = Math.min(6, 2.5 + u.respawns * 0.5);
      this.emit({ t: 'death', u: u.id, x: u.x, z: u.z, color: u.def.palette.main, team: u.team, killer: killer?.id ?? -1 });
      this.rules.onKill(u, killer);
    } else if (target.kind === 'wild') {
      const w = target;
      w.deadT = 1.2;
      const killer = src ?? w.lastDamager;
      this.emit({ t: 'wildDeath', id: w.id, x: w.x, z: w.z, rarity: w.rarityIdx, team: killer?.team ?? -1 });
      if (!w.isBoss) {
        this.pickups.push({ id: this.id(), x: w.x, z: w.z, kind: this.rng.chance(0.5) ? 'heal' : 'super', t: 12 });
      }
      this.rules.onWildKill(w, killer);
    } else {
      this.emit({ t: 'boom', x: target.x, z: target.z, r: 1.5, color: target.color });
    }
  }

  spawnProjectile(p: Partial<Projectile> & { x: number; z: number; vx: number; vz: number; team: number; dmg: number; range: number }) {
    const pr: Projectile = {
      id: this.id(), owner: null, y: 0.9, traveled: 0, radius: 0.35, pierce: false, hit: new Set(), element: 'light', slow: 0, knockback: 0,
      color: '#fff', isSuper: false, isAbility: false, dead: false, ...p,
    } as Projectile;
    this.projectiles.push(pr);
    return pr;
  }

  addZone(z: Omit<Zone, 'id' | 't' | 'tick'>) {
    const zone: Zone = { ...z, id: this.id(), t: 0, tick: 0 };
    this.zones.push(zone);
    return zone;
  }

  addStrike(s: Omit<Strike, 'id'>) {
    const st = { ...s, id: this.id() };
    this.strikes.push(st);
    this.emit({ t: 'warn', x: s.x, z: s.z, r: s.r, dur: s.t, color: s.kind === 'lightning' ? '#ffe94d' : s.kind === 'meteor' ? '#ff5a1f' : '#ff4d6d' });
    return st;
  }

  /** Move an entity with wall collision. Airborne leaping units ignore walls. */
  move(e: { x: number; z: number; radius: number }, dx: number, dz: number, ignoreWalls = false) {
    const gr = this.grid;
    const r = e.radius;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.4));
    for (let s = 0; s < steps; s++) {
      e.x += dx / steps;
      e.z += dz / steps;
      if (!ignoreWalls) this.collide(e, r);
    }
    e.x = clamp(e.x, -gr.halfW + r, gr.halfW - r);
    e.z = clamp(e.z, -gr.halfH + r, gr.halfH - r);
  }
  collide(e: { x: number; z: number }, r: number) {
    const gr = this.grid;
    const p = gr.toCell(e.x, e.z);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = p.c + dc,
          rr = p.r + dr;
        if (!gr.isSolid(gr.get(c, rr))) continue;
        const cx = (c + 0.5) * gr.cell - gr.halfW,
          cz = (rr + 0.5) * gr.cell - gr.halfH;
        const h = gr.cell / 2;
        const nx = clamp(e.x, cx - h, cx + h),
          nz = clamp(e.z, cz - h, cz + h);
        let ddx = e.x - nx,
          ddz = e.z - nz;
        const d = Math.hypot(ddx, ddz);
        if (d < r) {
          if (d < 1e-5) {
            // inside: push along smallest axis
            const ox = e.x - cx,
              oz = e.z - cz;
            if (Math.abs(ox) > Math.abs(oz)) e.x = cx + Math.sign(ox || 1) * (h + r);
            else e.z = cz + Math.sign(oz || 1) * (h + r);
          } else {
            ddx /= d;
            ddz /= d;
            e.x = nx + ddx * r;
            e.z = nz + ddz * r;
          }
        }
      }
  }
  /** Find closest walkable point (used after teleports / landing on walls). */
  safeSpot(x: number, z: number) {
    const gr = this.grid;
    if (gr.walkable(gr.at(x, z)) || this.platformAt(x, z)) return { x, z };
    const p = gr.toCell(x, z);
    for (let rad = 1; rad < 6; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          const c = p.c + dc,
            r = p.r + dr;
          if (gr.inBounds(c, r) && gr.walkable(gr.get(c, r))) return gr.center(c, r);
        }
    return { x, z };
  }
  platformAt(x: number, z: number) {
    for (const p of this.platforms) if (Math.abs(x - p.x) < p.w / 2 + 0.1 && Math.abs(z - p.z) < 1.1) return p;
    return null;
  }

  // ------------------------------------------------------------------ eggs
  spawnEgg(x: number, z: number, phase = 0) {
    const pool = BEASTS.filter((b) => RARITIES.indexOf(b.rarity) <= 3 + (this.rng.chance(0.15) ? 2 : 0));
    const sp = this.rng.pick(pool);
    const e: Egg = { id: this.id(), x, z, y: 6, vx: 0, vz: 0, vy: 0, phase, phaseT: 0, carrier: null, speciesId: sp.id, pickupCd: 0.6, attackCd: 1, shieldCd: 4, dead: false };
    this.eggs.push(e);
    return e;
  }
  dropEgg(u: Unit) {
    const e = u.carrying;
    if (!e) return;
    u.carrying = null;
    e.carrier = null;
    e.x = u.x;
    e.z = u.z;
    e.y = Math.max(1.5, u.y + 1.2);
    const a = this.rng.next() * Math.PI * 2;
    e.vx = Math.sin(a) * 3;
    e.vz = Math.cos(a) * 3;
    e.vy = 6;
    e.pickupCd = 0.8;
    this.emit({ t: 'drop', egg: e.id });
  }
  eggPhaseTime() {
    return this.modifiers.has('fastEggs') ? 10 : 20;
  }
  eggSpeedMult(u: Unit) {
    if (!u.carrying) return 1;
    let m = EGG_SPEED[u.carrying.phase];
    const cs = u.hasPassive('carrierSpeed');
    if (cs) m += cs.value;
    return m;
  }

  // ------------------------------------------------------------------ wilds
  spawnWild(speciesId: string, x: number, z: number, opts: { boss?: boolean; team?: number; hpMult?: number } = {}) {
    const sp = getBeast(speciesId);
    const ri = RARITIES.indexOf(sp.rarity);
    const boss = !!opts.boss;
    const hp = boss ? 0 : (1400 + ri * 700) * (opts.hpMult ?? 1);
    const w: Wild = {
      kind: 'wild', id: this.id(), speciesId, team: opts.team ?? -1, x, z, y: 0, vx: 0, vz: 0, ex: 0, ez: 0, facing: 0,
      hp, maxHp: hp, atk: boss ? 900 : 260 + ri * 90, speed: boss ? 2.6 : 3.2 + sp.spd / 60, size: boss ? 3.2 : 0.9 + ri * 0.08, radius: boss ? 2.4 : 0.7 + ri * 0.05,
      rarityIdx: ri, attackCd: 1, wanderT: 0, tx: x, tz: z, aggro: null, alive: true, isBoss: boss, bossCd: 4, bossMove: '', bossMoveT: 0,
      slowT: 0, stunT: 0, liftT: 0, hitFlash: 0, lastDamager: null, deadT: 0, element: sp.element, action: '', actionT: 0, actionId: 0,
    };
    this.wilds.push(w);
    return w;
  }

  randomFloor(filter?: (x: number, z: number) => boolean) {
    const gr = this.grid;
    for (let i = 0; i < 80; i++) {
      const c = this.rng.int(0, gr.w - 1),
        r = this.rng.int(2, gr.h - 3);
      const t = gr.get(c, r);
      if (t === C.Floor || t === C.Bush || t === C.Spawn || t === C.Core) {
        const p = gr.center(c, r);
        if (!filter || filter(p.x, p.z)) return p;
      }
    }
    return { x: this.core.x, z: this.core.z };
  }

  // ------------------------------------------------------------------ events
  startEvent(id: MatchEventId) {
    const def = MATCH_EVENTS[id];
    this.event = { id, t: 0, dur: def.duration, data: {} };
    this.emit({ t: 'event', id });
    switch (id) {
      case 'gravity_flip':
        for (const u of this.units) if (u.alive) liftUnit(this, u, 2.6);
        for (const e of this.eggs) if (!e.carrier) e.vy = 9;
        break;
      case 'beast_rush': {
        const n = 4 + this.rng.int(0, 2);
        for (let i = 0; i < n; i++) {
          const p = this.randomFloor((x, z) => Math.abs(z) < 12);
          this.spawnWild(this.rng.pick(BEASTS.filter((b) => RARITIES.indexOf(b.rarity) <= 2)).id, p.x, p.z);
        }
        break;
      }
      case 'low_gravity':
        this.globalLowG = true;
        break;
      case 'void_storm': {
        const fromLeft = this.rng.chance(0.5);
        const z = this.rng.range(-10, 10);
        this.addZone({ x: fromLeft ? -20 : 20, z, r: 4.5, gtype: 'storm', team: -1, owner: null, dur: def.duration, dps: 450, strength: 4, vx: fromLeft ? 4 : -4, vz: this.rng.range(-0.8, 0.8) });
        break;
      }
      default:
        break;
    }
  }
  private updateEvent(dt: number) {
    const ev = this.event;
    if (!ev) return;
    ev.t += dt;
    switch (ev.id) {
      case 'meteor_shower':
        ev.data.acc = (ev.data.acc ?? 0) + dt;
        if (ev.data.acc > 0.55) {
          ev.data.acc = 0;
          const p = this.randomFloor();
          this.addStrike({ x: p.x, z: p.z, r: 2.3, t: 1.1, dmg: 900, team: -1, owner: null, kind: 'meteor', knock: 6, stun: 0 });
        }
        break;
      case 'core_overload':
        ev.data.acc = (ev.data.acc ?? 0) + dt;
        if (ev.data.acc > 1.6) {
          ev.data.acc = 0;
          this.addStrike({ x: this.core.x, z: this.core.z, r: 6.5, t: 0.6, dmg: 450, team: -1, owner: null, kind: 'pulse', knock: 14, stun: 0 });
        }
        break;
    }
    if (ev.t >= ev.dur) {
      if (ev.id === 'low_gravity') this.globalLowG = false;
      this.event = null;
    }
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    this.fx.length = 0 as any;
    if (this.state === 'ended') {
      // keep animating units for victory pose
      for (const u of this.units) u.actionT += dt;
      return;
    }
    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) this.state = 'playing';
      for (const u of this.units) u.actionT += dt;
      this.updateEggs(dt);
      return;
    }
    this.time += dt;
    this.rules.preUpdate(dt);
    for (const u of this.units) if (u.alive && u.brain) u.brain.update(dt);
    for (const u of this.units) this.updateUnit(u, dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateStrikes(dt);
    this.updateEggs(dt);
    this.updateWilds(dt);
    this.updateTurrets(dt);
    this.updateNodes(dt);
    this.updatePlatforms(dt);
    this.updatePickups(dt);
    this.updateArenaMechanics(dt);
    // core events
    if (this.rules.coreEvents) {
      this.core.eventT -= dt;
      if (this.core.eventT <= 0 && !this.event) {
        const pool: MatchEventId[] = ['gravity_flip', 'beast_rush', 'meteor_shower', 'core_overload', 'low_gravity', 'void_storm'];
        this.startEvent(this.modifiers.has('meteors') && this.rng.chance(0.5) ? 'meteor_shower' : this.rng.pick(pool));
        this.core.eventT = this.cfg.mode === 'chaos' ? 20 : 40;
      }
    }
    this.updateEvent(dt);
    this.rules.update(dt);
    if (this.time >= this.duration && this.state === 'playing') this.rules.onTimeUp();
  }

  end(winner: number, reason: string) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.winner = winner;
    this.endReason = reason;
    for (const u of this.units) {
      u.input = { mx: 0, mz: 0, ax: 0, az: 0, attack: false, skill: false, super: false, gadget: false, interact: false };
      u.action = winner === u.team ? 'victory' : winner === 2 ? 'idle' : 'defeat';
      u.actionT = 0;
      u.actionId++;
    }
  }

  // ------------------------------------------------------------------ units
  private updateUnit(u: Unit, dt: number) {
    u.actionT += dt;
    if (u.emoteT > 0) u.emoteT -= dt;
    if (!u.alive) {
      if (!this.rules.respawn) return;
      u.respawnT -= dt;
      if (u.respawnT <= 0) this.respawn(u);
      return;
    }
    // timers
    u.invulnT = Math.max(0, u.invulnT - dt);
    u.revealT = Math.max(0, u.revealT - dt);
    u.portalCd = Math.max(0, u.portalCd - dt);
    u.padCd = Math.max(0, u.padCd - dt);
    u.shotCd = Math.max(0, u.shotCd - dt);
    u.skillCd = Math.max(0, u.skillCd - dt);
    u.gadgetCd = Math.max(0, u.gadgetCd - dt);
    if (u.slowT > 0) {
      u.slowT -= dt;
      if (u.slowT <= 0) u.slowAmt = 0;
    }
    if (u.stunT > 0) u.stunT -= dt;
    if (u.buffT > 0) {
      u.buffT -= dt;
      if (u.buffT <= 0) {
        u.buffSpeed = 0;
        u.buffDmg = 1;
        u.rapid = false;
      }
    }
    if (u.shieldT > 0) {
      u.shieldT -= dt;
      if (u.shieldT <= 0) u.shield = 0;
    }
    if (u.burnT > 0) {
      u.burnT -= dt;
      this.damage(u.burnSrc, u, u.burnDps * dt, { noCharge: true, color: '#ff7a1f' });
      if (!u.alive) return;
    }
    // reload
    const atk = u.def.attack;
    if (u.ammo < atk.ammo) {
      let rate = 1 / atk.reload;
      const rs = u.hasPassive('reloadSpeed');
      if (rs) rate *= 1 + rs.value;
      if (u.rapid) rate *= 2;
      if (u.heavy) rate *= 0.7;
      u.ammo = Math.min(atk.ammo, u.ammo + rate * dt);
    }
    // regen out of combat
    if (this.time - u.lastHurtT > 3 && this.time - u.lastActT > 2.5 && u.hp < u.maxHp) {
      const rg = u.hasPassive('regen');
      u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * 0.07 + (rg ? rg.value : 0)) * dt);
    }
    if (this.isOnBase(u.team, u.x, u.z) && u.hp < u.maxHp && this.rules.baseHeal) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25 * dt);

    // gravity zones flags reset (set by zones each tick)
    const wasLow = u.lowG;
    void wasLow;

    const lifted = u.liftT > 0;
    const canAct = u.stunT <= 0 && !lifted && !u.falling && this.state !== ('ended' as any);
    // abilities & attacks
    if (canAct) tickAbilities(this, u, dt);
    else {
      u.input.attack = u.input.skill = u.input.super = u.input.gadget = false;
    }

    // movement
    let speed = u.baseSpeed * (1 + u.buffSpeed);
    const slh = u.hasPassive('speedLowHp');
    if (slh && u.hp < u.maxHp * 0.4) speed *= 1 + slh.value;
    if (u.slowT > 0) speed *= 1 - u.slowAmt;
    speed *= this.eggSpeedMult(u);
    const cell = this.grid.at(u.x, u.z);
    if (cell === C.Slow && !u.airborne && this.arena.slowKind !== 'ice') speed *= 0.65;
    if (u.heavy) speed *= 0.5;
    if (this.globalLowG) speed *= 1.1;
    const onIce = cell === C.Slow && this.arena.slowKind === 'ice' && !u.airborne;
    let mx = u.input.mx,
      mz = u.input.mz;
    if (!canAct && !lifted) mx = mz = 0;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    if (u.dash) {
      const d = u.dash;
      const step = Math.min(d.left, d.speed * dt);
      d.left -= step;
      this.move(u, d.dx * step, d.dz * step);
      u.facing = angleOf(d.dx, d.dz);
      for (const t of this.targetsNear(u.x, u.z, 1.5, u.team)) {
        if (d.hit.has(t.id)) continue;
        d.hit.add(t.id);
        this.damage(u, t, d.dmg, { element: u.element, isAbility: true, isSuper: d.chain > 0 || (u.action === 'super'), knock: d.knock, knockX: d.dx, knockZ: d.dz, color: u.def.palette.accent });
      }
      if (d.left <= 0.001) {
        if (d.chain > 0) {
          d.chain--;
          const nt = this.nearestEnemy(u, 9, true);
          if (nt) {
            const n = norm(nt.x - u.x, nt.z - u.z);
            u.dash = { ...d, dx: n.x, dz: n.z, left: Math.min(9, dist(u, nt) + 1.5), hit: new Set() };
            this.emit({ t: 'dash', u: u.id, x: u.x, z: u.z, color: u.def.palette.accent });
          } else u.dash = null;
        } else u.dash = null;
      }
      u.vx = u.vz = 0;
    } else {
      const tvx = mx * speed,
        tvz = mz * speed;
      const accel = onIce ? 2.2 : u.airborne ? (u.leap ? 0.6 : 4) : 16;
      const k = 1 - Math.exp(-accel * dt);
      if (!(u.leap && u.airborne)) {
        u.vx += (tvx - u.vx) * k;
        u.vz += (tvz - u.vz) * k;
      }
      if (ml > 0.1 && canAct) {
        const aimLocked = this.time - u.lastAttackT < 0.35;
        if (!aimLocked) u.facing = dampAngleSim(u.facing, angleOf(mx, mz), 14, dt);
      }
    }
    // wind
    let wx = 0,
      wz = 0;
    if (this.wind.t > 0) {
      wx = this.wind.x;
      wz = this.wind.z;
    }
    // external velocity decay
    const ek = Math.exp(-5 * dt);
    const dx = (u.vx + u.ex + wx) * dt,
      dz = (u.vz + u.ez + wz) * dt;
    u.ex *= ek;
    u.ez *= ek;
    const ignoreWalls = u.leap && u.y > 1.0;
    if (!u.falling) this.move(u, dx, dz, ignoreWalls);
    // platforms carry
    const plat = !u.airborne ? this.platformAt(u.x, u.z) : null;
    if (plat && this.grid.isPit(this.grid.at(u.x, u.z))) u.x += plat.dir * plat.speed * dt;

    // vertical physics
    let g = this.g;
    if (u.lowG) g *= 0.35;
    if (u.heavy) g *= 1.8;
    if (u.liftT > 0) {
      u.liftT -= dt;
      const targetY = 3.4;
      u.vy += (targetY - u.y) * 6 * dt - u.vy * 3 * dt;
      if (u.carrying) this.dropEgg(u);
    } else if (u.y > 0 || u.vy > 0 || u.falling) {
      u.vy -= g * dt;
    }
    u.y += u.vy * dt;
    const support = this.grid.walkable(this.grid.at(u.x, u.z)) || !!this.platformAt(u.x, u.z) || this.grid.isSolid(this.grid.at(u.x, u.z));
    if (u.falling) {
      if (u.y < -5) {
        this.kill(u, this.time - u.lastDamagerT < 5 ? u.lastDamager : null);
        u.falling = false;
        u.y = 0;
      }
    } else if (u.y <= 0 && u.liftT <= 0) {
      if (!support) {
        u.falling = true;
        if (u.carrying) this.dropEgg(u);
      } else {
        if (u.vy < -12) {
          this.emit({ t: 'land', u: u.id, hard: u.vy < -18 });
          if (u.vy < -22) this.damage(null, u, 200, { noCharge: true });
        }
        if (u.leap && this.grid.isSolid(this.grid.at(u.x, u.z))) {
          const sp = this.safeSpot(u.x, u.z);
          u.x = sp.x;
          u.z = sp.z;
        }
        u.y = 0;
        u.vy = 0;
        u.leap = false;
        const ld = (u as any).landDmg as number | undefined;
        if (ld) {
          (u as any).landDmg = 0;
          for (const t of this.targetsNear(u.x, u.z, 2.4, u.team)) this.damage(u, t, ld, { element: u.element, isAbility: true, knock: 6, knockX: t.x - u.x, knockZ: t.z - u.z, color: u.def.palette.accent });
          this.emit({ t: 'ring', x: u.x, z: u.z, r: 2.4, color: u.def.palette.accent });
        }
        // low gravity hop
        if ((u.lowG || this.globalLowG) && ml > 0.2) u.vy = this.globalLowG ? 3.5 : 4.5;
      }
    }
    if (!u.alive) return;
    u.lowG = false;
    u.heavy = false;
    // terrain interactions
    const c2 = this.grid.at(u.x, u.z);
    u.inBush = c2 === C.Bush && !u.airborne;
    if (!u.airborne && !u.falling) {
      if (c2 === C.Hazard) this.hazardDamage(u, dt);
      if (c2 === C.Pad && u.padCd <= 0) this.launchPad(u);
      if (c2 === C.Portal && u.portalCd <= 0) this.usePortal(u);
    }
    // egg pickup
    if (!u.carrying && !u.airborne && !u.falling && this.rules.eggs) {
      for (const e of this.eggs) {
        if (e.carrier || e.dead || e.pickupCd > 0 || e.y > 1.2) continue;
        if (Math.hypot(e.x - u.x, e.z - u.z) < u.radius + 0.7) {
          e.carrier = u;
          u.carrying = e;
          this.emit({ t: 'pickup', u: u.id, egg: e.id });
          break;
        }
      }
    }
    // delivery
    if (u.carrying && this.isOnBase(u.team, u.x, u.z)) this.rules.onDeliver(u, u.carrying);
    // node channel
    if (u.input.interact) {
      this.tryActivateNode(u);
      u.input.interact = false;
    }
    if (u.input.emote) {
      u.emote = u.input.emote;
      u.emoteT = 2;
      this.emit({ t: 'emote', u: u.id, e: u.emote });
      u.input.emote = undefined;
    }
  }

  respawn(u: Unit) {
    const sp = this.baseSpawnPoint(u.team, this.rng.int(0, 2));
    u.x = sp.x;
    u.z = sp.z;
    u.y = 0;
    u.vy = u.vx = u.vz = u.ex = u.ez = 0;
    u.hp = u.maxHp;
    u.alive = true;
    u.falling = false;
    u.liftT = 0;
    u.invulnT = 1.6;
    u.stunT = u.slowT = u.burnT = 0;
    u.ammo = u.def.attack.ammo;
    u.dash = null;
    this.emit({ t: 'respawn', u: u.id });
    if (u.brain) u.brain.reset?.();
  }

  hazardDamage(u: Unit, dt: number) {
    const k = this.arena.hazard;
    if (k === 'lava') this.damage(null, u, 1100 * dt, { noCharge: true, color: '#ff5a1f' });
    else if (k === 'spikes') {
      if (this.hazardOn) this.damage(null, u, 1300 * dt, { noCharge: true, color: '#ddd' });
    } else if (this.hazardOn) this.damage(null, u, 900 * dt, { noCharge: true, color: '#38f0ff', slow: 0.3, slowT: 0.5 });
  }

  launchPad(u: Unit) {
    const n = norm(this.core.x - u.x || 0.001, this.core.z - u.z);
    const vy = 12;
    const hs = 11;
    u.vy = vy;
    u.vx = n.x * hs;
    u.vz = n.z * hs;
    u.leap = true;
    u.padCd = 1;
    u.stats.jumps++;
    this.emit({ t: 'jump', u: u.id });
  }

  usePortal(u: Unit) {
    const i = this.portals.findIndex((p) => Math.hypot(p.x - u.x, p.z - u.z) < 1.4);
    if (i < 0) return;
    const p = this.portals[i];
    const mate = this.portals[p.pair];
    if (!mate) return;
    const fx = u.x,
      fz = u.z;
    const dir = norm(this.core.x - mate.x, this.core.z - mate.z + 0.001);
    const sp = this.safeSpot(mate.x + dir.x * 1.6, mate.z + dir.z * 1.6);
    u.x = sp.x;
    u.z = sp.z;
    u.portalCd = 2;
    u.stats.portals++;
    this.emit({ t: 'portal', u: u.id, x: fx, z: fz });
    this.emit({ t: 'blink', u: u.id, fx, fz, x: u.x, z: u.z, color: '#8a4dff' });
  }

  tryActivateNode(u: Unit) {
    for (const n of this.nodes) {
      if (n.cd > 0 || Math.hypot(n.x - u.x, n.z - u.z) > 2.2) continue;
      const nm = u.hasPassive('nodeMaster');
      const dur = 7 * (1 + (nm ? nm.value : 0));
      const strength: Record<GravityType, number> = { normal: 0, low: 1, heavy: 1, reverse: 1, orbit: 8, vortex: 10, repulsion: 16 };
      const r = n.gtype === 'reverse' ? 4.5 : 5.5;
      this.addZone({ x: n.x, z: n.z, r, gtype: n.gtype, team: u.team, owner: u, dur: n.gtype === 'reverse' ? 3.5 : n.gtype === 'repulsion' ? 2.5 : dur, dps: n.gtype === 'heavy' || n.gtype === 'vortex' ? 150 : 0, strength: strength[n.gtype], fromNode: true });
      n.cd = 18;
      n.activeT = dur;
      n.team = u.team;
      u.stats.nodes++;
      this.emit({ t: 'node', x: n.x, z: n.z, gtype: n.gtype, team: u.team, u: u.id });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ projectiles
  private updateProjectiles(dt: number) {
    const gr = this.grid;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (p.lob) {
        const L = p.lob;
        L.t += dt;
        const k = Math.min(1, L.t / L.T);
        p.x = L.sx + (L.tx - L.sx) * k;
        p.z = L.sz + (L.tz - L.sz) * k;
        p.y = 0.8 + Math.sin(k * Math.PI) * (L.big ? 9 : 4);
        if (k >= 1) {
          p.dead = true;
          this.emit({ t: 'boom', x: p.x, z: p.z, r: L.splash, color: p.color, big: L.big });
          for (const t of this.targetsNear(p.x, p.z, L.splash, p.team)) {
            const n = norm(t.x - p.x, t.z - p.z);
            this.damage(p.owner, t, p.dmg, { element: p.element, slow: p.slow, isSuper: p.isSuper, isAbility: p.isAbility, knock: p.knockback, knockX: n.x, knockZ: n.z, color: p.color });
          }
          this.damageCratesAround(p.x, p.z, L.splash, p.dmg * 0.6);
          if (L.burn) this.addZone({ x: p.x, z: p.z, r: L.splash * 0.85, gtype: 'burn', team: p.team, owner: p.owner, dur: 3, dps: L.burn, strength: 0 });
        }
        continue;
      }
      // orbit zones bend enemy projectiles
      for (const z of this.zones) {
        if (z.gtype !== 'orbit' || z.team === p.team) continue;
        const dx = p.x - z.x,
          dz = p.z - z.z;
        if (dx * dx + dz * dz < z.r * z.r) {
          const a = 2.6 * dt;
          const vx = p.vx * Math.cos(a) - p.vz * Math.sin(a);
          p.vz = p.vx * Math.sin(a) + p.vz * Math.cos(a);
          p.vx = vx;
        }
      }
      const sx = p.vx * dt,
        sz = p.vz * dt;
      p.x += sx;
      p.z += sz;
      p.traveled += Math.hypot(sx, sz);
      if (p.traveled >= p.range) {
        p.dead = true;
        continue;
      }
      const cell = gr.at(p.x, p.z);
      if (gr.isSolid(cell)) {
        p.dead = true;
        if (cell === C.Crate) {
          const cp = gr.toCell(p.x, p.z);
          this.damageCrate(cp.c, cp.r, p.dmg);
        }
        this.emit({ t: 'boom', x: p.x - sx, z: p.z - sz, r: 0.5, color: p.color });
        continue;
      }
      for (const t of this.enemiesOf(p.team)) {
        if (p.hit.has(t.id)) continue;
        const tr = (t as any).radius ?? 0.8;
        if (t.kind === 'unit' && t.y > 2.2) continue;
        if (Math.hypot(t.x - p.x, t.z - p.z) < tr + p.radius) {
          p.hit.add(t.id);
          const n = norm(p.vx, p.vz);
          if (p.ownerTurret) {
            this.damage(null, t, p.dmg, { color: p.color, noCharge: true });
            if (p.ownerTurret.owner) p.ownerTurret.owner.stats.damage += p.dmg;
          } else this.damage(p.owner, t, p.dmg, { element: p.element, slow: p.slow, isSuper: p.isSuper, isAbility: p.isAbility, knock: p.knockback, knockX: n.x, knockZ: n.z, color: p.color, burn: p.owner?.hasPassive('burn')?.value, critReady: p.critReady });
          if (p.owner && !p.isSuper && !p.isAbility) {
            const sl = p.owner.hasPassive('slowOnHit');
            if (sl && t.kind !== 'turret') {
              t.slowT = Math.max(t.slowT, 1.2);
              if (t.kind === 'unit') t.slowAmt = Math.max(t.slowAmt, sl.value);
            }
          }
          if (!p.pierce) {
            p.dead = true;
            break;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  damageCrate(c: number, r: number, dmg: number) {
    const gr = this.grid;
    if (gr.get(c, r) !== C.Crate) return;
    const i = gr.idx(c, r);
    gr.crateHp[i] -= dmg;
    if (gr.crateHp[i] <= 0) {
      gr.set(c, r, C.Floor);
      const p = gr.center(c, r);
      this.emit({ t: 'crate', x: p.x, z: p.z, color: this.arena.theme.crate });
      if (this.arena.mechanic === 'crystals' && gr.origCrate[i]) this.regrow.push({ c, r, t: 14 });
    }
  }
  regrow: { c: number; r: number; t: number }[] = [];
  damageCratesAround(x: number, z: number, r: number, dmg: number) {
    const gr = this.grid;
    const p = gr.toCell(x, z);
    const rc = Math.ceil(r / gr.cell);
    for (let dr = -rc; dr <= rc; dr++)
      for (let dc = -rc; dc <= rc; dc++) {
        const cc = gr.center(p.c + dc, p.r + dr);
        if (Math.hypot(cc.x - x, cc.z - z) <= r + 1) this.damageCrate(p.c + dc, p.r + dr, dmg);
      }
  }
  placeCrate(x: number, z: number, hp = 2000) {
    const gr = this.grid;
    const p = gr.toCell(x, z);
    const t = gr.get(p.c, p.r);
    if (t !== C.Floor && t !== C.Bush && t !== C.Spawn) return false;
    const c = gr.center(p.c, p.r);
    for (const u of this.units) if (u.alive && Math.abs(u.x - c.x) < 1.4 && Math.abs(u.z - c.z) < 1.4) return false;
    for (const e of this.eggs) if (!e.carrier && Math.abs(e.x - c.x) < 1.2 && Math.abs(e.z - c.z) < 1.2) return false;
    gr.set(p.c, p.r, C.Crate);
    gr.crateHp[gr.idx(p.c, p.r)] = hp;
    this.emit({ t: 'crate', x: c.x, z: c.z, color: '#7ff7ff' });
    return true;
  }

  // ------------------------------------------------------------------ zones
  private updateZones(dt: number) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.vx || z.vz) {
        z.x += (z.vx ?? 0) * dt;
        z.z += (z.vz ?? 0) * dt;
      }
      z.tick += dt;
      const doTick = z.tick >= 0.25;
      if (doTick) z.tick -= 0.25;
      if (z.gtype === 'heal') {
        if (doTick)
          for (const u of this.unitsNear(z.x, z.z, z.r, (u) => u.team === z.team)) {
            this.heal(u, (z.heal ?? 0) * 0.25, z.owner);
            if (z.speed) {
              u.buffT = Math.max(u.buffT, 0.5);
              u.buffSpeed = Math.max(u.buffSpeed, z.speed);
            }
          }
        continue;
      }
      // units affected
      const victims: (Unit | Wild)[] = [];
      for (const u of this.units) if (u.alive && (z.team === -1 || u.team !== z.team) && Math.hypot(u.x - z.x, u.z - z.z) < z.r + u.radius) victims.push(u);
      for (const w of this.wilds) if (w.alive && (z.team === -1 || w.team !== z.team) && Math.hypot(w.x - z.x, w.z - z.z) < z.r + w.radius) victims.push(w);
      for (const v of victims) {
        const dx = v.x - z.x,
          dz = v.z - z.z;
        const d = Math.max(0.3, Math.hypot(dx, dz));
        const nx = dx / d,
          nz = dz / d;
        if (doTick && z.dps > 0) this.damage(z.owner, v, z.dps * 0.25, { isSuper: true, noCharge: true, color: zoneColor(z.gtype) });
        if (!v.alive) continue;
        const res = v.kind === 'wild' && v.isBoss ? 0.15 : 1;
        switch (z.gtype) {
          case 'low':
            if (v.kind === 'unit') {
              v.lowG = true;
              v.slowT = Math.max(v.slowT, 0.3);
              v.slowAmt = Math.max(v.slowAmt, 0.25);
            } else v.slowT = Math.max(v.slowT, 0.3);
            break;
          case 'heavy':
            if (v.kind === 'unit') v.heavy = true;
            else v.slowT = Math.max(v.slowT, 0.3);
            break;
          case 'reverse':
            if (v.kind === 'unit') liftUnit(this, v, 0.3);
            else if (!v.isBoss) v.liftT = Math.max(v.liftT, 0.3);
            break;
          case 'orbit':
          case 'storm': {
            const pull = z.strength * (z.gtype === 'storm' ? 1 : 0.45) * res;
            v.x += (-nz * z.strength * 0.6 * res - nx * pull) * dt;
            v.z += (nx * z.strength * 0.6 * res - nz * pull) * dt;
            break;
          }
          case 'vortex':
            if (d > 0.6) {
              v.x -= nx * z.strength * res * dt;
              v.z -= nz * z.strength * res * dt;
            }
            break;
          case 'repulsion':
            v.ex += nx * z.strength * 3 * dt * res;
            v.ez += nz * z.strength * 3 * dt * res;
            break;
          case 'burn':
            break;
        }
        if (v.kind === 'unit') this.collide(v, v.radius);
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.dur);
  }

  private updateStrikes(dt: number) {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t <= 0) {
        this.emit({ t: 'strike', x: s.x, z: s.z, r: s.r, kind: s.kind });
        for (const t of s.team === -1 ? [...this.units.filter((u) => u.alive), ...this.wilds.filter((w) => w.alive && !w.isBoss)] : this.enemiesOf(s.team)) {
          if (Math.hypot(t.x - s.x, t.z - s.z) > s.r + 0.5) continue;
          if (t.kind === 'unit' && t.y > 2) continue;
          const n = norm(t.x - s.x || 0.01, t.z - s.z);
          this.damage(s.owner, t, s.dmg, { isSuper: true, knock: s.knock, knockX: n.x, knockZ: n.z, stun: s.stun, color: s.kind === 'lightning' ? '#ffe94d' : '#ff7a1f' });
        }
        if (s.kind === 'meteor') this.damageCratesAround(s.x, s.z, s.r, s.dmg);
      }
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  // ------------------------------------------------------------------ eggs
  private updateEggs(dt: number) {
    for (const e of this.eggs) {
      if (e.dead) continue;
      if (this.state === 'playing') {
        e.phaseT += dt;
        if (e.phase < 4 && e.phaseT >= this.eggPhaseTime()) {
          e.phaseT = 0;
          e.phase++;
          this.emit({ t: 'evolve', egg: e.id, phase: e.phase, x: e.x, z: e.z });
        }
      }
      e.pickupCd = Math.max(0, e.pickupCd - dt);
      const c = e.carrier;
      if (c) {
        e.x = c.x;
        e.z = c.z;
        e.y = c.y + 2.2;
        if (!c.alive) {
          this.dropEgg(c);
          continue;
        }
        // beast attacks from the carried creature
        if (e.phase >= 2 && this.state === 'playing') {
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            const t = this.nearestEnemy(c, 6.5, true);
            if (t) {
              const dmg = [0, 0, 260, 420, 720][e.phase];
              const n = norm(t.x - e.x, t.z - e.z);
              const el = getBeast(e.speciesId).element;
              this.spawnProjectile({ owner: c, team: c.team, x: e.x, z: e.z, vx: n.x * 18, vz: n.z * 18, dmg: dmg / c.dmgMult, range: 7, radius: 0.4, element: el, color: '#ffe94d', isAbility: true });
              this.emit({ t: 'shoot', u: c.id, x: e.x, z: e.z, dx: n.x, dz: n.z, color: '#ffe94d', kind: 'beast' });
            }
            e.attackCd = [9, 9, 1.3, 1.0, 0.65][e.phase];
          }
          if (e.phase >= 3) {
            e.shieldCd -= dt;
            if (e.shieldCd <= 0) {
              c.shield = Math.max(c.shield, 700);
              c.shieldT = 3;
              e.shieldCd = 6;
              this.emit({ t: 'shield', u: c.id, color: '#ffd23a' });
            }
          }
        }
      } else {
        // physics on the ground
        if (e.y > 0 || e.vy > 0) {
          e.vy -= this.g * 0.8 * dt;
          e.y += e.vy * dt;
          const nx = e.x + e.vx * dt,
            nz = e.z + e.vz * dt;
          if (!this.grid.solidAt(nx, nz)) {
            e.x = nx;
            e.z = nz;
          }
          if (e.y <= 0) {
            const t = this.grid.at(e.x, e.z);
            if (this.grid.isPit(t) && !this.platformAt(e.x, e.z)) {
              // fell in a pit: respawn at core
              e.x = this.core.x;
              e.z = this.core.z;
              e.y = 8;
              e.vx = e.vz = 0;
              e.vy = 0;
            } else {
              e.y = 0;
              e.vy = e.vy < -4 ? -e.vy * 0.3 : 0;
              e.vx *= 0.5;
              e.vz *= 0.5;
            }
          }
        }
        if (this.grid.solidAt(e.x, e.z)) {
          const sp = this.safeSpot(e.x, e.z);
          e.x = sp.x;
          e.z = sp.z;
        }
      }
    }
    this.eggs = this.eggs.filter((e) => !e.dead);
  }

  // ------------------------------------------------------------------ wild creatures
  private updateWilds(dt: number) {
    for (const w of this.wilds) {
      if (!w.alive) {
        w.deadT -= dt;
        continue;
      }
      w.actionT += dt;
      w.hitFlash = Math.max(0, w.hitFlash - dt);
      if (w.stunT > 0) {
        w.stunT -= dt;
        continue;
      }
      if (w.slowT > 0) w.slowT -= dt;
      if (w.liftT > 0) {
        w.liftT -= dt;
        w.y += (2.5 - w.y) * 4 * dt;
        continue;
      } else if (w.y > 0) w.y = Math.max(0, w.y - 12 * dt);
      if (w.isBoss) {
        bossUpdate(this, w, dt);
      } else {
        // pick target: aggro or nearest unit in 6
        let tgt: Target | null = w.aggro && w.aggro.alive && dist(w, w.aggro) < 14 ? w.aggro : null;
        if (!tgt && (this.event?.id === 'beast_rush' || w.team !== -1)) tgt = this.nearestEnemy(w, 7, true);
        const spd = w.speed * (w.slowT > 0 ? 0.6 : 1);
        if (tgt) {
          const d = dist(w, tgt);
          const n = norm(tgt.x - w.x, tgt.z - w.z);
          w.facing = angleOf(n.x, n.z);
          if (d > w.radius + 1.2) this.move(w, n.x * spd * dt, n.z * spd * dt);
          w.attackCd -= dt;
          if (d < w.radius + 1.6 && w.attackCd <= 0) {
            w.attackCd = 1.2;
            w.action = 'attack';
            w.actionT = 0;
            w.actionId++;
            this.damage(null, tgt, w.atk, { element: w.element, knock: 3, knockX: n.x, knockZ: n.z, color: '#ff4d6d' });
          }
        } else {
          w.wanderT -= dt;
          if (w.wanderT <= 0) {
            const p = this.randomFloor((x, z) => Math.hypot(x - w.x, z - w.z) < 8);
            w.tx = p.x;
            w.tz = p.z;
            w.wanderT = 3 + this.rng.next() * 3;
          }
          const d = Math.hypot(w.tx - w.x, w.tz - w.z);
          if (d > 0.5) {
            const n = norm(w.tx - w.x, w.tz - w.z);
            w.facing = angleOf(n.x, n.z);
            this.move(w, n.x * spd * 0.5 * dt, n.z * spd * 0.5 * dt);
          }
        }
      }
      const ek = Math.exp(-5 * dt);
      this.move(w, w.ex * dt, w.ez * dt);
      w.ex *= ek;
      w.ez *= ek;
      // wilds that wander onto pits fall
      const t = this.grid.at(w.x, w.z);
      if (this.grid.isPit(t) && !this.platformAt(w.x, w.z) && !w.isBoss) this.kill(w, w.lastDamager);
    }
    this.wilds = this.wilds.filter((w) => w.alive || w.deadT > 0);
  }

  private updateTurrets(dt: number) {
    for (const t of this.turrets) {
      if (!t.alive) continue;
      t.t -= dt;
      if (t.t <= 0) {
        t.alive = false;
        this.emit({ t: 'boom', x: t.x, z: t.z, r: 1, color: t.color });
        continue;
      }
      if (t.decoy) continue;
      t.cd -= dt;
      const tgt = this.nearestEnemy(t, t.range, true);
      if (tgt) {
        const n = norm(tgt.x - t.x, tgt.z - t.z);
        t.facing = angleOf(n.x, n.z);
        if (t.cd <= 0) {
          t.cd = t.rate;
          this.spawnProjectile({ owner: null, ownerTurret: t, team: t.team, x: t.x + n.x * 0.8, z: t.z + n.z * 0.8, vx: n.x * 22, vz: n.z * 22, dmg: t.dmg, range: t.range + 1, radius: 0.3, color: t.color, isAbility: true });
          this.emit({ t: 'shoot', u: -1, x: t.x, z: t.z, dx: n.x, dz: n.z, color: t.color, kind: 'turret' });
        }
      }
    }
    this.turrets = this.turrets.filter((t) => t.alive);
  }

  private updateNodes(dt: number) {
    for (const n of this.nodes) {
      n.cd = Math.max(0, n.cd - dt);
      n.activeT = Math.max(0, n.activeT - dt);
      if (n.activeT <= 0) n.team = -1;
    }
  }

  private updatePlatforms(dt: number) {
    for (const p of this.platforms) {
      p.x += p.dir * p.speed * dt;
      if (p.x > p.maxX) {
        p.x = p.maxX;
        p.dir = -1;
      } else if (p.x < p.minX) {
        p.x = p.minX;
        p.dir = 1;
      }
    }
  }

  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      p.t -= dt;
      for (const u of this.units) {
        if (!u.alive || p.t <= 0) continue;
        if (Math.hypot(u.x - p.x, u.z - p.z) < 1.2) {
          if (p.kind === 'heal') this.heal(u, u.maxHp * 0.3, null);
          else u.superCharge = Math.min(1, u.superCharge + 0.25);
          p.t = 0;
          this.emit({ t: 'ring', x: p.x, z: p.z, r: 1.2, color: p.kind === 'heal' ? '#4dff7a' : '#ffd23a' });
        }
      }
    }
    this.pickups = this.pickups.filter((p) => p.t > 0);
  }

  private updateArenaMechanics(dt: number) {
    const m = this.arena.mechanic;
    this.hazardT += dt;
    if (this.arena.hazard === 'spikes') this.hazardOn = this.hazardT % 3 < 1.4;
    else if (this.arena.hazard === 'electric') this.hazardOn = this.hazardT % 2.5 < 0.8;
    else this.hazardOn = true;
    this.mechT += dt;
    if (this.wind.t > 0) this.wind.t -= dt;
    for (const r of this.regrow) {
      r.t -= dt;
      if (r.t <= 0) {
        const c = this.grid.center(r.c, r.r);
        if (!this.units.some((u) => u.alive && Math.abs(u.x - c.x) < 1.5 && Math.abs(u.z - c.z) < 1.5)) {
          this.grid.set(r.c, r.r, C.Crate);
          this.grid.crateHp[this.grid.idx(r.c, r.r)] = 1600;
          this.emit({ t: 'crate', x: c.x, z: c.z, color: '#7ff7ff' });
        } else r.t = 1;
      }
    }
    this.regrow = this.regrow.filter((r) => r.t > 0);
    if (m === 'eruption' && this.mechT > 16) {
      this.mechT = 0;
      for (let i = 0; i < 5; i++) {
        const p = this.randomFloor();
        this.addStrike({ x: p.x, z: p.z, r: 2, t: 1.3, dmg: 700, team: -1, owner: null, kind: 'meteor', knock: 5, stun: 0 });
      }
    } else if (m === 'storm') {
      if (this.mechT > 13) {
        this.mechT = 0;
        const s = this.rng.chance(0.5) ? 1 : -1;
        this.wind = { x: s * 3.2, z: 0, t: 3 };
        this.emit({ t: 'warn', x: 0, z: 0, r: 0, dur: 3, color: '#c6f5d8' });
      }
      if (Math.floor((this.mechT - dt) / 4) !== Math.floor(this.mechT / 4)) {
        const p = this.randomFloor();
        this.addStrike({ x: p.x, z: p.z, r: 1.8, t: 1, dmg: 650, team: -1, owner: null, kind: 'lightning', knock: 0, stun: 0.4 });
      }
    } else if (m === 'wildBeasts' && this.rules.ambientWilds) {
      if (this.wilds.filter((w) => w.alive && !w.isBoss).length < 2 && this.mechT > 12) {
        this.mechT = 0;
        const p = this.randomFloor((x, z) => Math.abs(z) < 10);
        this.spawnWild(this.rng.pick(BEASTS.filter((b) => b.habitat === 'Beast Valley')).id, p.x, p.z);
      }
    }
  }

  // ------------------------------------------------------------------ summary
  mvp(): Unit | null {
    let best: Unit | null = null,
      bs = -1;
    for (const u of this.units) {
      const s = u.stats.kills * 3 + u.stats.points * 4 + u.stats.damage / 1500 + u.stats.healing / 1500 + u.stats.nodes + u.stats.captures * 2;
      if (s > bs) {
        bs = s;
        best = u;
      }
    }
    return best;
  }
}

function zoneColor(g: string) {
  return g === 'burn' ? '#ff7a1f' : g === 'storm' ? '#8a4dff' : '#c45cff';
}

export function liftUnit(w: World, u: Unit, t: number) {
  u.liftT = Math.max(u.liftT, t);
  if (u.carrying) w.dropEgg(u);
  u.dash = null;
}

function dampAngleSim(a: number, b: number, lambda: number, dt: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function allyDifficulty(d: string) {
  // allies are slightly weaker than enemies on easy so beginners carry, equal otherwise
  return (d === 'easy' ? 'normal' : d) as any;
}

/** Boss behaviour for BOSS RAID. */
function bossUpdate(world: World, b: Wild, dt: number) {
  const enraged = b.hp < b.maxHp * 0.35;
  b.bossCd -= dt * (enraged ? 1.5 : 1);
  const tgt = world.nearestEnemy(b, 30, false);
  if (b.bossMoveT > 0) {
    b.bossMoveT -= dt;
    return;
  }
  if (tgt) {
    const n = norm(tgt.x - b.x, tgt.z - b.z);
    b.facing = angleOf(n.x, n.z);
    const d = dist(b, tgt);
    if (d > b.radius + 2) world.move(b, n.x * b.speed * (enraged ? 1.3 : 1) * dt, n.z * b.speed * (enraged ? 1.3 : 1) * dt);
    b.attackCd -= dt;
    if (d < b.radius + 1.8 && b.attackCd <= 0) {
      b.attackCd = 1.4;
      b.action = 'attack';
      b.actionT = 0;
      b.actionId++;
      world.damage(null, tgt, b.atk, { knock: 10, knockX: n.x, knockZ: n.z, color: '#ff4d6d' });
    }
  }
  if (b.bossCd <= 0) {
    const moves = ['slam', 'barrage', 'summon', 'vortex', 'meteors'];
    const mv = world.rng.pick(moves);
    b.bossMove = mv;
    b.action = 'super';
    b.actionT = 0;
    b.actionId++;
    world.emit({ t: 'boss', move: mv });
    b.bossCd = enraged ? 4.5 : 6.5;
    switch (mv) {
      case 'slam':
        world.addStrike({ x: b.x, z: b.z, r: 6.5, t: 1.1, dmg: 1400, team: b.team, owner: null, kind: 'slam', knock: 16, stun: 0.6 });
        b.bossMoveT = 1.2;
        break;
      case 'barrage':
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          world.spawnProjectile({ team: b.team, x: b.x, z: b.z, vx: Math.sin(a) * 12, vz: Math.cos(a) * 12, dmg: 650, range: 16, radius: 0.55, color: '#ff4d6d', element: b.element, fromWild: true });
        }
        break;
      case 'summon':
        for (let i = 0; i < 3; i++) {
          const a = world.rng.next() * Math.PI * 2;
          const sp = world.safeSpot(b.x + Math.sin(a) * 4, b.z + Math.cos(a) * 4);
          world.spawnWild(world.rng.pick(BEASTS.filter((x) => x.rarity === 'common')).id, sp.x, sp.z, { team: b.team, hpMult: 0.8 });
        }
        break;
      case 'vortex':
        world.addZone({ x: b.x, z: b.z, r: 9, gtype: 'vortex', team: b.team, owner: null, dur: 2.5, dps: 300, strength: 7 });
        break;
      case 'meteors':
        for (const u of world.units)
          if (u.alive) world.addStrike({ x: u.x, z: u.z, r: 2.4, t: 1.2, dmg: 1100, team: b.team, owner: null, kind: 'meteor', knock: 6, stun: 0 });
        break;
    }
  }
}

export { len };
