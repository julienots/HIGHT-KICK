import type { Difficulty } from '../data/modes';
import { dist, norm } from '../core/math';
import { C } from './grid';
import type { Unit } from './entities';
import type { Target, World } from './world';

export interface BotProfile {
  name: Difficulty;
  reaction: number;
  aimErr: number;
  abilityUse: number;
  nodeUse: number;
  dodge: number;
  retreatHp: number;
  lead: boolean;
  noise: number;
  /** waits for eggs to evolve when safe */
  strategic: number;
  /** team-level role assignment */
  coordinate: boolean;
  fireRate: number;
}

const PROFILES: Record<Difficulty, BotProfile> = {
  easy: { name: 'easy', reaction: 0.85, aimErr: 0.42, abilityUse: 0.25, nodeUse: 0, dodge: 0, retreatHp: 0, lead: false, noise: 0.35, strategic: 0, coordinate: false, fireRate: 0.45 },
  normal: { name: 'normal', reaction: 0.5, aimErr: 0.22, abilityUse: 0.55, nodeUse: 0.25, dodge: 0.1, retreatHp: 0.22, lead: false, noise: 0.15, strategic: 0, coordinate: false, fireRate: 0.7 },
  hard: { name: 'hard', reaction: 0.32, aimErr: 0.12, abilityUse: 0.8, nodeUse: 0.6, dodge: 0.35, retreatHp: 0.3, lead: true, noise: 0.06, strategic: 2, coordinate: true, fireRate: 0.85 },
  expert: { name: 'expert', reaction: 0.2, aimErr: 0.06, abilityUse: 0.95, nodeUse: 0.85, dodge: 0.6, retreatHp: 0.33, lead: true, noise: 0.03, strategic: 3, coordinate: true, fireRate: 0.95 },
  master: { name: 'master', reaction: 0.12, aimErr: 0.025, abilityUse: 1, nodeUse: 1, dodge: 0.85, retreatHp: 0.35, lead: true, noise: 0, strategic: 3, coordinate: true, fireRate: 1 },
};
export const botProfile = (d: Difficulty) => PROFILES[d];

type GoalKind = 'deliver' | 'hold' | 'grab' | 'chase' | 'escort' | 'retreat' | 'node' | 'fight' | 'capture' | 'hunt' | 'boss' | 'roam' | 'survive';
interface Goal {
  kind: GoalKind;
  x: number;
  z: number;
  target?: Target | null;
  nodeId?: number;
}

/**
 * Bot AI. Utility-style decision making refreshed every `reaction` seconds, with path-finding,
 * strafing, projectile dodging, gravity node usage, egg strategy and ability heuristics.
 * Difficulty changes the actual decision quality, not just stats.
 */
export class BotBrain {
  goal: Goal = { kind: 'roam', x: 0, z: 0 };
  path: { x: number; z: number }[] = [];
  pathT = 0;
  pathGoal = { x: 1e9, z: 1e9 };
  thinkT = 0;
  strafe = 1;
  strafeT = 0;
  dodgeT = 0;
  dodgeX = 0;
  dodgeZ = 0;
  dodged = new Set<number>();
  fireT = 0;
  stuckT = 0;
  lastX = 0;
  lastZ = 0;
  focus: Target | null = null;
  get lead() {
    return this.p.lead;
  }
  constructor(private w: World, private u: Unit, public p: BotProfile) {
    this.thinkT = Math.random() * p.reaction;
  }
  reset() {
    this.path = [];
    this.goal = { kind: 'roam', x: this.u.x, z: this.u.z };
    this.thinkT = 0.2;
  }
  aimError() {
    const r = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    return r * this.p.aimErr * 2;
  }

  update(dt: number) {
    const u = this.u;
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.think();
      this.thinkT = this.p.reaction * (0.7 + Math.random() * 0.6);
    }
    this.steer(dt);
    this.combat(dt);
    // stuck detection -> repath
    this.stuckT += dt;
    if (this.stuckT > 1) {
      if (Math.hypot(u.x - this.lastX, u.z - this.lastZ) < 0.5 && Math.hypot(u.input.mx, u.input.mz) > 0.3) {
        this.path = [];
        this.strafe *= -1;
      }
      this.lastX = u.x;
      this.lastZ = u.z;
      this.stuckT = 0;
    }
  }

  private visibleEnemies(range: number) {
    return this.w.enemiesOf(this.u.team).filter((t) => dist(this.u, t) < range && this.w.visibleTo(this.u.team, t));
  }

  private think() {
    const w = this.w,
      u = this.u,
      p = this.p;
    const mode = w.cfg.mode;
    const allies = w.units.filter((a) => a.team === u.team && a.alive && a !== u);
    const enemies = this.visibleEnemies(14);
    const nearestEnemy = enemies.sort((a, b) => dist(u, a) - dist(u, b))[0] ?? null;
    const base = w.baseCenter[u.team];
    const noisy = Math.random() < p.noise;

    // retreat when low
    if (p.retreatHp > 0 && u.hp < u.maxHp * p.retreatHp && !u.carrying && nearestEnemy && mode !== 'survival' && mode !== 'boss_raid') {
      this.goal = { kind: 'retreat', x: base.x, z: base.z };
      return;
    }
    // survival: stay away from collapsing edges
    if (mode === 'survival') {
      if (nearestEnemy && u.hp > u.maxHp * 0.35) this.goal = { kind: 'fight', x: nearestEnemy.x, z: nearestEnemy.z, target: nearestEnemy };
      else this.goal = { kind: 'survive', x: w.core.x + (Math.random() - 0.5) * 4, z: w.core.z + (u.team === 0 ? 3 : -3) };
      return;
    }
    if (mode === 'boss_raid') {
      const boss = w.wilds.find((x) => x.isBoss && x.alive);
      const minion = w.wilds.filter((x) => x.alive && !x.isBoss).sort((a, b) => dist(u, a) - dist(u, b))[0];
      const t = minion && dist(u, minion) < 6 ? minion : boss;
      if (t) this.goal = { kind: 'boss', x: t.x, z: t.z, target: t };
      return;
    }
    // carrying an egg
    if (u.carrying) {
      const e = u.carrying;
      const threat = nearestEnemy ? dist(u, nearestEnemy) : 99;
      const timeLeft = w.duration - w.time;
      const behind = w.score[u.team] - w.score[1 - u.team];
      const wantPhase = p.strategic >= 3 ? (behind < -6 ? 4 : 3) : p.strategic >= 2 ? 2 : 0;
      const wouldWin = w.score[u.team] + [1, 2, 4, 7, 12][e.phase] >= w.target;
      if (!wouldWin && e.phase < wantPhase && threat > 9 && timeLeft > 30 && u.hp > u.maxHp * 0.5) {
        // hold just outside the base and let the creature evolve
        const dir = u.team === 0 ? -1 : 1;
        this.goal = { kind: 'hold', x: base.x + (allies.length % 2 ? 2 : -2), z: base.z + dir * 3.5 };
      } else this.goal = { kind: 'deliver', x: base.x, z: base.z };
      return;
    }
    // gravity nodes
    if (p.nodeUse > 0 && Math.random() < p.nodeUse) {
      for (const n of w.nodes) {
        if (n.cd > 0.5) continue;
        const dn = Math.hypot(n.x - u.x, n.z - u.z);
        if (dn > 13) continue;
        const foes = w.enemiesOf(u.team).filter((t) => t.kind === 'unit' && Math.hypot(t.x - n.x, t.z - n.z) < 6);
        const carrierNear = foes.some((t) => t.kind === 'unit' && t.carrying);
        const allyCarrierNear = allies.some((a) => a.carrying && Math.hypot(a.x - n.x, a.z - n.z) < 6);
        if ((foes.length >= 2 || carrierNear) && !allyCarrierNear) {
          this.goal = { kind: 'node', x: n.x, z: n.z, nodeId: n.id };
          return;
        }
      }
    }
    if (mode === 'gravity_war') {
      const zones = w.captures.slice().sort((a, b) => {
        const sa = (a.owner === u.team ? 12 : 0) + Math.hypot(a.x - u.x, a.z - u.z);
        const sb = (b.owner === u.team ? 12 : 0) + Math.hypot(b.x - u.x, b.z - u.z);
        return sa - sb;
      });
      // spread bots over zones with coordination
      const idx = p.coordinate ? (u.id % 3) % zones.length : 0;
      const z = zones[noisy ? Math.floor(Math.random() * zones.length) : Math.min(idx, zones.length - 1)] ?? zones[0];
      if (nearestEnemy && dist(u, nearestEnemy) < 6) this.goal = { kind: 'fight', x: nearestEnemy.x, z: nearestEnemy.z, target: nearestEnemy };
      else if (z) this.goal = { kind: 'capture', x: z.x + (Math.random() - 0.5) * 2, z: z.z + (Math.random() - 0.5) * 2 };
      return;
    }
    if (mode === 'beast_hunt') {
      const wild = w.wilds.filter((x) => x.alive).sort((a, b) => dist(u, a) - dist(u, b) - (b.rarityIdx - a.rarityIdx) * 2)[0];
      if (nearestEnemy && dist(u, nearestEnemy) < 7) this.goal = { kind: 'fight', x: nearestEnemy.x, z: nearestEnemy.z, target: nearestEnemy };
      else if (wild) this.goal = { kind: 'hunt', x: wild.x, z: wild.z, target: wild };
      else this.goal = { kind: 'roam', x: w.core.x, z: w.core.z };
      return;
    }
    // enemy carrier
    const carrier = w.units.find((e) => e.alive && e.team !== u.team && e.carrying);
    if (carrier) {
      const d = dist(u, carrier);
      const chasers = allies.filter((a) => dist(a, carrier) < d).length;
      const allowed = p.coordinate ? chasers < 2 : d < (p.name === 'easy' ? 10 : 16);
      if (allowed && !noisy) {
        this.goal = { kind: 'chase', x: carrier.x, z: carrier.z, target: carrier };
        return;
      }
    }
    // loose eggs
    const loose = w.eggs.filter((e) => !e.carrier && !e.dead);
    if (loose.length) {
      for (const e of loose.sort((a, b) => b.phase - a.phase || Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))) {
        const myD = Math.hypot(e.x - u.x, e.z - u.z);
        const closerAlly = allies.some((a) => !a.carrying && Math.hypot(e.x - a.x, e.z - a.z) < myD - 1);
        if (!closerAlly || (!p.coordinate && Math.random() < 0.5) || noisy) {
          this.goal = { kind: 'grab', x: e.x, z: e.z };
          return;
        }
      }
    }
    // escort
    const ac = allies.find((a) => a.carrying);
    if (ac && (!nearestEnemy || dist(u, nearestEnemy) > 5)) {
      const threat = this.visibleEnemies(16).sort((a, b) => dist(ac, a) - dist(ac, b))[0];
      if (threat) {
        const n = norm(threat.x - ac.x, threat.z - ac.z);
        this.goal = { kind: 'escort', x: ac.x + n.x * 3, z: ac.z + n.z * 3, target: threat };
      } else this.goal = { kind: 'escort', x: ac.x + 2 * this.strafe, z: ac.z + (u.team === 0 ? -2 : 2) };
      return;
    }
    if (nearestEnemy && dist(u, nearestEnemy) < 12) {
      this.goal = { kind: 'fight', x: nearestEnemy.x, z: nearestEnemy.z, target: nearestEnemy };
      return;
    }
    const wild = w.wilds.find((x) => x.alive && dist(u, x) < 8);
    if (wild) {
      this.goal = { kind: 'hunt', x: wild.x, z: wild.z, target: wild };
      return;
    }
    this.goal = { kind: 'roam', x: w.core.x + (Math.random() - 0.5) * 6, z: w.core.z + (u.team === 0 ? 4 : -4) };
  }

  private steer(dt: number) {
    const w = this.w,
      u = this.u,
      g = this.goal;
    // keep goal positions live for moving targets
    if (g.target && g.target.alive) {
      g.x = g.target.x;
      g.z = g.target.z;
    }
    let tx = g.x,
      tz = g.z;
    const tgt = g.target;
    const fighting = tgt && tgt.alive && (g.kind === 'fight' || g.kind === 'chase' || g.kind === 'hunt' || g.kind === 'boss' || g.kind === 'escort');
    let desired = 0;
    if (fighting) {
      const melee = u.def.attack.kind === 'melee' || u.def.attack.range < 4;
      desired = g.kind === 'chase' || melee ? 1.2 : u.def.attack.range * 0.72;
      if (g.kind === 'escort') desired = 0;
    }
    const d = Math.hypot(tx - u.x, tz - u.z);
    let mx = 0,
      mz = 0;
    const direct = w.grid.los(u.x, u.z, tx, tz) && !this.dangerOnLine(u.x, u.z, tx, tz);
    if (fighting && d < desired + 3 && direct) {
      // strafe around the target at preferred distance
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafe = Math.random() < 0.5 ? -1 : 1;
        this.strafeT = 0.8 + Math.random() * 1.4;
      }
      const n = norm(tx - u.x, tz - u.z);
      const radial = d > desired ? 1 : d < desired - 1.5 ? -0.8 : 0;
      const sideAmt = this.p.name === 'easy' ? 0.2 : 0.7;
      mx = n.x * radial + -n.z * this.strafe * sideAmt;
      mz = n.z * radial + n.x * this.strafe * sideAmt;
    } else if (d > 0.6) {
      if (direct && d < 6) {
        const n = norm(tx - u.x, tz - u.z);
        mx = n.x;
        mz = n.z;
      } else {
        this.pathT -= dt;
        if (!this.path.length || this.pathT <= 0 || Math.hypot(this.pathGoal.x - tx, this.pathGoal.z - tz) > 3) {
          this.path = w.grid.path(u.x, u.z, tx, tz);
          this.pathGoal = { x: tx, z: tz };
          this.pathT = 0.8;
        }
        while (this.path.length && Math.hypot(this.path[0].x - u.x, this.path[0].z - u.z) < 0.9) this.path.shift();
        const wp = this.path[0] ?? { x: tx, z: tz };
        const n = norm(wp.x - u.x, wp.z - u.z);
        mx = n.x;
        mz = n.z;
      }
    }
    // separation from allies
    for (const a of w.units) {
      if (a === u || !a.alive || a.team !== u.team) continue;
      const dd = Math.hypot(a.x - u.x, a.z - u.z);
      if (dd < 1.6 && dd > 0.01) {
        mx -= ((a.x - u.x) / dd) * 0.5;
        mz -= ((a.z - u.z) / dd) * 0.5;
      }
    }
    // dodge incoming projectiles
    if (this.p.dodge > 0) {
      if (this.dodgeT > 0) {
        this.dodgeT -= dt;
        mx = this.dodgeX;
        mz = this.dodgeZ;
      } else {
        for (const p of w.projectiles) {
          if (p.team === u.team || p.lob || this.dodged.has(p.id)) continue;
          const rx = u.x - p.x,
            rz = u.z - p.z;
          const sp = Math.hypot(p.vx, p.vz) || 1;
          const along = (rx * p.vx + rz * p.vz) / sp;
          if (along < 0 || along > 6) continue;
          const side = (rx * -p.vz + rz * p.vx) / sp;
          if (Math.abs(side) < 1.3) {
            this.dodged.add(p.id);
            if (Math.random() < this.p.dodge) {
              const s = side >= 0 ? 1 : -1;
              this.dodgeX = (-p.vz / sp) * s;
              this.dodgeZ = (p.vx / sp) * s;
              this.dodgeT = 0.28;
              mx = this.dodgeX;
              mz = this.dodgeZ;
              break;
            }
          }
        }
        if (this.dodged.size > 200) this.dodged.clear();
      }
    }
    // avoid stepping into pits / active hazards when moving directly
    const l = Math.hypot(mx, mz);
    if (l > 0.01) {
      mx /= l;
      mz /= l;
      const ahead = w.grid.at(u.x + mx * 1.2, u.z + mz * 1.2);
      if ((w.grid.isPit(ahead) && !w.platformAt(u.x + mx * 1.2, u.z + mz * 1.2)) || (ahead === C.Hazard && w.hazardOn)) {
        if (!this.path.length) this.path = w.grid.path(u.x, u.z, tx, tz);
        const wp = this.path[0];
        if (wp) {
          const n = norm(wp.x - u.x, wp.z - u.z);
          mx = n.x;
          mz = n.z;
        } else mx = mz = 0;
      }
    }
    if (g.kind === 'hold' && d < 1) mx = mz = 0;
    u.input.mx = mx;
    u.input.mz = mz;
  }

  private dangerOnLine(ax: number, az: number, bx: number, bz: number) {
    const gr = this.w.grid;
    const dd = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(dd / 1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const c = gr.at(ax + (bx - ax) * t, az + (bz - az) * t);
      if (gr.isPit(c) || c === C.Hazard) return true;
    }
    return false;
  }

  private combat(dt: number) {
    const w = this.w,
      u = this.u,
      p = this.p;
    const a = u.def.attack;
    const range = a.range;
    // choose target: goal target if in range, else best nearby
    let t: Target | null = null;
    const gt = this.goal.target;
    if (gt && gt.alive && dist(u, gt) < range * 1.05 && w.visibleTo(u.team, gt) && (a.kind === 'lob' || w.grid.los(u.x, u.z, gt.x, gt.z))) t = gt;
    if (!t) t = w.nearestEnemy(u, range * 1.05, a.kind !== 'lob');
    this.fireT -= dt;
    if (t && u.ammo >= 1 && this.fireT <= 0) {
      if (Math.random() < p.fireRate) {
        const lead = p.lead && t.kind === 'unit' ? dist(u, t) / (a.speed ?? 20) : 0;
        const tx = t.x + (t.kind === 'unit' ? t.vx * lead * 0.7 : 0),
          tz = t.z + (t.kind === 'unit' ? t.vz * lead * 0.7 : 0);
        const n = norm(tx - u.x, tz - u.z);
        const dd = Math.hypot(tx - u.x, tz - u.z);
        u.input.ax = n.x * Math.min(1, dd / range);
        u.input.az = n.z * Math.min(1, dd / range);
        u.input.attack = true;
        // easier bots keep an ammo in reserve less often
      }
      this.fireT = p.reaction * 0.6 + (p.name === 'easy' ? 0.5 : 0.1);
    } else if (!u.input.attack) {
      u.input.ax = u.input.az = 0;
    }
    // interact with node
    if (this.goal.kind === 'node') {
      const n = w.nodes.find((x) => x.id === this.goal.nodeId);
      if (n && Math.hypot(n.x - u.x, n.z - u.z) < 1.8) {
        u.input.interact = true;
        this.thinkT = 0;
      } else if (n && n.cd > 0.5) this.thinkT = 0;
    }
    if (this.thinkT > p.reaction * 0.5) return; // ability decisions at think cadence-ish
    if (Math.random() > p.abilityUse * dt * 6) return;
    const enemies = this.visibleEnemies(14);
    const near = (r: number) => enemies.filter((e) => dist(u, e) < r);
    const allies = w.units.filter((x) => x.team === u.team && x.alive);
    const hurtAlly = (r: number, th: number) => allies.some((x) => dist(u, x) < r && x.hp < x.maxHp * th);
    const decide = (def: any, isSuper: boolean): boolean => {
      switch (def.kind) {
        case 'dash':
        case 'blink': {
          const reach = def.dist + range;
          if (u.carrying) return near(6).length > 0;
          if (def.strike) return near(def.dist).length > 0;
          if (u.hp < u.maxHp * 0.3 && near(5).length) return true;
          const tg = this.goal.target;
          return !!tg && tg.alive && dist(u, tg) > range && dist(u, tg) < reach;
        }
        case 'shield':
          return (u.hp < u.maxHp * 0.65 && near(8).length > 0) || (u.carrying != null && near(9).length > 0) || (def.radius > 0 && hurtAlly(def.radius, 0.6) && near(9).length > 0);
        case 'gravityZone':
          return def.range > 0 ? near(def.range + 1).length >= (isSuper ? 1 : 1) : near(def.radius).length >= 1;
        case 'chain':
          return near(def.range).length > 0;
        case 'storm':
        case 'meteor':
          return near(def.range).length > 0;
        case 'heal':
          return hurtAlly(def.radius, 0.7);
        case 'ring':
          return near(def.radius).length >= 1;
        case 'cone':
        case 'line':
        case 'tornado':
          return near(def.range * 0.8).length > 0;
        case 'buff':
          return near(9).length > 0;
        case 'turret':
          return near(9).length > 0;
        case 'wall':
          return (u.carrying != null || u.hp < u.maxHp * 0.5) && near(8).length > 0;
        case 'radial':
          return near(def.range * 0.7).length >= 1;
      }
      return false;
    };
    const aimAt = (r: number) => {
      const e = near(r)[0];
      if (e) {
        const n = norm(e.x - u.x, e.z - u.z);
        const dd = dist(u, e);
        u.input.ax = n.x * Math.min(1, dd / r);
        u.input.az = n.z * Math.min(1, dd / r);
      } else if (u.carrying) {
        const b = w.baseCenter[u.team];
        const n = norm(b.x - u.x, b.z - u.z);
        u.input.ax = n.x;
        u.input.az = n.z;
      }
    };
    if (u.superCharge >= 1 && decide(u.def.super.def, true)) {
      aimAt(14);
      u.input.super = true;
      return;
    }
    if (u.skillCd <= 0 && decide(u.def.skill.def, false)) {
      const def: any = u.def.skill.def;
      if ((def.kind === 'dash' || def.kind === 'blink') && u.carrying) {
        const b = w.baseCenter[u.team];
        const n = norm(b.x - u.x, b.z - u.z);
        u.input.ax = n.x;
        u.input.az = n.z;
      } else if ((def.kind === 'dash' || def.kind === 'blink') && u.hp < u.maxHp * 0.3) {
        const e = near(6)[0];
        if (e) {
          const n = norm(u.x - e.x, u.z - e.z);
          u.input.ax = n.x;
          u.input.az = n.z;
        }
      } else aimAt(14);
      u.input.skill = true;
      return;
    }
    if (u.gadget && u.gadgetUses > 0 && u.gadgetCd <= 0 && p.name !== 'easy') {
      const g = u.gadget.kind;
      const use =
        (g === 'heal' && u.hp < u.maxHp * 0.45) ||
        (g === 'shield' && u.hp < u.maxHp * 0.6 && near(7).length > 0) ||
        (g === 'speed' && (u.carrying != null || this.goal.kind === 'chase')) ||
        ((g === 'push' || g === 'gravityPulse') && near(3.5).length > 0) ||
        (g === 'blink' && u.hp < u.maxHp * 0.3 && near(5).length > 0) ||
        (g === 'reload' && u.ammo < 1 && near(range).length > 0) ||
        (g === 'decoy' && u.hp < u.maxHp * 0.35);
      if (use) u.input.gadget = true;
    }
  }
}
