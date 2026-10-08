import { BEASTS, getBeast } from '../data/beasts';
import { CHESTS, CURRENCY_INFO, FOOD_MAP, type ChestId, type Reward } from '../data/economy';
import { getJacker, JACKERS } from '../data/jackers';
import { RARITIES, RARITY_INFO, type Rarity } from '../data/rarities';
import { SKIN_MAP, SKIN_RARITY_INFO, SKINS } from '../data/skins';
import type { Ctx, GrantedItem } from './ctx';
import type { EggInstance, Mutation } from './state';

export function pickWeighted<T extends string>(rand: () => number, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export const HATCH_MINUTES: Record<Rarity, number> = { common: 1, rare: 3, epic: 10, mythic: 30, legendary: 60, ancient: 120, celestial: 240 };

/** RewardSystem: the single place where anything is given to the player. */
export class RewardSystem {
  constructor(private c: Ctx) {}

  uid(prefix: string) {
    this.c.state.uidCounter++;
    return prefix + this.c.state.uidCounter.toString(36) + Math.floor(this.c.rand() * 1e6).toString(36);
  }

  randomSpecies(rarity?: Rarity, element?: string) {
    let pool = BEASTS.filter((b) => (!rarity || b.rarity === rarity) && (!element || b.element === element));
    if (!pool.length) pool = BEASTS.filter((b) => !rarity || b.rarity === rarity);
    if (!pool.length) pool = BEASTS;
    return pool[Math.floor(this.c.rand() * pool.length)];
  }

  rollMutation(bonus = 0): Mutation {
    const r = this.c.rand();
    if (r < 0.02 + bonus * 0.5) return 'prism';
    if (r < 0.05 + bonus) return 'shiny';
    if (r < 0.08 + bonus) return 'giant';
    if (r < 0.1 + bonus) return 'shadow';
    return 'none';
  }

  makeEgg(rarity: Rarity, speciesId: string | undefined, source: EggInstance['source'], mutation?: Mutation): EggInstance {
    const sp = speciesId ? getBeast(speciesId) : this.randomSpecies(rarity);
    return { uid: this.uid('e'), rarity: sp.rarity, speciesId: sp.id, mutation: mutation ?? this.rollMutation(), source, hatchAt: 0, incubating: false };
  }

  grant(rewards: Reward[], source: string, silent = false): GrantedItem[] {
    const s = this.c.state;
    const out: GrantedItem[] = [];
    for (const r of rewards) {
      switch (r.type) {
        case 'coins':
        case 'gems':
        case 'energy': {
          s.currencies[r.type] += r.amount;
          const ci = CURRENCY_INFO[r.type];
          out.push({ reward: r, label: `+${r.amount}`, icon: ci.icon, color: ci.color });
          s.stats['earned_' + r.type] = (s.stats['earned_' + r.type] ?? 0) + r.amount;
          break;
        }
        case 'shards': {
          if (r.jackerId && s.jackers[r.jackerId]) {
            s.jackers[r.jackerId].shards += r.amount;
            out.push({ reward: r, label: `+${r.amount} ${getJacker(r.jackerId).name}`, icon: '🧬', color: CURRENCY_INFO.shards.color });
          } else {
            s.currencies.shards += r.amount;
            out.push({ reward: r, label: `+${r.amount}`, icon: '🧬', color: CURRENCY_INFO.shards.color });
          }
          break;
        }
        case 'jacker': {
          const jp = s.jackers[r.jackerId];
          if (!jp) break;
          const j = getJacker(r.jackerId);
          if (jp.unlocked) {
            jp.shards += 60;
            out.push({ reward: { type: 'shards', amount: 60, jackerId: j.id }, label: `${j.name} (doublon) +60`, icon: '🧬', color: '#c45cff' });
          } else {
            jp.unlocked = true;
            out.push({ reward: r, label: j.name, icon: '🧑‍🚀', color: '#ffd23a', isNew: true });
            this.c.bus.emit('unlock', { kind: 'jacker', id: j.id });
          }
          break;
        }
        case 'skin': {
          const sk = SKIN_MAP[r.skinId];
          if (!sk) break;
          const jp = s.jackers[sk.jackerId];
          if (jp.skins.includes(sk.id)) {
            s.currencies.coins += 200;
            out.push({ reward: { type: 'coins', amount: 200 }, label: `${sk.name} (doublon) +200`, icon: '🪙', color: '#ffd23a' });
          } else {
            jp.skins.push(sk.id);
            out.push({ reward: r, label: sk.name, icon: '🎨', color: SKIN_RARITY_INFO[sk.rarity].color, rarity: sk.rarity, isNew: true });
            this.c.bus.emit('unlock', { kind: 'skin', id: sk.id });
          }
          break;
        }
        case 'beast': {
          const sp = r.beastId ? getBeast(r.beastId) : this.randomSpecies(r.rarity);
          const isNew = !s.beasts.some((b) => b.speciesId === sp.id);
          const mutation = this.rollMutation();
          s.beasts.push({ uid: this.uid('b'), speciesId: sp.id, level: 1, xp: 0, stage: 0, mutation, obtainedAt: this.c.now(), favorite: false, breedReadyAt: 0 });
          out.push({ reward: { type: 'beast', beastId: sp.id }, label: sp.name + (mutation !== 'none' ? ` ✦${mutation.toUpperCase()}` : ''), icon: '🐾', color: RARITY_INFO[sp.rarity].color, rarity: sp.rarity, isNew });
          s.stats.beastsHatched = (s.stats.beastsHatched ?? 0) + 0; // hatch counted only via eggs
          break;
        }
        case 'egg': {
          const egg = this.makeEgg(r.rarity, undefined, 'reward');
          s.eggs.push(egg);
          out.push({ reward: r, label: `Œuf ${RARITY_INFO[egg.rarity].name}`, icon: '🥚', color: RARITY_INFO[egg.rarity].color, rarity: egg.rarity });
          break;
        }
        case 'chest': {
          s.chests.push(r.chestId);
          out.push({ reward: r, label: CHESTS[r.chestId].name, icon: '🎁', color: CHESTS[r.chestId].color });
          break;
        }
        case 'food': {
          s.food[r.foodId] = (s.food[r.foodId] ?? 0) + r.amount;
          const f = FOOD_MAP[r.foodId];
          out.push({ reward: r, label: `+${r.amount} ${f?.name ?? r.foodId}`, icon: f?.icon ?? '🍖', color: '#ff9a3a' });
          break;
        }
        case 'seed': {
          s.seeds[r.foodId] = (s.seeds[r.foodId] ?? 0) + r.amount;
          const f = FOOD_MAP[r.foodId];
          out.push({ reward: r, label: `+${r.amount} graines ${f?.name ?? ''}`, icon: '🌱', color: '#4dff7a' });
          break;
        }
        case 'xp':
          out.push({ reward: r, label: `+${r.amount} XP`, icon: '📈', color: '#7ff7ff' });
          break; // handled by progression (caller)
        case 'passXp':
          out.push({ reward: r, label: `+${r.amount} Pass XP`, icon: '🎟️', color: '#ffb000' });
          break;
        case 'title':
          if (!s.profile.titles.includes(r.title)) s.profile.titles.push(r.title);
          out.push({ reward: r, label: `Titre « ${r.title} »`, icon: '🏷️', color: '#ffd23a', isNew: true });
          break;
        case 'emote':
          if (!s.profile.emotes.includes(r.emote)) s.profile.emotes.push(r.emote);
          out.push({ reward: r, label: 'Emote', icon: r.emote, color: '#ff8ad8', isNew: true });
          break;
      }
    }
    this.c.dirty();
    if (!silent && out.length) this.c.bus.emit('granted', { items: out, source });
    return out;
  }

  /** Roll the content of a chest (pure, uses ctx rng). */
  rollChest(id: ChestId): Reward[] {
    const def = CHESTS[id];
    const s = this.c.state;
    const R = this.c.rand;
    const between = (a: number, b: number) => Math.round(a + (b - a) * R());
    const out: Reward[] = [{ type: 'coins', amount: between(...def.coins) }];
    const owned = JACKERS.filter((j) => s.jackers[j.id].unlocked);
    // split shards across 1-2 owned jackers
    const sh = between(...def.shards);
    const j1 = owned[Math.floor(R() * owned.length)];
    if (owned.length > 1 && R() < 0.5) {
      const j2 = owned[Math.floor(R() * owned.length)];
      out.push({ type: 'shards', amount: Math.ceil(sh * 0.6), jackerId: j1.id }, { type: 'shards', amount: Math.floor(sh * 0.4), jackerId: j2.id });
    } else out.push({ type: 'shards', amount: sh, jackerId: j1.id });
    for (let i = 0; i < def.rolls - 2; i++) {
      const roll = R();
      if (roll < 0.4) out.push({ type: 'energy', amount: between(5, 15) * (1 + CHEST_TIER(id)) });
      else if (roll < 0.7) out.push({ type: 'food', foodId: ['berry', 'chili', 'kelp', 'zapfruit', 'snowmelon', 'cloudpuff', 'rootnut', 'sunpear', 'shadeplum', 'stardrop'][Math.floor(R() * (4 + CHEST_TIER(id) * 1.2))] ?? 'berry', amount: between(1, 3) });
      else out.push({ type: 'seed', foodId: ['berry', 'chili', 'kelp', 'zapfruit', 'snowmelon', 'cloudpuff', 'rootnut', 'sunpear'][Math.floor(R() * 8)], amount: between(1, 3) });
    }
    if (R() < def.gemChance) out.push({ type: 'gems', amount: between(...def.gems) });
    if (R() < def.beastChance) {
      const rar = pickWeighted<Rarity>(R, def.rarityWeights);
      if (R() < 0.5) out.push({ type: 'egg', rarity: rar });
      else out.push({ type: 'beast', rarity: rar });
    }
    if (R() < def.jackerChance) {
      const locked = JACKERS.filter((j) => !s.jackers[j.id].unlocked);
      if (locked.length) out.push({ type: 'jacker', jackerId: locked[Math.floor(R() * locked.length)].id });
    }
    if (R() < def.skinChance) {
      const avail = SKINS.filter((k) => !k.exclusive && s.jackers[k.jackerId].unlocked && !s.jackers[k.jackerId].skins.includes(k.id));
      if (avail.length) out.push({ type: 'skin', skinId: avail[Math.floor(R() * avail.length)].id });
    }
    return out;
  }

  openChest(index: number) {
    const s = this.c.state;
    const id = s.chests[index];
    if (!id) return null;
    s.chests.splice(index, 1);
    const rewards = this.rollChest(id);
    s.stats.chestsOpened = (s.stats.chestsOpened ?? 0) + 1;
    const items = this.grant(rewards, 'chest:' + id, true);
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return { id, items };
  }
}

export const CHEST_TIER = (id: ChestId) => ['wood', 'silver', 'gold', 'beast', 'mythic', 'cosmic'].indexOf(id);
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
