import { JACKERS, type Palette } from './jackers';

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Accessory = 'none' | 'crown' | 'cap' | 'shades' | 'halo' | 'scarf' | 'helmet' | 'flowers' | 'horns' | 'mask' | 'headphones' | 'tophat';

export const SKIN_RARITY_INFO: Record<SkinRarity, { name: string; color: string; gems: number }> = {
  common: { name: 'COMMON', color: '#9fd8ff', gems: 0 },
  rare: { name: 'RARE', color: '#4dff7a', gems: 29 },
  epic: { name: 'EPIC', color: '#c45cff', gems: 79 },
  legendary: { name: 'LEGENDARY', color: '#ffd23a', gems: 149 },
  mythic: { name: 'MYTHIC', color: '#ff4d6d', gems: 249 },
};

export interface SkinDef {
  id: string;
  jackerId: string;
  name: string;
  rarity: SkinRarity;
  palette: Palette;
  accessory: Accessory;
  /** colour of attack projectiles/trails */
  fx: string;
  /** emissive glow for high tier skins */
  glow?: string;
  victory: 'jump' | 'spin' | 'flex' | 'dance' | 'float';
  /** obtained via pass/achievement only */
  exclusive?: boolean;
}

interface Theme {
  key: string;
  name: string;
  rarity: SkinRarity;
  accessory: Accessory;
  palette: (p: Palette) => Palette;
  fx: string;
  glow?: string;
  victory: SkinDef['victory'];
}

const THEMES: Theme[] = [
  { key: 'candy', name: 'Bonbon', rarity: 'rare', accessory: 'cap', fx: '#ff8ad8', victory: 'dance', palette: (p) => ({ ...p, main: '#ff9ad6', second: '#9ef0ff', belly: '#fff0fb', accent: '#ffe94d' }) },
  { key: 'jungle', name: 'Jungle', rarity: 'rare', accessory: 'flowers', fx: '#6fd64a', victory: 'jump', palette: (p) => ({ ...p, main: '#4fb83a', second: '#ffcc33', belly: '#e9ffd1', accent: '#ff5a4d' }) },
  { key: 'arctic', name: 'Arctique', rarity: 'rare', accessory: 'scarf', fx: '#9ef0ff', victory: 'spin', palette: (p) => ({ ...p, main: '#dff4ff', second: '#3a8fff', belly: '#ffffff', accent: '#ff5a8a' }) },
  { key: 'neon', name: 'Néon', rarity: 'epic', accessory: 'shades', fx: '#38ff8a', glow: '#38ff8a', victory: 'dance', palette: (p) => ({ ...p, main: '#1b1440', second: '#38ff8a', belly: '#2b2f5a', accent: '#ff3af0' }) },
  { key: 'samurai', name: 'Samouraï', rarity: 'epic', accessory: 'helmet', fx: '#ff4d6d', victory: 'flex', palette: (p) => ({ ...p, main: '#c4202f', second: '#1b1b24', belly: '#f2e3c9', accent: '#ffd23a' }) },
  { key: 'pirate', name: 'Pirate', rarity: 'epic', accessory: 'tophat', fx: '#ffd23a', victory: 'jump', palette: (p) => ({ ...p, main: '#7a4a2b', second: '#1b2b4a', belly: '#f2dcb9', accent: '#ffd23a' }) },
  { key: 'dj', name: 'DJ', rarity: 'epic', accessory: 'headphones', fx: '#38c8ff', glow: '#38c8ff', victory: 'dance', palette: (p) => ({ ...p, main: '#ffcc33', second: '#2b2f5a', belly: '#fff5d1', accent: '#38c8ff' }) },
  { key: 'gold', name: 'Or Royal', rarity: 'legendary', accessory: 'crown', fx: '#ffd23a', glow: '#ffb000', victory: 'flex', palette: (p) => ({ ...p, main: '#ffc933', second: '#fff1b0', belly: '#fff8d6', accent: '#ff4d6d' }) },
  { key: 'void', name: 'Abysse', rarity: 'legendary', accessory: 'horns', fx: '#8a4dff', glow: '#8a4dff', victory: 'float', palette: (p) => ({ ...p, main: '#1d1238', second: '#8a4dff', belly: '#3b2470', accent: '#ff3a8a' }) },
  { key: 'celestial', name: 'Céleste', rarity: 'mythic', accessory: 'halo', fx: '#7ff7ff', glow: '#ff7af5', victory: 'float', palette: (p) => ({ ...p, main: '#ffffff', second: '#7ff7ff', belly: '#fff0fb', accent: '#ff7af5' }) },
];

function buildSkins(): SkinDef[] {
  const out: SkinDef[] = [];
  JACKERS.forEach((j, idx) => {
    out.push({ id: `${j.id}_classic`, jackerId: j.id, name: 'Classique', rarity: 'common', palette: j.palette, accessory: 'none', fx: j.palette.accent, victory: 'jump' });
    // three themed skins per Jacker, deterministic rotation so the roster looks varied
    const picks = [THEMES[idx % 3], THEMES[3 + (idx % 4)], THEMES[7 + (idx % 3)]];
    for (const t of picks) {
      out.push({
        id: `${j.id}_${t.key}`,
        jackerId: j.id,
        name: `${j.name} ${t.name}`,
        rarity: t.rarity,
        palette: t.palette(j.palette),
        accessory: t.accessory,
        fx: t.fx,
        glow: t.glow,
        victory: t.victory,
        exclusive: t.rarity === 'mythic',
      });
    }
  });
  return out;
}

export const SKINS = buildSkins();
export const SKIN_MAP: Record<string, SkinDef> = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const skinsFor = (jackerId: string) => SKINS.filter((s) => s.jackerId === jackerId);
export const defaultSkin = (jackerId: string) => `${jackerId}_classic`;
