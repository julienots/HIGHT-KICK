import type { Reward } from './economy';

export type QuestKind = 'daily' | 'weekly' | 'season' | 'beast' | 'combat' | 'exploration';
export const QUEST_KIND_INFO: Record<QuestKind, { name: string; icon: string; color: string; count: number }> = {
  daily: { name: 'DAILY', icon: '☀️', color: '#ffb000', count: 4 },
  weekly: { name: 'WEEKLY', icon: '📅', color: '#2bb8ff', count: 4 },
  season: { name: 'SEASON', icon: '🏆', color: '#c45cff', count: 5 },
  beast: { name: 'BEAST', icon: '🐾', color: '#4dff7a', count: 3 },
  combat: { name: 'COMBAT', icon: '⚔️', color: '#ff4d6d', count: 3 },
  exploration: { name: 'EXPLORATION', icon: '🗺️', color: '#7ff7ff', count: 3 },
};

export interface QuestTemplate {
  id: string;
  kind: QuestKind;
  stat: string;
  target: number;
  text: string;
  reward: Reward[];
  passXp: number;
}

const T = (id: string, kind: QuestKind, stat: string, target: number, text: string, reward: Reward[], passXp: number): QuestTemplate => ({ id, kind, stat, target, text, reward, passXp });

export const QUEST_POOL: QuestTemplate[] = [
  // DAILY
  T('d_play3', 'daily', 'matches', 3, 'Joue 3 matchs', [{ type: 'coins', amount: 60 }], 60),
  T('d_win2', 'daily', 'wins', 2, 'Gagne 2 matchs', [{ type: 'coins', amount: 80 }], 80),
  T('d_eggs3', 'daily', 'eggsDelivered', 3, 'Livre 3 œufs', [{ type: 'energy', amount: 15 }], 70),
  T('d_kills8', 'daily', 'kills', 8, 'Élimine 8 ennemis', [{ type: 'coins', amount: 70 }], 70),
  T('d_nodes3', 'daily', 'nodesActivated', 3, 'Active 3 Gravity Nodes', [{ type: 'shards', amount: 20 }], 60),
  T('d_supers4', 'daily', 'supersUsed', 4, 'Utilise 4 SUPER', [{ type: 'coins', amount: 60 }], 60),
  T('d_feed3', 'daily', 'beastsFed', 3, 'Nourris 3 créatures', [{ type: 'energy', amount: 10 }], 50),
  T('d_harvest2', 'daily', 'harvests', 2, 'Récolte 2 parcelles', [{ type: 'coins', amount: 50 }], 50),
  T('d_dmg15k', 'daily', 'damage', 15000, 'Inflige 15 000 dégâts', [{ type: 'shards', amount: 25 }], 70),
  T('d_points10', 'daily', 'pointsDelivered', 10, 'Marque 10 points d’œufs', [{ type: 'coins', amount: 90 }], 80),
  // WEEKLY
  T('w_win15', 'weekly', 'wins', 15, 'Gagne 15 matchs', [{ type: 'chest', chestId: 'gold' }], 300),
  T('w_eggs25', 'weekly', 'eggsDelivered', 25, 'Livre 25 œufs', [{ type: 'gems', amount: 15 }], 300),
  T('w_titan2', 'weekly', 'titansDelivered', 2, 'Livre 2 œufs TITAN', [{ type: 'chest', chestId: 'beast' }], 350),
  T('w_kills60', 'weekly', 'kills', 60, 'Élimine 60 ennemis', [{ type: 'coins', amount: 500 }], 300),
  T('w_boss3', 'weekly', 'bossesKilled', 3, 'Vaincs 3 Boss en BOSS RAID', [{ type: 'gems', amount: 20 }], 350),
  T('w_breed2', 'weekly', 'beastsBred', 2, 'Fais naître 2 œufs par élevage', [{ type: 'energy', amount: 60 }], 250),
  T('w_up3', 'weekly', 'upgrades', 3, 'Améliore 3 fois un Jacker', [{ type: 'shards', amount: 120 }], 250),
  // SEASON
  T('s_win100', 'season', 'wins', 100, 'Gagne 100 matchs cette saison', [{ type: 'chest', chestId: 'mythic' }], 1000),
  T('s_titan15', 'season', 'titansDelivered', 15, 'Livre 15 œufs TITAN', [{ type: 'gems', amount: 60 }], 1000),
  T('s_evolve10', 'season', 'beastsEvolved', 10, 'Fais évoluer 10 créatures', [{ type: 'chest', chestId: 'beast' }], 800),
  T('s_hatch20', 'season', 'beastsHatched', 20, 'Fais éclore 20 créatures', [{ type: 'energy', amount: 200 }], 800),
  T('s_mvp20', 'season', 'mvp', 20, 'Sois MVP 20 fois', [{ type: 'gems', amount: 50 }], 900),
  T('s_camp30', 'season', 'campaignStars', 30, 'Gagne 30 étoiles de campagne', [{ type: 'chest', chestId: 'gold' }], 800),
  // BEAST
  T('b_hatch3', 'beast', 'beastsHatched', 3, 'Fais éclore 3 créatures', [{ type: 'energy', amount: 25 }], 120),
  T('b_feed10', 'beast', 'beastsFed', 10, 'Nourris 10 fois tes créatures', [{ type: 'food', foodId: 'stardrop', amount: 1 }], 100),
  T('b_evolve1', 'beast', 'beastsEvolved', 1, 'Fais évoluer une créature', [{ type: 'gems', amount: 10 }], 150),
  T('b_wild10', 'beast', 'wildCaptured', 10, 'Capture 10 créatures sauvages', [{ type: 'egg', rarity: 'rare' }], 150),
  T('b_breed1', 'beast', 'beastsBred', 1, 'Élève un nouvel œuf', [{ type: 'energy', amount: 30 }], 120),
  // COMBAT
  T('c_kills20', 'combat', 'kills', 20, 'Élimine 20 ennemis', [{ type: 'coins', amount: 150 }], 120),
  T('c_heal5k', 'combat', 'healing', 5000, 'Soigne 5 000 PV', [{ type: 'shards', amount: 40 }], 120),
  T('c_super10', 'combat', 'supersUsed', 10, 'Utilise 10 SUPER', [{ type: 'coins', amount: 120 }], 120),
  T('c_duel3', 'combat', 'duelWins', 3, 'Gagne 3 DUELS', [{ type: 'chest', chestId: 'silver' }], 150),
  T('c_surv2', 'combat', 'survivalWins', 2, 'Gagne 2 parties SURVIVAL', [{ type: 'chest', chestId: 'silver' }], 150),
  // EXPLORATION
  T('e_arenas3', 'exploration', 'arenasPlayed', 3, 'Joue sur 3 arènes différentes', [{ type: 'coins', amount: 120 }], 100),
  T('e_modes4', 'exploration', 'modesPlayed', 4, 'Joue 4 modes différents', [{ type: 'gems', amount: 8 }], 120),
  T('e_portal5', 'exploration', 'portalsUsed', 5, 'Utilise 5 portails', [{ type: 'coins', amount: 80 }], 80),
  T('e_jump10', 'exploration', 'jumpPads', 10, 'Utilise 10 trampolines', [{ type: 'coins', amount: 80 }], 80),
  T('e_camp5', 'exploration', 'campaignStars', 5, 'Gagne 5 étoiles de campagne', [{ type: 'chest', chestId: 'silver' }], 120),
];
