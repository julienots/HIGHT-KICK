/**
 * 2.0 RENAISSANCE meta systems: Star Drops, Jacker Mastery, offline Club, Ladder, Beast Arena battles.
 * Everything is deterministic or local: works fully offline.
 */
import { Rng, hashString } from '../core/rng';
import { dayIndex, weekIndex, DAY } from '../core/time';
import { BEASTS, getBeast, STAGES, STAGE_INFO } from '../data/beasts';
import { elementMultiplier, type Element } from '../data/elements';
import type { ChestId, Reward } from '../data/economy';
import { JACKERS, getJacker } from '../data/jackers';
import { RARITIES } from '../data/rarities';
import { seasonInfo } from '../data/seasons';
import { SKINS } from '../data/skins';
import type { Ctx, GrantedItem } from './ctx';
import type { RewardSystem } from './rewards';
import type { ClubMember, ClubState } from './state';
import { beastStats } from './beasts';

// ================================================================ STAR DROPS
export type DropRarity = 'rare' | 'superRare' | 'epic' | 'mythic' | 'legendary';
export const DROP_RARITIES: DropRarity[] = ['rare', 'superRare', 'epic', 'mythic', 'legendary'];
export const DROP_INFO: Record<DropRarity, { name: string; color: string; glow: string }> = {
  rare: { name: 'RARE', color: '#4dff7a', glow: '#1aa83f' },
  superRare: { name: 'SUPER RARE', color: '#38c8ff', glow: '#1f6ae0' },
  epic: { name: 'EPIC', color: '#c45cff', glow: '#7a1fbf' },
  mythic: { name: 'MYTHIC', color: '#ff4d6d', glow: '#b3122f' },
  legendary: { name: 'LEGENDARY', color: '#ffd23a', glow: '#ff9a00' },
};
export const DAILY_DROP_CAP = 8;

export class StarDropSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}
  /** Earn a drop (limited per day). Returns true if granted. */
  earn(n = 1) {
    const s = this.c.state;
    const d = dayIndex(this.c.now());
    if (s.starDropDay.day !== d) s.starDropDay = { day: d, earned: 0 };
    const k = Math.max(0, Math.min(n, DAILY_DROP_CAP - s.starDropDay.earned));
    s.starDropDay.earned += k;
    s.starDrops += k;
    this.c.dirty();
    return k > 0;
  }
  /** Roll the final rarity: the drop "upgrades" step by step from RARE. */
  rollRarity(): { rarity: DropRarity; steps: DropRarity[] } {
    const R = this.c.rand;
    const steps: DropRarity[] = ['rare'];
    const up = [0.45, 0.35, 0.28, 0.25];
    let i = 0;
    while (i < 4 && R() < up[i]) {
      i++;
      steps.push(DROP_RARITIES[i]);
    }
    return { rarity: DROP_RARITIES[i], steps };
  }
  rewardFor(r: DropRarity): Reward[] {
    const R = this.c.rand;
    const s = this.c.state;
    const owned = JACKERS.filter((j) => s.jackers[j.id].unlocked);
    const jk = owned[Math.floor(R() * owned.length)];
    const pick = <T>(a: T[]) => a[Math.floor(R() * a.length)];
    switch (r) {
      case 'rare':
        return [pick<Reward>([{ type: 'coins', amount: 60 + Math.floor(R() * 40) }, { type: 'shards', amount: 20, jackerId: jk.id }, { type: 'energy', amount: 12 }, { type: 'food', foodId: 'berry', amount: 3 }])];
      case 'superRare':
        return [pick<Reward>([{ type: 'coins', amount: 150 + Math.floor(R() * 80) }, { type: 'shards', amount: 50, jackerId: jk.id }, { type: 'energy', amount: 30 }, { type: 'seed', foodId: 'sunpear', amount: 2 }])];
      case 'epic':
        return [pick<Reward>([{ type: 'coins', amount: 350 }, { type: 'gems', amount: 10 }, { type: 'egg', rarity: 'rare' }, { type: 'chest', chestId: 'silver' }, { type: 'shards', amount: 120, jackerId: jk.id }])];
      case 'mythic': {
        const skin = SKINS.filter((k) => !k.exclusive && (k.rarity === 'rare' || k.rarity === 'epic') && s.jackers[k.jackerId].unlocked && !s.jackers[k.jackerId].skins.includes(k.id));
        const opts: Reward[] = [{ type: 'gems', amount: 25 }, { type: 'egg', rarity: 'epic' }, { type: 'chest', chestId: 'gold' as ChestId }];
        if (skin.length) opts.push({ type: 'skin', skinId: pick(skin).id });
        return [pick(opts)];
      }
      case 'legendary': {
        const locked = JACKERS.filter((j) => !s.jackers[j.id].unlocked);
        const skin = SKINS.filter((k) => !k.exclusive && (k.rarity === 'legendary' || k.rarity === 'epic') && s.jackers[k.jackerId].unlocked && !s.jackers[k.jackerId].skins.includes(k.id));
        const opts: Reward[] = [{ type: 'gems', amount: 60 }, { type: 'chest', chestId: 'mythic' }, { type: 'egg', rarity: 'legendary' }];
        if (locked.length) opts.push({ type: 'jacker', jackerId: pick(locked).id }, { type: 'jacker', jackerId: pick(locked).id });
        if (skin.length) opts.push({ type: 'skin', skinId: pick(skin).id });
        return [pick(opts)];
      }
    }
  }
  open(): { rarity: DropRarity; steps: DropRarity[]; items: GrantedItem[] } | null {
    const s = this.c.state;
    if (s.starDrops <= 0) return null;
    s.starDrops--;
    const roll = this.rollRarity();
    const items = this.rewards.grant(this.rewardFor(roll.rarity), 'starDrop', true);
    s.stats.starDrops = (s.stats.starDrops ?? 0) + 1;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { ...roll, items };
  }
}

// ================================================================ MASTERY
export const MASTERY_TIERS = [100, 300, 600, 1000, 1600, 2500, 4000, 6000, 9000];
export const MASTERY_NAMES = ['BRONZE I', 'BRONZE II', 'BRONZE III', 'ARGENT I', 'ARGENT II', 'ARGENT III', 'OR I', 'OR II', 'OR III'];
export function masteryReward(tier: number, jackerId: string): Reward[] {
  const j = getJacker(jackerId);
  switch (tier) {
    case 0:
      return [{ type: 'coins', amount: 150 }];
    case 1:
      return [{ type: 'shards', amount: 60, jackerId }];
    case 2:
      return [{ type: 'gems', amount: 10 }];
    case 3:
      return [{ type: 'coins', amount: 400 }, { type: 'shards', amount: 100, jackerId }];
    case 4:
      return [{ type: 'chest', chestId: 'gold' }];
    case 5:
      return [{ type: 'title', title: `Expert ${j.name}` }, { type: 'gems', amount: 20 }];
    case 6:
      return [{ type: 'chest', chestId: 'mythic' }];
    case 7:
      return [{ type: 'gems', amount: 40 }, { type: 'shards', amount: 250, jackerId }];
    default:
      return [{ type: 'title', title: `Maître ${j.name}` }, { type: 'chest', chestId: 'cosmic' }];
  }
}
export class MasterySystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}
  add(jackerId: string, outcome: 'win' | 'loss' | 'draw', mvp: boolean) {
    const jp = this.c.state.jackers[jackerId];
    if (!jp) return 0;
    const pts = (outcome === 'win' ? 24 : outcome === 'draw' ? 12 : 8) + (mvp ? 6 : 0);
    jp.mastery += pts;
    this.c.dirty();
    return pts;
  }
  tier(jackerId: string) {
    const m = this.c.state.jackers[jackerId].mastery;
    return MASTERY_TIERS.filter((t) => m >= t).length;
  }
  claim(jackerId: string, tier: number) {
    const jp = this.c.state.jackers[jackerId];
    if (tier >= this.tier(jackerId) || jp.masteryClaimed.includes(tier)) return null;
    jp.masteryClaimed.push(tier);
    const items = this.rewards.grant(masteryReward(tier, jackerId), 'mastery');
    this.c.bus.emit('changed', undefined);
    return items;
  }
  claimable() {
    let n = 0;
    for (const j of JACKERS) for (let t = 0; t < this.tier(j.id); t++) if (!this.c.state.jackers[j.id].masteryClaimed.includes(t)) n++;
    return n;
  }
}

// ================================================================ CLUB (offline)
const CLUB_NAMES = ['Les Gravitons', 'Nid de Titans', 'Œufs d’Or', 'Team Vortex', 'Les Plumes', 'Sky Raiders', 'Coeurs de Lave', 'Les Givrés', 'Mega Beasts', 'Nova Squad', 'Les Zappeurs', 'Clan Abysse'];
const CLUB_BADGES = ['🛡️', '🐲', '🥚', '🌀', '🪶', '⚡', '🔥', '❄️', '👑', '🌟', '🐾', '🌑'];
const CLUB_COLORS = ['#2bb8ff', '#ff4d6d', '#ffd23a', '#8a4dff', '#4dff7a', '#ff9a3a', '#ff5ad6', '#7ff7ff'];
const MEMBER_NAMES = ['Zorg', 'Pixel', 'Miko', 'Nova', 'Rex', 'Lumi', 'Bolt', 'Kiki', 'Taro', 'Yuzu', 'Momo', 'Juno', 'Rocco', 'Pip', 'Vega', 'Suki', 'Gizmo', 'Nala', 'Orion', 'Bibi', 'Kaito', 'Lola', 'Nuno', 'Pika', 'Riri', 'Sora', 'Tiko', 'Ulla', 'Vivi', 'Wako', 'Xena', 'Yoyo'];
export const CLUB_CHEST_TIERS = [500, 1500, 3000, 6000, 10000];
const CLUB_MSGS = ['Qui pour un BEAST RUSH ?', 'GG à tous cette semaine 🔥', 'Je viens de livrer un TITAN !!', 'Le nouveau mode CORE KING est trop bien', 'Quelqu’un a un conseil pour la BEAST ARENA ?', 'Objectif coffre de club niveau 4 💪', 'Mon compagnon a carry la game 😂', 'ÉVEIL débloqué sur mon main !', 'Attention au Boss Raid en Expert…', 'Bienvenue aux nouveaux 👋', 'Comète LÉGENDAIRE ce matin 😱', 'On push la ligue ce week-end'];

export interface ClubOffer {
  name: string;
  badge: string;
  color: string;
  seed: number;
  members: ClubMember[];
  trophies: number;
  required: number;
}

export class ClubSystem {
  constructor(private c: Ctx, private rewards: RewardSystem, private trophies: () => number) {}
  private makeClub(seed: number): ClubOffer {
    const rng = new Rng(seed);
    const n = 12 + rng.int(0, 13);
    const base = this.trophies();
    const names = rng.shuffle(MEMBER_NAMES.slice());
    const members: ClubMember[] = Array.from({ length: n }, (_, i) => ({
      name: names[i % names.length] + (i >= names.length ? i : ''),
      jacker: rng.pick(JACKERS).id,
      trophies: Math.max(0, Math.round(base * (0.4 + rng.next() * 1.4) + rng.int(0, 800))),
      role: i === 0 ? 'président' : i < 3 ? 'vice' : i < 7 ? 'senior' : 'membre',
    }));
    members.sort((a, b) => b.trophies - a.trophies);
    const k = seed % CLUB_NAMES.length;
    return { name: CLUB_NAMES[k], badge: CLUB_BADGES[k], color: CLUB_COLORS[seed % CLUB_COLORS.length], seed, members, trophies: members.reduce((a, m) => a + m.trophies, 0), required: Math.max(0, Math.round(base * 0.4 / 100) * 100) };
  }
  offers(): ClubOffer[] {
    const w = weekIndex(this.c.now());
    return [0, 1, 2, 3].map((i) => this.makeClub(hashString('club:' + w + ':' + i + ':' + this.c.state.createdAt) % 100000));
  }
  join(o: ClubOffer) {
    const s = this.c.state;
    s.club = { name: o.name, badge: o.badge, color: o.color, seed: o.seed, members: o.members, week: weekIndex(this.c.now()), weekPoints: 0, claimed: [], joinedAt: this.c.now() };
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
  }
  create(name: string, badge: string) {
    const o = this.makeClub(hashString(name + this.c.now()) % 100000);
    this.join({ ...o, name: name.slice(0, 20), badge, members: o.members.slice(0, 6) });
  }
  leave() {
    this.c.state.club = null;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
  }
  /** Weekly reset + simulated contribution of offline teammates. */
  sync() {
    const cl = this.c.state.club;
    if (!cl) return;
    const w = weekIndex(this.c.now());
    if (cl.week !== w) {
      cl.week = w;
      cl.weekPoints = 0;
      cl.claimed = [];
      for (const m of cl.members) m.trophies += Math.round((hashString(m.name + w) % 120) - 20);
    }
    this.c.dirty();
  }
  botPoints() {
    const cl = this.c.state.club;
    if (!cl) return 0;
    const w = weekIndex(this.c.now());
    const dayOfWeek = (dayIndex(this.c.now()) + 3) % 7;
    const hours = dayOfWeek * 24 + new Date(this.c.now()).getHours();
    return cl.members.reduce((a, m) => a + Math.round(((hashString(m.name + ':' + w) % 60) + 20) * (hours / 24)), 0);
  }
  total() {
    const cl = this.c.state.club;
    return cl ? cl.weekPoints + this.botPoints() : 0;
  }
  onMatch(won: boolean, trophies: number) {
    const cl = this.c.state.club;
    if (!cl) return;
    this.sync();
    cl.weekPoints += (won ? 20 : 6) + Math.max(0, trophies);
    this.c.dirty();
  }
  claim(tier: number) {
    const cl = this.c.state.club;
    if (!cl || cl.claimed.includes(tier) || this.total() < CLUB_CHEST_TIERS[tier]) return null;
    cl.claimed.push(tier);
    const rew: Reward[][] = [[{ type: 'coins', amount: 200 }], [{ type: 'chest', chestId: 'silver' }], [{ type: 'chest', chestId: 'gold' }, { type: 'gems', amount: 10 }], [{ type: 'chest', chestId: 'beast' }, { type: 'gems', amount: 15 }], [{ type: 'chest', chestId: 'mythic' }, { type: 'gems', amount: 30 }]];
    const items = this.rewards.grant(rew[tier], 'club');
    this.c.bus.emit('changed', undefined);
    return items;
  }
  feed(): { who: string; text: string; ago: string }[] {
    const cl = this.c.state.club;
    if (!cl) return [];
    const d = dayIndex(this.c.now());
    const rng = new Rng(hashString(cl.name + ':' + d));
    return Array.from({ length: 7 }, (_, i) => ({ who: rng.pick(cl.members).name, text: rng.pick(CLUB_MSGS), ago: `${i * 37 + rng.int(1, 30)} min` }));
  }
  /** Club league ranking among simulated clubs. */
  league() {
    const cl = this.c.state.club;
    const w = weekIndex(this.c.now());
    const rows = CLUB_NAMES.filter((n) => n !== cl?.name)
      .slice(0, 9)
      .map((n) => ({ name: n, badge: CLUB_BADGES[CLUB_NAMES.indexOf(n)], points: Math.round((hashString(n + w) % 6000) * ((((dayIndex(this.c.now()) + 3) % 7) + 1) / 7)), me: false }));
    if (cl) rows.push({ name: cl.name, badge: cl.badge, points: this.total(), me: true });
    return rows.sort((a, b) => b.points - a.points);
  }
}

// ================================================================ LADDER (offline leaderboard)
export class LadderSystem {
  constructor(private c: Ctx, private trophies: () => number, private name: () => string) {}
  rows(limit = 100) {
    const si = seasonInfo(this.c.now());
    const progress = Math.min(1, (this.c.now() - si.start) / (si.end - si.start));
    const rng = new Rng(hashString('ladder:' + si.index));
    const out: { rank: number; name: string; jacker: string; trophies: number; me: boolean }[] = [];
    for (let i = 0; i < 300; i++) {
      const top = Math.pow(rng.next(), 2.2);
      out.push({ rank: 0, name: MEMBER_NAMES[i % MEMBER_NAMES.length] + (i >= MEMBER_NAMES.length ? '_' + i : ''), jacker: rng.pick(JACKERS).id, trophies: Math.round((800 + top * 24000) * (0.55 + progress * 0.45)), me: false });
    }
    out.push({ rank: 0, name: this.name(), jacker: this.c.state.profile.selectedJacker, trophies: this.trophies(), me: true });
    out.sort((a, b) => b.trophies - a.trophies);
    out.forEach((r, i) => (r.rank = i + 1));
    const me = out.find((r) => r.me)!;
    return { top: out.slice(0, limit), me, total: out.length };
  }
}

// ================================================================ BEAST ARENA (creature battles)
export interface Fighter {
  key: string;
  side: 0 | 1;
  speciesId: string;
  name: string;
  element: Element;
  stage: number;
  mutation: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  turn: number;
}
export interface BattleEvent {
  round: number;
  actor: string;
  target: string[];
  skill: string;
  power: number;
  dmg: number[];
  crit: boolean;
  eff: number;
  ko: string[];
}
export interface BattleResult {
  fighters: Fighter[];
  events: BattleEvent[];
  winner: 0 | 1;
}
export const ARENA_FLOORS = 30;

export class BattleSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}
  private ensureDay() {
    const b = this.c.state.battle;
    const d = dayIndex(this.c.now());
    if (b.day !== d) {
      b.day = d;
      b.winsToday = 0;
    }
  }
  enemyTeam(floor: number): Fighter[] {
    const rng = new Rng(hashString('floor:' + floor));
    const maxR = Math.min(6, Math.floor(floor / 5));
    const pool = BEASTS.filter((b) => RARITIES.indexOf(b.rarity) <= maxR);
    const n = floor < 3 ? 2 : 3;
    const stage = Math.min(4, Math.floor(floor / 7));
    const level = Math.min(40, 1 + Math.round(floor * 1.25));
    return Array.from({ length: n }, (_, i) => {
      const sp = rng.pick(pool);
      return this.fighter(`e${i}`, 1, { uid: '', speciesId: sp.id, level, xp: 0, stage, mutation: 'none', obtainedAt: 0, favorite: false, breedReadyAt: 0 }, 1 + floor * 0.03);
    });
  }
  fighter(key: string, side: 0 | 1, b: { uid: string; speciesId: string; level: number; xp: number; stage: number; mutation: any; obtainedAt: number; favorite: boolean; breedReadyAt: number }, mult = 1): Fighter {
    const sp = getBeast(b.speciesId);
    const st = beastStats(b as any);
    return { key, side, speciesId: sp.id, name: b.stage >= 3 ? sp.forms[b.stage] : sp.name, element: sp.element, stage: b.stage, mutation: b.mutation, level: b.level, hp: Math.round(st.hp * mult), maxHp: Math.round(st.hp * mult), atk: Math.round(st.atk * mult), def: Math.round(st.def * mult), spd: st.spd, turn: 0 };
  }
  /** Deterministic auto-battle. */
  simulate(team: string[], floor: number, seed = floor * 7919): BattleResult | null {
    const s = this.c.state;
    const mine = team.map((u) => s.beasts.find((b) => b.uid === u)).filter(Boolean) as any[];
    if (!mine.length) return null;
    const rng = new Rng(seed);
    const fighters: Fighter[] = [...mine.map((b, i) => this.fighter(`p${i}`, 0, b)), ...this.enemyTeam(floor)];
    const events: BattleEvent[] = [];
    const alive = (side: number) => fighters.filter((f) => f.side === side && f.hp > 0);
    for (let round = 1; round <= 30 && alive(0).length && alive(1).length; round++) {
      const order = fighters.filter((f) => f.hp > 0).sort((a, b) => b.spd - a.spd || a.key.localeCompare(b.key));
      for (const f of order) {
        if (f.hp <= 0) continue;
        const foes = alive(1 - f.side);
        if (!foes.length) break;
        f.turn++;
        const sp = getBeast(f.speciesId);
        let skill = sp.skills[0],
          aoe = false;
        if (f.stage >= 3 && f.turn % 4 === 0) {
          skill = sp.skills[2];
          aoe = true;
        } else if (f.stage >= 2 && f.turn % 3 === 0) skill = sp.skills[1];
        const targets = aoe ? foes : [foes.sort((a, b) => a.hp - b.hp)[0]];
        const ev: BattleEvent = { round, actor: f.key, target: targets.map((t) => t.key), skill: skill.name, power: skill.power, dmg: [], crit: false, eff: 1, ko: [] };
        for (const t of targets) {
          const eff = elementMultiplier(f.element, t.element);
          const crit = rng.chance(0.1);
          const dmg = Math.max(1, Math.round(f.atk * skill.power * (aoe ? 0.7 : 1) * eff * (100 / (100 + t.def)) * (0.9 + rng.next() * 0.2) * (crit ? 1.5 : 1) * 2.4));
          t.hp = Math.max(0, t.hp - dmg);
          ev.dmg.push(dmg);
          ev.crit ||= crit;
          ev.eff = eff;
          if (t.hp <= 0) ev.ko.push(t.key);
        }
        events.push(ev);
      }
    }
    let winner: 0 | 1;
    if (!alive(1).length) winner = 0;
    else if (!alive(0).length) winner = 1;
    else {
      const pct = (side: number) => fighters.filter((f) => f.side === side).reduce((a, f) => a + f.hp / f.maxHp, 0);
      winner = pct(0) >= pct(1) ? 0 : 1;
    }
    // reset hp for replay display
    const result = { fighters: fighters.map((f) => ({ ...f, hp: f.maxHp })), events, winner };
    return result;
  }
  floorReward(floor: number): Reward[] {
    if (floor % 10 === 0) return [{ type: 'chest', chestId: floor >= 30 ? 'cosmic' : 'mythic' }, { type: 'gems', amount: 20 }];
    if (floor % 5 === 0) return [{ type: 'egg', rarity: floor >= 20 ? 'legendary' : floor >= 10 ? 'epic' : 'rare' }, { type: 'energy', amount: 40 }];
    return [{ type: 'energy', amount: 10 + floor * 2 }, { type: 'coins', amount: 60 + floor * 10 }];
  }
  /** Fight the current floor; grants rewards on first clear. */
  fight(team: string[]): { result: BattleResult; items: GrantedItem[]; floor: number } | null {
    this.ensureDay();
    const b = this.c.state.battle;
    const floor = Math.min(b.floor, ARENA_FLOORS);
    const result = this.simulate(team, floor, hashString(team.join() + ':' + floor + ':' + b.winsToday + ':' + this.c.now()));
    if (!result) return null;
    b.team = team.slice(0, 3);
    let items: GrantedItem[] = [];
    if (result.winner === 0) {
      b.winsToday++;
      this.c.state.stats.battleWins = (this.c.state.stats.battleWins ?? 0) + 1;
      if (floor >= b.floor) {
        items = this.rewards.grant(this.floorReward(floor), 'battle', true);
        b.best = Math.max(b.best, floor);
        if (b.floor < ARENA_FLOORS) b.floor++;
        else items.push(...this.rewards.grant([{ type: 'energy', amount: 30 }], 'battle', true));
      }
      // XP for the creatures who fought
      for (const u of team) {
        const be = this.c.state.beasts.find((x) => x.uid === u);
        if (be) (this as any).xpHook?.(be, 30 + floor * 4);
      }
    }
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { result, items, floor };
  }
}

export const STAGE_NAMES = STAGES.map((s) => STAGE_INFO[s].name);
export { DAY };
