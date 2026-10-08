import { BEAST_MAX_LEVEL, compatible, getBeast, STAGE_INFO, STAGES } from '../data/beasts';
import { FOOD_MAP, FOODS } from '../data/economy';
import { RARITIES, type Rarity } from '../data/rarities';
import type { Ctx } from './ctx';
import { HATCH_MINUTES, type RewardSystem } from './rewards';
import type { BeastInstance } from './state';
import { MIN } from '../core/time';

export const MAX_INCUBATORS = 2;
export const BREED_COOLDOWN = 30 * MIN;

export const beastXpForLevel = (l: number) => 40 + l * 25 + l * l * 2;
/** Max level reachable at a given stage index. */
export const stageCap = (stage: number) => [5, 10, 20, 30, BEAST_MAX_LEVEL][stage];

export function beastStats(b: BeastInstance) {
  const sp = getBeast(b.speciesId);
  const st = STAGE_INFO[STAGES[b.stage]];
  const lv = 1 + (b.level - 1) * 0.06;
  const mut = b.mutation === 'none' ? 1 : b.mutation === 'prism' ? 1.2 : 1.1;
  const m = st.statMult * lv * mut;
  return { hp: Math.round(sp.hp * m), atk: Math.round(sp.atk * m), def: Math.round(sp.def * m), spd: Math.round(sp.spd * (0.9 + 0.1 * st.statMult)), power: Math.round((sp.hp / 10 + sp.atk + sp.def + sp.spd) * m) };
}

/** BeastSystem: collection, feeding, XP, evolution, eggs/incubation, breeding, farm. */
export class BeastSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}

  get(uid: string) {
    return this.c.state.beasts.find((b) => b.uid === uid);
  }

  addXp(b: BeastInstance, xp: number) {
    b.xp += xp;
    let leveled = false;
    while (b.level < stageCap(b.stage) && b.xp >= beastXpForLevel(b.level)) {
      b.xp -= beastXpForLevel(b.level);
      b.level++;
      leveled = true;
    }
    if (b.level >= stageCap(b.stage)) b.xp = Math.min(b.xp, beastXpForLevel(b.level));
    return leveled;
  }

  feed(uid: string, foodId: string): { ok: boolean; msg: string; xp?: number } {
    const s = this.c.state;
    const b = this.get(uid);
    const f = FOOD_MAP[foodId];
    if (!b || !f) return { ok: false, msg: 'Introuvable' };
    if ((s.food[foodId] ?? 0) <= 0) return { ok: false, msg: 'Plus de nourriture' };
    if (b.level >= stageCap(b.stage) && b.xp >= beastXpForLevel(b.level)) return { ok: false, msg: b.stage < 4 ? 'Prêt à évoluer !' : 'Niveau maximum' };
    s.food[foodId]--;
    const fav = getBeast(b.speciesId).favFood === foodId;
    const xp = Math.round(f.xp * (fav ? 2 : 1));
    this.addXp(b, xp);
    s.stats.beastsFed = (s.stats.beastsFed ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { ok: true, msg: fav ? 'Nourriture préférée ! XP ×2' : `+${xp} XP`, xp };
  }

  canEvolve(b: BeastInstance) {
    if (b.stage >= 4) return { ok: false, reason: 'Forme ultime atteinte', cost: 0 };
    const cost = STAGE_INFO[STAGES[b.stage + 1]].energy;
    if (b.level < stageCap(b.stage)) return { ok: false, reason: `Niveau ${stageCap(b.stage)} requis`, cost };
    if (this.c.state.currencies.energy < cost) return { ok: false, reason: `${cost} ⭐ requis`, cost };
    return { ok: true, reason: '', cost };
  }

  evolve(uid: string) {
    const b = this.get(uid);
    if (!b) return false;
    const chk = this.canEvolve(b);
    if (!chk.ok) return false;
    this.c.state.currencies.energy -= chk.cost;
    b.stage++;
    b.xp = 0;
    const s = this.c.state;
    s.stats.beastsEvolved = (s.stats.beastsEvolved ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }

  // ---------------- Eggs / incubation ----------------
  incubating() {
    return this.c.state.eggs.filter((e) => e.incubating);
  }
  incubate(uid: string) {
    const e = this.c.state.eggs.find((x) => x.uid === uid);
    if (!e || e.incubating) return false;
    if (this.incubating().length >= MAX_INCUBATORS) return false;
    e.incubating = true;
    e.hatchAt = this.c.now() + HATCH_MINUTES[e.rarity] * MIN;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }
  skipCost(uid: string) {
    const e = this.c.state.eggs.find((x) => x.uid === uid);
    if (!e || !e.incubating) return 0;
    return Math.max(1, Math.ceil((e.hatchAt - this.c.now()) / (10 * MIN)));
  }
  skip(uid: string) {
    const cost = this.skipCost(uid);
    const e = this.c.state.eggs.find((x) => x.uid === uid);
    if (!e || this.c.state.currencies.gems < cost) return false;
    this.c.state.currencies.gems -= cost;
    e.hatchAt = this.c.now();
    this.c.dirty();
    return true;
  }
  hatch(uid: string) {
    const s = this.c.state;
    const i = s.eggs.findIndex((x) => x.uid === uid);
    if (i < 0) return null;
    const e = s.eggs[i];
    if (!e.incubating || e.hatchAt > this.c.now()) return null;
    s.eggs.splice(i, 1);
    const isNew = !s.beasts.some((b) => b.speciesId === e.speciesId);
    const beast: BeastInstance = { uid: this.rewards.uid('b'), speciesId: e.speciesId, level: 1, xp: 0, stage: 0, mutation: e.mutation, obtainedAt: this.c.now(), favorite: false, breedReadyAt: 0 };
    s.beasts.push(beast);
    s.stats.beastsHatched = (s.stats.beastsHatched ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { beast, isNew };
  }

  // ---------------- Breeding ----------------
  canBreed(a: BeastInstance, b: BeastInstance): { ok: boolean; reason: string } {
    if (a.uid === b.uid) return { ok: false, reason: 'Choisis deux créatures différentes' };
    if (this.c.state.breeding) return { ok: false, reason: 'Le nid est déjà occupé' };
    if (a.stage < 2 || b.stage < 2) return { ok: false, reason: 'Les parents doivent être ADULT ou plus' };
    const ea = getBeast(a.speciesId).element,
      eb = getBeast(b.speciesId).element;
    if (!compatible(ea, eb)) return { ok: false, reason: 'Éléments incompatibles' };
    const t = this.c.now();
    if (a.breedReadyAt > t || b.breedReadyAt > t) return { ok: false, reason: 'Un parent se repose' };
    return { ok: true, reason: '' };
  }
  breedDuration(a: BeastInstance, b: BeastInstance) {
    const ra = RARITIES.indexOf(getBeast(a.speciesId).rarity),
      rb = RARITIES.indexOf(getBeast(b.speciesId).rarity);
    return (3 + Math.max(ra, rb) * 4) * MIN;
  }
  startBreeding(aUid: string, bUid: string) {
    const a = this.get(aUid),
      b = this.get(bUid);
    if (!a || !b) return false;
    if (!this.canBreed(a, b).ok) return false;
    const t = this.c.now();
    this.c.state.breeding = { a: aUid, b: bUid, start: t, end: t + this.breedDuration(a, b) };
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }
  /** Compute the offspring (exposed for tests). */
  offspring(a: BeastInstance, b: BeastInstance) {
    const R = this.c.rand;
    const sa = getBeast(a.speciesId),
      sb = getBeast(b.speciesId);
    let species = R() < 0.5 ? sa : sb;
    const roll = R();
    if (roll < 0.04) {
      // rare result: one rarity tier above the best parent, same element
      const best = Math.max(RARITIES.indexOf(sa.rarity), RARITIES.indexOf(sb.rarity));
      const target = RARITIES[Math.min(RARITIES.length - 1, best + 1)] as Rarity;
      species = this.rewards.randomSpecies(target, species.element);
    } else if (roll < 0.14) {
      species = this.rewards.randomSpecies(undefined, R() < 0.5 ? sa.element : sb.element);
    }
    const mutBonus = (a.mutation !== 'none' ? 0.04 : 0) + (b.mutation !== 'none' ? 0.04 : 0);
    const mutation = this.rewards.rollMutation(mutBonus + 0.02);
    return { species, mutation };
  }
  collectBreeding() {
    const s = this.c.state;
    const br = s.breeding;
    if (!br || br.end > this.c.now()) return null;
    const a = this.get(br.a),
      b = this.get(br.b);
    s.breeding = null;
    if (!a || !b) return null;
    const { species, mutation } = this.offspring(a, b);
    const egg = this.rewards.makeEgg(species.rarity, species.id, 'breed', mutation);
    s.eggs.push(egg);
    a.breedReadyAt = b.breedReadyAt = this.c.now() + BREED_COOLDOWN;
    s.stats.beastsBred = (s.stats.beastsBred ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return egg;
  }

  // ---------------- Farm ----------------
  plant(plot: number, foodId: string) {
    const s = this.c.state;
    const p = s.farm[plot];
    const f = FOOD_MAP[foodId];
    if (!p || !f || p.foodId) return false;
    if ((s.seeds[foodId] ?? 0) <= 0) return false;
    s.seeds[foodId]--;
    p.foodId = foodId;
    p.plantedAt = this.c.now();
    p.readyAt = p.plantedAt + f.growMinutes * MIN;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }
  harvest(plot: number) {
    const s = this.c.state;
    const p = s.farm[plot];
    if (!p || !p.foodId || p.readyAt > this.c.now()) return null;
    const f = FOOD_MAP[p.foodId];
    const n = f.yield[0] + Math.floor(this.c.rand() * (f.yield[1] - f.yield[0] + 1));
    s.food[f.id] = (s.food[f.id] ?? 0) + n;
    // small chance to recover a seed
    if (this.c.rand() < 0.5) s.seeds[f.id] = (s.seeds[f.id] ?? 0) + 1;
    p.foodId = null;
    p.plantedAt = p.readyAt = 0;
    s.stats.harvests = (s.stats.harvests ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { food: f, amount: n };
  }
  buySeed(foodId: string, amount = 1) {
    const f = FOOD_MAP[foodId];
    const s = this.c.state;
    if (!f || s.currencies.coins < f.seedPrice * amount) return false;
    s.currencies.coins -= f.seedPrice * amount;
    s.seeds[foodId] = (s.seeds[foodId] ?? 0) + amount;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }

  /** Companion beast: grants a small stat bonus in matches. */
  companionBonus(): { hp: number; dmg: number; element?: string } {
    const uid = this.c.state.profile.companion;
    const b = uid ? this.get(uid) : undefined;
    if (!b) return { hp: 0, dmg: 0 };
    const st = beastStats(b);
    return { hp: Math.min(0.12, st.power / 20000), dmg: Math.min(0.1, st.power / 25000), element: getBeast(b.speciesId).element };
  }
}

export const ALL_FOODS = FOODS;
