export type ModeId = 'beast_rush' | 'gravity_war' | 'beast_hunt' | 'boss_raid' | 'survival' | 'duel' | 'chaos';

export interface ModeDef {
  id: ModeId;
  name: string;
  icon: string;
  desc: string;
  teamSize: number;
  duration: number;
  target: number;
  color: string;
  unlockLevel: number;
}

export const MODES: ModeDef[] = [
  { id: 'beast_rush', name: 'BEAST RUSH', icon: '🥚', desc: 'Récupère les œufs et ramène-les à ta base. Plus l’œuf évolue, plus il rapporte !', teamSize: 3, duration: 180, target: 20, color: '#ffb000', unlockLevel: 1 },
  { id: 'gravity_war', name: 'GRAVITY WAR', icon: '🧲', desc: 'Contrôle les 3 zones de gravité. Premier à 100 points.', teamSize: 3, duration: 180, target: 100, color: '#2bb8ff', unlockLevel: 2 },
  { id: 'beast_hunt', name: 'BEAST HUNT', icon: '🐾', desc: 'Capture les créatures sauvages. Les plus rares valent plus !', teamSize: 3, duration: 150, target: 25, color: '#4dff7a', unlockLevel: 3 },
  { id: 'boss_raid', name: 'BOSS RAID', icon: '👑', desc: '3 Jackers contre un TITAN. Abattez-le avant la fin du temps.', teamSize: 3, duration: 180, target: 1, color: '#ff4d6d', unlockLevel: 4 },
  { id: 'survival', name: 'SURVIVAL', icon: '💀', desc: 'L’arène s’effondre. Pas de réapparition. Dernière équipe debout !', teamSize: 3, duration: 150, target: 0, color: '#c45cff', unlockLevel: 5 },
  { id: 'duel', name: 'DUEL', icon: '⚔️', desc: '1 contre 1. Livre 10 points d’œufs ou élimine ton rival.', teamSize: 1, duration: 150, target: 10, color: '#ff9a3a', unlockLevel: 2 },
  { id: 'chaos', name: 'CHAOS', icon: '🎲', desc: 'Règles aléatoires, événements en rafale. Tout peut arriver !', teamSize: 3, duration: 180, target: 20, color: '#ff5ad6', unlockLevel: 6 },
];
export const MODE_MAP: Record<ModeId, ModeDef> = Object.fromEntries(MODES.map((m) => [m.id, m])) as any;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'master';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'expert', 'master'];
export const DIFFICULTY_INFO: Record<Difficulty, { name: string; color: string; rewardMult: number }> = {
  easy: { name: 'EASY', color: '#4dff7a', rewardMult: 0.7 },
  normal: { name: 'NORMAL', color: '#2bb8ff', rewardMult: 1 },
  hard: { name: 'HARD', color: '#ffb000', rewardMult: 1.25 },
  expert: { name: 'EXPERT', color: '#ff4d6d', rewardMult: 1.5 },
  master: { name: 'MASTER', color: '#c45cff', rewardMult: 2 },
};

export type MatchEventId = 'gravity_flip' | 'beast_rush' | 'meteor_shower' | 'core_overload' | 'low_gravity' | 'void_storm';
export const MATCH_EVENTS: Record<MatchEventId, { name: string; icon: string; desc: string; duration: number; color: string }> = {
  gravity_flip: { name: 'GRAVITY FLIP', icon: '🔄', desc: 'La gravité s’inverse !', duration: 6, color: '#ff5ad6' },
  beast_rush: { name: 'BEAST RUSH', icon: '🐾', desc: 'Des créatures sauvages déferlent !', duration: 12, color: '#4dff7a' },
  meteor_shower: { name: 'METEOR SHOWER', icon: '☄️', desc: 'Pluie de météores !', duration: 9, color: '#ff7a1f' },
  core_overload: { name: 'CORE OVERLOAD', icon: '⚠️', desc: 'Le Gravity Core devient instable !', duration: 8, color: '#ffd23a' },
  low_gravity: { name: 'LOW GRAVITY', icon: '🪶', desc: 'Tout le monde flotte !', duration: 12, color: '#7dfcff' },
  void_storm: { name: 'VOID STORM', icon: '🌪️', desc: 'Une tempête du néant traverse l’arène !', duration: 10, color: '#8a4dff' },
};
