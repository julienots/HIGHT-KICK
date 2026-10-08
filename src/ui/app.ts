import { audio } from '../audio/audio';
import { haptics } from '../audio/haptics';
import { ARENAS, getArena } from '../data/arenas';
import { getJacker } from '../data/jackers';
import { MODE_MAP, type Difficulty, type ModeId } from '../data/modes';
import { MatchView } from '../render/matchView';
import { MenuScene } from '../render/menuScene';
import { Renderer } from '../render/renderer';
import type { MatchConfig } from '../sim/entities';
import { World } from '../sim/world';
import { BotBrain, botProfile } from '../sim/ai';
import { LocalStorageAdapter } from '../systems/save';
import { Meta } from '../systems/meta';
import { h, showRewards, toast } from './dom';
import { Hud } from './hud';
import { ResultsScreen } from './results';
import { offlineService } from '../online/service';

export interface Screen {
  el: HTMLElement;
  /** show the 3D menu world behind this screen */
  menu3d?: 0 | 1 | false;
  mount?(): void;
  unmount?(): void;
  update?(dt: number): void;
  refresh?(): void;
}
export type ScreenFactory = (app: App, params?: any) => Screen;

export interface PlayOpts {
  mode: ModeId;
  arena?: string;
  difficulty?: Difficulty;
  campaignLevel?: string;
  eventId?: string;
  modifiers?: string[];
}

interface ActiveMatch {
  world: World;
  view: MatchView;
  hud: Hud;
  opts: PlayOpts;
  acc: number;
  paused: boolean;
  endT: number;
  resultShown: boolean;
}

/** Application shell: renderer, router, main loop, match lifecycle. Everything runs offline. */
export class App {
  meta: Meta;
  renderer: Renderer;
  menu: MenuScene;
  ui = document.getElementById('ui')!;
  overlay = document.getElementById('overlay')!;
  screen: Screen | null = null;
  screenStack: { f: ScreenFactory; p?: any }[] = [];
  match: ActiveMatch | null = null;
  last = performance.now();
  fpsEl: HTMLDivElement;
  fpsAcc = 0;
  fpsN = 0;
  screens: Record<string, ScreenFactory> = {};
  selectedMode: ModeId = 'beast_rush';
  selectedArena: string | 'random' = 'random';
  running = false;
  /** debug/e2e: simulation speed multiplier */
  timeScale = 1;

  constructor() {
    this.meta = new Meta(new LocalStorageAdapter());
    this.renderer = new Renderer(document.getElementById('gl') as HTMLCanvasElement);
    const st = this.meta.state.settings;
    this.renderer.setQuality(st.quality, st.performance);
    this.menu = new MenuScene(this.renderer);
    this.applySettings();
    this.fpsEl = h('div', { class: 'fps' });
    document.getElementById('app')!.appendChild(this.fpsEl);
    // meta notifications
    this.meta.bus.on('toast', (t) => toast(t.text, t.icon, t.color));
    this.meta.bus.on('levelUp', (e) => {
      audio.sfx('levelUp');
      toast(`NIVEAU ${e.level} !`, '⭐', '#ffb300');
    });
    this.meta.bus.on('unlock', (e) => {
      if (e.kind === 'jacker') toast(`${getJacker(e.id).name} débloqué !`, '🎉', '#ffb300');
      if (e.kind === 'mode') toast(`Nouveau mode : ${MODE_MAP[e.id as ModeId].name}`, MODE_MAP[e.id as ModeId].icon, '#2bb8ff');
    });
    this.meta.bus.on('changed', () => this.screen?.refresh?.());
    // persistence safety: flush on background / close
    const flush = () => this.meta.flush();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flush();
        audio.suspend();
        if (this.match && !this.match.paused && this.match.world.state !== 'ended') this.match.hud.pause(true);
      } else audio.resume();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    // first gesture unlocks audio
    const unlock = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    this.updateRotateHint();
    window.addEventListener('resize', () => this.updateRotateHint());
  }

  applySettings() {
    const st = this.meta.state.settings;
    audio.setVolumes(st.music, st.sfx);
    haptics.enabled = st.haptics;
    this.fpsEl && (this.fpsEl.style.display = st.showFps ? 'block' : 'none');
  }
  setQuality(q: 'low' | 'medium' | 'high' | 'ultra', perf: boolean) {
    this.renderer.setQuality(q, perf);
  }
  updateRotateHint() {
    const el = document.getElementById('rotate-hint')!;
    // only nag during matches on small portrait screens (menus work in portrait)
    const portraitPhone = window.innerHeight > window.innerWidth && window.innerWidth < 600;
    el.style.display = portraitPhone && this.match ? 'flex' : 'none';
  }

  start() {
    if (this.running) return;
    this.running = true;
    const daily = this.meta.progression.dailyCheck();
    this.meta.quests.refresh();
    this.go('home');
    if (daily.gift) setTimeout(() => showRewards(`CONNEXION — JOUR ${daily.streak}`, daily.gift!), 600);
    if (daily.reset) setTimeout(() => toast(`Nouvelle saison ! ${daily.reset!.lost} trophées → ${daily.reset!.coins} coins`, '🏆', '#c45cff'), 1500);
    this.meta.saveNow();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------ routing
  register(name: string, f: ScreenFactory) {
    this.screens[name] = f;
  }
  go(name: string, params?: any, push = false) {
    const f = this.screens[name];
    if (!f) return;
    if (!push) this.screenStack = [];
    this.screenStack.push({ f, p: params });
    this.mountScreen(f(this, params));
  }
  push(name: string, params?: any) {
    this.go(name, params, true);
  }
  back() {
    if (this.screenStack.length > 1) {
      this.screenStack.pop();
      const top = this.screenStack[this.screenStack.length - 1];
      this.mountScreen(top.f(this, top.p));
    } else this.go('home');
  }
  private mountScreen(s: Screen) {
    audio.playMusic({ tempo: 118, root: 62, scale: 'major', intensity: 0.5, style: 'menu' });
    if (this.screen) {
      this.screen.unmount?.();
      this.screen.el.remove();
    }
    this.screen = s;
    this.ui.appendChild(s.el);
    s.mount?.();
    if (s.menu3d !== false && s.menu3d !== undefined) this.menu.layout = s.menu3d;
  }

  // ------------------------------------------------------------ match
  play(opts: PlayOpts) {
    const s = this.meta.state;
    const jid = s.profile.selectedJacker;
    const jp = s.jackers[jid];
    const arena = opts.arena && opts.arena !== 'random' ? opts.arena : this.randomArena();
    const difficulty = opts.difficulty ?? (s.tutorialDone ? s.settings.difficulty : 'easy');
    const cfg: MatchConfig = {
      mode: opts.mode,
      arena,
      difficulty,
      seed: (Math.random() * 1e9) | 0,
      player: {
        jackerId: jid,
        level: jp.level,
        skin: jp.skin,
        name: s.profile.name,
        gadget: jp.gadget,
        starPower: jp.starPower,
        special: jp.special,
        useGadget: jp.level >= 7,
        useStarPower: jp.level >= 10,
        useSpecial: jp.level >= 14,
        bonus: this.meta.beasts.companionBonus(),
      },
      modifiers: opts.modifiers,
      eventId: opts.eventId,
      campaignLevel: opts.campaignLevel,
      botLevel: Math.max(1, Math.round((jp.level + Math.min(20, s.level / 2)) / 2)),
    };
    this.startMatch(cfg, opts);
  }
  randomArena() {
    const unlocked = ARENAS.filter((a) => this.meta.progression.arenaUnlocked(a.id));
    return unlocked[Math.floor(Math.random() * unlocked.length)]?.id ?? 'sky_jungle';
  }
  startMatch(cfg: MatchConfig, opts: PlayOpts) {
    if (this.screen) {
      this.screen.unmount?.();
      this.screen.el.remove();
      this.screen = null;
    }
    const world = new World(cfg);
    const hud = new Hud(this, world);
    const view = new MatchView(this.renderer, world, this.overlay, { onFx: (e) => hud.onFx(e) }, { damageNumbers: this.meta.state.settings.damageNumbers, screenShake: this.meta.state.settings.screenShake });
    hud.view = view;
    this.ui.appendChild(hud.el);
    this.match = { world, view, hud, opts, acc: 0, paused: false, endT: 0, resultShown: false };
    const a = getArena(cfg.arena);
    audio.playMusic({ tempo: a.music.tempo, root: a.music.root, scale: a.music.scale, intensity: 0.5, style: cfg.mode === 'boss_raid' ? 'boss' : 'battle' });
    this.updateRotateHint();
  }
  quitMatch() {
    const m = this.match;
    if (!m) return;
    m.hud.dispose();
    m.hud.el.remove();
    m.view.dispose();
    this.match = null;
    this.overlay.innerHTML = '';
    this.updateRotateHint();
    this.go('home');
  }
  /** Debug/e2e helper: let the AI drive the player's Jacker. */
  debugAutoplay() {
    const p = this.match?.world.player;
    if (p) p.brain = new BotBrain(this.match!.world, p, botProfile('hard'));
  }
  /** Called when the player forfeits: counts as a loss. */
  forfeit() {
    const m = this.match;
    if (!m) return;
    m.world.end(1 - (m.world.player?.team ?? 0), 'forfeit');
  }
  private finishMatch() {
    const m = this.match!;
    const w = m.world;
    const p = w.player!;
    const outcome = w.winner === 2 ? 'draw' : w.winner === p.team ? 'win' : 'loss';
    const mvp = w.mvp();
    let stars = 0;
    if (m.opts.campaignLevel && outcome === 'win') {
      stars = 1;
      const margin = w.score[p.team] - w.score[1 - p.team];
      if (margin >= 5 || w.cfg.mode === 'boss_raid' || w.cfg.mode === 'survival') stars++;
      if (p.stats.deaths === 0) stars++;
    }
    const res = this.meta.applyMatch({
      mode: w.cfg.mode,
      arena: w.cfg.arena,
      jackerId: p.def.id,
      difficulty: w.cfg.difficulty,
      outcome,
      kills: p.stats.kills,
      deaths: p.stats.deaths,
      damage: p.stats.damage,
      healing: p.stats.healing,
      eggsDelivered: p.stats.eggs,
      pointsDelivered: p.stats.points,
      titansDelivered: p.stats.titans,
      nodesActivated: p.stats.nodes,
      supersUsed: p.stats.supers,
      wildCaptured: p.stats.captures,
      bossKilled: w.cfg.mode === 'boss_raid' && outcome === 'win',
      portalsUsed: p.stats.portals,
      jumpPads: p.stats.jumps,
      mvp: mvp === p,
      bestEgg: p.stats.bestEgg,
      campaignLevel: m.opts.campaignLevel,
      stars,
      eventId: m.opts.eventId,
    });
    this.meta.state.tutorialDone = true;
    m.hud.el.style.display = 'none';
    audio.sfx(outcome === 'win' ? 'victory' : outcome === 'loss' ? 'defeat' : 'reveal');
    if (outcome === 'win') haptics.victory();
    audio.playMusic({ tempo: 100, root: outcome === 'win' ? 65 : 57, scale: outcome === 'win' ? 'major' : 'minor', intensity: 0.2, style: 'calm' });
    const rs = ResultsScreen(this, { world: w, outcome, rewards: res, stars, mvp, opts: m.opts });
    this.ui.appendChild(rs.el);
    rs.mount?.();
  }

  /** Auto-downgrade graphics when a device can't hold ~30 FPS during matches (keeps the game smooth). */
  private lowFpsT = 0;
  private adaptQuality(fps: number) {
    if (!this.match || this.match.paused || document.hidden || this.timeScale !== 1) return;
    if (fps < 28) this.lowFpsT += 0.5;
    else this.lowFpsT = Math.max(0, this.lowFpsT - 0.5);
    const st = this.meta.state.settings;
    if (this.lowFpsT >= 6 && st.quality !== 'low' && !st.performance) {
      this.lowFpsT = 0;
      const order = ['low', 'medium', 'high', 'ultra'] as const;
      st.quality = order[Math.max(0, order.indexOf(st.quality) - 1)];
      this.meta.dirty();
      this.renderer.setQuality(st.quality, st.performance);
      toast(`Qualité ajustée : ${st.quality.toUpperCase()} (fluidité)`, '⚙️');
    }
  }

  // ------------------------------------------------------------ loop
  private loop(t: number) {
    requestAnimationFrame((tt) => this.loop(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      const fps = this.fpsN / this.fpsAcc;
      this.fpsEl.textContent = `${Math.round(fps)} FPS · ${this.renderer.quality.toUpperCase()}`;
      this.adaptQuality(fps);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    const m = this.match;
    if (m) {
      const STEP = 1 / 60;
      if (!m.paused) {
        m.acc += dt * this.timeScale;
        let n = 0;
        const maxSteps = 5 * this.timeScale;
        while (m.acc >= STEP && n < maxSteps) {
          m.hud.applyInput();
          m.world.update(STEP);
          m.view.update(STEP);
          m.hud.update(STEP);
          m.acc -= STEP;
          n++;
        }
        if (n >= maxSteps) m.acc = 0;
        if (n === 0) {
          // still animate view smoothly (no fx)
        }
      }
      if (m.world.state === 'ended' && !m.resultShown) {
        m.endT += dt;
        if (m.endT > 2.6) {
          m.resultShown = true;
          this.finishMatch();
        }
      }
      this.renderer.r.render(m.view.scene, m.view.camera);
      return;
    }
    this.screen?.update?.(dt);
    if (this.screen && this.screen.menu3d !== false && this.screen.menu3d !== undefined) {
      this.menu.update(dt);
      this.renderer.r.render(this.menu.scene, this.menu.camera);
    } else {
      this.renderer.r.setClearColor('#142a7a');
      this.renderer.r.clear();
    }
  }
}


export { offlineService };
