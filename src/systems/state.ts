import { JACKERS, STARTER_JACKERS } from '../data/jackers';
import { defaultSkin, SKIN_MAP } from '../data/skins';
import { BEAST_MAP } from '../data/beasts';
import type { ChestId } from '../data/economy';
import { FARM_PLOTS, MAX_JACKER_LEVEL } from '../data/economy';
import type { Rarity } from '../data/rarities';
import { RARITIES } from '../data/rarities';
import type { Difficulty } from '../data/modes';

export const SAVE_VERSION = 3;

export interface JackerProgress {
  unlocked: boolean;
  level: number;
  shards: number;
  trophies: number;
  highest: number;
  skin: string;
  skins: string[];
  gadget: 0 | 1;
  starPower: 0 | 1;
  special: 0 | 1;
  matches: number;
  wins: number;
}

export type Mutation = 'none' | 'shiny' | 'giant' | 'shadow' | 'prism';
export interface BeastInstance {
  uid: string;
  speciesId: string;
  level: number;
  xp: number;
  stage: number;
  mutation: Mutation;
  obtainedAt: number;
  favorite: boolean;
  breedReadyAt: number;
}
export interface EggInstance {
  uid: string;
  rarity: Rarity;
  speciesId: string;
  mutation: Mutation;
  source: 'breed' | 'chest' | 'match' | 'reward' | 'shop';
  /** 0 = waiting, otherwise timestamp when it hatches */
  hatchAt: number;
  incubating: boolean;
}
export interface BreedingSlot {
  a: string;
  b: string;
  start: number;
  end: number;
}
export interface FarmPlot {
  foodId: string | null;
  plantedAt: number;
  readyAt: number;
}
export interface QuestEntry {
  tid: string;
  base: number;
  claimed: boolean;
}
export interface QuestBucket {
  key: number;
  list: QuestEntry[];
}

export interface Settings {
  music: number;
  sfx: number;
  haptics: boolean;
  aim: 'auto' | 'manual';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  performance: boolean;
  showFps: boolean;
  difficulty: Difficulty;
  damageNumbers: boolean;
  screenShake: boolean;
}

export interface PlayerState {
  version: number;
  createdAt: number;
  updatedAt: number;
  profile: {
    name: string;
    avatar: string;
    title: string;
    titles: string[];
    badges: string[];
    emotes: string[];
    selectedJacker: string;
    companion: string | null;
  };
  currencies: { coins: number; gems: number; energy: number; shards: number };
  xp: number;
  level: number;
  jackers: Record<string, JackerProgress>;
  beasts: BeastInstance[];
  eggs: EggInstance[];
  breeding: BreedingSlot | null;
  food: Record<string, number>;
  seeds: Record<string, number>;
  farm: FarmPlot[];
  chests: ChestId[];
  stats: Record<string, number>;
  seen: { arenas: string[]; modes: string[] };
  quests: Record<string, QuestBucket>;
  achievements: string[];
  pass: { season: number; xp: number; premium: boolean; free: number[]; prem: number[] };
  seasonSeen: number;
  shop: { day: number; bought: string[] };
  trophyRoad: number[];
  campaign: Record<string, number>;
  eventsClaimed: string[];
  settings: Settings;
  lastDay: number;
  streak: number;
  tutorialDone: boolean;
  uidCounter: number;
}

export function newJackerProgress(id: string, unlocked: boolean): JackerProgress {
  return { unlocked, level: 1, shards: 0, trophies: 0, highest: 0, skin: defaultSkin(id), skins: [defaultSkin(id)], gadget: 0, starPower: 0, special: 0, matches: 0, wins: 0 };
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.6,
  sfx: 0.8,
  haptics: true,
  aim: 'auto',
  quality: 'high',
  performance: false,
  showFps: false,
  difficulty: 'normal',
  damageNumbers: true,
  screenShake: true,
};

export function defaultState(t = Date.now()): PlayerState {
  const jackers: Record<string, JackerProgress> = {};
  for (const j of JACKERS) jackers[j.id] = newJackerProgress(j.id, STARTER_JACKERS.includes(j.id));
  return {
    version: SAVE_VERSION,
    createdAt: t,
    updatedAt: t,
    profile: { name: 'Jacker' + Math.floor(1000 + Math.random() * 9000), avatar: 'vex', title: 'Recrue', titles: ['Recrue'], badges: [], emotes: ['👍', '😂'], selectedJacker: 'vex', companion: null },
    currencies: { coins: 250, gems: 30, energy: 20, shards: 0 },
    xp: 0,
    level: 1,
    jackers,
    beasts: [
      { uid: 'b1', speciesId: 'sproutle', level: 1, xp: 0, stage: 0, mutation: 'none', obtainedAt: t, favorite: true, breedReadyAt: 0 },
      { uid: 'b2', speciesId: 'flamby', level: 1, xp: 0, stage: 0, mutation: 'none', obtainedAt: t, favorite: false, breedReadyAt: 0 },
    ],
    eggs: [{ uid: 'e1', rarity: 'rare', speciesId: 'joltpup', mutation: 'none', source: 'reward', hatchAt: 0, incubating: false }],
    breeding: null,
    food: { berry: 5 },
    seeds: { berry: 3, chili: 1 },
    farm: Array.from({ length: FARM_PLOTS }, () => ({ foodId: null, plantedAt: 0, readyAt: 0 })),
    chests: ['wood'],
    stats: {},
    seen: { arenas: [], modes: [] },
    quests: {},
    achievements: [],
    pass: { season: -1, xp: 0, premium: false, free: [], prem: [] },
    seasonSeen: -1,
    shop: { day: -1, bought: [] },
    trophyRoad: [],
    campaign: {},
    eventsClaimed: [],
    settings: { ...DEFAULT_SETTINGS },
    lastDay: -1,
    streak: 0,
    tutorialDone: false,
    uidCounter: 10,
  };
}

const num = (v: any, d = 0, min = 0, max = 1e12) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const arr = <T>(v: any, f: (x: any) => x is T): T[] => (Array.isArray(v) ? v.filter(f) : []);
const isStr = (x: any): x is string => typeof x === 'string';
const isNum = (x: any): x is number => typeof x === 'number' && isFinite(x);

/**
 * Validate and repair a loaded state. Anything missing/invalid is replaced with defaults so that a
 * partially corrupted (or older) save never crashes the game.
 */
export function sanitize(raw: any): PlayerState {
  const d = defaultState(num(raw?.createdAt, Date.now()));
  if (!raw || typeof raw !== 'object') return d;
  const s: PlayerState = { ...d };
  s.version = SAVE_VERSION;
  s.createdAt = num(raw.createdAt, d.createdAt);
  s.updatedAt = num(raw.updatedAt, d.updatedAt);
  const p = raw.profile ?? {};
  s.profile = {
    name: isStr(p.name) && p.name.length > 0 ? p.name.slice(0, 16) : d.profile.name,
    avatar: isStr(p.avatar) && JACKERS.some((j) => j.id === p.avatar) ? p.avatar : 'vex',
    title: isStr(p.title) ? p.title : d.profile.title,
    titles: arr(p.titles, isStr).length ? arr(p.titles, isStr) : d.profile.titles,
    badges: arr(p.badges, isStr),
    emotes: arr(p.emotes, isStr).length ? arr(p.emotes, isStr) : d.profile.emotes,
    selectedJacker: isStr(p.selectedJacker) && raw.jackers?.[p.selectedJacker]?.unlocked ? p.selectedJacker : 'vex',
    companion: isStr(p.companion) ? p.companion : null,
  };
  const c = raw.currencies ?? {};
  s.currencies = { coins: num(c.coins, d.currencies.coins), gems: num(c.gems, d.currencies.gems), energy: num(c.energy, d.currencies.energy), shards: num(c.shards, 0) };
  s.xp = num(raw.xp, 0);
  s.level = num(raw.level, 1, 1, 999);
  s.jackers = {};
  for (const j of JACKERS) {
    const r = raw.jackers?.[j.id];
    const base = newJackerProgress(j.id, STARTER_JACKERS.includes(j.id));
    if (!r) {
      s.jackers[j.id] = base;
      continue;
    }
    const skins = arr(r.skins, isStr).filter((x) => SKIN_MAP[x]?.jackerId === j.id);
    if (!skins.includes(base.skin)) skins.unshift(base.skin);
    s.jackers[j.id] = {
      unlocked: !!r.unlocked || base.unlocked,
      level: Math.round(num(r.level, 1, 1, MAX_JACKER_LEVEL)),
      shards: num(r.shards, 0),
      trophies: num(r.trophies, 0),
      highest: num(r.highest, 0),
      skin: skins.includes(r.skin) ? r.skin : base.skin,
      skins,
      gadget: r.gadget === 1 ? 1 : 0,
      starPower: r.starPower === 1 ? 1 : 0,
      special: r.special === 1 ? 1 : 0,
      matches: num(r.matches, 0),
      wins: num(r.wins, 0),
    };
  }
  if (!s.jackers[s.profile.selectedJacker]?.unlocked) s.profile.selectedJacker = 'vex';
  s.beasts = arr(raw.beasts, (b: any): b is any => b && isStr(b.uid) && !!BEAST_MAP[b.speciesId]).map((b: any) => ({
    uid: b.uid,
    speciesId: b.speciesId,
    level: Math.round(num(b.level, 1, 1, 40)),
    xp: num(b.xp, 0),
    stage: Math.round(num(b.stage, 0, 0, 4)),
    mutation: ['none', 'shiny', 'giant', 'shadow', 'prism'].includes(b.mutation) ? b.mutation : 'none',
    obtainedAt: num(b.obtainedAt, Date.now()),
    favorite: !!b.favorite,
    breedReadyAt: num(b.breedReadyAt, 0),
  }));
  s.eggs = arr(raw.eggs, (e: any): e is any => e && isStr(e.uid) && !!BEAST_MAP[e.speciesId]).map((e: any) => ({
    uid: e.uid,
    rarity: RARITIES.includes(e.rarity) ? e.rarity : 'common',
    speciesId: e.speciesId,
    mutation: ['none', 'shiny', 'giant', 'shadow', 'prism'].includes(e.mutation) ? e.mutation : 'none',
    source: e.source ?? 'reward',
    hatchAt: num(e.hatchAt, 0),
    incubating: !!e.incubating,
  }));
  const br = raw.breeding;
  s.breeding = br && isStr(br.a) && isStr(br.b) && isNum(br.end) ? { a: br.a, b: br.b, start: num(br.start, 0), end: br.end } : null;
  const recNum = (o: any) => {
    const out: Record<string, number> = {};
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (isNum(o[k]) && o[k] >= 0) out[k] = o[k];
    return out;
  };
  s.food = recNum(raw.food);
  s.seeds = recNum(raw.seeds);
  s.farm = d.farm.map((pl, i) => {
    const r = raw.farm?.[i];
    return r && (r.foodId === null || isStr(r.foodId)) ? { foodId: r.foodId, plantedAt: num(r.plantedAt, 0), readyAt: num(r.readyAt, 0) } : pl;
  });
  s.chests = arr(raw.chests, isStr).filter((c) => ['wood', 'silver', 'gold', 'beast', 'mythic', 'cosmic'].includes(c)) as ChestId[];
  s.stats = recNum(raw.stats);
  s.seen = { arenas: arr(raw.seen?.arenas, isStr), modes: arr(raw.seen?.modes, isStr) };
  s.quests = {};
  if (raw.quests && typeof raw.quests === 'object')
    for (const k of Object.keys(raw.quests)) {
      const b = raw.quests[k];
      if (b && isNum(b.key) && Array.isArray(b.list))
        s.quests[k] = { key: b.key, list: b.list.filter((q: any) => q && isStr(q.tid)).map((q: any) => ({ tid: q.tid, base: num(q.base, 0), claimed: !!q.claimed })) };
    }
  s.achievements = arr(raw.achievements, isStr);
  const ps = raw.pass ?? {};
  s.pass = { season: num(ps.season, -1, -1), xp: num(ps.xp, 0), premium: !!ps.premium, free: arr(ps.free, isNum), prem: arr(ps.prem, isNum) };
  s.seasonSeen = num(raw.seasonSeen, -1, -1);
  s.shop = { day: num(raw.shop?.day, -1, -1), bought: arr(raw.shop?.bought, isStr) };
  s.trophyRoad = arr(raw.trophyRoad, isNum);
  s.campaign = recNum(raw.campaign);
  s.eventsClaimed = arr(raw.eventsClaimed, isStr);
  const st = raw.settings ?? {};
  s.settings = {
    music: num(st.music, DEFAULT_SETTINGS.music, 0, 1),
    sfx: num(st.sfx, DEFAULT_SETTINGS.sfx, 0, 1),
    haptics: typeof st.haptics === 'boolean' ? st.haptics : true,
    aim: st.aim === 'manual' ? 'manual' : 'auto',
    quality: ['low', 'medium', 'high', 'ultra'].includes(st.quality) ? st.quality : DEFAULT_SETTINGS.quality,
    performance: !!st.performance,
    showFps: !!st.showFps,
    difficulty: ['easy', 'normal', 'hard', 'expert', 'master'].includes(st.difficulty) ? st.difficulty : 'normal',
    damageNumbers: typeof st.damageNumbers === 'boolean' ? st.damageNumbers : true,
    screenShake: typeof st.screenShake === 'boolean' ? st.screenShake : true,
  };
  s.lastDay = num(raw.lastDay, -1, -1);
  s.streak = num(raw.streak, 0);
  s.tutorialDone = !!raw.tutorialDone;
  s.uidCounter = num(raw.uidCounter, 10);
  return s;
}

/** Version migrations. Each step upgrades raw JSON from version n to n+1. */
export function migrate(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  let v = typeof raw.version === 'number' ? raw.version : 1;
  if (v < 2) {
    // v1 stored a single `trophies` number at root; spread onto selected jacker
    if (typeof raw.trophies === 'number' && raw.jackers) {
      const sel = raw.profile?.selectedJacker ?? 'vex';
      if (raw.jackers[sel]) raw.jackers[sel].trophies = (raw.jackers[sel].trophies ?? 0) + raw.trophies;
    }
    delete raw.trophies;
    v = 2;
  }
  if (v < 3) {
    // v2 had no farm/seeds
    raw.seeds = raw.seeds ?? { berry: 3 };
    v = 3;
  }
  raw.version = v;
  return raw;
}
