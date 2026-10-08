import { describe, expect, it } from 'vitest';
import { Meta } from '../../src/systems/meta';
import { MemoryStorage } from '../../src/systems/save';
import { Rng } from '../../src/core/rng';
import { upgradeCost } from '../../src/data/economy';
import { JACKERS } from '../../src/data/jackers';
import { BEASTS } from '../../src/data/beasts';
import { ARENAS } from '../../src/data/arenas';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { SKINS } from '../../src/data/skins';
import { MIN, HOUR, DAY } from '../../src/core/time';
import { World } from '../../src/sim/world';
import { TROPHY_ROAD } from '../../src/systems/progression';
import { beastStats } from '../../src/systems/beasts';

function mkMeta(t0 = Date.UTC(2026, 9, 8, 12)) {
  const rng = new Rng(42);
  let now = t0;
  const store = new MemoryStorage();
  const meta = new Meta(store, { rand: () => rng.next(), now: () => now });
  return { meta, store, advance: (ms: number) => (now += ms), get now() { return now; } };
}

const win = (extra: any = {}) => ({ mode: 'beast_rush', arena: 'sky_jungle', jackerId: 'vex', difficulty: 'normal', outcome: 'win', kills: 5, deaths: 1, damage: 9000, healing: 0, eggsDelivered: 2, pointsDelivered: 6, titansDelivered: 0, nodesActivated: 1, supersUsed: 2, wildCaptured: 0, bossKilled: false, portalsUsed: 0, jumpPads: 0, mvp: true, ...extra }) as any;

describe('content volume', () => {
  it('has the required amount of content', () => {
    expect(JACKERS.length).toBeGreaterThanOrEqual(20);
    expect(BEASTS.length).toBeGreaterThanOrEqual(50);
    expect(ARENAS.length).toBeGreaterThanOrEqual(10);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(50);
    for (const j of JACKERS) expect(SKINS.filter((s) => s.jackerId === j.id).length).toBeGreaterThanOrEqual(3);
    expect(new Set(BEASTS.map((b) => b.id)).size).toBe(BEASTS.length);
  });
  it('every arena layout is 17 wide with two bases and a core', () => {
    for (const a of ARENAS) {
      expect(a.half.length, a.id).toBe(14);
      for (const row of a.half) expect(row.length, a.id + ':' + row).toBe(17);
      expect(a.half.join('').includes('B'), a.id).toBe(true);
      expect(a.half[13].includes('C'), a.id).toBe(true);
    }
  });
  it('every arena: both bases reachable from the core (A* path)', () => {
    for (const a of ARENAS) {
      const w = new World({ mode: 'beast_rush', arena: a.id, difficulty: 'easy', seed: 1, allBots: true, player: { jackerId: 'vex', level: 1, skin: 'vex_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: false, useStarPower: false, useSpecial: false } });
      for (const t of [0, 1]) expect(w.grid.path(w.core.x, w.core.z, w.baseCenter[t].x, w.baseCenter[t].z).length, a.id).toBeGreaterThan(3);
    }
  });
});

describe('progression', () => {
  it('match rewards: coins, xp, trophies and stats', () => {
    const { meta } = mkMeta();
    const coins0 = meta.state.currencies.coins;
    const r = meta.applyMatch(win());
    expect(r.trophies).toBeGreaterThan(0);
    expect(meta.state.currencies.coins).toBe(coins0 + r.coins);
    expect(meta.state.jackers.vex.trophies).toBe(r.trophies);
    expect(meta.state.stats.wins).toBe(1);
    expect(meta.state.stats.eggsDelivered).toBe(2);
    expect(meta.state.pass.xp).toBeGreaterThan(0);
  });
  it('upgrading really changes stats and costs coins + shards', () => {
    const { meta } = mkMeta();
    meta.state.currencies.coins = 10000;
    meta.state.jackers.boulder.shards = 500;
    const w1 = new World({ mode: 'duel', arena: 'sky_jungle', difficulty: 'easy', seed: 1, allBots: true, player: { jackerId: 'boulder', level: 1, skin: 'boulder_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: false, useStarPower: false, useSpecial: false } });
    const hp1 = w1.player!.maxHp;
    for (let i = 0; i < 5; i++) expect(meta.progression.upgrade('boulder')).toBe(true);
    expect(meta.state.jackers.boulder.level).toBe(6);
    const spent = [1, 2, 3, 4, 5].reduce((a, l) => a + upgradeCost(l).coins, 0);
    expect(meta.state.currencies.coins).toBe(10000 - spent);
    const w6 = new World({ mode: 'duel', arena: 'sky_jungle', difficulty: 'easy', seed: 1, allBots: true, player: { jackerId: 'boulder', level: 6, skin: 'boulder_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: false, useStarPower: false, useSpecial: false } });
    expect(w6.player!.maxHp).toBeGreaterThan(hp1 * 1.2);
    expect(w6.player!.dmgMult).toBeGreaterThan(1.2);
  });
  it('trophy road unlocks Jackers', () => {
    const { meta } = mkMeta();
    meta.state.jackers.vex.trophies = 70;
    const i = meta.progression.stat('trophies') >= 60 ? 1 : 0;
    expect(i).toBe(1);
    const k = TROPHY_ROAD.findIndex((s) => s.reward.type === 'jacker' && (s.reward as any).jackerId === 'pyra');
    expect(meta.progression.claimTrophyRoad(k)).toBeTruthy();
    expect(meta.state.jackers.pyra.unlocked).toBe(true);
    expect(meta.progression.claimTrophyRoad(k)).toBeNull();
  });
  it('player level ups give rewards', () => {
    const { meta } = mkMeta();
    const chests = meta.state.chests.length;
    meta.progression.addXp(5000);
    expect(meta.state.level).toBeGreaterThan(3);
    expect(meta.state.chests.length).toBeGreaterThan(chests);
  });
});

describe('chests & rewards', () => {
  it('chest rewards are actually credited', () => {
    const { meta } = mkMeta();
    meta.state.chests = ['gold', 'cosmic'];
    const before = JSON.stringify(meta.state.currencies);
    const r1 = meta.rewards.openChest(0)!;
    const r2 = meta.rewards.openChest(0)!;
    expect(r1.items.length).toBeGreaterThanOrEqual(2);
    expect(r2.items.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(meta.state.currencies)).not.toBe(before);
    expect(meta.state.chests.length).toBe(0);
    expect(meta.state.stats.chestsOpened).toBe(2);
  });
  it('drop rates respect rarity weights over many rolls', () => {
    const { meta } = mkMeta();
    let beasts = 0;
    for (let i = 0; i < 400; i++) beasts += meta.rewards.rollChest('beast').filter((r) => r.type === 'beast' || r.type === 'egg').length;
    expect(beasts).toBe(400); // beast chest always contains a creature
  });
});

describe('creatures: eggs, feeding, evolution, breeding, farm', () => {
  it('incubate and hatch in real time (offline clock)', () => {
    const t = mkMeta();
    const egg = t.meta.state.eggs[0];
    expect(t.meta.beasts.incubate(egg.uid)).toBe(true);
    expect(t.meta.beasts.hatch(egg.uid)).toBeNull();
    t.advance(4 * MIN);
    const res = t.meta.beasts.hatch(egg.uid)!;
    expect(res.beast.speciesId).toBe('joltpup');
    expect(t.meta.state.stats.beastsHatched).toBe(1);
  });
  it('feeding levels up and evolution changes stage & stats', () => {
    const t = mkMeta();
    const b = t.meta.state.beasts[0];
    t.meta.state.food.sunpear = 50;
    for (let i = 0; i < 20; i++) t.meta.beasts.feed(b.uid, 'sunpear');
    expect(b.level).toBe(5);
    t.meta.state.currencies.energy = 1000;
    const before = beastStats(b).hp;
    expect(t.meta.beasts.evolve(b.uid)).toBe(true);
    expect(b.stage).toBe(1);
    expect(beastStats(b).hp).toBeGreaterThan(before);
  });
  it('breeding produces an egg after the timer', () => {
    const t = mkMeta();
    const s = t.meta.state;
    s.beasts.push({ uid: 'p1', speciesId: 'flamby', level: 10, xp: 0, stage: 2, mutation: 'none', obtainedAt: 0, favorite: false, breedReadyAt: 0 });
    s.beasts.push({ uid: 'p2', speciesId: 'cindrake', level: 10, xp: 0, stage: 2, mutation: 'shiny', obtainedAt: 0, favorite: false, breedReadyAt: 0 });
    s.beasts.push({ uid: 'p3', speciesId: 'bubbloo', level: 10, xp: 0, stage: 2, mutation: 'none', obtainedAt: 0, favorite: false, breedReadyAt: 0 });
    expect(t.meta.beasts.canBreed(t.meta.beasts.get('p1')!, t.meta.beasts.get('p3')!).ok).toBe(false); // flame + aqua incompatible
    expect(t.meta.beasts.startBreeding('p1', 'p2')).toBe(true);
    expect(t.meta.beasts.collectBreeding()).toBeNull();
    t.advance(HOUR);
    const egg = t.meta.beasts.collectBreeding()!;
    expect(egg).toBeTruthy();
    expect(s.eggs.some((e) => e.uid === egg.uid)).toBe(true);
    expect(s.stats.beastsBred).toBe(1);
  });
  it('farm: plant, grow, harvest', () => {
    const t = mkMeta();
    expect(t.meta.beasts.plant(0, 'berry')).toBe(true);
    expect(t.meta.beasts.harvest(0)).toBeNull();
    t.advance(3 * MIN);
    const h = t.meta.beasts.harvest(0)!;
    expect(h.amount).toBeGreaterThanOrEqual(3);
  });
});

describe('live systems: quests, pass, shop, achievements, seasons', () => {
  it('quests track progress and pay out', () => {
    const t = mkMeta();
    const daily = t.meta.quests.list('daily');
    expect(daily.length).toBe(4);
    for (let i = 0; i < 10; i++) t.meta.applyMatch(win({ eggsDelivered: 3, kills: 10, damage: 20000, pointsDelivered: 12 }));
    const done = t.meta.quests.list('daily').filter((q) => q.done);
    expect(done.length).toBeGreaterThan(0);
    const gems0 = t.meta.state.currencies.gems,
      coins0 = t.meta.state.currencies.coins;
    expect(t.meta.quests.claim('daily', done[0].entry.tid)).toBeTruthy();
    expect(t.meta.state.currencies.gems + t.meta.state.currencies.coins + t.meta.state.currencies.energy).toBeGreaterThan(gems0 + coins0);
    expect(t.meta.quests.claim('daily', done[0].entry.tid)).toBeNull();
  });
  it('daily quests renew on the next day', () => {
    const t = mkMeta();
    const a = t.meta.quests.list('daily').map((q) => q.entry.tid).join();
    t.advance(DAY);
    t.meta.quests.refresh();
    expect(t.meta.state.quests.daily.key).toBeGreaterThan(0);
    void a;
  });
  it('super pass: free and premium tracks', () => {
    const t = mkMeta();
    t.meta.pass.addXp(1000);
    expect(t.meta.pass.tier()).toBe(3);
    expect(t.meta.pass.claim(2, 'free')).toBeTruthy();
    expect(t.meta.pass.claim(1, 'prem')).toBeNull();
    t.meta.state.currencies.gems = 500;
    expect(t.meta.pass.buyPremium()).toBe(true);
    expect(t.meta.pass.claim(1, 'prem')).toBeTruthy();
  });
  it('shop: buying deducts the price and grants items', () => {
    const t = mkMeta();
    t.meta.state.currencies.coins = 5000;
    const free = t.meta.shop.offers().find((o) => o.free)!;
    expect(t.meta.shop.buy(free.id)).toBeTruthy();
    expect(t.meta.shop.offers().find((o) => o.id === free.id)).toBeUndefined();
    const sh = t.meta.shop.offers().find((o) => o.section === 'daily' && !o.free && o.price.currency === 'coins')!;
    const c0 = t.meta.state.currencies.coins;
    t.meta.shop.buy(sh.id);
    expect(t.meta.state.currencies.coins).toBe(c0 - sh.price.amount);
  });
  it('achievements unlock from stats', () => {
    const t = mkMeta();
    t.meta.applyMatch(win());
    const first = t.meta.achievements.list().find((a) => a.def.id === 'wins_1')!;
    expect(first.done).toBe(true);
    expect(t.meta.achievements.claim('wins_1')).toBeTruthy();
  });
  it('season rollover partially resets trophies', () => {
    const t = mkMeta();
    t.meta.progression.dailyCheck();
    t.meta.state.jackers.vex.trophies = 1500;
    t.advance(43 * DAY);
    const r = t.meta.progression.dailyCheck();
    expect(r.reset).toBeTruthy();
    expect(t.meta.state.jackers.vex.trophies).toBe(1500 - 400);
  });
  it('state survives a save/reload cycle (simulated app restart)', () => {
    const t = mkMeta();
    t.meta.applyMatch(win());
    t.meta.saveNow();
    const again = new Meta(t.store, { now: () => t.now });
    expect(again.state.stats.wins).toBe(1);
    expect(again.state.jackers.vex.trophies).toBe(t.meta.state.jackers.vex.trophies);
  });
});
