import type { Element } from '../data/elements';
import type { GravityType } from '../data/gravity';
import type { GadgetDef, JackerDef, PassiveDef, SpecialDef } from '../data/jackers';
import type { MatchEventId, ModeId, Difficulty } from '../data/modes';

export interface UnitInput {
  mx: number;
  mz: number;
  /** aim direction for manual aim; (0,0) = auto aim */
  ax: number;
  az: number;
  attack: boolean;
  skill: boolean;
  super: boolean;
  gadget: boolean;
  interact: boolean;
  emote?: string;
}

export const emptyInput = (): UnitInput => ({ mx: 0, mz: 0, ax: 0, az: 0, attack: false, skill: false, super: false, gadget: false, interact: false });

export interface UnitStats {
  kills: number;
  deaths: number;
  damage: number;
  healing: number;
  eggs: number;
  points: number;
  titans: number;
  nodes: number;
  supers: number;
  captures: number;
  portals: number;
  jumps: number;
  bestEgg?: { speciesId: string; phase: number };
}

export interface DashState {
  dx: number;
  dz: number;
  left: number;
  speed: number;
  dmg: number;
  hit: Set<number>;
  chain: number;
  knock: number;
}

export const HP_SCALE = 1.4;

export class Unit {
  kind = 'unit' as const;
  x = 0;
  z = 0;
  y = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  /** external velocity (knockback, gravity zones) */
  ex = 0;
  ez = 0;
  facing = 0;
  hp: number;
  maxHp: number;
  shield = 0;
  shieldT = 0;
  baseSpeed: number;
  dmgMult: number;
  ammo: number;
  shotCd = 0;
  reloadAcc = 0;
  skillCd = 0;
  skillCdMax: number;
  superCharge = 0;
  gadgetUses = 3;
  gadgetCd = 0;
  slowT = 0;
  slowAmt = 0;
  stunT = 0;
  burnT = 0;
  burnDps = 0;
  burnSrc: Unit | null = null;
  buffT = 0;
  buffSpeed = 0;
  buffDmg = 1;
  rapid = false;
  liftT = 0;
  lowG = false;
  heavy = false;
  alive = true;
  respawnT = 0;
  invulnT = 0;
  falling = false;
  carrying: Egg | null = null;
  lastHurtT = -99;
  lastActT = -99;
  lastAttackT = -99;
  lastDamager: Unit | null = null;
  lastDamagerT = -99;
  revealT = 0;
  inBush = false;
  portalCd = 0;
  padCd = 0;
  leap = false;
  dash: DashState | null = null;
  burst: { n: number; t: number; dx: number; dz: number; crit: boolean } | null = null;
  nodeChannel = 0;
  respawns = 0;
  /** last visible action for the view: attack / skill / super / hit / emote */
  action = '';
  actionT = 0;
  actionId = 0;
  emote = '';
  emoteT = 0;
  stats: UnitStats = { kills: 0, deaths: 0, damage: 0, healing: 0, eggs: 0, points: 0, titans: 0, nodes: 0, supers: 0, captures: 0, portals: 0, jumps: 0 };
  input: UnitInput = emptyInput();
  /** ai brain (opaque for the sim) */
  brain: any = null;
  radius: number;
  constructor(
    public id: number,
    public team: number,
    public def: JackerDef,
    public level: number,
    public skin: string,
    public name: string,
    public isBot: boolean,
    public passives: PassiveDef[],
    public gadget: GadgetDef | null,
    public special: SpecialDef | null,
    bonus: { hp: number; dmg: number } = { hp: 0, dmg: 0 },
  ) {
    const lm = 1 + (level - 1) * 0.05;
    // HP_SCALE tunes time-to-kill (~3-4s focused) for readable fights
    this.maxHp = Math.round(def.hp * HP_SCALE * lm * (1 + bonus.hp));
    this.hp = this.maxHp;
    this.baseSpeed = def.speed;
    this.dmgMult = lm * (1 + bonus.dmg);
    this.ammo = def.attack.ammo;
    this.skillCdMax = (def.skill.cd ?? 8) * (special?.kind === 'skillCd' ? 1 - special.value : 1);
    this.radius = 0.55 * def.model.size + 0.1;
  }
  get element(): Element {
    return this.def.element;
  }
  hasPassive(k: PassiveDef['kind']) {
    return this.passives.find((p) => p.kind === k);
  }
  get airborne() {
    return this.y > 0.35;
  }
}

export interface Projectile {
  id: number;
  owner: Unit | null;
  ownerTurret?: Turret;
  team: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  traveled: number;
  range: number;
  radius: number;
  dmg: number;
  pierce: boolean;
  hit: Set<number>;
  element: Element;
  slow: number;
  knockback: number;
  color: string;
  isSuper: boolean;
  isAbility: boolean;
  /** lobbed projectile: flies over walls */
  lob?: { sx: number; sz: number; tx: number; tz: number; t: number; T: number; splash: number; burn?: number; big?: boolean };
  dead: boolean;
  fromWild?: boolean;
  critReady?: boolean;
}

export interface Zone {
  id: number;
  x: number;
  z: number;
  r: number;
  gtype: GravityType | 'heal' | 'burn' | 'storm';
  /** team that owns the zone (affects the other team); -1 affects everyone */
  team: number;
  owner: Unit | null;
  t: number;
  dur: number;
  dps: number;
  strength: number;
  heal?: number;
  speed?: number;
  /** moving zone (tornado / void storm) */
  vx?: number;
  vz?: number;
  fromNode?: boolean;
  tick: number;
}

export interface Egg {
  id: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  phase: number;
  phaseT: number;
  carrier: Unit | null;
  speciesId: string;
  pickupCd: number;
  attackCd: number;
  shieldCd: number;
  dead: boolean;
}

export interface Wild {
  kind: 'wild';
  id: number;
  speciesId: string;
  team: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  ex: number;
  ez: number;
  facing: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  size: number;
  radius: number;
  rarityIdx: number;
  attackCd: number;
  wanderT: number;
  tx: number;
  tz: number;
  aggro: Unit | null;
  alive: boolean;
  isBoss: boolean;
  bossCd: number;
  bossMove: string;
  bossMoveT: number;
  slowT: number;
  stunT: number;
  liftT: number;
  hitFlash: number;
  lastDamager: Unit | null;
  deadT: number;
  element: Element;
  action: string;
  actionT: number;
  actionId: number;
}

export interface Turret {
  kind: 'turret';
  id: number;
  team: number;
  owner: Unit;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  dmg: number;
  rate: number;
  range: number;
  t: number;
  cd: number;
  alive: boolean;
  decoy: boolean;
  facing: number;
  color: string;
}

export interface GravityNode {
  id: number;
  x: number;
  z: number;
  gtype: GravityType;
  cd: number;
  activeT: number;
  team: number;
}

export interface Platform {
  id: number;
  row: number;
  minX: number;
  maxX: number;
  x: number;
  z: number;
  w: number;
  dir: number;
  speed: number;
}

export interface Strike {
  id: number;
  x: number;
  z: number;
  r: number;
  t: number;
  dmg: number;
  team: number;
  owner: Unit | null;
  kind: 'lightning' | 'meteor' | 'slam' | 'pulse';
  knock: number;
  stun: number;
}

export interface CaptureZone {
  id: number;
  x: number;
  z: number;
  r: number;
  owner: number;
  progress: number;
}

export interface Pickup {
  id: number;
  x: number;
  z: number;
  kind: 'heal' | 'super';
  t: number;
}

export interface MatchConfig {
  mode: ModeId;
  arena: string;
  difficulty: Difficulty;
  seed: number;
  player: { jackerId: string; level: number; skin: string; name: string; gadget: 0 | 1; starPower: 0 | 1; special: 0 | 1; useStarPower: boolean; useGadget: boolean; useSpecial: boolean; bonus?: { hp: number; dmg: number } };
  /** override team size (otherwise from mode) */
  teamSize?: number;
  modifiers?: string[];
  eventId?: string;
  campaignLevel?: string;
  /** set true for headless simulation (all units are bots) */
  allBots?: boolean;
  /** the player's account level (bots scale around it) */
  botLevel?: number;
}

export type FxEvent =
  | { t: 'shoot'; u: number; x: number; z: number; dx: number; dz: number; color: string; kind: string }
  | { t: 'hit'; x: number; z: number; y: number; color: string; dmg: number; crit: boolean; target: number; heal?: boolean; team: number; byPlayer: boolean; onPlayer: boolean }
  | { t: 'boom'; x: number; z: number; r: number; color: string; big?: boolean }
  | { t: 'ring'; x: number; z: number; r: number; color: string }
  | { t: 'cone'; x: number; z: number; dx: number; dz: number; range: number; angle: number; color: string }
  | { t: 'line'; x: number; z: number; dx: number; dz: number; range: number; width: number; color: string }
  | { t: 'chain'; pts: { x: number; z: number }[]; color: string }
  | { t: 'dash'; u: number; x: number; z: number; color: string }
  | { t: 'blink'; u: number; fx: number; fz: number; x: number; z: number; color: string }
  | { t: 'heal'; x: number; z: number; r: number }
  | { t: 'shield'; u: number; color: string }
  | { t: 'death'; u: number; x: number; z: number; color: string; team: number; killer: number }
  | { t: 'respawn'; u: number }
  | { t: 'pickup'; u: number; egg: number }
  | { t: 'drop'; egg: number }
  | { t: 'deliver'; u: number; team: number; phase: number; points: number; x: number; z: number }
  | { t: 'evolve'; egg: number; phase: number; x: number; z: number }
  | { t: 'node'; x: number; z: number; gtype: string; team: number; u: number }
  | { t: 'event'; id: MatchEventId }
  | { t: 'warn'; x: number; z: number; r: number; dur: number; color: string }
  | { t: 'strike'; x: number; z: number; r: number; kind: string }
  | { t: 'jump'; u: number }
  | { t: 'land'; u: number; hard: boolean }
  | { t: 'portal'; u: number; x: number; z: number }
  | { t: 'crate'; x: number; z: number; color: string }
  | { t: 'wildDeath'; id: number; x: number; z: number; rarity: number; team: number }
  | { t: 'capture'; zone: number; team: number }
  | { t: 'super'; u: number; name: string }
  | { t: 'gadget'; u: number; name: string }
  | { t: 'skill'; u: number; name: string }
  | { t: 'boss'; move: string }
  | { t: 'collapse'; cells: number[] }
  | { t: 'emote'; u: number; e: string }
  | { t: 'score'; team: number; score: number[] };
