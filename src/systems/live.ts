import { ACHIEVEMENTS } from '../data/achievements';
import { BEASTS } from '../data/beasts';
import { CHESTS, FOODS, type ChestId, type Reward } from '../data/economy';
import { JACKERS } from '../data/jackers';
import { QUEST_KIND_INFO, QUEST_POOL, type QuestKind } from '../data/quests';
import { RARITY_INFO } from '../data/rarities';
import { currentEvents, PASS_PREMIUM_PRICE, PASS_TIERS, PASS_XP_PER_TIER, passTiers, seasonInfo, type PassTier } from '../data/seasons';
import { SKIN_RARITY_INFO, SKINS } from '../data/skins';
import { Rng, hashString } from '../core/rng';
import { dayIndex, weekIndex } from '../core/time';
import type { Ctx } from './ctx';
import type { ProgressionSystem } from './progression';
import type { RewardSystem } from './rewards';

// ============================ QUESTS ============================
export class QuestSystem {
  constructor(private c: Ctx, private prog: ProgressionSystem, private rewards: RewardSystem, private pass: PassSystem) {}

  private keyFor(kind: QuestKind) {
    const t = this.c.now();
    const season = seasonInfo(t).index;
    switch (kind) {
      case 'daily':
      case 'combat':
        return dayIndex(t);
      case 'weekly':
      case 'beast':
      case 'exploration':
        return weekIndex(t);
      case 'season':
        return season;
    }
  }

  refresh() {
    const s = this.c.state;
    for (const kind of Object.keys(QUEST_KIND_INFO) as QuestKind[]) {
      const key = this.keyFor(kind);
      const b = s.quests[kind];
      if (b && b.key === key) continue;
      const rng = new Rng(hashString(kind + ':' + key + ':' + s.createdAt));
      const pool = rng.shuffle(QUEST_POOL.filter((q) => q.kind === kind));
      s.quests[kind] = { key, list: pool.slice(0, QUEST_KIND_INFO[kind].count).map((q) => ({ tid: q.id, base: this.prog.stat(q.stat), claimed: false })) };
    }
    this.c.dirty();
  }

  list(kind: QuestKind) {
    const b = this.c.state.quests[kind];
    if (!b) return [];
    return b.list
      .map((e) => {
        const t = QUEST_POOL.find((q) => q.id === e.tid);
        if (!t) return null;
        const progress = Math.max(0, Math.min(t.target, this.prog.stat(t.stat) - e.base));
        return { entry: e, tpl: t, progress, done: progress >= t.target };
      })
      .filter(Boolean) as { entry: { tid: string; base: number; claimed: boolean }; tpl: (typeof QUEST_POOL)[number]; progress: number; done: boolean }[];
  }

  claim(kind: QuestKind, tid: string) {
    const q = this.list(kind).find((x) => x.entry.tid === tid);
    if (!q || !q.done || q.entry.claimed) return null;
    q.entry.claimed = true;
    const items = this.rewards.grant([...q.tpl.reward, { type: 'passXp', amount: q.tpl.passXp }], 'quest');
    this.pass.addXp(q.tpl.passXp);
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return items;
  }

  claimable() {
    let n = 0;
    for (const kind of Object.keys(QUEST_KIND_INFO) as QuestKind[]) n += this.list(kind).filter((q) => q.done && !q.entry.claimed).length;
    return n;
  }
}

// ============================ ACHIEVEMENTS ============================
export class AchievementSystem {
  constructor(private c: Ctx, private prog: ProgressionSystem, private rewards: RewardSystem) {}
  list() {
    return ACHIEVEMENTS.map((a) => {
      const progress = Math.min(a.target, this.prog.stat(a.stat));
      return { def: a, progress, done: progress >= a.target, claimed: this.c.state.achievements.includes(a.id) };
    });
  }
  claim(id: string) {
    const a = this.list().find((x) => x.def.id === id);
    if (!a || !a.done || a.claimed) return null;
    this.c.state.achievements.push(id);
    if (!this.c.state.profile.badges.includes(a.def.icon)) this.c.state.profile.badges.push(a.def.icon);
    const items = this.rewards.grant(a.def.reward, 'achievement');
    this.c.bus.emit('changed', undefined);
    return items;
  }
  claimable() {
    return this.list().filter((a) => a.done && !a.claimed).length;
  }
}

// ============================ SUPER PASS ============================
export class PassSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}
  ensureSeason() {
    const idx = seasonInfo(this.c.now()).index;
    const p = this.c.state.pass;
    if (p.season !== idx) {
      this.c.state.pass = { season: idx, xp: 0, premium: false, free: [], prem: [] };
      this.c.dirty();
    }
  }
  tiers(): PassTier[] {
    return passTiers(this.c.state.pass.season, SKINS.map((s) => s.id));
  }
  tier() {
    return Math.min(PASS_TIERS, Math.floor(this.c.state.pass.xp / PASS_XP_PER_TIER));
  }
  addXp(n: number) {
    this.ensureSeason();
    this.c.state.pass.xp = Math.min(PASS_TIERS * PASS_XP_PER_TIER, this.c.state.pass.xp + n);
    this.c.dirty();
  }
  claim(tier: number, track: 'free' | 'prem') {
    const p = this.c.state.pass;
    const t = this.tiers()[tier - 1];
    if (!t || tier > this.tier()) return null;
    if (track === 'free') {
      if (!t.free || p.free.includes(tier)) return null;
      p.free.push(tier);
      return this.rewards.grant([t.free], 'pass');
    }
    if (!p.premium || p.prem.includes(tier)) return null;
    p.prem.push(tier);
    return this.rewards.grant([t.premium], 'pass');
  }
  buyPremium() {
    const s = this.c.state;
    if (s.pass.premium || s.currencies.gems < PASS_PREMIUM_PRICE) return false;
    s.currencies.gems -= PASS_PREMIUM_PRICE;
    s.stats.gemsSpent = (s.stats.gemsSpent ?? 0) + PASS_PREMIUM_PRICE;
    s.pass.premium = true;
    this.c.dirty();
    this.c.bus.emit('changed', undefined);
    return true;
  }
  claimable() {
    const p = this.c.state.pass;
    let n = 0;
    const tiers = this.tiers();
    for (let i = 1; i <= this.tier(); i++) {
      if (tiers[i - 1].free && !p.free.includes(i)) n++;
      if (p.premium && !p.prem.includes(i)) n++;
    }
    return n;
  }
}

// ============================ SHOP ============================
export type ShopSection = 'daily' | 'featured' | 'skins' | 'beasts' | 'bundles' | 'events' | 'chests';
export interface ShopOffer {
  id: string;
  section: ShopSection;
  name: string;
  icon: string;
  color: string;
  price: { currency: 'coins' | 'gems'; amount: number };
  rewards: Reward[];
  free?: boolean;
  once: boolean;
  tag?: string;
  previewSkin?: string;
  previewBeast?: string;
}

export class ShopSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}

  private ensureDay() {
    const d = dayIndex(this.c.now());
    if (this.c.state.shop.day !== d) this.c.state.shop = { day: d, bought: [] };
  }

  offers(): ShopOffer[] {
    this.ensureDay();
    const s = this.c.state;
    const d = s.shop.day;
    const rng = new Rng(hashString('shop:' + d));
    const out: ShopOffer[] = [];
    // DAILY
    out.push({ id: `d${d}_free`, section: 'daily', name: 'Cadeau du jour', icon: '🎁', color: '#4dff7a', price: { currency: 'coins', amount: 0 }, rewards: [{ type: 'coins', amount: 50 }, { type: 'energy', amount: 5 }], free: true, once: true, tag: 'GRATUIT' });
    const owned = JACKERS.filter((j) => s.jackers[j.id].unlocked);
    for (let i = 0; i < 3; i++) {
      const j = owned[Math.floor(rng.next() * owned.length)];
      const amt = 20 + Math.floor(rng.next() * 3) * 10;
      out.push({ id: `d${d}_sh${i}`, section: 'daily', name: `${amt} Shards ${j.name}`, icon: '🧬', color: '#c45cff', price: { currency: 'coins', amount: amt * 4 }, rewards: [{ type: 'shards', amount: amt, jackerId: j.id }], once: true });
    }
    const f = FOODS[Math.floor(rng.next() * FOODS.length)];
    out.push({ id: `d${d}_seed`, section: 'daily', name: `Graines ${f.name} ×3`, icon: '🌱', color: '#4dff7a', price: { currency: 'coins', amount: Math.round(f.seedPrice * 2.4) }, rewards: [{ type: 'seed', foodId: f.id, amount: 3 }], once: true, tag: '-20%' });
    // FEATURED
    const locked = JACKERS.filter((j) => !s.jackers[j.id].unlocked);
    if (locked.length) {
      const j = locked[Math.floor(rng.next() * locked.length)];
      out.push({ id: `d${d}_jk`, section: 'featured', name: j.name, icon: '🧑‍🚀', color: '#ffd23a', price: { currency: 'gems', amount: 49 + Math.round(j.unlockTrophies / 20) * 5 }, rewards: [{ type: 'jacker', jackerId: j.id }], once: true, tag: 'JACKER' });
    }
    out.push({ id: `d${d}_mega`, section: 'featured', name: 'Méga Pack Gravité', icon: '🧲', color: '#2bb8ff', price: { currency: 'gems', amount: 99 }, rewards: [{ type: 'chest', chestId: 'mythic' }, { type: 'coins', amount: 1000 }, { type: 'energy', amount: 100 }], once: true, tag: 'MEILLEURE OFFRE' });
    // SKINS
    const avail = SKINS.filter((k) => !k.exclusive && k.rarity !== 'common' && s.jackers[k.jackerId].unlocked);
    rng.shuffle(avail.slice()).slice(0, 4).forEach((k, i) =>
      out.push({ id: `d${d}_sk${i}_${k.id}`, section: 'skins', name: k.name, icon: '🎨', color: SKIN_RARITY_INFO[k.rarity].color, price: { currency: 'gems', amount: SKIN_RARITY_INFO[k.rarity].gems }, rewards: [{ type: 'skin', skinId: k.id }], once: true, tag: SKIN_RARITY_INFO[k.rarity].name, previewSkin: k.id }),
    );
    // BEASTS
    const bpool = BEASTS.filter((b) => ['rare', 'epic', 'mythic'].includes(b.rarity));
    for (let i = 0; i < 3; i++) {
      const b = bpool[Math.floor(rng.next() * bpool.length)];
      const price = { rare: 30, epic: 70, mythic: 140 }[b.rarity as 'rare' | 'epic' | 'mythic'];
      out.push({ id: `d${d}_bst${i}_${b.id}`, section: 'beasts', name: b.name, icon: '🐾', color: RARITY_INFO[b.rarity].color, price: { currency: 'gems', amount: price }, rewards: [{ type: 'beast', beastId: b.id }], once: true, tag: RARITY_INFO[b.rarity].name, previewBeast: b.id });
    }
    out.push({ id: `d${d}_eggrare`, section: 'beasts', name: 'Œuf Mystère', icon: '🥚', color: '#4dff7a', price: { currency: 'coins', amount: 600 }, rewards: [{ type: 'egg', rarity: 'rare' }], once: false });
    // CHESTS (always)
    for (const id of ['silver', 'gold', 'beast', 'mythic', 'cosmic'] as ChestId[])
      out.push({ id: `chest_${id}`, section: 'chests', name: CHESTS[id].name, icon: '🎁', color: CHESTS[id].color, price: { currency: 'gems', amount: CHESTS[id].priceGems }, rewards: [{ type: 'chest', chestId: id }], once: false });
    out.push({ id: `chest_wood_c`, section: 'chests', name: 'WOOD CHEST', icon: '🎁', color: CHESTS.wood.color, price: { currency: 'coins', amount: 150 }, rewards: [{ type: 'chest', chestId: 'wood' }], once: false });
    // BUNDLES
    out.push({ id: `b_starter`, section: 'bundles', name: 'Pack Débutant', icon: '🚀', color: '#ffb000', price: { currency: 'gems', amount: 29 }, rewards: [{ type: 'chest', chestId: 'gold' }, { type: 'coins', amount: 500 }, { type: 'egg', rarity: 'epic' }], once: true, tag: 'UNIQUE' });
    out.push({ id: `b_farm${d}`, section: 'bundles', name: 'Pack Fermier', icon: '🌾', color: '#4dff7a', price: { currency: 'coins', amount: 400 }, rewards: [{ type: 'seed', foodId: 'sunpear', amount: 2 }, { type: 'seed', foodId: 'stardrop', amount: 1 }, { type: 'food', foodId: 'berry', amount: 5 }], once: true });
    out.push({ id: `b_energy`, section: 'bundles', name: 'Énergie ×100', icon: '⭐', color: '#ff9a3a', price: { currency: 'gems', amount: 30 }, rewards: [{ type: 'energy', amount: 100 }], once: false });
    out.push({ id: `b_coins`, section: 'bundles', name: '1 200 Coins', icon: '🪙', color: '#ffd23a', price: { currency: 'gems', amount: 40 }, rewards: [{ type: 'coins', amount: 1200 }], once: false });
    // EVENTS
    const ev = currentEvents(this.c.now());
    for (const e of ev.events) out.push({ id: `ev${ev.slot}_${e.id}`, section: 'events', name: `Offre ${e.name}`, icon: e.icon, color: e.color, price: { currency: 'gems', amount: 25 }, rewards: [e.reward, { type: 'energy', amount: 30 }], once: true, tag: 'ÉVÉNEMENT' });
    return out.filter((o) => !(o.once && s.shop.bought.includes(o.id)) && !(o.id === 'b_starter' && (s.stats.starterBought ?? 0) > 0));
  }

  buy(id: string) {
    const s = this.c.state;
    const o = this.offers().find((x) => x.id === id);
    if (!o) return null;
    const cur = o.price.currency;
    if (s.currencies[cur] < o.price.amount) return null;
    s.currencies[cur] -= o.price.amount;
    if (cur === 'gems') s.stats.gemsSpent = (s.stats.gemsSpent ?? 0) + o.price.amount;
    if (o.once) s.shop.bought.push(o.id);
    if (o.id === 'b_starter') s.stats.starterBought = 1;
    const items = this.rewards.grant(o.rewards, 'shop');
    this.c.bus.emit('changed', undefined);
    return items;
  }
}

// ============================ EVENTS ============================
export class EventSystem {
  constructor(private c: Ctx, private rewards: RewardSystem) {}
  current() {
    return currentEvents(this.c.now());
  }
  claimKey(eventId: string) {
    return `${this.current().slot}:${eventId}`;
  }
  isClaimed(eventId: string) {
    return this.c.state.eventsClaimed.includes(this.claimKey(eventId));
  }
  /** Called when an event match is won. */
  onWin(eventId: string) {
    const ev = this.current().events.find((e) => e.id === eventId);
    if (!ev || this.isClaimed(eventId)) return null;
    this.c.state.eventsClaimed.push(this.claimKey(eventId));
    if (this.c.state.eventsClaimed.length > 40) this.c.state.eventsClaimed.splice(0, 10);
    return this.rewards.grant([ev.reward], 'event', true);
  }
}
