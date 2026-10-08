export type Rarity = 'common' | 'rare' | 'epic' | 'mythic' | 'legendary' | 'ancient' | 'celestial';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'mythic', 'legendary', 'ancient', 'celestial'];

export interface RarityInfo {
  id: Rarity;
  name: string;
  color: string;
  glow: string;
  /** base drop weight for creature drops */
  weight: number;
  statMult: number;
  /** number of reveal "pulses" on chest opening */
  revealPulses: number;
  shardsToUnlock: number;
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  common: { id: 'common', name: 'COMMON', color: '#9fd8ff', glow: '#5fa6d9', weight: 520, statMult: 1, revealPulses: 0, shardsToUnlock: 10 },
  rare: { id: 'rare', name: 'RARE', color: '#4dff7a', glow: '#1aa83f', weight: 260, statMult: 1.08, revealPulses: 1, shardsToUnlock: 20 },
  epic: { id: 'epic', name: 'EPIC', color: '#c45cff', glow: '#7a1fbf', weight: 130, statMult: 1.16, revealPulses: 2, shardsToUnlock: 40 },
  mythic: { id: 'mythic', name: 'MYTHIC', color: '#ff4d6d', glow: '#b3122f', weight: 55, statMult: 1.25, revealPulses: 3, shardsToUnlock: 60 },
  legendary: { id: 'legendary', name: 'LEGENDARY', color: '#ffd23a', glow: '#c98a00', weight: 24, statMult: 1.35, revealPulses: 4, shardsToUnlock: 90 },
  ancient: { id: 'ancient', name: 'ANCIENT', color: '#ff9a3a', glow: '#a34b00', weight: 8, statMult: 1.45, revealPulses: 5, shardsToUnlock: 120 },
  celestial: { id: 'celestial', name: 'CELESTIAL', color: '#7ff7ff', glow: '#ff7af5', weight: 3, statMult: 1.6, revealPulses: 6, shardsToUnlock: 160 },
};

export const rarityIndex = (r: Rarity) => RARITIES.indexOf(r);
