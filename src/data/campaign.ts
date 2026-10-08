import { ARENAS } from './arenas';
import type { Difficulty, ModeId } from './modes';
import type { Reward } from './economy';

export interface CampaignLevel {
  id: string;
  num: number;
  chapter: number;
  name: string;
  arena: string;
  mode: ModeId;
  difficulty: Difficulty;
  reward: Reward;
}

const MODE_CYCLE: ModeId[] = ['beast_rush', 'gravity_war', 'beast_hunt'];
const DIFFS: Difficulty[] = ['easy', 'easy', 'normal', 'normal', 'normal', 'hard', 'hard', 'expert', 'expert', 'master'];
const NAMES = ['Premier Envol', 'Le Gardien', 'Chute Libre'];

export const CAMPAIGN: CampaignLevel[] = ARENAS.flatMap((a, ci) =>
  [0, 1, 2].map((k) => {
    const num = ci * 3 + k + 1;
    const mode: ModeId = k === 2 && ci % 2 === 1 ? 'boss_raid' : k === 2 && ci % 3 === 2 ? 'survival' : MODE_CYCLE[(ci + k) % 3];
    const reward: Reward = k === 2 ? { type: 'chest', chestId: ci >= 6 ? 'mythic' : ci >= 3 ? 'gold' : 'silver' } : k === 1 ? { type: 'gems', amount: 5 + ci } : { type: 'coins', amount: 100 + ci * 40 };
    return { id: `c${num}`, num, chapter: ci + 1, name: `${a.name} — ${NAMES[k]}`, arena: a.id, mode, difficulty: DIFFS[ci], reward };
  }),
);
