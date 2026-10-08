import { ELEMENT_INFO, type Element } from './elements';
import { RARITY_INFO, type Rarity } from './rarities';
import type { BodyPlan, ModelDef, Palette } from './jackers';

export type BeastStage = 'baby' | 'young' | 'adult' | 'elite' | 'titan';
export const STAGES: BeastStage[] = ['baby', 'young', 'adult', 'elite', 'titan'];
export const STAGE_INFO: Record<BeastStage, { name: string; level: number; scale: number; statMult: number; energy: number }> = {
  baby: { name: 'BABY', level: 1, scale: 0.6, statMult: 1, energy: 0 },
  young: { name: 'YOUNG', level: 5, scale: 0.75, statMult: 1.25, energy: 20 },
  adult: { name: 'ADULT', level: 10, scale: 0.9, statMult: 1.6, energy: 60 },
  elite: { name: 'ELITE', level: 20, scale: 1.05, statMult: 2.1, energy: 150 },
  titan: { name: 'TITAN', level: 30, scale: 1.3, statMult: 2.8, energy: 400 },
};
export const BEAST_MAX_LEVEL = 40;

export interface BeastSkill {
  name: string;
  desc: string;
  power: number;
}

export interface BeastDef {
  id: string;
  num: number;
  name: string;
  element: Element;
  rarity: Rarity;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  size: number;
  habitat: string;
  lore: string;
  skills: BeastSkill[];
  model: ModelDef;
  palette: Palette;
  /** favourite food id: feeding it gives bonus XP */
  favFood: string;
  /** names of the 5 evolution forms */
  forms: [string, string, string, string, string];
}

type Row = [string, Element, Rarity, BodyPlan, string, string, string, string, string];
// name, element, rarity, plan, ears, tail, horns, extras(comma), habitat
const ROWS: Row[] = [
  ['Flamby', 'flame', 'common', 'blob', 'none', 'flame', 'none', '', 'Lava Core'],
  ['Cindrake', 'flame', 'rare', 'quad', 'fin', 'thin', 'small', 'wings', 'Lava Core'],
  ['Magmaw', 'flame', 'epic', 'golem', 'none', 'none', 'big', 'spikes', 'Lava Core'],
  ['Pyrophox', 'flame', 'mythic', 'quad', 'pointy', 'flame', 'none', 'mane', 'Sky Jungle'],
  ['Solcinder', 'flame', 'legendary', 'bird', 'tuft', 'flame', 'single', 'wings', 'Lava Core'],
  ['Bubbloo', 'aqua', 'common', 'blob', 'fin', 'none', 'none', '', 'Frozen Ring'],
  ['Squidle', 'aqua', 'common', 'octo', 'none', 'none', 'none', '', 'Storm Island'],
  ['Coralisk', 'aqua', 'rare', 'serpent', 'fin', 'fan', 'none', 'spikes', 'Storm Island'],
  ['Tidalon', 'aqua', 'epic', 'quad', 'fin', 'fan', 'single', 'shell', 'Storm Island'],
  ['Leviabyss', 'aqua', 'ancient', 'serpent', 'fin', 'fan', 'crystal', 'crown', 'Storm Island'],
  ['Sproutle', 'nature', 'common', 'blob', 'none', 'leaf', 'none', 'flower', 'Sky Jungle'],
  ['Mosshop', 'nature', 'common', 'quad', 'long', 'stub', 'none', 'moss', 'Beast Valley'],
  ['Thornback', 'nature', 'rare', 'quad', 'round', 'leaf', 'small', 'spikes', 'Beast Valley'],
  ['Bloomoth', 'nature', 'epic', 'bird', 'tuft', 'fan', 'antenna', 'wings,flower', 'Sky Jungle'],
  ['Elderoak', 'nature', 'legendary', 'golem', 'none', 'none', 'antlers', 'moss,flower', 'Ancient Ruins'],
  ['Zappik', 'volt', 'common', 'biped', 'pointy', 'thin', 'antenna', 'sparks', 'Storm Island'],
  ['Joltpup', 'volt', 'rare', 'quad', 'pointy', 'thin', 'none', 'sparks', 'Sky City'],
  ['Amperoo', 'volt', 'epic', 'biped', 'long', 'thin', 'antenna', 'sparks', 'Sky City'],
  ['Thundrake', 'volt', 'mythic', 'serpent', 'fin', 'thin', 'big', 'wings,sparks', 'Storm Island'],
  ['Voltaris', 'volt', 'celestial', 'bird', 'tuft', 'fan', 'crystal', 'wings,sparks,crown', 'Storm Island'],
  ['Snowpip', 'frost', 'common', 'blob', 'round', 'stub', 'none', 'fur', 'Frozen Ring'],
  ['Frostling', 'frost', 'rare', 'biped', 'pointy', 'fluffy', 'none', 'scarf', 'Frozen Ring'],
  ['Glacieron', 'frost', 'epic', 'golem', 'none', 'none', 'crystal', 'crystals', 'Frozen Ring'],
  ['Blizzwing', 'frost', 'legendary', 'bird', 'tuft', 'fan', 'crystal', 'wings', 'Frozen Ring'],
  ['Breezel', 'wind', 'common', 'bird', 'tuft', 'fan', 'none', '', 'Sky City'],
  ['Gustail', 'wind', 'rare', 'quad', 'long', 'fluffy', 'none', '', 'Sky Jungle'],
  ['Cyclonix', 'wind', 'epic', 'serpent', 'fin', 'fan', 'none', 'wings', 'Storm Island'],
  ['Zephyra', 'wind', 'mythic', 'bird', 'tuft', 'fan', 'single', 'wings,crown', 'Sky City'],
  ['Pebblit', 'earth', 'common', 'golem', 'none', 'none', 'none', '', 'Crystal Caves'],
  ['Burrowmole', 'earth', 'common', 'quad', 'round', 'stub', 'none', 'claws', 'Beast Valley'],
  ['Rockhorn', 'earth', 'rare', 'quad', 'round', 'stub', 'big', 'armor', 'Beast Valley'],
  ['Terragon', 'earth', 'epic', 'quad', 'fin', 'thin', 'big', 'spikes,armor', 'Ancient Ruins'],
  ['Montitan', 'earth', 'ancient', 'golem', 'none', 'none', 'crystal', 'moss,crystals', 'Ancient Ruins'],
  ['Shadowisp', 'void', 'common', 'blob', 'pointy', 'thin', 'none', '', 'Void Station'],
  ['Nullcat', 'void', 'rare', 'biped', 'pointy', 'thin', 'none', 'mask', 'Void Station'],
  ['Eclipsor', 'void', 'epic', 'bird', 'tuft', 'fan', 'big', 'wings', 'Void Station'],
  ['Abyssmaw', 'void', 'mythic', 'serpent', 'fin', 'thin', 'big', 'spikes', 'Void Station'],
  ['Nihilux', 'void', 'celestial', 'octo', 'none', 'none', 'crystal', 'crown', 'Void Station'],
  ['Glowbug', 'light', 'common', 'bird', 'none', 'stub', 'antenna', 'wings', 'Crystal Caves'],
  ['Lumipaw', 'light', 'rare', 'quad', 'pointy', 'fluffy', 'none', '', 'Sky City'],
  ['Radiant', 'light', 'epic', 'biped', 'long', 'fluffy', 'single', 'mane', 'Crystal Caves'],
  ['Aurorex', 'light', 'legendary', 'quad', 'fin', 'fan', 'antlers', 'crystals', 'Crystal Caves'],
  ['Seraphyx', 'light', 'ancient', 'bird', 'tuft', 'fan', 'crystal', 'wings,crown', 'Ancient Ruins'],
  ['Stardust', 'cosmic', 'common', 'blob', 'none', 'thin', 'antenna', '', 'Cosmic Arena'],
  ['Nebulynx', 'cosmic', 'rare', 'quad', 'pointy', 'fluffy', 'none', 'spots', 'Cosmic Arena'],
  ['Orbitoad', 'cosmic', 'rare', 'blob', 'none', 'none', 'none', 'spots', 'Cosmic Arena'],
  ['Cometail', 'cosmic', 'epic', 'serpent', 'fin', 'flame', 'single', '', 'Cosmic Arena'],
  ['Galaxeon', 'cosmic', 'mythic', 'biped', 'long', 'fan', 'crystal', 'wings', 'Cosmic Arena'],
  ['Quasarok', 'cosmic', 'legendary', 'golem', 'none', 'none', 'big', 'crystals,core_belly', 'Cosmic Arena'],
  ['Omnivora', 'cosmic', 'celestial', 'serpent', 'fin', 'fan', 'antlers', 'wings,crown', 'Cosmic Arena'],
];

const SKILL_WORDS: Record<Element, [string, string, string]> = {
  flame: ['Braise', 'Souffle Ardent', 'Éruption'],
  aqua: ['Jet d’Eau', 'Bulle Prison', 'Raz-de-marée'],
  nature: ['Fouet Liane', 'Pollen Soignant', 'Racines Géantes'],
  volt: ['Étincelle', 'Arc Électrique', 'Tempête Ionique'],
  frost: ['Givre', 'Souffle Glacé', 'Ère Glaciaire'],
  wind: ['Rafale', 'Lame d’Air', 'Cyclone'],
  earth: ['Jet de Pierre', 'Carapace', 'Séisme'],
  void: ['Ombre', 'Faille', 'Singularité'],
  light: ['Éclat', 'Halo', 'Jugement Solaire'],
  cosmic: ['Poussière d’Étoile', 'Orbite', 'Supernova'],
};

const FOOD_BY_ELEMENT: Record<Element, string> = {
  flame: 'chili', aqua: 'kelp', nature: 'berry', volt: 'zapfruit', frost: 'snowmelon',
  wind: 'cloudpuff', earth: 'rootnut', void: 'shadeplum', light: 'sunpear', cosmic: 'stardrop',
};

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt));
  const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt));
  const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function build(): BeastDef[] {
  return ROWS.map((r, i) => {
    const [name, element, rarity, plan, ears, tail, horns, extras, habitat] = r;
    const el = ELEMENT_INFO[element];
    const rm = RARITY_INFO[rarity].statMult;
    const seed = (i * 7919) % 97;
    const sizeBase = plan === 'golem' || plan === 'serpent' ? 1.15 : plan === 'blob' ? 0.85 : 1;
    const words = SKILL_WORDS[element];
    const def: BeastDef = {
      id: name.toLowerCase(),
      num: i + 1,
      name,
      element,
      rarity,
      hp: Math.round((900 + seed * 6 + (plan === 'golem' ? 400 : 0)) * rm),
      atk: Math.round((120 + ((seed * 3) % 60) + (plan === 'serpent' ? 30 : 0)) * rm),
      def: Math.round((60 + ((seed * 5) % 50) + (plan === 'golem' ? 40 : 0)) * rm),
      spd: Math.round((50 + ((seed * 11) % 50) + (plan === 'bird' ? 25 : 0)) * (0.9 + rm * 0.1)),
      size: sizeBase,
      habitat,
      lore: `${name} vit à ${habitat}. Une créature ${el.name} ${RARITY_INFO[rarity].name.toLowerCase()} que les Jackers rêvent de faire éclore.`,
      skills: [
        { name: words[0], desc: `Attaque ${el.name} de base.`, power: 1 },
        { name: words[1], desc: 'Débloquée au stade ADULT.', power: 1.6 },
        { name: words[2], desc: 'Capacité ultime des ELITE et TITAN.', power: 2.6 },
      ],
      model: {
        plan,
        ears: ears as ModelDef['ears'],
        tail: tail as ModelDef['tail'],
        horns: horns as ModelDef['horns'],
        extras: extras ? extras.split(',') : [],
        head: plan === 'blob' ? 1.2 : 1.05,
        body: 1,
        size: sizeBase,
      },
      palette: {
        main: el.color,
        second: el.dark,
        belly: lighten(el.color, 0.6),
        accent: ['#ffffff', '#ffd23a', '#ff5ad6', '#38f0ff', '#4dff7a'][seed % 5],
        eye: '#1b1440',
      },
      favFood: FOOD_BY_ELEMENT[element],
      forms: [`${name}`, `${name}`, `${name}`, `Elite ${name}`, `Titan ${name}`],
    };
    return def;
  });
}

export const BEASTS: BeastDef[] = build();
export const BEAST_MAP: Record<string, BeastDef> = Object.fromEntries(BEASTS.map((b) => [b.id, b]));
export const getBeast = (id: string) => BEAST_MAP[id] ?? BEASTS[0];

/** Two creatures can breed if they share an element or their elements are "allied". */
const ALLIED: [Element, Element][] = [
  ['flame', 'light'], ['aqua', 'frost'], ['nature', 'earth'], ['volt', 'wind'], ['void', 'cosmic'],
  ['flame', 'earth'], ['aqua', 'nature'], ['wind', 'frost'], ['light', 'cosmic'], ['void', 'volt'],
];
export function compatible(a: Element, b: Element) {
  if (a === b) return true;
  return ALLIED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}
