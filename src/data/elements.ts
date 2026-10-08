export type Element = 'flame' | 'aqua' | 'nature' | 'volt' | 'frost' | 'wind' | 'earth' | 'void' | 'light' | 'cosmic';

export const ELEMENTS: Element[] = ['flame', 'aqua', 'nature', 'volt', 'frost', 'wind', 'earth', 'void', 'light', 'cosmic'];

export interface ElementInfo {
  id: Element;
  name: string;
  icon: string;
  color: string;
  dark: string;
  strongVs: Element[];
}

export const ELEMENT_INFO: Record<Element, ElementInfo> = {
  flame: { id: 'flame', name: 'FLAME', icon: '🔥', color: '#ff6a2b', dark: '#9c2a0a', strongVs: ['nature', 'frost'] },
  aqua: { id: 'aqua', name: 'AQUA', icon: '💧', color: '#2bb8ff', dark: '#0b4f8f', strongVs: ['flame', 'earth'] },
  nature: { id: 'nature', name: 'NATURE', icon: '🌿', color: '#5fd63a', dark: '#22721a', strongVs: ['aqua', 'earth'] },
  volt: { id: 'volt', name: 'VOLT', icon: '⚡', color: '#ffd92b', dark: '#a07a00', strongVs: ['aqua', 'wind'] },
  frost: { id: 'frost', name: 'FROST', icon: '❄️', color: '#9ef0ff', dark: '#3a8fb0', strongVs: ['nature', 'wind'] },
  wind: { id: 'wind', name: 'WIND', icon: '🌪️', color: '#c6f5d8', dark: '#4f9c7a', strongVs: ['earth', 'flame'] },
  earth: { id: 'earth', name: 'EARTH', icon: '🪨', color: '#c48a4a', dark: '#5e3a17', strongVs: ['volt', 'frost'] },
  void: { id: 'void', name: 'VOID', icon: '🌑', color: '#8a4dff', dark: '#2e0d6b', strongVs: ['light', 'cosmic'] },
  light: { id: 'light', name: 'LIGHT', icon: '✨', color: '#fff3a8', dark: '#b39320', strongVs: ['void', 'wind'] },
  cosmic: { id: 'cosmic', name: 'COSMIC', icon: '🌌', color: '#ff5ad6', dark: '#6b1069', strongVs: ['light', 'flame'] },
};

/** Damage multiplier for attacker element vs defender element. */
export function elementMultiplier(att: Element, def: Element): number {
  if (ELEMENT_INFO[att].strongVs.includes(def)) return 1.25;
  if (ELEMENT_INFO[def].strongVs.includes(att)) return 0.85;
  return 1;
}
