import type { Rarity } from './rarities';

export type Currency = 'coins' | 'gems' | 'shards' | 'energy';
export const CURRENCY_INFO: Record<Currency, { name: string; icon: string; color: string }> = {
  coins: { name: 'COINS', icon: '🪙', color: '#ffd23a' },
  gems: { name: 'GEMS', icon: '💎', color: '#38f0ff' },
  shards: { name: 'SHARDS', icon: '🧬', color: '#c45cff' },
  energy: { name: 'BEAST ENERGY', icon: '⭐', color: '#ff9a3a' },
};

/** Reward atoms used by chests, pass, quests, shop, achievements. */
export type Reward =
  | { type: 'coins'; amount: number }
  | { type: 'gems'; amount: number }
  | { type: 'energy'; amount: number }
  | { type: 'shards'; amount: number; jackerId?: string }
  | { type: 'jacker'; jackerId: string }
  | { type: 'skin'; skinId: string }
  | { type: 'beast'; beastId?: string; rarity?: Rarity }
  | { type: 'egg'; rarity: Rarity }
  | { type: 'chest'; chestId: ChestId }
  | { type: 'food'; foodId: string; amount: number }
  | { type: 'seed'; foodId: string; amount: number }
  | { type: 'xp'; amount: number }
  | { type: 'passXp'; amount: number }
  | { type: 'title'; title: string }
  | { type: 'emote'; emote: string };

export type ChestId = 'wood' | 'silver' | 'gold' | 'beast' | 'mythic' | 'cosmic';

export interface ChestDef {
  id: ChestId;
  name: string;
  color: string;
  trim: string;
  /** rolls of random drops */
  rolls: number;
  coins: [number, number];
  shards: [number, number];
  gemChance: number;
  gems: [number, number];
  beastChance: number;
  jackerChance: number;
  skinChance: number;
  rarityWeights: Partial<Record<Rarity, number>>;
  priceGems: number;
}

export const CHESTS: Record<ChestId, ChestDef> = {
  wood: { id: 'wood', name: 'WOOD CHEST', color: '#b9773a', trim: '#6b3f1a', rolls: 2, coins: [40, 90], shards: [8, 20], gemChance: 0.05, gems: [2, 5], beastChance: 0.15, jackerChance: 0.02, skinChance: 0, rarityWeights: { common: 80, rare: 18, epic: 2 }, priceGems: 10 },
  silver: { id: 'silver', name: 'SILVER CHEST', color: '#c9d6e8', trim: '#6a7a99', rolls: 3, coins: [90, 180], shards: [20, 45], gemChance: 0.12, gems: [3, 8], beastChance: 0.3, jackerChance: 0.05, skinChance: 0.01, rarityWeights: { common: 60, rare: 30, epic: 9, mythic: 1 }, priceGems: 25 },
  gold: { id: 'gold', name: 'GOLD CHEST', color: '#ffc933', trim: '#a06a00', rolls: 4, coins: [200, 400], shards: [45, 90], gemChance: 0.25, gems: [5, 15], beastChance: 0.5, jackerChance: 0.1, skinChance: 0.03, rarityWeights: { common: 40, rare: 38, epic: 17, mythic: 4, legendary: 1 }, priceGems: 60 },
  beast: { id: 'beast', name: 'BEAST CHEST', color: '#4dff7a', trim: '#1a8a3a', rolls: 3, coins: [120, 220], shards: [20, 40], gemChance: 0.1, gems: [3, 8], beastChance: 1, jackerChance: 0.03, skinChance: 0, rarityWeights: { common: 35, rare: 35, epic: 20, mythic: 7, legendary: 2.5, ancient: 0.5 }, priceGems: 50 },
  mythic: { id: 'mythic', name: 'MYTHIC CHEST', color: '#ff4d6d', trim: '#8a0a2a', rolls: 5, coins: [400, 800], shards: [90, 180], gemChance: 0.4, gems: [10, 25], beastChance: 0.8, jackerChance: 0.2, skinChance: 0.08, rarityWeights: { rare: 30, epic: 40, mythic: 20, legendary: 8, ancient: 2 }, priceGems: 140 },
  cosmic: { id: 'cosmic', name: 'COSMIC CHEST', color: '#7a5cff', trim: '#ff7af5', rolls: 7, coins: [900, 1600], shards: [180, 320], gemChance: 0.6, gems: [20, 50], beastChance: 1, jackerChance: 0.4, skinChance: 0.15, rarityWeights: { epic: 35, mythic: 30, legendary: 22, ancient: 9, celestial: 4 }, priceGems: 300 },
};
export const CHEST_ORDER: ChestId[] = ['wood', 'silver', 'gold', 'beast', 'mythic', 'cosmic'];

/** Jacker upgrade costs, level n -> n+1 (index = current level). */
export const MAX_JACKER_LEVEL = 20;
export function upgradeCost(level: number): { coins: number; shards: number } {
  return { coins: Math.round(20 * Math.pow(level, 1.85) + 20 * level), shards: Math.round(10 + level * level * 2.4) };
}
/** Stat multiplier for jacker level (1..20): +5% per level. */
export const levelStatMult = (level: number) => 1 + (level - 1) * 0.05;
export const GADGET_LEVEL = 7;
export const STARPOWER_LEVEL = 10;
export const SPECIAL_LEVEL = 14;

/** Player account level XP curve. */
export const playerXpForLevel = (lvl: number) => Math.round(100 + lvl * 60 + lvl * lvl * 8);

export interface RankDef {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
}
export const RANKS: RankDef[] = [
  { id: 'bronze', name: 'BRONZE', min: 0, color: '#cd7f32', icon: '🥉' },
  { id: 'silver', name: 'SILVER', min: 300, color: '#c9d6e8', icon: '🥈' },
  { id: 'gold', name: 'GOLD', min: 800, color: '#ffc933', icon: '🥇' },
  { id: 'platinum', name: 'PLATINUM', min: 1500, color: '#7ff7e0', icon: '💠' },
  { id: 'diamond', name: 'DIAMOND', min: 2500, color: '#38c8ff', icon: '💎' },
  { id: 'master', name: 'MASTER', min: 3800, color: '#c45cff', icon: '🔮' },
  { id: 'champion', name: 'CHAMPION', min: 5200, color: '#ff4d6d', icon: '🏆' },
  { id: 'legend', name: 'LEGEND', min: 7000, color: '#ffd23a', icon: '👑' },
];
export function rankFor(trophies: number): RankDef {
  let r = RANKS[0];
  for (const x of RANKS) if (trophies >= x.min) r = x;
  return r;
}

export interface FoodDef {
  id: string;
  name: string;
  icon: string;
  xp: number;
  growMinutes: number;
  seedPrice: number;
  yield: [number, number];
}
export const FOODS: FoodDef[] = [
  { id: 'berry', name: 'Baie Sauvage', icon: '🫐', xp: 40, growMinutes: 2, seedPrice: 20, yield: [3, 5] },
  { id: 'chili', name: 'Piment Ardent', icon: '🌶️', xp: 55, growMinutes: 5, seedPrice: 35, yield: [2, 4] },
  { id: 'kelp', name: 'Algue Bleue', icon: '🪸', xp: 55, growMinutes: 5, seedPrice: 35, yield: [2, 4] },
  { id: 'zapfruit', name: 'Zapfruit', icon: '🍋', xp: 60, growMinutes: 8, seedPrice: 45, yield: [2, 4] },
  { id: 'snowmelon', name: 'Melon des Neiges', icon: '🍈', xp: 60, growMinutes: 8, seedPrice: 45, yield: [2, 4] },
  { id: 'cloudpuff', name: 'Nuage Sucré', icon: '☁️', xp: 70, growMinutes: 12, seedPrice: 60, yield: [2, 3] },
  { id: 'rootnut', name: 'Noix-Racine', icon: '🌰', xp: 70, growMinutes: 12, seedPrice: 60, yield: [2, 3] },
  { id: 'sunpear', name: 'Poire Solaire', icon: '🍐', xp: 90, growMinutes: 20, seedPrice: 90, yield: [1, 3] },
  { id: 'shadeplum', name: 'Prune d’Ombre', icon: '🍇', xp: 90, growMinutes: 20, seedPrice: 90, yield: [1, 3] },
  { id: 'stardrop', name: 'Goutte d’Étoile', icon: '🌟', xp: 140, growMinutes: 45, seedPrice: 150, yield: [1, 2] },
];
export const FOOD_MAP: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const FARM_PLOTS = 6;

export const TIPS = [
  'Les Gravity Nodes peuvent changer le cours d’un combat.',
  'Certaines créatures sont plus puissantes après évolution.',
  'Un œuf TITAN rapporte 12 points… si tu survis jusqu’à ta base !',
  'Livrer vite ou attendre l’évolution ? À toi de choisir.',
  'Les buissons de Sky Jungle te rendent invisible aux ennemis éloignés.',
  'Utilise ton SUPER quand plusieurs ennemis sont groupés.',
  'Les éléments comptent : FLAME bat NATURE et FROST.',
  'Nourris tes créatures avec leur nourriture préférée pour plus d’XP.',
  'Deux créatures compatibles peuvent produire un nouvel œuf.',
  'Le Gravity Core déclenche des événements toutes les 40 secondes.',
  'En REVERSE GRAVITY, les porteurs lâchent leur œuf !',
  'Les tanks protègent mieux les porteurs d’œufs.',
  'Ta base te soigne rapidement quand tu y retournes.',
  'Les trampolines permettent de traverser les gouffres.',
  'Le mode AUTO AIM est parfait pour débuter. Passe en MANUAL pour plus de précision.',
  'Une créature mutée a des couleurs uniques et des stats bonus.',
  'Les missions quotidiennes se renouvellent chaque jour, même hors ligne.',
  'Améliore tes Jackers pour débloquer Gadgets, Star Powers et Pouvoirs Spéciaux.',
];
