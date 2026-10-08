import type { Palette } from '../data/jackers';

/** Colour variants for mutated creatures. */
export function mutatePalette(p: Palette, mutation: string): Palette {
  switch (mutation) {
    case 'shiny':
      return { ...p, main: '#ffd23a', second: '#ff9a00', belly: '#fff3c9', accent: '#ffffff' };
    case 'shadow':
      return { ...p, main: '#2b1f4a', second: '#120c26', belly: '#4a3a7a', accent: '#c4ff3a' };
    case 'prism':
      return { ...p, main: '#ff9af0', second: '#7ff7ff', belly: '#ffffff', accent: '#ffe94d' };
    case 'giant':
      return { ...p, second: '#5a3a1a' };
    default:
      return p;
  }
}
