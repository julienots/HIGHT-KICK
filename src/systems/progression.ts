import { ARENAS } from '../data/arenas';
import { CAMPAIGN } from '../data/campaign';
import { GADGET_LEVEL, MAX_JACKER_LEVEL, playerXpForLevel, SPECIAL_LEVEL, STARPOWER_LEVEL, upgradeCost, type Reward } from '../data/economy';
import { getJacker, JACKERS } from '../data/jackers';
import { MODES, type ModeId, type Difficulty, DIFFICULTY_INFO } from '../data/modes';
import { seasonInfo } from '../data/seasons';
import { dayIndex } from '../core/time';
import type { Ctx, GrantedItem } from './ctx';
import type { RewardSystem } from './rewards';

export interface TrophyRoadStep {
  trophies: number;
  reward: Reward;
}

/** Trophy road: unlocks Jackers at their threshold + chests/gems in between. */
export const TROPHY_ROAD: TrophyRoadStep[] = (() => {
  const steps: TrophyRoadStep[] = [];
  for (const j of JACKERS) if (j.unlockTrophies > 0) steps.push({ trophies: j.unlockTrophies, reward: { type: 'jacker', jackerId: j.id } });
  const extra: [number, Reward][] = [
    [20, { type: 'chest', chestId: 'wood' }], [40, { type: 'coins', amount: 100 }], [80, { type: 'chest', chestId: 'silver' }],
    [150, { type: 'egg', rarity: 'rare' }], [250, { type: 'gems', amount: 20 }], [350, { type: 'chest', chestId: 'gold' }],
    [550, { type: 'chest', chestId: 'beast' }], [750, { type: 'gems', amount: 30 }], [900, { type: 'egg', rarity: 'epic' }],
    [1200, { type: 'chest', chestId: 'mythic' }], [1400, { type: 'gems', amount: 40 }], [1800, { type: 'chest', chestId: 'beast' }],
    [2100, { type: 'egg', rarity: 'legendary' }], [2400, { type: 'chest', chestId: 'cosmic' }], [3000, { type: 'chest', chestId: 'cosmic' }],
  ];
  for (const [t, r] of extra) steps.push({ trophies: t, reward: r });
  return steps.sort((a, b) => a.trophies - b.trophies);
})();

export interface MatchResultInput {
  mode: ModeId;
  arena: string;
  jackerId: string;
  difficulty: Difficulty;
  outcome: 'win' | 'loss' | 'draw';
  kills: number;
  deaths: number;
  damage: number;
  healing: number;
  eggsDelivered: number;
  pointsDelivered: number;
  titansDelivered: number;
  nodesActivated: number;
  supersUsed: number;
  wildCaptured: number;
  bossKilled: boolean;
  portalsUsed: number;
  jumpPads: number;
  mvp: boolean;
  /** species delivered by the player (best one) -> egg reward */
  bestEgg?: { speciesId: string; phase: number };
  campaignLevel?: string;
  stars?: number;
  eventId?: string;
}

export interface MatchRewards {
  coins: number;
  xp: number;
  passXp: number;
  trophies: number;
  chest?: string;
  egg?: string;
  levelUp?: number;
  firstClear?: Reward;
  starsGained: number;
}

export class ProgressionSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}

  addStat(key: string, n = 1) {
    const s = this.c.state;
    s.stats[key] = (s.stats[key] ?? 0) + n;
    this.c.bus.emit('stat', { key, total: s.stats[key] });
  }

  /** Includes derived stats (collection counts, trophies...). */
  stat(key: string): number {
    const s = this.c.state;
    switch (key) {
      case 'trophies':
        return this.totalTrophies();
      case 'beastsOwned':
        return s.beasts.length;
      case 'speciesOwned':
        return new Set(s.beasts.map((b) => b.speciesId)).size;
      case 'titanBeasts':
        return s.beasts.filter((b) => b.stage >= 4).length;
      case 'jackersOwned':
        return JACKERS.filter((j) => s.jackers[j.id].unlocked).length;
      case 'jackersMaxLevel':
        return JACKERS.filter((j) => s.jackers[j.id].level >= MAX_JACKER_LEVEL).length;
      case 'skinsOwned':
        return JACKERS.reduce((a, j) => a + s.jackers[j.id].skins.length - 1, 0);
      case 'playerLevel':
        return s.level;
      case 'arenasPlayed':
        return s.seen.arenas.length;
      case 'modesPlayed':
        return s.seen.modes.length;
      case 'campaignStars':
        return Object.values(s.campaign).reduce((a, b) => a + b, 0);
      default:
        return s.stats[key] ?? 0;
    }
  }

  totalTrophies() {
    const s = this.c.state;
    return JACKERS.reduce((a, j) => a + s.jackers[j.id].trophies, 0);
  }

  addXp(xp: number): number | undefined {
    const s = this.c.state;
    s.xp += xp;
    let up: number | undefined;
    while (s.xp >= playerXpForLevel(s.level)) {
      s.xp -= playerXpForLevel(s.level);
      s.level++;
      up = s.level;
      this.rewards.grant([{ type: 'coins', amount: 50 + s.level * 10 }, ...(s.level % 5 === 0 ? [{ type: 'chest', chestId: 'gold' } as Reward] : [{ type: 'chest', chestId: 'wood' } as Reward])], 'level', true);
      this.c.bus.emit('levelUp', { level: s.level });
      for (const m of MODES) if (m.unlockLevel === s.level) this.c.bus.emit('unlock', { kind: 'mode', id: m.id });
    }
    this.c.dirty();
    return up;
  }

  modeUnlocked(id: ModeId) {
    const m = MODES.find((x) => x.id === id)!;
    return this.c.state.level >= m.unlockLevel;
  }
  arenaUnlocked(id: string) {
    const a = ARENAS.find((x) => x.id === id);
    return !!a && this.totalTrophies() >= a.unlockTrophies;
  }

  // -------- Jacker upgrades & loadout --------
  upgradeInfo(jackerId: string) {
    const jp = this.c.state.jackers[jackerId];
    const cost = upgradeCost(jp.level);
    const shardsAvail = jp.shards + this.c.state.currencies.shards;
    const maxed = jp.level >= MAX_JACKER_LEVEL;
    return { cost, maxed, canAfford: !maxed && jp.unlocked && this.c.state.currencies.coins >= cost.coins && shardsAvail >= cost.shards };
  }
  upgrade(jackerId: string) {
    const s = this.c.state;
    const jp = s.jackers[jackerId];
    const info = this.upgradeInfo(jackerId);
    if (!info.canAfford) return false;
    s.currencies.coins -= info.cost.coins;
    const fromJ = Math.min(jp.shards, info.cost.shards);
    jp.shards -= fromJ;
    s.currencies.shards -= info.cost.shards - fromJ;
    jp.level++;
    this.addStat('upgrades');
    if (jp.level === GADGET_LEVEL || jp.level === STARPOWER_LEVEL || jp.level === SPECIAL_LEVEL) this.c.bus.emit('toast', { text: `${getJacker(jackerId).name} : nouveau choix de loadout débloqué !`, icon: '✨' });
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }
  setLoadout(jackerId: string, slot: 'gadget' | 'starPower' | 'special', v: 0 | 1) {
    const jp = this.c.state.jackers[jackerId];
    jp[slot] = v;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
  }
  buyJacker(jackerId: string) {
    const s = this.c.state;
    const jp = s.jackers[jackerId];
    const price = this.jackerPrice(jackerId);
    if (jp.unlocked || s.currencies.gems < price) return false;
    s.currencies.gems -= price;
    this.rewards.grant([{ type: 'jacker', jackerId }], 'shop');
    this.c.bus.emit('changed', undefined);
    return true;
  }
  jackerPrice(jackerId: string) {
    return 49 + Math.round(getJacker(jackerId).unlockTrophies / 20) * 5;
  }

  trophyDelta(trophies: number, outcome: 'win' | 'loss' | 'draw', difficulty: Difficulty) {
    const dm = { easy: 0.6, normal: 1, hard: 1.2, expert: 1.4, master: 1.6 }[difficulty];
    if (outcome === 'win') return Math.max(3, Math.round((10 - Math.floor(trophies / 150)) * dm));
    if (outcome === 'loss') return trophies < 40 ? 0 : -Math.min(9, 1 + Math.floor(trophies / 120));
    return 0;
  }

  claimTrophyRoad(index: number) {
    const step = TROPHY_ROAD[index];
    const s = this.c.state;
    if (!step || s.trophyRoad.includes(index) || this.totalTrophies() < step.trophies) return null;
    s.trophyRoad.push(index);
    const items = this.rewards.grant([step.reward], 'trophyRoad');
    this.c.bus.emit('changed', undefined);
    return items;
  }

  /** Apply the outcome of a match: currencies, XP, trophies, stats, chest/egg drops. */
  applyMatch(r: MatchResultInput, addPassXp: (n: number) => void): MatchRewards {
    const s = this.c.state;
    const jp = s.jackers[r.jackerId];
    const dm = DIFFICULTY_INFO[r.difficulty].rewardMult;
    const win = r.outcome === 'win';
    const coins = Math.round(((win ? 40 : r.outcome === 'draw' ? 25 : 15) + r.kills * 2 + r.pointsDelivered * 2) * dm);
    const xp = Math.round((30 + (win ? 25 : 0) + (r.mvp ? 15 : 0) + r.kills * 2) * (0.8 + dm * 0.2));
    const passXp = Math.round((40 + (win ? 35 : 0) + (r.mvp ? 10 : 0)) * (0.8 + dm * 0.2));
    const isCampaign = !!r.campaignLevel;
    const trophies = isCampaign ? 0 : this.trophyDelta(jp.trophies, r.outcome, r.difficulty);
    jp.trophies = Math.max(0, jp.trophies + trophies);
    jp.highest = Math.max(jp.highest, jp.trophies);
    jp.matches++;
    if (win) jp.wins++;
    s.currencies.coins += coins;
    this.addStat('earned_coins', coins);
    // stats
    this.addStat('matches');
    if (win) this.addStat('wins');
    else if (r.outcome === 'loss') this.addStat('losses');
    else this.addStat('draws');
    if (win) this.addStat('wins_' + r.mode);
    this.addStat('matches_' + r.mode);
    if (win && r.mode === 'duel') this.addStat('duelWins');
    if (win && r.mode === 'survival') this.addStat('survivalWins');
    this.addStat('kills', r.kills);
    this.addStat('deaths', r.deaths);
    this.addStat('damage', Math.round(r.damage));
    this.addStat('healing', Math.round(r.healing));
    this.addStat('eggsDelivered', r.eggsDelivered);
    this.addStat('pointsDelivered', r.pointsDelivered);
    this.addStat('titansDelivered', r.titansDelivered);
    this.addStat('nodesActivated', r.nodesActivated);
    this.addStat('supersUsed', r.supersUsed);
    this.addStat('wildCaptured', r.wildCaptured);
    this.addStat('portalsUsed', r.portalsUsed);
    this.addStat('jumpPads', r.jumpPads);
    if (r.bossKilled) this.addStat('bossesKilled');
    if (r.mvp) this.addStat('mvp');
    if (!s.seen.arenas.includes(r.arena)) s.seen.arenas.push(r.arena);
    if (!s.seen.modes.includes(r.mode)) s.seen.modes.push(r.mode);

    const out: MatchRewards = { coins, xp, passXp, trophies, starsGained: 0 };
    // chest every 2 wins
    if (win) {
      this.addStat('winStreakChest');
      if ((s.stats.winStreakChest ?? 0) % 2 === 0) {
        const roll = this.c.rand();
        const chest = roll < 0.03 * dm ? 'mythic' : roll < 0.15 * dm ? 'gold' : roll < 0.3 ? 'beast' : roll < 0.6 ? 'silver' : 'wood';
        s.chests.push(chest as any);
        out.chest = chest;
      }
    }
    // egg from the best creature delivered by the player
    if (r.bestEgg && (win || r.bestEgg.phase >= 3)) {
      const egg = this.rewards.makeEgg('common', r.bestEgg.speciesId, 'match');
      s.eggs.push(egg);
      out.egg = egg.speciesId;
    }
    // campaign
    if (r.campaignLevel && r.stars) {
      const prev = s.campaign[r.campaignLevel] ?? 0;
      if (r.stars > prev) {
        out.starsGained = r.stars - prev;
        s.campaign[r.campaignLevel] = r.stars;
        if (prev === 0) {
          const lvl = CAMPAIGN.find((c) => c.id === r.campaignLevel);
          if (lvl) {
            this.rewards.grant([lvl.reward], 'campaign', true);
            out.firstClear = lvl.reward;
          }
        }
      }
    }
    out.levelUp = this.addXp(xp);
    addPassXp(passXp);
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return out;
  }

  /** Daily login streak + season rollover (partial trophy reset). */
  dailyCheck() {
    const s = this.c.state;
    const today = dayIndex(this.c.now());
    let gift: GrantedItem[] | null = null;
    if (s.lastDay !== today) {
      s.streak = s.lastDay === today - 1 ? s.streak + 1 : 1;
      s.lastDay = today;
      const d = ((s.streak - 1) % 7) + 1;
      const rewards: Reward[] = d === 7 ? [{ type: 'chest', chestId: 'gold' }, { type: 'gems', amount: 10 }] : [{ type: 'coins', amount: 40 + d * 20 }, ...(d % 3 === 0 ? [{ type: 'energy', amount: 15 } as Reward] : [])];
      gift = this.rewards.grant(rewards, 'daily', true);
      this.addStat('playDays');
    }
    const season = seasonInfo(this.c.now());
    let reset: { coins: number; lost: number } | null = null;
    if (s.seasonSeen >= 0 && s.seasonSeen < season.index) {
      let lost = 0;
      for (const j of JACKERS) {
        const jp = s.jackers[j.id];
        if (jp.trophies > 500) {
          const cut = Math.floor((jp.trophies - 500) * 0.4);
          jp.trophies -= cut;
          lost += cut;
        }
      }
      const coins = Math.round(lost * 1.5);
      s.currencies.coins += coins;
      reset = { coins, lost };
    }
    s.seasonSeen = season.index;
    this.c.dirty();
    return { gift, streak: s.streak, reset };
  }
}
