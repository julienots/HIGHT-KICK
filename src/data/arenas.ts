import type { GravityType } from './gravity';

export type ArenaMechanic = 'bushes' | 'eruption' | 'ice' | 'portals' | 'wildBeasts' | 'lowGravity' | 'storm' | 'crystals' | 'platforms' | 'spikeTraps';

export interface ArenaTheme {
  sky: string;
  skyBottom: string;
  fog: string;
  groundA: string;
  groundB: string;
  groundSide: string;
  wallTop: string;
  wallSide: string;
  crate: string;
  crateTop: string;
  bush: string;
  hazard: string;
  slow: string;
  pit: string;
  light: string;
  ambient: string;
  decor: 'jungle' | 'volcano' | 'snow' | 'space' | 'valley' | 'cosmos' | 'storm' | 'crystal' | 'city' | 'ruins';
  particles: 'pollen' | 'embers' | 'snow' | 'stars' | 'leaves' | 'sparkles' | 'rain' | 'crystals' | 'clouds' | 'dust';
}

export interface ArenaDef {
  id: string;
  num: number;
  name: string;
  desc: string;
  mechanic: ArenaMechanic;
  mechanicDesc: string;
  /** top half (13 rows) + middle row, 17 columns; bottom half is mirrored */
  half: string[];
  nodeTypes: GravityType[];
  gravity: number;
  hazard: 'lava' | 'spikes' | 'electric';
  slowKind: 'water' | 'ice' | 'snow';
  theme: ArenaTheme;
  music: { tempo: number; root: number; scale: 'major' | 'minor' | 'dorian' | 'lydian' | 'phrygian' };
  unlockTrophies: number;
}

export const GRID_W = 17;
export const GRID_H = 27;
export const CELL = 2;

export const ARENAS: ArenaDef[] = [
  {
    id: 'sky_jungle', num: 1, name: 'SKY JUNGLE', desc: 'Une jungle suspendue au-dessus des nuages.',
    mechanic: 'bushes', mechanicDesc: 'Les buissons cachent les Jackers.',
    half: [
      '__.....***.....__',
      '_......BBB......_',
      '_..**..BBB..**.._',
      '...**.......**...',
      '..x....###....x..',
      '..x..E.....E..x..',
      '__..G.......G..__',
      '__*...#...#...*__',
      '...*.........*...',
      '.##....xxx....##.',
      '....**.....**....',
      '...__.......__...',
      '..*.....^.....*..',
      '##.*....C....*.##',
    ],
    nodeTypes: ['low', 'vortex'], gravity: 30, hazard: 'spikes', slowKind: 'water',
    theme: { sky: '#7fd6ff', skyBottom: '#e9fbff', fog: '#bfeeff', groundA: '#7ed957', groundB: '#6cc94a', groundSide: '#8a5a33', wallTop: '#a7e06a', wallSide: '#6b8f3a', crate: '#c98a4a', crateTop: '#e8b06a', bush: '#3fae3a', hazard: '#ff6a3d', slow: '#46b6ff', pit: '#ffffff', light: '#fff4dc', ambient: '#9fd0ff', decor: 'jungle', particles: 'pollen' },
    music: { tempo: 124, root: 60, scale: 'major' }, unlockTrophies: 0,
  },
  {
    id: 'lava_core', num: 2, name: 'LAVA CORE', desc: 'Le cœur bouillonnant d’un volcan endormi… pas pour longtemps.',
    mechanic: 'eruption', mechanicDesc: 'La lave brûle. Le volcan entre parfois en éruption.',
    half: [
      '#...............#',
      '#......BBB......#',
      '..x....BBB....x..',
      '..x...........x..',
      '....hh..#..hh....',
      '..E.hh.....hh.E..',
      '##..G.......G..##',
      '.....xx...xx.....',
      '.hh.....^.....hh.',
      '.hh..#.....#..hh.',
      '....#..hhh..#....',
      '..x.....E.....x..',
      'xx..##.....##..xx',
      '......hhChh......',
    ],
    nodeTypes: ['heavy', 'repulsion'], gravity: 30, hazard: 'lava', slowKind: 'water',
    theme: { sky: '#3a0f1a', skyBottom: '#ff7a3a', fog: '#5a1a1a', groundA: '#5a4a4a', groundB: '#4d3f40', groundSide: '#2a1a1a', wallTop: '#7a5a50', wallSide: '#3a2828', crate: '#4a3a3a', crateTop: '#ff7a3a', bush: '#7a3a2a', hazard: '#ff5a1f', slow: '#ff9a3a', pit: '#ff5a1f', light: '#ffcf9a', ambient: '#ff6a4a', decor: 'volcano', particles: 'embers' },
    music: { tempo: 132, root: 57, scale: 'phrygian' }, unlockTrophies: 100,
  },
  {
    id: 'frozen_ring', num: 3, name: 'FROZEN RING', desc: 'Une patinoire de glace éternelle. Attention aux glissades !',
    mechanic: 'ice', mechanicDesc: 'La glace fait glisser les Jackers.',
    half: [
      '___...........___',
      '__.....BBB.....__',
      '_......BBB......_',
      '...~~~.....~~~...',
      '..#~~~..x..~~~#..',
      '..#..E.....E..#..',
      '......G...G......',
      '_..~~~~...~~~~.._',
      '__.~~~~*.*~~~~.__',
      '__...##...##...__',
      '......x.E.x......',
      '..~~~.......~~~..',
      '..~~~..*.*..~~~..',
      '^...~~~~C~~~~...^',
    ],
    nodeTypes: ['low', 'orbit'], gravity: 30, hazard: 'spikes', slowKind: 'ice',
    theme: { sky: '#bfe6ff', skyBottom: '#ffffff', fog: '#e6f6ff', groundA: '#f2fbff', groundB: '#dff2ff', groundSide: '#7ab8e0', wallTop: '#ffffff', wallSide: '#8fd0ff', crate: '#9ad7ff', crateTop: '#e8f8ff', bush: '#cfefff', hazard: '#38c8ff', slow: '#9ef0ff', pit: '#ffffff', light: '#ffffff', ambient: '#bfe0ff', decor: 'snow', particles: 'snow' },
    music: { tempo: 118, root: 62, scale: 'lydian' }, unlockTrophies: 250,
  },
  {
    id: 'void_station', num: 4, name: 'VOID STATION', desc: 'Une station spatiale abandonnée au bord du néant.',
    mechanic: 'portals', mechanicDesc: 'Portails, plateformes mobiles et gouffres du vide.',
    half: [
      '##.............##',
      '#......BBB......#',
      '#......BBB......#',
      '#.o...........o.#',
      '###...#####...###',
      '......E...E......',
      '_____.G...G._____',
      'mmmmm.......mmmmm',
      '_____...x..._____',
      '......#...#......',
      '..x...........x..',
      '...__..E.E..__...',
      '...__.......__...',
      '..o____=C=____o..',
    ],
    nodeTypes: ['reverse', 'vortex'], gravity: 30, hazard: 'electric', slowKind: 'water',
    theme: { sky: '#0b0820', skyBottom: '#2a1a5a', fog: '#140c33', groundA: '#3a4466', groundB: '#323b5a', groundSide: '#1a1f33', wallTop: '#5a6a99', wallSide: '#2a3050', crate: '#4a5a88', crateTop: '#38f0ff', bush: '#5a3a99', hazard: '#38f0ff', slow: '#5a6aff', pit: '#8a4dff', light: '#cfd8ff', ambient: '#7a6aff', decor: 'space', particles: 'stars' },
    music: { tempo: 128, root: 55, scale: 'minor' }, unlockTrophies: 450,
  },
  {
    id: 'beast_valley', num: 5, name: 'BEAST VALLEY', desc: 'La vallée sauvage où rôdent les créatures.',
    mechanic: 'wildBeasts', mechanicDesc: 'Des créatures sauvages errent dans la vallée.',
    half: [
      '**.............**',
      '*......BBB......*',
      '...x...BBB...x...',
      '...x.........x...',
      '.***...***...***.',
      '.***.E.***.E.***.',
      '........G........',
      '..##.........##..',
      '..##..**.**..##..',
      '......**.**......',
      '^...x.......x...^',
      '...***..E..***...',
      '...***.....***...',
      'G.......C.......G',
    ],
    nodeTypes: ['orbit', 'repulsion'], gravity: 30, hazard: 'spikes', slowKind: 'water',
    theme: { sky: '#8fdcff', skyBottom: '#fff1c9', fog: '#d9f2d0', groundA: '#a5d957', groundB: '#96cc4a', groundSide: '#7a5230', wallTop: '#b98a5a', wallSide: '#7a5230', crate: '#d99a5a', crateTop: '#f2c27a', bush: '#4fae3a', hazard: '#ff6a3d', slow: '#46b6ff', pit: '#ffffff', light: '#fff1d0', ambient: '#bfe8a0', decor: 'valley', particles: 'leaves' },
    music: { tempo: 120, root: 64, scale: 'dorian' }, unlockTrophies: 700,
  },
  {
    id: 'cosmic_arena', num: 6, name: 'COSMIC ARENA', desc: 'Une arène qui flotte entre les galaxies. Gravité faible permanente.',
    mechanic: 'lowGravity', mechanicDesc: 'Gravité réduite : les sauts durent beaucoup plus longtemps.',
    half: [
      '____.........____',
      '___....BBB....___',
      '__.....BBB.....__',
      '__.............__',
      '__..#..^.^..#..__',
      '____..E...E..____',
      '____.........____',
      '__..G.......G..__',
      '_......xxx......_',
      '_..___.....___.._',
      '^..___..E..___..^',
      '...___.....___...',
      '........#........',
      '__.....=C=.....__',
    ],
    nodeTypes: ['reverse', 'orbit'], gravity: 15, hazard: 'electric', slowKind: 'water',
    theme: { sky: '#120a2e', skyBottom: '#5a1a6b', fog: '#24104a', groundA: '#4a3a8a', groundB: '#40327a', groundSide: '#20184a', wallTop: '#7a5aff', wallSide: '#3a2a8a', crate: '#ff5ad6', crateTop: '#ffb3ec', bush: '#7a3aff', hazard: '#ff5ad6', slow: '#7ff7ff', pit: '#ff5ad6', light: '#e8d8ff', ambient: '#a07aff', decor: 'cosmos', particles: 'sparkles' },
    music: { tempo: 126, root: 58, scale: 'lydian' }, unlockTrophies: 1000,
  },
  {
    id: 'storm_island', num: 7, name: 'STORM ISLAND', desc: 'Une île battue par les vents et la foudre.',
    mechanic: 'storm', mechanicDesc: 'Des rafales poussent tout le monde. La foudre tombe au hasard.',
    half: [
      '~~.............~~',
      '~......BBB......~',
      '~..x...BBB...x..~',
      '...x.........x...',
      '..~~~..###..~~~..',
      '..~~~E.....E~~~..',
      '......G...G......',
      '.##...........##.',
      '.....**...**.....',
      '~~...**.x.**...~~',
      '~~~...........~~~',
      '...x...E.E...x...',
      '..##.........##..',
      '~~~....~C~....~~~',
    ],
    nodeTypes: ['repulsion', 'vortex'], gravity: 30, hazard: 'electric', slowKind: 'water',
    theme: { sky: '#4a5a7a', skyBottom: '#9ab0c9', fog: '#6a7a99', groundA: '#d9c99a', groundB: '#cfbd8a', groundSide: '#6a5a3a', wallTop: '#8a9a8a', wallSide: '#5a6a5a', crate: '#9a7a5a', crateTop: '#c9a57a', bush: '#3a8a5a', hazard: '#ffe94d', slow: '#3a8aff', pit: '#3a6aff', light: '#e0e8ff', ambient: '#8090b0', decor: 'storm', particles: 'rain' },
    music: { tempo: 136, root: 53, scale: 'minor' }, unlockTrophies: 1300,
  },
  {
    id: 'crystal_caves', num: 8, name: 'CRYSTAL CAVES', desc: 'Des grottes de cristaux qui se brisent… et repoussent.',
    mechanic: 'crystals', mechanicDesc: 'Les cristaux sont destructibles et repoussent.',
    half: [
      '##.............##',
      '#......BBB......#',
      '#.x....BBB....x.#',
      '#.x..xx...xx..x.#',
      '#....#.....#....#',
      '#.E..#.xxx.#..E.#',
      '###..G.....G..###',
      '#.....xx.xx.....#',
      '#.###.......###.#',
      '#...x...E...x...#',
      '#..xx..###..xx..#',
      '#...............#',
      '#.**.x.....x.**.#',
      '#.**.x..C..x.**.#',
    ],
    nodeTypes: ['heavy', 'orbit'], gravity: 30, hazard: 'electric', slowKind: 'water',
    theme: { sky: '#1a1033', skyBottom: '#3a2a6b', fog: '#24184a', groundA: '#5a4a7a', groundB: '#50426e', groundSide: '#2a2040', wallTop: '#7a6a9a', wallSide: '#3a2a5a', crate: '#7ff7ff', crateTop: '#e0ffff', bush: '#5a3a8a', hazard: '#ff7af5', slow: '#7ff7ff', pit: '#7ff7ff', light: '#d8c8ff', ambient: '#8a6aff', decor: 'crystal', particles: 'crystals' },
    music: { tempo: 116, root: 61, scale: 'dorian' }, unlockTrophies: 1600,
  },
  {
    id: 'sky_city', num: 9, name: 'SKY CITY', desc: 'Une ville flottante reliée par des plateformes mobiles.',
    mechanic: 'platforms', mechanicDesc: 'Plateformes mobiles, ponts et trampolines.',
    half: [
      '_..............._',
      '_......BBB......_',
      '_..#...BBB...#.._',
      '_..#.........#.._',
      '_.....^...^....._',
      '___..E.....E..___',
      'mmm...G...G...mmm',
      '___...........___',
      '....##..x..##....',
      '......._=_.......',
      '__..x.._=_..x..__',
      '__.....E.E.....__',
      'mmmmm.......mmmmm',
      '_____...C..._____',
    ],
    nodeTypes: ['low', 'repulsion'], gravity: 30, hazard: 'electric', slowKind: 'water',
    theme: { sky: '#ffb36b', skyBottom: '#ffe8c9', fog: '#ffd9b0', groundA: '#e8e0f2', groundB: '#d9d0ea', groundSide: '#6a5a8a', wallTop: '#ffffff', wallSide: '#9a8ac9', crate: '#ff7a5a', crateTop: '#ffb38a', bush: '#5ac96b', hazard: '#38c8ff', slow: '#46b6ff', pit: '#ffffff', light: '#fff0d8', ambient: '#ffc9a0', decor: 'city', particles: 'clouds' },
    music: { tempo: 122, root: 65, scale: 'major' }, unlockTrophies: 2000,
  },
  {
    id: 'ancient_ruins', num: 10, name: 'ANCIENT RUINS', desc: 'Les ruines d’une civilisation qui maîtrisait la gravité.',
    mechanic: 'spikeTraps', mechanicDesc: 'Des pièges à pointes s’activent en rythme.',
    half: [
      '#.#...........#.#',
      '#......BBB......#',
      '..#....BBB....#..',
      '....#.......#....',
      '.#.....hhh.....#.',
      '...E..#...#..E...',
      '....G.......G....',
      '#.#..**...**..#.#',
      '....x..#.#..x....',
      '.^.....hhh.....^.',
      '...#....E....#...',
      '.#..xx.....xx..#.',
      '........G........',
      '#.#.....C.....#.#',
    ],
    nodeTypes: ['reverse', 'heavy', 'vortex'], gravity: 30, hazard: 'spikes', slowKind: 'water',
    theme: { sky: '#9ad0b0', skyBottom: '#f2e6c0', fog: '#cfe0c0', groundA: '#d9c08a', groundB: '#cdb27a', groundSide: '#7a5a3a', wallTop: '#b9a57a', wallSide: '#7a6a4a', crate: '#a58a5a', crateTop: '#d9bf8a', bush: '#5a9a3a', hazard: '#c9c9c9', slow: '#46b6ff', pit: '#ffffff', light: '#fff0c9', ambient: '#c0d8a0', decor: 'ruins', particles: 'dust' },
    music: { tempo: 112, root: 59, scale: 'dorian' }, unlockTrophies: 2500,
  },
];

export const ARENA_MAP: Record<string, ArenaDef> = Object.fromEntries(ARENAS.map((a) => [a.id, a]));
export const getArena = (id: string) => ARENA_MAP[id] ?? ARENAS[0];

/** Expand the authored half into the full mirrored grid (rows top→bottom). */
export function fullGrid(a: ArenaDef): string[] {
  const top = a.half.slice(0, 13);
  const mid = a.half[13];
  const bottom = top.slice().reverse();
  return [...top, mid, ...bottom];
}
