import type { Element } from './elements';
import type { GravityType } from './gravity';

export type Role = 'tank' | 'assassin' | 'damage' | 'support' | 'control' | 'mobility' | 'hybrid';

export const ROLE_INFO: Record<Role, { name: string; icon: string; color: string }> = {
  tank: { name: 'TANK', icon: '🛡️', color: '#ff9a3a' },
  assassin: { name: 'ASSASSIN', icon: '🗡️', color: '#c45cff' },
  damage: { name: 'DAMAGE', icon: '💥', color: '#ff4d6d' },
  support: { name: 'SUPPORT', icon: '💚', color: '#4dff7a' },
  control: { name: 'CONTROL', icon: '🧲', color: '#2bb8ff' },
  mobility: { name: 'MOBILITY', icon: '💨', color: '#7ff7ff' },
  hybrid: { name: 'HYBRID', icon: '⚖️', color: '#ffd23a' },
};

export type AttackDef = {
  kind: 'bolt' | 'spread' | 'lob' | 'melee' | 'burst';
  name: string;
  dmg: number;
  range: number;
  speed?: number;
  size?: number;
  count?: number;
  angle?: number;
  radius?: number;
  pierce?: boolean;
  interval?: number;
  ammo: number;
  reload: number;
  slow?: number;
  knockback?: number;
};

export type AbilityDef =
  | { kind: 'dash'; dist: number; dmg: number; count?: number }
  | { kind: 'shield'; amount: number; duration: number; radius: number }
  | { kind: 'gravityZone'; gtype: GravityType; radius: number; duration: number; dps: number; strength: number; range: number }
  | { kind: 'chain'; dmg: number; jumps: number; range: number }
  | { kind: 'storm'; strikes: number; dmg: number; radius: number; area: number; range: number }
  | { kind: 'heal'; amount: number; radius: number; duration: number; speed?: number }
  | { kind: 'ring'; dmg: number; radius: number; knockback: number; stun: number }
  | { kind: 'blink'; dist: number; dmg: number; strike?: boolean }
  | { kind: 'cone'; dmg: number; angle: number; range: number; slow: number; knockback: number }
  | { kind: 'tornado'; dmg: number; speed: number; range: number; radius: number }
  | { kind: 'buff'; speed: number; dmgMult: number; duration: number; radius: number; rapid?: boolean }
  | { kind: 'turret'; hp: number; dmg: number; rate: number; range: number; duration: number }
  | { kind: 'wall'; count: number; range: number }
  | { kind: 'radial'; count: number; dmg: number; range: number; speed: number }
  | { kind: 'meteor'; dmg: number; radius: number; range: number; burn: number }
  | { kind: 'line'; dmg: number; range: number; width: number; stun: number };

export interface AbilitySlot {
  name: string;
  desc: string;
  icon: string;
  /** cooldown (skills) in seconds */
  cd?: number;
  def: AbilityDef;
}

export type PassiveKind =
  | 'regen'
  | 'lifesteal'
  | 'speedLowHp'
  | 'shieldOnSkill'
  | 'carrierSpeed'
  | 'superCharge'
  | 'burn'
  | 'slowOnHit'
  | 'firstHitCrit'
  | 'thorns'
  | 'healOnSuper'
  | 'damageReduction'
  | 'reloadSpeed'
  | 'nodeMaster'
  | 'executioner';

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  kind: PassiveKind;
  value: number;
}

export type GadgetKind = 'heal' | 'speed' | 'shield' | 'push' | 'blink' | 'gravityPulse' | 'reload' | 'decoy';
export interface GadgetDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: GadgetKind;
  value: number;
}

export type SpecialKind = 'superBig' | 'skillCd' | 'superHeal' | 'skillDmg' | 'superFast' | 'attackRange';
export interface SpecialDef {
  id: string;
  name: string;
  desc: string;
  kind: SpecialKind;
  value: number;
}

export type BodyPlan = 'biped' | 'quad' | 'blob' | 'bird' | 'octo' | 'golem' | 'serpent' | 'bot';
export interface ModelDef {
  plan: BodyPlan;
  ears: 'pointy' | 'round' | 'long' | 'fin' | 'none' | 'tuft';
  tail: 'fluffy' | 'thin' | 'none' | 'flame' | 'leaf' | 'stub' | 'fan';
  horns: 'none' | 'small' | 'big' | 'antlers' | 'single' | 'crystal' | 'antenna';
  extras: string[];
  head: number;
  body: number;
  size: number;
}

export interface Palette {
  main: string;
  second: string;
  belly: string;
  accent: string;
  eye: string;
}

export interface JackerDef {
  id: string;
  name: string;
  title: string;
  role: Role;
  element: Element;
  lore: string;
  hp: number;
  speed: number;
  attack: AttackDef;
  skill: AbilitySlot;
  super: AbilitySlot;
  /** damage needed to fully charge super */
  superCost: number;
  passive: PassiveDef;
  starPowers: [PassiveDef, PassiveDef];
  gadgets: [GadgetDef, GadgetDef];
  specials: [SpecialDef, SpecialDef];
  model: ModelDef;
  palette: Palette;
  /** trophies needed on the Trophy Road to unlock (0 = starter) */
  unlockTrophies: number;
  voice: number;
}

const P = (id: string, name: string, desc: string, kind: PassiveKind, value: number): PassiveDef => ({ id, name, desc, kind, value });
const G = (id: string, name: string, desc: string, icon: string, kind: GadgetKind, value: number): GadgetDef => ({ id, name, desc, icon, kind, value });
const S = (id: string, name: string, desc: string, kind: SpecialKind, value: number): SpecialDef => ({ id, name, desc, kind, value });

export const JACKERS: JackerDef[] = [
  {
    id: 'vex', name: 'VEX', title: 'Renard Éclair', role: 'assassin', element: 'flame',
    lore: 'Petit renard débordant d’énergie. Il a appris à courir plus vite que les comètes de Sky Jungle.',
    hp: 3200, speed: 7.4,
    attack: { kind: 'melee', name: 'Griffes d’énergie', dmg: 620, range: 2.6, angle: 1.6, ammo: 3, reload: 0.9 },
    skill: { name: 'DASH', desc: 'Bondit en avant et blesse au passage.', icon: '💨', cd: 5, def: { kind: 'dash', dist: 7, dmg: 500 } },
    super: { name: 'TRIPLE DASH', desc: 'Enchaîne trois dashs foudroyants sur les ennemis proches.', icon: '⚡', def: { kind: 'dash', dist: 7, dmg: 900, count: 3 } },
    superCost: 3000,
    passive: P('vex_p', 'Instinct', '+20% vitesse quand PV < 40%.', 'speedLowHp', 0.2),
    starPowers: [P('vex_s1', 'Griffes Brûlantes', 'Les attaques brûlent (+250 dégâts sur 2s).', 'burn', 250), P('vex_s2', 'Chasseur', '+30% dégâts sur les cibles < 50% PV.', 'executioner', 0.3)],
    gadgets: [G('vex_g1', 'Pas Fantôme', 'Téléportation courte.', '👻', 'blink', 5), G('vex_g2', 'Turbo Queue', 'Vitesse +50% pendant 3s.', '🦊', 'speed', 0.5)],
    specials: [S('vex_x1', 'Dash Express', 'Recharge du DASH -30%.', 'skillCd', 0.3), S('vex_x2', 'Combo Infini', 'SUPER chargé 25% plus vite.', 'superFast', 0.25)],
    model: { plan: 'biped', ears: 'pointy', tail: 'fluffy', horns: 'none', extras: ['scarf'], head: 1.1, body: 0.85, size: 0.95 },
    palette: { main: '#ff7a1f', second: '#fff1dc', belly: '#fff1dc', accent: '#2bd4ff', eye: '#1b1440' },
    unlockTrophies: 0, voice: 1.4,
  },
  {
    id: 'boulder', name: 'BOULDER', title: 'Colosse de Roche', role: 'tank', element: 'earth',
    lore: 'Une montagne qui a décidé de se lever. Il protège les œufs comme ses propres galets.',
    hp: 6800, speed: 5.6,
    attack: { kind: 'melee', name: 'Poing Rocheux', dmg: 900, range: 3, angle: 1.9, ammo: 3, reload: 1.2, knockback: 4 },
    skill: { name: 'BOUCLIER ROCHEUX', desc: 'Se couvre de pierre : absorbe 2500 dégâts.', icon: '🪨', cd: 9, def: { kind: 'shield', amount: 2500, duration: 4, radius: 0 } },
    super: { name: 'GRAVITY CRUSH', desc: 'Écrase le sol : zone de gravité extrême qui ralentit et blesse.', icon: '🏋️', def: { kind: 'gravityZone', gtype: 'heavy', radius: 5.5, duration: 4, dps: 700, strength: 1, range: 0 } },
    superCost: 3800,
    passive: P('boulder_p', 'Peau de Granite', '-15% dégâts reçus.', 'damageReduction', 0.15),
    starPowers: [P('boulder_s1', 'Épines de Quartz', 'Renvoie 20% des dégâts de mêlée.', 'thorns', 0.2), P('boulder_s2', 'Racines', 'Régénère 300 PV/s hors combat.', 'regen', 300)],
    gadgets: [G('boulder_g1', 'Onde Sismique', 'Repousse les ennemis proches.', '🌋', 'push', 6), G('boulder_g2', 'Carapace', 'Bouclier de 1500.', '🧱', 'shield', 1500)],
    specials: [S('boulder_x1', 'Crush Géant', 'Zone de SUPER +35%.', 'superBig', 0.35), S('boulder_x2', 'Mur Vivant', 'SUPER soigne de 20% PV.', 'superHeal', 0.2)],
    model: { plan: 'golem', ears: 'none', tail: 'none', horns: 'crystal', extras: ['moss'], head: 0.8, body: 1.4, size: 1.25 },
    palette: { main: '#8f7a68', second: '#5d4b3f', belly: '#b9a48f', accent: '#5fe0ff', eye: '#ffe14a' },
    unlockTrophies: 0, voice: 0.6,
  },
  {
    id: 'oona', name: 'OONA', title: 'Reine des Abysses', role: 'control', element: 'aqua',
    lore: 'Une pieuvre sage qui manipule les courants de gravité comme des vagues.',
    hp: 3900, speed: 6.2,
    attack: { kind: 'bolt', name: 'Orbes d’encre', dmg: 520, range: 9, speed: 16, size: 0.45, ammo: 3, reload: 1.1, slow: 0.25 },
    skill: { name: 'VORTEX', desc: 'Crée un tourbillon qui aspire les ennemis.', icon: '🌀', cd: 8, def: { kind: 'gravityZone', gtype: 'vortex', radius: 4, duration: 2.5, dps: 300, strength: 9, range: 8 } },
    super: { name: 'ABYSSAL PULL', desc: 'Gigantesque vortex abyssal qui aspire, ralentit et broie.', icon: '🐙', def: { kind: 'gravityZone', gtype: 'vortex', radius: 7, duration: 3.5, dps: 650, strength: 16, range: 9 } },
    superCost: 3000,
    passive: P('oona_p', 'Courants', 'Les attaques ralentissent de 25%.', 'slowOnHit', 0.25),
    starPowers: [P('oona_s1', 'Maîtresse des Nodes', 'Les Gravity Nodes activés durent 50% plus longtemps.', 'nodeMaster', 0.5), P('oona_s2', 'Marée', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2)],
    gadgets: [G('oona_g1', 'Bulle', 'Bouclier de 1200.', '🫧', 'shield', 1200), G('oona_g2', 'Pulse', 'Impulsion de répulsion.', '💥', 'gravityPulse', 8)],
    specials: [S('oona_x1', 'Abysse Profond', 'Zone de SUPER +30%.', 'superBig', 0.3), S('oona_x2', 'Vortex Rapide', 'Recharge du VORTEX -30%.', 'skillCd', 0.3)],
    model: { plan: 'octo', ears: 'fin', tail: 'none', horns: 'none', extras: ['crown'], head: 1.25, body: 0.8, size: 1 },
    palette: { main: '#7a5cff', second: '#ff8ad8', belly: '#ffd6f2', accent: '#38f0ff', eye: '#ffffff' },
    unlockTrophies: 0, voice: 1.1,
  },
  {
    id: 'aero', name: 'AERO', title: 'Plume Céleste', role: 'mobility', element: 'wind',
    lore: 'Un oiseau-éclair qui n’a jamais touché le sol plus de trois secondes.',
    hp: 3300, speed: 7.2,
    attack: { kind: 'spread', name: 'Plumes Tranchantes', dmg: 340, range: 8, speed: 20, size: 0.3, count: 3, angle: 0.45, ammo: 3, reload: 1 },
    skill: { name: 'DASH AÉRIEN', desc: 'S’envole en avant au-dessus des obstacles et des gouffres.', icon: '🪽', cd: 6, def: { kind: 'blink', dist: 8, dmg: 0 } },
    super: { name: 'TORNADO', desc: 'Lance une tornade qui avance, aspire et blesse.', icon: '🌪️', def: { kind: 'tornado', dmg: 500, speed: 6, range: 14, radius: 2.8 } },
    superCost: 2800,
    passive: P('aero_p', 'Porteur Ailé', '+15% vitesse en portant un œuf.', 'carrierSpeed', 0.15),
    starPowers: [P('aero_s1', 'Vent Arrière', 'Recharge des munitions +25%.', 'reloadSpeed', 0.25), P('aero_s2', 'Courant Ascendant', '+20% vitesse quand PV < 40%.', 'speedLowHp', 0.2)],
    gadgets: [G('aero_g1', 'Rafale', 'Vitesse +60% pendant 2s.', '💨', 'speed', 0.6), G('aero_g2', 'Plongeon', 'Téléportation courte.', '🪶', 'blink', 6)],
    specials: [S('aero_x1', 'Ouragan', 'SUPER plus large de 30%.', 'superBig', 0.3), S('aero_x2', 'Ailes Légères', 'Recharge du DASH -30%.', 'skillCd', 0.3)],
    model: { plan: 'bird', ears: 'tuft', tail: 'fan', horns: 'none', extras: ['goggles'], head: 1.05, body: 0.8, size: 0.95 },
    palette: { main: '#3ad6c8', second: '#ffffff', belly: '#e9fffb', accent: '#ffcc33', eye: '#14213d' },
    unlockTrophies: 0, voice: 1.6,
  },
  {
    id: 'volt', name: 'VOLT', title: 'Foudre Vivante', role: 'damage', element: 'volt',
    lore: 'Une petite boule d’électricité au grand cœur… et aux gros dégâts.',
    hp: 3000, speed: 6.3,
    attack: { kind: 'bolt', name: 'Arc Électrique', dmg: 780, range: 11, speed: 24, size: 0.35, ammo: 3, reload: 1.15 },
    skill: { name: 'CHAIN LIGHTNING', desc: 'Éclair qui rebondit entre les ennemis.', icon: '⚡', cd: 7, def: { kind: 'chain', dmg: 700, jumps: 3, range: 9 } },
    super: { name: 'THUNDER STORM', desc: 'Déchaîne un orage : la foudre frappe la zone.', icon: '🌩️', def: { kind: 'storm', strikes: 8, dmg: 650, radius: 1.8, area: 5, range: 10 } },
    superCost: 3200,
    passive: P('volt_p', 'Surtension', 'La 1re attaque après 3s inflige +50%.', 'firstHitCrit', 0.5),
    starPowers: [P('volt_s1', 'Dynamo', 'SUPER chargé 25% plus vite.', 'superCharge', 0.25), P('volt_s2', 'Court-circuit', 'Les attaques ralentissent de 20%.', 'slowOnHit', 0.2)],
    gadgets: [G('volt_g1', 'Recharge Flash', 'Recharge toutes les munitions.', '🔋', 'reload', 3), G('volt_g2', 'Décharge', 'Repousse les ennemis proches.', '💥', 'push', 5)],
    specials: [S('volt_x1', 'Super Cellule', 'Zone d’orage +30%.', 'superBig', 0.3), S('volt_x2', 'Haute Tension', 'Dégâts de CHAIN +40%.', 'skillDmg', 0.4)],
    model: { plan: 'blob', ears: 'pointy', tail: 'thin', horns: 'antenna', extras: ['sparks'], head: 1, body: 1, size: 0.9 },
    palette: { main: '#ffd92b', second: '#2b2f5a', belly: '#fff7c2', accent: '#38c8ff', eye: '#1b1440' },
    unlockTrophies: 0, voice: 1.3,
  },
  {
    id: 'pyra', name: 'PYRA', title: 'Salamandre Ardente', role: 'damage', element: 'flame',
    lore: 'Née dans la lave de Lava Core, elle lance des boules de feu comme d’autres lancent des cailloux.',
    hp: 3100, speed: 6.1,
    attack: { kind: 'lob', name: 'Boule de Lave', dmg: 820, range: 9, radius: 2, ammo: 3, reload: 1.3 },
    skill: { name: 'EMBER BURST', desc: 'Explosion de braises autour d’elle.', icon: '🔥', cd: 7, def: { kind: 'ring', dmg: 800, radius: 3.6, knockback: 6, stun: 0 } },
    super: { name: 'MÉTÉORE', desc: 'Fait tomber un énorme météore qui laisse le sol en feu.', icon: '☄️', def: { kind: 'meteor', dmg: 1800, radius: 4, range: 11, burn: 400 } },
    superCost: 3200,
    passive: P('pyra_p', 'Brûlure', 'Les attaques brûlent (+200 sur 2s).', 'burn', 200),
    starPowers: [P('pyra_s1', 'Cœur de Magma', 'Régénère 250 PV/s hors combat.', 'regen', 250), P('pyra_s2', 'Pyromanie', '+25% dégâts sur cibles < 50% PV.', 'executioner', 0.25)],
    gadgets: [G('pyra_g1', 'Sang Chaud', 'Soigne 1200 PV.', '❤️‍🔥', 'heal', 1200), G('pyra_g2', 'Flamme Vive', 'Vitesse +40% pendant 3s.', '🔥', 'speed', 0.4)],
    specials: [S('pyra_x1', 'Super Nova', 'Météore +30% de zone.', 'superBig', 0.3), S('pyra_x2', 'Feu Sacré', 'Portée d’attaque +15%.', 'attackRange', 0.15)],
    model: { plan: 'quad', ears: 'none', tail: 'flame', horns: 'small', extras: ['spots'], head: 1.1, body: 1, size: 0.95 },
    palette: { main: '#ff4d3d', second: '#ffb03a', belly: '#ffe0a3', accent: '#ffe94d', eye: '#2a0f0f' },
    unlockTrophies: 60, voice: 1.2,
  },
  {
    id: 'mossly', name: 'MOSSLY', title: 'Paresseux Mousse', role: 'support', element: 'nature',
    lore: 'Il dort beaucoup, mais quand il se réveille, toute l’équipe refleurit.',
    hp: 3800, speed: 6,
    attack: { kind: 'burst', name: 'Graines Rebondissantes', dmg: 280, range: 9, speed: 18, size: 0.3, count: 3, interval: 0.09, ammo: 3, reload: 1.2 },
    skill: { name: 'HEALING BLOOM', desc: 'Fleur de soin qui régénère les alliés proches.', icon: '🌸', cd: 9, def: { kind: 'heal', amount: 1800, radius: 5, duration: 3 } },
    super: { name: 'GROVE', desc: 'Forêt sacrée : soin massif et vitesse pour l’équipe.', icon: '🌳', def: { kind: 'heal', amount: 3500, radius: 8, duration: 4, speed: 0.3 } },
    superCost: 2600,
    passive: P('mossly_p', 'Photosynthèse', 'Régénère 220 PV/s hors combat.', 'regen', 220),
    starPowers: [P('mossly_s1', 'Sève Vampire', 'Vol de vie 20%.', 'lifesteal', 0.2), P('mossly_s2', 'Bourgeon', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2)],
    gadgets: [G('mossly_g1', 'Fruit Juteux', 'Soigne 1500 PV.', '🍐', 'heal', 1500), G('mossly_g2', 'Épines', 'Bouclier de 1200.', '🌵', 'shield', 1200)],
    specials: [S('mossly_x1', 'Jardin Infini', 'GROVE +35% de zone.', 'superBig', 0.35), S('mossly_x2', 'Floraison', 'Recharge du BLOOM -30%.', 'skillCd', 0.3)],
    model: { plan: 'biped', ears: 'round', tail: 'stub', horns: 'none', extras: ['moss', 'flower'], head: 1.05, body: 1.1, size: 1 },
    palette: { main: '#8a6a4a', second: '#6fd64a', belly: '#e7d3b0', accent: '#ff8ad8', eye: '#1b1440' },
    unlockTrophies: 120, voice: 0.8,
  },
  {
    id: 'glacia', name: 'GLACIA', title: 'Chevalière du Givre', role: 'control', element: 'frost',
    lore: 'Une manchote chevalier du Frozen Ring. Son épée de glace gèle même les éclairs.',
    hp: 4200, speed: 6,
    attack: { kind: 'bolt', name: 'Éclat de Glace', dmg: 640, range: 9.5, speed: 20, size: 0.4, pierce: true, ammo: 3, reload: 1.2, slow: 0.2 },
    skill: { name: 'FREEZE WAVE', desc: 'Onde glacée en cône qui ralentit fortement.', icon: '❄️', cd: 8, def: { kind: 'cone', dmg: 600, angle: 1.2, range: 7, slow: 0.6, knockback: 0 } },
    super: { name: 'BLIZZARD', desc: 'Tempête de neige : les ennemis dans la zone sont gelés.', icon: '🌨️', def: { kind: 'line', dmg: 1200, range: 12, width: 3.2, stun: 1.6 } },
    superCost: 3300,
    passive: P('glacia_p', 'Froid Mordant', 'Les attaques ralentissent de 20%.', 'slowOnHit', 0.2),
    starPowers: [P('glacia_s1', 'Armure de Givre', '-15% dégâts reçus.', 'damageReduction', 0.15), P('glacia_s2', 'Cristaux', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2)],
    gadgets: [G('glacia_g1', 'Mur de Glace', 'Bouclier de 1500.', '🧊', 'shield', 1500), G('glacia_g2', 'Glissade', 'Vitesse +50% pendant 2.5s.', '⛸️', 'speed', 0.5)],
    specials: [S('glacia_x1', 'Ère Glaciaire', 'BLIZZARD +30% de zone.', 'superBig', 0.3), S('glacia_x2', 'Givre Tranchant', 'Dégâts de FREEZE WAVE +40%.', 'skillDmg', 0.4)],
    model: { plan: 'biped', ears: 'none', tail: 'stub', horns: 'none', extras: ['helmet', 'beak'], head: 1, body: 1.05, size: 0.95 },
    palette: { main: '#25345e', second: '#ffffff', belly: '#ffffff', accent: '#7ff7ff', eye: '#14213d' },
    unlockTrophies: 200, voice: 1.1,
  },
  {
    id: 'nox', name: 'NOX', title: 'Chat du Néant', role: 'assassin', element: 'void',
    lore: 'Personne ne l’a jamais vu arriver. Tout le monde l’a vu repartir.',
    hp: 3100, speed: 7.2,
    attack: { kind: 'melee', name: 'Griffe d’Ombre', dmg: 700, range: 2.5, angle: 1.4, ammo: 3, reload: 0.95 },
    skill: { name: 'BLINK', desc: 'Se téléporte dans la direction visée.', icon: '🌑', cd: 6, def: { kind: 'blink', dist: 7, dmg: 300 } },
    super: { name: 'VOID RIFT', desc: 'Surgit sur l’ennemi le plus proche et frappe violemment.', icon: '🕳️', def: { kind: 'blink', dist: 12, dmg: 2000, strike: true } },
    superCost: 3000,
    passive: P('nox_p', 'Prédateur', '+25% dégâts sur cibles < 50% PV.', 'executioner', 0.25),
    starPowers: [P('nox_s1', 'Ombre Vorace', 'Vol de vie 25%.', 'lifesteal', 0.25), P('nox_s2', 'Silence', 'La 1re attaque après 3s inflige +60%.', 'firstHitCrit', 0.6)],
    gadgets: [G('nox_g1', 'Leurre', 'Laisse un leurre et devient plus rapide.', '🐈‍⬛', 'decoy', 0.4), G('nox_g2', 'Fondu', 'Téléportation courte.', '🌘', 'blink', 6)],
    specials: [S('nox_x1', 'Pas de l’Ombre', 'Recharge du BLINK -35%.', 'skillCd', 0.35), S('nox_x2', 'Faim du Néant', 'SUPER chargé 25% plus vite.', 'superFast', 0.25)],
    model: { plan: 'biped', ears: 'pointy', tail: 'thin', horns: 'none', extras: ['mask'], head: 1.1, body: 0.85, size: 0.92 },
    palette: { main: '#2b1f4a', second: '#8a4dff', belly: '#4a3a7a', accent: '#c4ff3a', eye: '#c4ff3a' },
    unlockTrophies: 300, voice: 1.2,
  },
  {
    id: 'solis', name: 'SOLIS', title: 'Lion Solaire', role: 'hybrid', element: 'light',
    lore: 'Un jeune lion à la crinière de soleil. Il rayonne autant qu’il rugit.',
    hp: 4600, speed: 6.3,
    attack: { kind: 'bolt', name: 'Lance de Lumière', dmg: 700, range: 10, speed: 22, size: 0.4, pierce: true, ammo: 3, reload: 1.2 },
    skill: { name: 'RADIANT SHIELD', desc: 'Bouclier de lumière pour lui et ses alliés proches.', icon: '🛡️', cd: 10, def: { kind: 'shield', amount: 1200, duration: 4, radius: 5 } },
    super: { name: 'SOLAR FLARE', desc: 'Éruption solaire en cône : dégâts massifs et ralentissement.', icon: '☀️', def: { kind: 'cone', dmg: 1600, angle: 1.0, range: 10, slow: 0.4, knockback: 5 } },
    superCost: 3400,
    passive: P('solis_p', 'Aura Royale', 'Régénère 200 PV/s hors combat.', 'regen', 200),
    starPowers: [P('solis_s1', 'Gloire', 'SUPER soigne les alliés de 15%.', 'healOnSuper', 0.15), P('solis_s2', 'Rugissement', '-12% dégâts reçus.', 'damageReduction', 0.12)],
    gadgets: [G('solis_g1', 'Lumière Vitale', 'Soigne 1300 PV.', '✨', 'heal', 1300), G('solis_g2', 'Rayon', 'Repousse les ennemis proches.', '🌞', 'push', 5)],
    specials: [S('solis_x1', 'Zénith', 'SOLAR FLARE +30% de portée.', 'superBig', 0.3), S('solis_x2', 'Aube', 'Recharge du bouclier -30%.', 'skillCd', 0.3)],
    model: { plan: 'quad', ears: 'round', tail: 'thin', horns: 'none', extras: ['mane'], head: 1.1, body: 1.05, size: 1.05 },
    palette: { main: '#ffcf5a', second: '#ff8a1f', belly: '#fff3c9', accent: '#ffffff', eye: '#3a1c00' },
    unlockTrophies: 400, voice: 0.9,
  },
  {
    id: 'cosmo', name: 'COSMO', title: 'Axolotl Astronaute', role: 'control', element: 'cosmic',
    lore: 'Tombé d’une étoile filante, il cherche encore le chemin de sa galaxie.',
    hp: 3500, speed: 6.4,
    attack: { kind: 'bolt', name: 'Orbe Stellaire', dmg: 560, range: 10, speed: 15, size: 0.55, ammo: 3, reload: 1.1 },
    skill: { name: 'BULLE LOW-G', desc: 'Zone d’apesanteur : les ennemis flottent et ralentissent.', icon: '🫧', cd: 9, def: { kind: 'gravityZone', gtype: 'low', radius: 4.5, duration: 3.5, dps: 200, strength: 1, range: 8 } },
    super: { name: 'BLACK HOLE', desc: 'Trou noir qui aspire tout et explose.', icon: '🕳️', def: { kind: 'gravityZone', gtype: 'orbit', radius: 6.5, duration: 3.5, dps: 750, strength: 12, range: 9 } },
    superCost: 3200,
    passive: P('cosmo_p', 'Navigateur', 'Gravity Nodes activés +40% de durée.', 'nodeMaster', 0.4),
    starPowers: [P('cosmo_s1', 'Poussière d’Étoile', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2), P('cosmo_s2', 'Orbite Basse', 'Les attaques ralentissent de 20%.', 'slowOnHit', 0.2)],
    gadgets: [G('cosmo_g1', 'Antigravité', 'Impulsion de répulsion.', '🪐', 'gravityPulse', 8), G('cosmo_g2', 'Jetpack', 'Vitesse +50% pendant 3s.', '🚀', 'speed', 0.5)],
    specials: [S('cosmo_x1', 'Singularité', 'BLACK HOLE +30% de zone.', 'superBig', 0.3), S('cosmo_x2', 'Microgravité', 'Recharge de la bulle -30%.', 'skillCd', 0.3)],
    model: { plan: 'biped', ears: 'fin', tail: 'thin', horns: 'none', extras: ['helmet_glass', 'gills'], head: 1.2, body: 0.9, size: 0.9 },
    palette: { main: '#ff9ad6', second: '#ffffff', belly: '#ffe1f2', accent: '#7a5cff', eye: '#14213d' },
    unlockTrophies: 500, voice: 1.5,
  },
  {
    id: 'rumble', name: 'RUMBLE', title: 'Rhino Bulldozer', role: 'tank', element: 'earth',
    lore: 'Il ne connaît qu’une direction : tout droit. À travers les murs si nécessaire.',
    hp: 6200, speed: 5.9,
    attack: { kind: 'melee', name: 'Coup de Corne', dmg: 880, range: 2.8, angle: 1.5, ammo: 3, reload: 1.1, knockback: 5 },
    skill: { name: 'CHARGE', desc: 'Charge et projette les ennemis.', icon: '🦏', cd: 7, def: { kind: 'dash', dist: 9, dmg: 700 } },
    super: { name: 'EARTHQUAKE', desc: 'Séisme : étourdit et repousse tout autour.', icon: '🌋', def: { kind: 'ring', dmg: 1300, radius: 6, knockback: 9, stun: 1.2 } },
    superCost: 3600,
    passive: P('rumble_p', 'Cuirasse', '-12% dégâts reçus.', 'damageReduction', 0.12),
    starPowers: [P('rumble_s1', 'Rage', '+25% vitesse quand PV < 40%.', 'speedLowHp', 0.25), P('rumble_s2', 'Cornes d’Acier', 'Renvoie 20% des dégâts.', 'thorns', 0.2)],
    gadgets: [G('rumble_g1', 'Plaque', 'Bouclier de 2000.', '🛡️', 'shield', 2000), G('rumble_g2', 'Coup de Sabot', 'Repousse les ennemis proches.', '🐾', 'push', 6)],
    specials: [S('rumble_x1', 'Faille', 'EARTHQUAKE +30% de zone.', 'superBig', 0.3), S('rumble_x2', 'Inarrêtable', 'Dégâts de CHARGE +40%.', 'skillDmg', 0.4)],
    model: { plan: 'quad', ears: 'round', tail: 'stub', horns: 'big', extras: ['armor'], head: 1, body: 1.35, size: 1.2 },
    palette: { main: '#7e8aa3', second: '#4f5a73', belly: '#b9c3d6', accent: '#ffcc33', eye: '#14213d' },
    unlockTrophies: 650, voice: 0.55,
  },
  {
    id: 'zippy', name: 'ZIPPY', title: 'Colibri Turbo', role: 'mobility', element: 'volt',
    lore: 'Le plus rapide du ring. Ses ailes battent 400 fois par seconde.',
    hp: 2900, speed: 7.6,
    attack: { kind: 'burst', name: 'Fléchettes Zap', dmg: 230, range: 8.5, speed: 26, size: 0.25, count: 4, interval: 0.07, ammo: 3, reload: 0.95 },
    skill: { name: 'HYPER DASH', desc: 'Dash ultra-rapide.', icon: '💫', cd: 4.5, def: { kind: 'dash', dist: 8, dmg: 300 } },
    super: { name: 'OVERDRIVE', desc: 'Vitesse et cadence de tir décuplées.', icon: '⚡', def: { kind: 'buff', speed: 0.5, dmgMult: 1.3, duration: 6, radius: 0, rapid: true } },
    superCost: 2600,
    passive: P('zippy_p', 'Livreur Express', '+20% vitesse en portant un œuf.', 'carrierSpeed', 0.2),
    starPowers: [P('zippy_s1', 'Batterie', 'Recharge des munitions +25%.', 'reloadSpeed', 0.25), P('zippy_s2', 'Hyperactif', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2)],
    gadgets: [G('zippy_g1', 'Nectar', 'Soigne 1000 PV.', '🌺', 'heal', 1000), G('zippy_g2', 'Zap', 'Téléportation courte.', '⚡', 'blink', 6)],
    specials: [S('zippy_x1', 'Overclock', 'OVERDRIVE dure 30% plus longtemps.', 'superBig', 0.3), S('zippy_x2', 'Ailes Folles', 'Recharge du DASH -30%.', 'skillCd', 0.3)],
    model: { plan: 'bird', ears: 'none', tail: 'fan', horns: 'antenna', extras: ['beak_long'], head: 1.1, body: 0.75, size: 0.85 },
    palette: { main: '#2bff9a', second: '#ff3a8a', belly: '#e9fff4', accent: '#ffd92b', eye: '#14213d' },
    unlockTrophies: 800, voice: 1.8,
  },
  {
    id: 'totem', name: 'TOTEM', title: 'Hibou Chaman', role: 'support', element: 'wind',
    lore: 'Le gardien des Ancient Ruins. Ses totems murmurent avec le vent.',
    hp: 3600, speed: 6.1,
    attack: { kind: 'bolt', name: 'Orbe de Vent', dmg: 600, range: 10, speed: 17, size: 0.45, ammo: 3, reload: 1.15 },
    skill: { name: 'TOTEM DE VITESSE', desc: 'Aura qui accélère et renforce les alliés.', icon: '🗿', cd: 10, def: { kind: 'buff', speed: 0.3, dmgMult: 1.15, duration: 5, radius: 6 } },
    super: { name: 'SANCTUAIRE', desc: 'Bouclier massif pour toute l’équipe proche.', icon: '🪶', def: { kind: 'shield', amount: 2500, duration: 5, radius: 8 } },
    superCost: 2800,
    passive: P('totem_p', 'Sagesse', 'SUPER chargé 15% plus vite.', 'superCharge', 0.15),
    starPowers: [P('totem_s1', 'Esprit Gardien', 'Le SUPER soigne de 20%.', 'healOnSuper', 0.2), P('totem_s2', 'Brise', 'Régénère 250 PV/s hors combat.', 'regen', 250)],
    gadgets: [G('totem_g1', 'Plume Sacrée', 'Soigne 1400 PV.', '🪶', 'heal', 1400), G('totem_g2', 'Bourrasque', 'Repousse les ennemis proches.', '🌬️', 'push', 6)],
    specials: [S('totem_x1', 'Grand Esprit', 'SANCTUAIRE +35% de zone.', 'superBig', 0.35), S('totem_x2', 'Rituel', 'Recharge du TOTEM -30%.', 'skillCd', 0.3)],
    model: { plan: 'bird', ears: 'tuft', tail: 'fan', horns: 'none', extras: ['feather_crown', 'big_eyes'], head: 1.2, body: 1, size: 1 },
    palette: { main: '#8f6bd6', second: '#ffcc66', belly: '#f2e3ff', accent: '#4dffd8', eye: '#ffcc33' },
    unlockTrophies: 950, voice: 0.9,
  },
  {
    id: 'krakk', name: 'KRAKK', title: 'Crabe Forteresse', role: 'tank', element: 'aqua',
    lore: 'Une carapace de corail, des pinces d’acier, un cœur d’or.',
    hp: 6400, speed: 5.7,
    attack: { kind: 'spread', name: 'Pince-Bulles', dmg: 420, range: 6, speed: 16, size: 0.4, count: 4, angle: 0.7, ammo: 3, reload: 1.15 },
    skill: { name: 'CARAPACE', desc: 'Se replie : énorme bouclier.', icon: '🦀', cd: 9, def: { kind: 'shield', amount: 3000, duration: 3.5, radius: 0 } },
    super: { name: 'TIDAL WAVE', desc: 'Raz-de-marée qui repousse et blesse.', icon: '🌊', def: { kind: 'cone', dmg: 1300, angle: 1.4, range: 9, slow: 0.3, knockback: 12 } },
    superCost: 3600,
    passive: P('krakk_p', 'Coquille', '-15% dégâts reçus.', 'damageReduction', 0.15),
    starPowers: [P('krakk_s1', 'Corail Vivant', 'Régénère 320 PV/s hors combat.', 'regen', 320), P('krakk_s2', 'Pinces Piquantes', 'Renvoie 25% des dégâts.', 'thorns', 0.25)],
    gadgets: [G('krakk_g1', 'Algue', 'Soigne 1600 PV.', '🌿', 'heal', 1600), G('krakk_g2', 'Vague', 'Impulsion de répulsion.', '🌊', 'gravityPulse', 7)],
    specials: [S('krakk_x1', 'Tsunami', 'TIDAL WAVE +30% de zone.', 'superBig', 0.3), S('krakk_x2', 'Repli Rapide', 'Recharge de CARAPACE -30%.', 'skillCd', 0.3)],
    model: { plan: 'golem', ears: 'none', tail: 'none', horns: 'antenna', extras: ['claws', 'shell'], head: 0.8, body: 1.3, size: 1.15 },
    palette: { main: '#ff5a4d', second: '#ffb38a', belly: '#ffe3d1', accent: '#38f0ff', eye: '#14213d' },
    unlockTrophies: 1100, voice: 0.7,
  },
  {
    id: 'emberjaw', name: 'EMBERJAW', title: 'Dragonnet Rugissant', role: 'damage', element: 'flame',
    lore: 'Un bébé dragon avec un très gros souffle et un ego encore plus gros.',
    hp: 3600, speed: 6.2,
    attack: { kind: 'spread', name: 'Souffle de Feu', dmg: 300, range: 5.5, speed: 14, size: 0.55, count: 5, angle: 0.6, ammo: 3, reload: 1 },
    skill: { name: 'BOND AILÉ', desc: 'Bond par-dessus les obstacles.', icon: '🐉', cd: 6, def: { kind: 'blink', dist: 7, dmg: 400 } },
    super: { name: 'INFERNO RING', desc: 'Anneau de flammes dévastateur.', icon: '🔥', def: { kind: 'ring', dmg: 1700, radius: 5.5, knockback: 6, stun: 0 } },
    superCost: 3200,
    passive: P('emberjaw_p', 'Braise', 'Les attaques brûlent (+180 sur 2s).', 'burn', 180),
    starPowers: [P('emberjaw_s1', 'Fureur', 'Vol de vie 15%.', 'lifesteal', 0.15), P('emberjaw_s2', 'Écailles', '-12% dégâts reçus.', 'damageReduction', 0.12)],
    gadgets: [G('emberjaw_g1', 'Rugissement', 'Repousse les ennemis proches.', '🗯️', 'push', 6), G('emberjaw_g2', 'Ailes', 'Vitesse +50% pendant 3s.', '🪽', 'speed', 0.5)],
    specials: [S('emberjaw_x1', 'Supernova', 'INFERNO +30% de zone.', 'superBig', 0.3), S('emberjaw_x2', 'Long Souffle', 'Portée d’attaque +20%.', 'attackRange', 0.2)],
    model: { plan: 'quad', ears: 'fin', tail: 'thin', horns: 'small', extras: ['wings', 'spikes'], head: 1.15, body: 1, size: 1 },
    palette: { main: '#b23cff', second: '#ff7a1f', belly: '#ffd08a', accent: '#ffe94d', eye: '#1b1440' },
    unlockTrophies: 1300, voice: 1,
  },
  {
    id: 'glitch', name: 'GLITCH', title: 'Raton Bidouilleur', role: 'hybrid', element: 'void',
    lore: 'Il a démonté un Gravity Core pour voir comment ça marche. Il ne l’a jamais remonté.',
    hp: 3700, speed: 6.3,
    attack: { kind: 'burst', name: 'Pixels Laser', dmg: 360, range: 9.5, speed: 22, size: 0.3, count: 2, interval: 0.1, ammo: 3, reload: 1 },
    skill: { name: 'TOURELLE', desc: 'Déploie une tourelle automatique.', icon: '🤖', cd: 10, def: { kind: 'turret', hp: 1800, dmg: 260, rate: 0.5, range: 8, duration: 10 } },
    super: { name: 'MEGA TOURELLE', desc: 'Tourelle surpuissante qui tire en rafale.', icon: '🛰️', def: { kind: 'turret', hp: 3500, dmg: 420, rate: 0.25, range: 9.5, duration: 12 } },
    superCost: 3000,
    passive: P('glitch_p', 'Overclock', 'Recharge des munitions +15%.', 'reloadSpeed', 0.15),
    starPowers: [P('glitch_s1', 'Hack de Node', 'Gravity Nodes +50% de durée.', 'nodeMaster', 0.5), P('glitch_s2', 'Bug Fatal', 'La 1re attaque après 3s inflige +50%.', 'firstHitCrit', 0.5)],
    gadgets: [G('glitch_g1', 'Batterie', 'Recharge toutes les munitions.', '🔋', 'reload', 3), G('glitch_g2', 'Hologramme', 'Leurre + vitesse.', '🎭', 'decoy', 0.4)],
    specials: [S('glitch_x1', 'Firmware', 'Recharge de TOURELLE -30%.', 'skillCd', 0.3), S('glitch_x2', 'Surcharge', 'Dégâts de tourelle +40%.', 'skillDmg', 0.4)],
    model: { plan: 'biped', ears: 'round', tail: 'fluffy', horns: 'none', extras: ['mask', 'backpack'], head: 1.1, body: 0.95, size: 0.95 },
    palette: { main: '#6f7a8f', second: '#2b2f3a', belly: '#d9dee8', accent: '#38ff8a', eye: '#14213d' },
    unlockTrophies: 1500, voice: 1.3,
  },
  {
    id: 'prism', name: 'PRISM', title: 'Cerf de Cristal', role: 'damage', element: 'light',
    lore: 'Ses bois de cristal décomposent la lumière en rayons tranchants.',
    hp: 3100, speed: 6.2,
    attack: { kind: 'bolt', name: 'Rayon Prismatique', dmg: 900, range: 12.5, speed: 30, size: 0.3, pierce: true, ammo: 3, reload: 1.4 },
    skill: { name: 'MUR DE CRISTAL', desc: 'Fait surgir des cristaux protecteurs.', icon: '💎', cd: 9, def: { kind: 'wall', count: 3, range: 4 } },
    super: { name: 'PRISM BARRAGE', desc: 'Salve de rayons dans toutes les directions.', icon: '🌈', def: { kind: 'radial', count: 16, dmg: 700, range: 11, speed: 22 } },
    superCost: 3000,
    passive: P('prism_p', 'Focalisation', 'La 1re attaque après 3s inflige +40%.', 'firstHitCrit', 0.4),
    starPowers: [P('prism_s1', 'Arc-en-ciel', 'SUPER chargé 20% plus vite.', 'superCharge', 0.2), P('prism_s2', 'Éclat Final', '+25% dégâts sur cibles < 50% PV.', 'executioner', 0.25)],
    gadgets: [G('prism_g1', 'Reflet', 'Téléportation courte.', '🔷', 'blink', 6), G('prism_g2', 'Facette', 'Bouclier de 1300.', '💠', 'shield', 1300)],
    specials: [S('prism_x1', 'Spectre', '+50% rayons de BARRAGE.', 'superBig', 0.5), S('prism_x2', 'Lentille', 'Portée d’attaque +15%.', 'attackRange', 0.15)],
    model: { plan: 'quad', ears: 'long', tail: 'stub', horns: 'antlers', extras: ['crystals'], head: 1, body: 0.95, size: 1 },
    palette: { main: '#e8f6ff', second: '#9ad7ff', belly: '#ffffff', accent: '#ff7af5', eye: '#2b1f4a' },
    unlockTrophies: 1700, voice: 1.1,
  },
  {
    id: 'graviton', name: 'GRAVITON', title: 'Ours Spatial', role: 'control', element: 'cosmic',
    lore: 'Il porte un mini Gravity Core dans son ventre. Ça gargouille dans le vide.',
    hp: 5000, speed: 5.9,
    attack: { kind: 'melee', name: 'Poing Gravitique', dmg: 760, range: 3.2, angle: 1.8, ammo: 3, reload: 1.1, knockback: 6 },
    skill: { name: 'REPULSE', desc: 'Champ de répulsion autour de lui.', icon: '💥', cd: 8, def: { kind: 'gravityZone', gtype: 'repulsion', radius: 5, duration: 1.2, dps: 500, strength: 22, range: 0 } },
    super: { name: 'REVERSE FIELD', desc: 'Inverse la gravité : les ennemis s’envolent, impuissants.', icon: '🔺', def: { kind: 'gravityZone', gtype: 'reverse', radius: 6, duration: 2.6, dps: 500, strength: 1, range: 8 } },
    superCost: 3400,
    passive: P('graviton_p', 'Masse Critique', 'Gravity Nodes +40% de durée.', 'nodeMaster', 0.4),
    starPowers: [P('graviton_s1', 'Noyau Dense', '-15% dégâts reçus.', 'damageReduction', 0.15), P('graviton_s2', 'Accrétion', 'Vol de vie 15%.', 'lifesteal', 0.15)],
    gadgets: [G('graviton_g1', 'Mini-Trou Noir', 'Impulsion de répulsion.', '⚫', 'gravityPulse', 9), G('graviton_g2', 'Champ', 'Bouclier de 1800.', '🧲', 'shield', 1800)],
    specials: [S('graviton_x1', 'Horizon', 'REVERSE FIELD +30% de zone.', 'superBig', 0.3), S('graviton_x2', 'Pulsar', 'Recharge de REPULSE -30%.', 'skillCd', 0.3)],
    model: { plan: 'biped', ears: 'round', tail: 'stub', horns: 'none', extras: ['core_belly', 'helmet_glass'], head: 1, body: 1.25, size: 1.15 },
    palette: { main: '#3a3f8f', second: '#ffffff', belly: '#ff5ad6', accent: '#7ff7ff', eye: '#ffffff' },
    unlockTrophies: 1900, voice: 0.65,
  },
  {
    id: 'frostbite', name: 'FROSTBITE', title: 'Petit Yéti', role: 'tank', element: 'frost',
    lore: 'Le plus petit yéti du monde. Le plus gros câlin du monde aussi.',
    hp: 5800, speed: 5.8,
    attack: { kind: 'lob', name: 'Boule de Neige', dmg: 900, range: 8, radius: 2.2, ammo: 3, reload: 1.3, slow: 0.3 },
    skill: { name: 'ARMURE DE GLACE', desc: 'Bouclier gelé qui absorbe les dégâts.', icon: '🧊', cd: 9, def: { kind: 'shield', amount: 2600, duration: 4, radius: 0 } },
    super: { name: 'AVALANCHE', desc: 'Avalanche en ligne droite qui gèle tout.', icon: '🏔️', def: { kind: 'line', dmg: 1500, range: 13, width: 3.6, stun: 1.4 } },
    superCost: 3600,
    passive: P('frostbite_p', 'Fourrure', '-12% dégâts reçus.', 'damageReduction', 0.12),
    starPowers: [P('frostbite_s1', 'Engelures', 'Les attaques ralentissent de 30%.', 'slowOnHit', 0.3), P('frostbite_s2', 'Câlin Glacé', 'Renvoie 20% des dégâts.', 'thorns', 0.2)],
    gadgets: [G('frostbite_g1', 'Igloo', 'Bouclier de 2000.', '🛖', 'shield', 2000), G('frostbite_g2', 'Sorbet', 'Soigne 1500 PV.', '🍧', 'heal', 1500)],
    specials: [S('frostbite_x1', 'Glacier', 'AVALANCHE +30% de zone.', 'superBig', 0.3), S('frostbite_x2', 'Hiver Éternel', 'Recharge d’ARMURE -30%.', 'skillCd', 0.3)],
    model: { plan: 'golem', ears: 'round', tail: 'none', horns: 'small', extras: ['fur'], head: 1, body: 1.3, size: 1.1 },
    palette: { main: '#e9f6ff', second: '#8fd0ff', belly: '#ffffff', accent: '#3a8fff', eye: '#14213d' },
    unlockTrophies: 2200, voice: 0.75,
  },
];

export const JACKER_MAP: Record<string, JackerDef> = Object.fromEntries(JACKERS.map((j) => [j.id, j]));
export const getJacker = (id: string) => JACKER_MAP[id] ?? JACKERS[0];

/** Starter Jackers available without any trophies. */
export const STARTER_JACKERS = JACKERS.filter((j) => j.unlockTrophies === 0).map((j) => j.id);
