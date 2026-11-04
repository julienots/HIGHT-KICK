import { EventBus } from '../core/events';
import { dayIndex } from '../core/time';
import { AchievementSystem, EventSystem, PassSystem, QuestSystem, ShopSystem } from './live';
import { BeastSystem } from './beasts';
import type { Ctx, MetaEvents } from './ctx';
import { ProgressionSystem, type MatchResultInput } from './progression';
import { RewardSystem } from './rewards';
import { SaveSystem, type StorageAdapter } from './save';
import type { PlayerState } from './state';
import { BattleSystem, ClubSystem, LadderSystem, MasterySystem, StarDropSystem } from './renaissance';

/**
 * Meta-game hub (everything outside of a match). Fully offline: state lives in local storage,
 * time-based features use the device clock. An online backend can later sync `state` (see src/online).
 */
export class Meta implements Ctx {
  state: PlayerState;
  bus = new EventBus<MetaEvents>();
  save: SaveSystem;
  rand: () => number;
  now: () => number;
  rewards: RewardSystem;
  progression: ProgressionSystem;
  beasts: BeastSystem;
  pass: PassSystem;
  quests: QuestSystem;
  achievements: AchievementSystem;
  shop: ShopSystem;
  events: EventSystem;
  starDrops: StarDropSystem;
  mastery: MasterySystem;
  club: ClubSystem;
  ladder: LadderSystem;
  battle: BattleSystem;

  constructor(storage: StorageAdapter, opts: { rand?: () => number; now?: () => number } = {}) {
    this.save = new SaveSystem(storage);
    this.rand = opts.rand ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.state = this.save.load();
    this.rewards = new RewardSystem(this);
    this.progression = new ProgressionSystem(this, this.rewards);
    this.beasts = new BeastSystem(this, this.rewards);
    this.pass = new PassSystem(this, this.rewards);
    this.quests = new QuestSystem(this, this.progression, this.rewards, this.pass);
    this.achievements = new AchievementSystem(this, this.progression, this.rewards);
    this.shop = new ShopSystem(this, this.rewards);
    this.events = new EventSystem(this, this.rewards);
    this.starDrops = new StarDropSystem(this, this.rewards);
    this.mastery = new MasterySystem(this, this.rewards);
    this.club = new ClubSystem(this, this.rewards, () => this.progression.totalTrophies());
    this.ladder = new LadderSystem(this, () => this.progression.totalTrophies(), () => this.state.profile.name);
    this.battle = new BattleSystem(this, this.rewards);
    (this.battle as any).xpHook = (b: any, xp: number) => this.beasts.addXp(b, xp);
    this.club.sync();
    this.pass.ensureSeason();
    this.quests.refresh();
  }

  dirty() {
    this.save.markDirty(this.state);
  }
  flush() {
    this.save.flush(this.state);
  }
  saveNow() {
    this.save.write(this.state);
  }

  applyMatch(r: MatchResultInput) {
    const res = this.progression.applyMatch(r, (n) => this.pass.addXp(n));
    let eventReward = null;
    if (r.eventId && r.outcome === 'win') eventReward = this.events.onWin(r.eventId);
    const masteryPts = this.mastery.add(r.jackerId, r.outcome, r.mvp);
    const s = this.state;
    const firstOfDay = s.starDropDay.day !== dayIndex(this.now()) || s.starDropDay.earned < 2;
    const starDrop = r.outcome === 'win' || firstOfDay ? this.starDrops.earn(1) : false;
    this.club.onMatch(r.outcome === 'win', res.trophies);
    this.quests.refresh();
    this.saveNow();
    return { ...res, eventReward, masteryPts, starDrop };
  }

  notifications() {
    return {
      quests: this.quests.claimable(),
      pass: this.pass.claimable(),
      achievements: this.achievements.claimable(),
      chests: this.state.chests.length,
      eggs: this.state.eggs.filter((e) => e.incubating && e.hatchAt <= this.now()).length + (this.state.breeding && this.state.breeding.end <= this.now() ? 1 : 0),
      farm: this.state.farm.filter((p) => p.foodId && p.readyAt <= this.now()).length,
      starDrops: this.state.starDrops,
      mastery: this.mastery.claimable(),
    };
  }
}
