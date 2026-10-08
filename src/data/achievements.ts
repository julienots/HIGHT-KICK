import type { Reward } from './economy';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  stat: string;
  target: number;
  reward: Reward[];
}

type Group = { stat: string; icon: string; name: string; desc: (n: number) => string; tiers: number[] };
const GROUPS: Group[] = [
  { stat: 'wins', icon: '🏆', name: 'Vainqueur', desc: (n) => (n === 1 ? 'Remporte ta première victoire' : `Remporte ${n} victoires`), tiers: [1, 10, 50, 100, 500] },
  { stat: 'matches', icon: '🎮', name: 'Habitué', desc: (n) => `Joue ${n} matchs`, tiers: [1, 10, 100, 500, 1000] },
  { stat: 'kills', icon: '💥', name: 'Chasseur', desc: (n) => `Élimine ${n} ennemis`, tiers: [10, 100, 1000, 5000] },
  { stat: 'eggsDelivered', icon: '🥚', name: 'Livreur', desc: (n) => `Livre ${n} œufs`, tiers: [1, 25, 100, 500] },
  { stat: 'titansDelivered', icon: '👑', name: 'Titanesque', desc: (n) => (n === 1 ? 'Livre ton premier œuf TITAN' : `Livre ${n} œufs TITAN`), tiers: [1, 10, 50] },
  { stat: 'beastsOwned', icon: '🐾', name: 'Collectionneur', desc: (n) => `Possède ${n} créatures`, tiers: [5, 25, 50, 100] },
  { stat: 'speciesOwned', icon: '📖', name: 'Bestiaire', desc: (n) => `Découvre ${n} espèces`, tiers: [10, 25, 50] },
  { stat: 'beastsEvolved', icon: '🧬', name: 'Évolution', desc: (n) => `Fais évoluer ${n} créatures`, tiers: [1, 10, 50] },
  { stat: 'titanBeasts', icon: '🦖', name: 'Dompteur de Titans', desc: (n) => `Possède ${n} créature(s) TITAN`, tiers: [1, 5] },
  { stat: 'beastsBred', icon: '💞', name: 'Éleveur', desc: (n) => `Élève ${n} œufs`, tiers: [1, 10, 50] },
  { stat: 'beastsFed', icon: '🍖', name: 'Nourricier', desc: (n) => `Nourris ${n} fois tes créatures`, tiers: [10, 100, 500] },
  { stat: 'harvests', icon: '🌱', name: 'Fermier', desc: (n) => `Récolte ${n} parcelles`, tiers: [10, 100] },
  { stat: 'jackersOwned', icon: '🧑‍🚀', name: 'Recruteur', desc: (n) => `Possède ${n} Jackers`, tiers: [5, 10, 20] },
  { stat: 'jackersMaxLevel', icon: '⭐', name: 'Perfection', desc: (n) => `${n} Jacker(s) niveau maximum`, tiers: [1, 10] },
  { stat: 'chestsOpened', icon: '🎁', name: 'Ouvreur', desc: (n) => `Ouvre ${n} coffres`, tiers: [10, 100, 500] },
  { stat: 'trophies', icon: '🏅', name: 'Compétiteur', desc: (n) => `Atteins ${n} trophées`, tiers: [500, 1000, 3000, 7000] },
  { stat: 'nodesActivated', icon: '🧲', name: 'Maître Gravité', desc: (n) => `Active ${n} Gravity Nodes`, tiers: [10, 100, 500] },
  { stat: 'supersUsed', icon: '⚡', name: 'Super Héros', desc: (n) => `Utilise ${n} SUPER`, tiers: [50, 500] },
  { stat: 'bossesKilled', icon: '🐉', name: 'Tueur de Boss', desc: (n) => `Vaincs ${n} Boss`, tiers: [1, 25] },
  { stat: 'wildCaptured', icon: '🕸️', name: 'Trappeur', desc: (n) => `Capture ${n} créatures sauvages`, tiers: [25, 250] },
  { stat: 'survivalWins', icon: '💀', name: 'Survivant', desc: (n) => `Gagne ${n} parties SURVIVAL`, tiers: [10] },
  { stat: 'duelWins', icon: '⚔️', name: 'Duelliste', desc: (n) => `Gagne ${n} DUELS`, tiers: [10] },
  { stat: 'campaignStars', icon: '🌟', name: 'Aventurier', desc: (n) => `Gagne ${n} étoiles de campagne`, tiers: [30, 90] },
  { stat: 'skinsOwned', icon: '🎨', name: 'Fashion', desc: (n) => `Possède ${n} skins`, tiers: [5, 25] },
  { stat: 'playerLevel', icon: '📈', name: 'Vétéran', desc: (n) => `Atteins le niveau ${n}`, tiers: [10, 30, 50] },
  { stat: 'mvp', icon: '🌠', name: 'MVP', desc: (n) => `Sois MVP ${n} fois`, tiers: [1, 50] },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export const ACHIEVEMENTS: AchievementDef[] = GROUPS.flatMap((g) =>
  g.tiers.map((t, i) => {
    const gems = 5 + i * 10;
    const reward: Reward[] = i >= 2 ? [{ type: 'gems', amount: gems }, { type: 'chest', chestId: i >= 3 ? 'mythic' : 'gold' }] : [{ type: 'gems', amount: gems }, { type: 'coins', amount: 100 * (i + 1) }];
    return { id: `${g.stat}_${t}`, name: `${g.name} ${ROMAN[i]}`, desc: g.desc(t), icon: g.icon, stat: g.stat, target: t, reward };
  }),
);
