import { BEASTS, getBeast } from '../data/beasts';
import { RARITIES } from '../data/rarities';
import { C } from './grid';
import type { Egg, Unit, Wild } from './entities';
import { EGG_POINTS, type World } from './world';

/** Mode rules: hooks called by the World. Each game mode customises scoring/spawns/end conditions. */
export class ModeRules {
  respawn = true;
  eggs = true;
  baseHeal = true;
  coreEvents = true;
  ambientWilds = true;
  maxEggs = 3;
  constructor(public w: World) {}
  setup() {
    const w = this.w;
    if (!this.eggs) return;
    w.spawnEgg(w.core.x, w.core.z);
    const pairs = this.spawnPairs();
    if (pairs.length && this.maxEggs > 1) {
      const p = w.rng.pick(pairs);
      for (const s of p) w.spawnEgg(s.x, s.z);
    }
  }
  /** egg spawn points grouped by mirror pairs */
  spawnPairs() {
    const w = this.w;
    const out: { x: number; z: number }[][] = [];
    const top = w.eggSpawns.filter((s) => s.z < -0.5);
    for (const t of top) {
      const m = w.eggSpawns.find((s) => Math.abs(s.x - t.x) < 0.1 && Math.abs(s.z + t.z) < 0.1);
      if (m) out.push([t, m]);
    }
    return out;
  }
  preUpdate(dt: number) {
    const w = this.w;
    if (!this.eggs) return;
    const live = w.eggs.length;
    if (live < this.maxEggs) {
      w.eggRespawnT -= dt;
      if (w.eggRespawnT <= 0) {
        const pairs = this.spawnPairs();
        if (live <= this.maxEggs - 2 && pairs.length && w.rng.chance(0.6)) for (const s of w.rng.pick(pairs)) w.spawnEgg(s.x, s.z);
        else w.spawnEgg(w.core.x, w.core.z);
        w.eggRespawnT = 4;
      }
    } else w.eggRespawnT = 4;
  }
  update(_dt: number) {
    const w = this.w;
    if (this.eggs && (w.score[0] >= w.target || w.score[1] >= w.target)) w.end(w.score[0] >= w.target ? 0 : 1, 'score');
  }
  onKill(_u: Unit, _killer: Unit | null) {}
  onWildKill(w: Wild, killer: Unit | null) {
    if (killer) killer.superCharge = Math.min(1, killer.superCharge + 0.2);
    void w;
  }
  onDeliver(u: Unit, e: Egg) {
    const w = this.w;
    const pts = EGG_POINTS[e.phase];
    w.score[u.team] += pts;
    u.stats.eggs++;
    u.stats.points += pts;
    if (e.phase >= 4) u.stats.titans++;
    if (!u.stats.bestEgg || e.phase > u.stats.bestEgg.phase) u.stats.bestEgg = { speciesId: e.speciesId, phase: e.phase };
    u.carrying = null;
    e.carrier = null;
    e.dead = true;
    w.emit({ t: 'deliver', u: u.id, team: u.team, phase: e.phase, points: pts, x: u.x, z: u.z });
    w.emit({ t: 'score', team: u.team, score: w.score.slice() });
    u.superCharge = Math.min(1, u.superCharge + 0.1 * (e.phase + 1));
  }
  onTimeUp() {
    const w = this.w;
    if (w.score[0] === w.score[1]) {
      if (w.state === 'playing' && w.time < w.duration + 30) {
        // sudden death: first score wins
        w.state = 'overtime';
        w.target = w.score[0] + 1;
        w.duration += 30;
        w.state = 'playing';
        return;
      }
      w.end(2, 'draw');
    } else w.end(w.score[0] > w.score[1] ? 0 : 1, 'time');
  }
}

class DuelRules extends ModeRules {
  maxEggs = 2;
  setup() {
    this.w.spawnEgg(this.w.core.x, this.w.core.z);
  }
  onKill(u: Unit, killer: Unit | null) {
    if (killer && killer.team !== u.team) {
      this.w.score[killer.team] += 1;
      this.w.emit({ t: 'score', team: killer.team, score: this.w.score.slice() });
    }
  }
}

class GravityWarRules extends ModeRules {
  eggs = false;
  acc = 0;
  setup() {
    const w = this.w;
    const midRow = Math.floor(w.grid.h / 2);
    const pts = [w.grid.center(3, midRow), { x: w.core.x, z: w.core.z }, w.grid.center(w.grid.w - 4, midRow)];
    pts.forEach((p) => {
      const sp = w.safeSpot(p.x, p.z);
      w.captures.push({ id: w.id(), x: sp.x, z: sp.z, r: 3.2, owner: -1, progress: 0 });
    });
  }
  preUpdate() {}
  update(dt: number) {
    const w = this.w;
    for (const z of w.captures) {
      let a = 0,
        b = 0;
      for (const u of w.units) if (u.alive && Math.hypot(u.x - z.x, u.z - z.z) < z.r) u.team === 0 ? a++ : b++;
      if (a && !b) z.progress = Math.max(-1, z.progress - 0.45 * Math.min(2, a) * dt);
      else if (b && !a) z.progress = Math.min(1, z.progress + 0.45 * Math.min(2, b) * dt);
      const prev = z.owner;
      if (z.progress <= -1) z.owner = 0;
      else if (z.progress >= 1) z.owner = 1;
      else if (Math.abs(z.progress) < 0.05) z.owner = -1;
      if (prev !== z.owner && z.owner >= 0) {
        w.emit({ t: 'capture', zone: z.id, team: z.owner });
        for (const u of w.units) if (u.alive && u.team === z.owner && Math.hypot(u.x - z.x, u.z - z.z) < z.r) u.stats.captures++;
      }
    }
    this.acc += dt;
    if (this.acc >= 1) {
      this.acc -= 1;
      for (const z of w.captures) if (z.owner >= 0) w.score[z.owner] += 1;
    }
    if (w.score[0] >= w.target || w.score[1] >= w.target) w.end(w.score[0] >= w.score[1] ? 0 : 1, 'score');
  }
  onTimeUp() {
    const w = this.w;
    w.end(w.score[0] === w.score[1] ? 2 : w.score[0] > w.score[1] ? 0 : 1, 'time');
  }
}

class HuntRules extends ModeRules {
  eggs = false;
  ambientWilds = false;
  spawnT = 0;
  setup() {
    for (let i = 0; i < 5; i++) this.spawn();
  }
  spawn() {
    const w = this.w;
    const p = w.randomFloor((x, z) => Math.abs(z) < 14);
    const weights = BEASTS.map((b) => ({ b, weight: [50, 25, 12, 6, 3, 1.5, 0.6][RARITIES.indexOf(b.rarity)] }));
    w.spawnWild(w.rng.weighted(weights).b.id, p.x, p.z);
  }
  preUpdate(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 2.5;
      if (this.w.wilds.filter((x) => x.alive).length < 7) this.spawn();
    }
  }
  onWildKill(wild: Wild, killer: Unit | null) {
    super.onWildKill(wild, killer);
    if (!killer) return;
    const pts = [1, 2, 3, 5, 8, 10, 12][wild.rarityIdx];
    this.w.score[killer.team] += pts;
    killer.stats.captures++;
    killer.stats.points += pts;
    if (!killer.stats.bestEgg || wild.rarityIdx > (killer.stats.bestEgg.phase ?? 0)) killer.stats.bestEgg = { speciesId: wild.speciesId, phase: Math.min(4, wild.rarityIdx + 1) };
    this.w.emit({ t: 'score', team: killer.team, score: this.w.score.slice() });
  }
  update() {
    const w = this.w;
    if (w.score[0] >= w.target || w.score[1] >= w.target) w.end(w.score[0] >= w.score[1] ? 0 : 1, 'score');
  }
  onTimeUp() {
    const w = this.w;
    w.end(w.score[0] === w.score[1] ? 2 : w.score[0] > w.score[1] ? 0 : 1, 'time');
  }
}

class BossRules extends ModeRules {
  eggs = false;
  coreEvents = false;
  ambientWilds = false;
  boss: Wild | null = null;
  setup() {
    const w = this.w;
    const pool = BEASTS.filter((b) => ['legendary', 'ancient', 'celestial', 'mythic'].includes(b.rarity));
    const sp = w.rng.pick(pool);
    const top = w.baseCenter[1];
    const b = w.spawnWild(sp.id, top.x, top.z + 6, { boss: true, team: 1 });
    const hp = { easy: 150000, normal: 220000, hard: 290000, expert: 370000, master: 460000 }[w.cfg.difficulty];
    b.atk = { easy: 700, normal: 900, hard: 1100, expert: 1300, master: 1500 }[w.cfg.difficulty];
    b.hp = b.maxHp = hp;
    this.boss = b;
  }
  preUpdate() {}
  update() {
    const w = this.w;
    if (this.boss && !this.boss.alive) w.end(0, 'boss');
    w.score[1] = this.boss ? Math.ceil((this.boss.hp / this.boss.maxHp) * 100) : 0;
    w.score[0] = 100 - w.score[1];
  }
  onWildKill(wild: Wild, killer: Unit | null) {
    if (wild.isBoss && killer) killer.stats.captures++;
  }
  onTimeUp() {
    this.w.end(1, 'time');
  }
}

class SurvivalRules extends ModeRules {
  eggs = false;
  baseHeal = false;
  ambientWilds = false;
  collapseT = 20;
  ring = 0;
  /** shared team lives: when a team runs out, its fallen Jackers stay down */
  lives = [3, 3];
  pending: { cells: number[]; t: number } | null = null;
  setup() {
    const n = this.w.units.filter((u) => u.team === 0).length;
    this.lives = [n * 2, n * 2];
  }
  onKill(u: Unit) {
    if (this.lives[u.team] > 0) this.lives[u.team]--;
    else u.respawnT = Infinity;
  }
  preUpdate(dt: number) {
    const w = this.w;
    const gr = w.grid;
    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) {
        for (const i of this.pending.cells) if (gr.cells[i] !== C.Wall) gr.cells[i] = C.Pit;
        this.pending = null;
      }
      return;
    }
    this.collapseT -= dt;
    if (this.collapseT <= 0 && this.ring < 7) {
      this.collapseT = 14;
      // collapse an outer ring of cells (bases go last)
      const cells: number[] = [];
      const k = this.ring;
      for (let r = 0; r < gr.h; r++)
        for (let c = 0; c < gr.w; c++) {
          const dEdge = Math.min(c, gr.w - 1 - c, Math.floor(Math.min(r, gr.h - 1 - r) * 0.75));
          if (dEdge === k && gr.cells[r * gr.w + c] !== C.Pit) cells.push(r * gr.w + c);
        }
      this.ring++;
      this.pending = { cells, t: 2.5 };
      w.emit({ t: 'collapse', cells });
    }
  }
  update() {
    const w = this.w;
    const alive = [0, 1].map((t) => w.units.filter((u) => u.team === t && (u.alive || u.respawnT < 1e9)).length);
    w.score[0] = this.lives[0] + w.units.filter((u) => u.team === 0 && u.alive).length;
    w.score[1] = this.lives[1] + w.units.filter((u) => u.team === 1 && u.alive).length;
    if (!alive[0] || !alive[1]) w.end(alive[0] ? 0 : alive[1] ? 1 : 2, 'elimination');
  }
  onTimeUp() {
    const w = this.w;
    if (w.score[0] !== w.score[1]) return w.end(w.score[0] > w.score[1] ? 0 : 1, 'time');
    const hp = [0, 1].map((t) => w.units.filter((u) => u.team === t && u.alive).reduce((s, u) => s + u.hp / u.maxHp, 0));
    w.end(Math.abs(hp[0] - hp[1]) < 0.01 ? 2 : hp[0] > hp[1] ? 0 : 1, 'time');
  }
}

export function createRules(w: World): ModeRules {
  switch (w.cfg.mode) {
    case 'duel':
      return new DuelRules(w);
    case 'gravity_war':
      return new GravityWarRules(w);
    case 'beast_hunt':
      return new HuntRules(w);
    case 'boss_raid':
      return new BossRules(w);
    case 'survival':
      return new SurvivalRules(w);
    default:
      return new ModeRules(w);
  }
}

export { getBeast };
