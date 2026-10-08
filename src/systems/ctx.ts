import { EventBus } from '../core/events';
import type { Reward } from '../data/economy';
import type { PlayerState } from './state';
import type { SaveSystem } from './save';

export interface GrantedItem {
  reward: Reward;
  label: string;
  icon: string;
  color: string;
  rarity?: string;
  isNew?: boolean;
}

export type MetaEvents = {
  changed: void;
  toast: { text: string; icon?: string; color?: string };
  granted: { items: GrantedItem[]; source: string };
  levelUp: { level: number };
  unlock: { kind: 'jacker' | 'arena' | 'mode' | 'skin'; id: string };
  stat: { key: string; total: number };
};

export interface Ctx {
  state: PlayerState;
  bus: EventBus<MetaEvents>;
  save: SaveSystem;
  rand: () => number;
  now: () => number;
  dirty(): void;
}
