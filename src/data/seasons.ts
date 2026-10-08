import { DAY } from '../core/time';
import type { Reward } from './economy';

export interface SeasonTheme {
  name: string;
  subtitle: string;
  color: string;
  color2: string;
  arena: string;
  featuredBeasts: string[];
  skinTheme: string;
  eventMode: string;
}

export const SEASON_THEMES: SeasonTheme[] = [
  { name: 'SAISON DES ŒUFS D’OR', subtitle: 'Les premiers Titans s’éveillent', color: '#ffc933', color2: '#ff7a1f', arena: 'sky_jungle', featuredBeasts: ['solcinder', 'pyrophox', 'elderoak'], skinTheme: 'gold', eventMode: 'beast_rush' },
  { name: 'NUIT DU NÉANT', subtitle: 'La Void Station s’ouvre', color: '#8a4dff', color2: '#ff3a8a', arena: 'void_station', featuredBeasts: ['nihilux', 'abyssmaw', 'eclipsor'], skinTheme: 'void', eventMode: 'gravity_war' },
  { name: 'HIVER COSMIQUE', subtitle: 'La neige tombe des étoiles', color: '#7ff7ff', color2: '#3a8fff', arena: 'frozen_ring', featuredBeasts: ['blizzwing', 'glacieron', 'voltaris'], skinTheme: 'arctic', eventMode: 'survival' },
  { name: 'TEMPÊTE SAUVAGE', subtitle: 'Les créatures se déchaînent', color: '#4dff7a', color2: '#ffd23a', arena: 'beast_valley', featuredBeasts: ['thundrake', 'zephyra', 'terragon'], skinTheme: 'jungle', eventMode: 'beast_hunt' },
  { name: 'CRISTAUX ANCIENS', subtitle: 'Les ruines révèlent leurs secrets', color: '#ff7af5', color2: '#7ff7ff', arena: 'crystal_caves', featuredBeasts: ['seraphyx', 'montitan', 'aurorex'], skinTheme: 'celestial', eventMode: 'boss_raid' },
  { name: 'FESTIVAL DE SKY CITY', subtitle: 'La ville flottante fait la fête', color: '#ffb36b', color2: '#ff5ad6', arena: 'sky_city', featuredBeasts: ['omnivora', 'galaxeon', 'quasarok'], skinTheme: 'candy', eventMode: 'chaos' },
];

/** Season 1 starts Monday 5 Jan 2026 (UTC). Each season lasts 6 weeks. */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);
export const SEASON_LENGTH = 42 * DAY;

export function seasonIndexAt(t: number) {
  return Math.max(0, Math.floor((t - SEASON_EPOCH) / SEASON_LENGTH));
}
export function seasonInfo(t = Date.now()) {
  const index = seasonIndexAt(t);
  const start = SEASON_EPOCH + index * SEASON_LENGTH;
  const end = start + SEASON_LENGTH;
  return { index, number: index + 1, theme: SEASON_THEMES[index % SEASON_THEMES.length], start, end, remaining: end - t };
}

export const PASS_TIERS = 50;
export const PASS_XP_PER_TIER = 300;
export const PASS_PREMIUM_PRICE = 169;

export interface PassTier {
  tier: number;
  free: Reward | null;
  premium: Reward;
}

/** Pass rewards depend on the season index so each season has its own pass. */
export function passTiers(seasonIndex: number, skinIds: string[]): PassTier[] {
  const tiers: PassTier[] = [];
  const theme = SEASON_THEMES[seasonIndex % SEASON_THEMES.length];
  // season-exclusive skins pulled from the theme's skins
  const themed = skinIds.filter((s) => s.endsWith('_' + theme.skinTheme));
  const pickSkin = (k: number) => themed[(seasonIndex * 3 + k) % Math.max(1, themed.length)] ?? skinIds[k % skinIds.length];
  for (let t = 1; t <= PASS_TIERS; t++) {
    let free: Reward | null = null;
    let premium: Reward;
    if (t % 10 === 0) free = { type: 'chest', chestId: t === 50 ? 'mythic' : 'gold' };
    else if (t % 5 === 0) free = { type: 'egg', rarity: t >= 30 ? 'epic' : 'rare' };
    else if (t % 3 === 0) free = { type: 'shards', amount: 30 + t * 2 };
    else if (t % 2 === 0) free = { type: 'coins', amount: 80 + t * 6 };
    else if (t % 7 === 0) free = { type: 'gems', amount: 5 };
    if (t === 1) premium = { type: 'skin', skinId: pickSkin(0) };
    else if (t === 25) premium = { type: 'skin', skinId: pickSkin(1) };
    else if (t === 50) premium = { type: 'skin', skinId: pickSkin(2) };
    else if (t === 15) premium = { type: 'beast', beastId: theme.featuredBeasts[0] };
    else if (t === 35) premium = { type: 'beast', beastId: theme.featuredBeasts[1] };
    else if (t === 45) premium = { type: 'beast', beastId: theme.featuredBeasts[2] };
    else if (t === 10 || t === 30) premium = { type: 'emote', emote: ['😎', '🤩', '😤', '🥳', '😈', '🤖'][(seasonIndex + t) % 6] };
    else if (t === 20 || t === 40) premium = { type: 'title', title: t === 20 ? `Héros de la Saison ${seasonIndex + 1}` : theme.name };
    else if (t % 8 === 0) premium = { type: 'chest', chestId: 'beast' };
    else if (t % 4 === 0) premium = { type: 'gems', amount: 10 };
    else if (t % 3 === 0) premium = { type: 'energy', amount: 25 + t };
    else premium = { type: 'coins', amount: 150 + t * 8 };
    tiers.push({ tier: t, free, premium });
  }
  return tiers;
}

/** Rotating offline events: one featured event per 3 days. */
export interface EventDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  mode: string;
  arena: string;
  modifier: 'none' | 'doubleSuper' | 'lowGravity' | 'titanEggs' | 'fastEggs' | 'bigHeads' | 'meteors';
  color: string;
  reward: Reward;
  difficulty: string;
}
export const EVENTS: EventDef[] = [
  { id: 'titan_week', name: 'TITAN FESTIVAL', desc: 'Les œufs évoluent 2× plus vite.', icon: '👑', mode: 'beast_rush', arena: 'beast_valley', modifier: 'fastEggs', color: '#ffc933', reward: { type: 'chest', chestId: 'beast' }, difficulty: 'hard' },
  { id: 'moon_bounce', name: 'MOON BOUNCE', desc: 'Gravité faible partout !', icon: '🌙', mode: 'gravity_war', arena: 'cosmic_arena', modifier: 'lowGravity', color: '#7dfcff', reward: { type: 'gems', amount: 20 }, difficulty: 'normal' },
  { id: 'super_frenzy', name: 'SUPER FRENZY', desc: 'Le SUPER se charge 2× plus vite.', icon: '⚡', mode: 'chaos', arena: 'storm_island', modifier: 'doubleSuper', color: '#ffd92b', reward: { type: 'chest', chestId: 'gold' }, difficulty: 'hard' },
  { id: 'meteor_night', name: 'METEOR NIGHT', desc: 'Les météores tombent sans arrêt.', icon: '☄️', mode: 'survival', arena: 'lava_core', modifier: 'meteors', color: '#ff7a1f', reward: { type: 'egg', rarity: 'epic' }, difficulty: 'hard' },
  { id: 'titan_raid', name: 'TITAN RAID', desc: 'Un Titan légendaire attaque !', icon: '🐉', mode: 'boss_raid', arena: 'ancient_ruins', modifier: 'none', color: '#ff4d6d', reward: { type: 'chest', chestId: 'mythic' }, difficulty: 'expert' },
  { id: 'big_heads', name: 'BIG HEAD PARTY', desc: 'Têtes géantes, chaos garanti.', icon: '🤪', mode: 'beast_rush', arena: 'sky_city', modifier: 'bigHeads', color: '#ff5ad6', reward: { type: 'gems', amount: 15 }, difficulty: 'normal' },
];
export function currentEvents(t = Date.now()) {
  const slot = Math.floor(t / (3 * DAY));
  const a = EVENTS[slot % EVENTS.length];
  const b = EVENTS[(slot + 2) % EVENTS.length];
  const ends = (slot + 1) * 3 * DAY;
  return { events: [a, b], ends, slot };
}
