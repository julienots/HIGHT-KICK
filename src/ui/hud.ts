import * as THREE from 'three';
import { audio } from '../audio/audio';
import { getBeast } from '../data/beasts';
import { GRAVITY_INFO } from '../data/gravity';
import { MATCH_EVENTS, MODE_MAP } from '../data/modes';
import type { FxEvent, Unit } from '../sim/entities';
import { EGG_PHASE_NAMES, EGG_POINTS, type World } from '../sim/world';
import type { MatchView } from '../render/matchView';
import type { App } from './app';
import { btn, confirmModal, h, modal } from './dom';

interface DragState {
  id: number;
  sx: number;
  sy: number;
  dx: number;
  dz: number;
  dragged: boolean;
  kind: 'attack' | 'skill' | 'super' | 'gadget';
  el: HTMLElement;
}

/** In-match HUD: virtual joystick, aimable action buttons, score, timers, announcements, killfeed. */
export class Hud {
  el: HTMLDivElement;
  view!: MatchView;
  private joyEl: HTMLDivElement;
  private knob: HTMLDivElement;
  private joyId = -1;
  private joyO = { x: 0, y: 0 };
  private joyV = { x: 0, y: 0 };
  private keys = new Set<string>();
  private drags = new Map<number, DragState>();
  private pending: { kind: DragState['kind']; ax: number; az: number }[] = [];
  private interactPending = false;
  private scoreA: HTMLDivElement;
  private scoreB: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private targetEl: HTMLDivElement;
  private killfeed: HTMLDivElement;
  private eventBar: HTMLDivElement;
  private carryBar: HTMLDivElement;
  private deadPanel: HTMLDivElement;
  private countdown: HTMLDivElement;
  private bAtk: HTMLDivElement;
  private bSkl: HTMLDivElement;
  private bSup: HTMLDivElement;
  private bGad: HTMLDivElement;
  private bInt: HTMLDivElement;
  private lastCount = -1;
  private aimGroup = new THREE.Group();
  private aimLine: THREE.Mesh;
  private aimCircle: THREE.Mesh;
  private mouseAim: { x: number; z: number } | null = null;
  paused = false;
  private pauseModal: { close: () => void } | null = null;
  private onKey = (e: KeyboardEvent) => this.key(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.key(e, false);

  constructor(public app: App, public world: World) {
    const mode = MODE_MAP[world.cfg.mode];
    this.el = h('div', { class: 'hud' });
    // score
    this.scoreA = h('div', { class: 'score blue' }, '0');
    this.scoreB = h('div', { class: 'score red' }, '0');
    this.timerEl = h('div', { class: 'timer' }, '3:00');
    this.targetEl = h('div', { class: 'target stroke' }, '');
    this.el.appendChild(h('div', { class: 'scorebar' }, this.scoreA, h('div', null, this.timerEl, this.targetEl), this.scoreB));
    this.eventBar = h('div', { class: 'eventbar stroke', style: 'display:none' });
    this.el.appendChild(this.eventBar);
    this.killfeed = h('div', { class: 'killfeed' });
    this.el.appendChild(this.killfeed);
    this.carryBar = h('div', { class: 'carrybar panel dark', style: 'display:none' });
    this.el.appendChild(this.carryBar);
    this.deadPanel = h('div', { class: 'deadpanel panel dark', style: 'display:none' });
    this.el.appendChild(this.deadPanel);
    this.countdown = h('div', { class: 'countdown stroke-l' });
    this.el.appendChild(this.countdown);
    // top-left: pause + emotes + mode
    const emoteBtn = btn('😀', 'white iconbtn small', () => this.toggleEmotes());
    this.el.appendChild(
      h('div', { class: 'hud-top-left' }, btn('⏸', 'white iconbtn small', () => this.pause(true)), emoteBtn, h('div', { class: 'chip', style: `background:${mode.color};align-self:center` }, `${mode.icon} ${mode.name}`)),
    );
    // joystick
    const zone = h('div', { class: 'joyzone' });
    this.joyEl = h('div', { class: 'joy', style: 'opacity:0.35;left:110px;top:calc(100% - 120px)' });
    this.knob = h('div', { class: 'knob' });
    this.joyEl.appendChild(this.knob);
    zone.appendChild(this.joyEl);
    this.el.appendChild(zone);
    zone.addEventListener('pointerdown', (e) => this.joyDown(e));
    // action buttons
    const p = world.player!;
    this.bAtk = this.actionBtn('atk', '💥', 'attack');
    this.bSkl = this.actionBtn('skl', p.def.skill.icon, 'skill');
    this.bSup = this.actionBtn('sup', p.def.super.icon, 'super');
    this.bGad = this.actionBtn('gad', p.gadget?.icon ?? '🔒', 'gadget');
    this.bInt = h('div', { class: 'abtn int' }, '🧲');
    this.bInt.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.interactPending = true;
      audio.sfx('click');
    });
    for (const b of [this.bSkl, this.bSup, this.bAtk]) b.appendChild(h('div', { class: 'cd' }));
    this.bSkl.appendChild(h('div', { class: 'cdt' }));
    this.bSup.appendChild(h('div', { class: 'ring' }));
    if (p.gadget) this.bGad.appendChild(h('div', { class: 'uses' }, '3'));
    else this.bGad.style.opacity = '0.3';
    const actions = h('div', { class: 'actions' }, this.bInt, this.bGad, this.bSup, this.bSkl, this.bAtk);
    this.el.appendChild(actions);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    // desktop mouse aiming on the canvas
    const canvas = app.renderer.canvas;
    canvas.addEventListener('pointerdown', this.onCanvasDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', this.onCanvasMove);
    // aim indicator
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    this.aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.aimLine.rotation.x = -Math.PI / 2;
    this.aimCircle = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    this.aimCircle.rotation.x = -Math.PI / 2;
    this.aimGroup.add(this.aimLine, this.aimCircle);
    this.aimGroup.visible = false;
    queueMicrotask(() => this.view?.scene.add(this.aimGroup));
  }

  private actionBtn(cls: string, icon: string, kind: DragState['kind']) {
    const b = h('div', { class: 'abtn ' + cls }, icon);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.unlock();
      b.setPointerCapture?.(e.pointerId);
      this.drags.set(e.pointerId, { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dz: 0, dragged: false, kind, el: b });
      b.classList.add('dragging');
    });
    return b;
  }

  private joyDown(e: PointerEvent) {
    e.preventDefault();
    audio.unlock();
    if (this.joyId !== -1) return;
    this.joyId = e.pointerId;
    this.joyO = { x: e.clientX, y: e.clientY };
    this.joyEl.style.left = e.clientX + 'px';
    this.joyEl.style.top = e.clientY + 'px';
    this.joyEl.style.opacity = '1';
  }
  private onMove = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      let dx = e.clientX - this.joyO.x,
        dy = e.clientY - this.joyO.y;
      const max = 55;
      const l = Math.hypot(dx, dy);
      if (l > max) {
        // joystick follows the finger (floating stick)
        this.joyO.x += (dx / l) * (l - max);
        this.joyO.y += (dy / l) * (l - max);
        this.joyEl.style.left = this.joyO.x + 'px';
        this.joyEl.style.top = this.joyO.y + 'px';
        dx = (dx / l) * max;
        dy = (dy / l) * max;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyV = { x: dx / max, y: dy / max };
      if (Math.hypot(this.joyV.x, this.joyV.y) < 0.15) this.joyV = { x: 0, y: 0 };
      return;
    }
    const d = this.drags.get(e.pointerId);
    if (d) {
      const dx = e.clientX - d.sx,
        dy = e.clientY - d.sy;
      const l = Math.hypot(dx, dy);
      if (l > 16) d.dragged = true;
      const max = 70;
      d.dx = (dx / Math.max(l, 1)) * Math.min(1, l / max);
      d.dz = (dy / Math.max(l, 1)) * Math.min(1, l / max);
    }
  };
  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      this.joyId = -1;
      this.joyV = { x: 0, y: 0 };
      this.knob.style.transform = '';
      this.joyEl.style.opacity = '0.35';
      return;
    }
    const d = this.drags.get(e.pointerId);
    if (d) {
      this.drags.delete(e.pointerId);
      d.el.classList.remove('dragging');
      const manual = this.app.meta.state.settings.aim === 'manual';
      if (d.dragged && Math.hypot(d.dx, d.dz) > 0.15) this.pending.push({ kind: d.kind, ax: d.dx, az: d.dz });
      else if (manual && d.kind === 'attack') {
        const p = this.world.player!;
        this.pending.push({ kind: d.kind, ax: Math.sin(p.facing), az: Math.cos(p.facing) });
      } else this.pending.push({ kind: d.kind, ax: 0, az: 0 });
    }
  };
  private groundPoint(e: PointerEvent) {
    const r = new THREE.Raycaster();
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    r.setFromCamera(ndc, this.view.camera);
    const p = new THREE.Vector3();
    r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return p;
  }
  private onCanvasDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const gp = this.groundPoint(e);
    const p = this.world.player!;
    const dx = gp.x - p.x,
      dz = gp.z - p.z;
    const l = Math.hypot(dx, dz) || 1;
    const range = e.button === 2 ? 10 : p.def.attack.range;
    const m = Math.min(1, l / range);
    this.pending.push({ kind: e.button === 2 ? 'super' : 'attack', ax: (dx / l) * Math.max(0.2, m), az: (dz / l) * Math.max(0.2, m) });
  };
  private onCanvasMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.view) return;
    const gp = this.groundPoint(e);
    this.mouseAim = { x: gp.x, z: gp.z };
  };
  private key(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    if (down && !this.keys.has(k)) {
      const p = this.world.player!;
      const aim = () => {
        if (!this.mouseAim) return { ax: 0, az: 0 };
        const dx = this.mouseAim.x - p.x,
          dz = this.mouseAim.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        return { ax: dx / l, az: dz / l };
      };
      if (k === ' ') this.pending.push({ kind: 'attack', ax: 0, az: 0 });
      if (k === 'e') this.pending.push({ kind: 'skill', ...aim() });
      if (k === 'q' || k === 'r') this.pending.push({ kind: 'super', ...aim() });
      if (k === 'g') this.pending.push({ kind: 'gadget', ax: 0, az: 0 });
      if (k === 'f') this.interactPending = true;
      if (k === 'escape' || k === 'p') this.pause(!this.paused);
      if (['1', '2', '3', '4'].includes(k)) {
        const em = this.app.meta.state.profile.emotes[+k - 1];
        if (em) p.input.emote = em;
      }
    }
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  /** Called before every simulation step. */
  applyInput() {
    const p = this.world.player;
    if (!p) return;
    let mx = this.joyV.x,
      mz = this.joyV.y;
    const K = this.keys;
    if (K.has('a') || K.has('arrowleft')) mx -= 1;
    if (K.has('d') || K.has('arrowright')) mx += 1;
    if (K.has('w') || K.has('z') || K.has('arrowup')) mz -= 1;
    if (K.has('s') || K.has('arrowdown')) mz += 1;
    p.input.mx = mx;
    p.input.mz = mz;
    if (this.pending.length && p.alive) {
      const a = this.pending.shift()!;
      p.input.ax = a.ax;
      p.input.az = a.az;
      if (a.kind === 'attack') p.input.attack = true;
      if (a.kind === 'skill') p.input.skill = true;
      if (a.kind === 'super') p.input.super = true;
      if (a.kind === 'gadget') p.input.gadget = true;
    } else if (!p.input.attack && !p.input.skill && !p.input.super) {
      p.input.ax = p.input.az = 0;
    }
    if (!p.alive) this.pending.length = 0;
    if (this.interactPending) {
      p.input.interact = true;
      this.interactPending = false;
    }
  }

  // ------------------------------------------------------------ per-frame UI
  update(_dt: number) {
    const w = this.world;
    const p = w.player!;
    const my = p.team;
    const mode = w.cfg.mode;
    // score
    if (mode === 'boss_raid') {
      this.scoreA.textContent = `${w.score[0]}%`;
      this.scoreB.textContent = '👑';
      this.targetEl.textContent = 'Abattez le TITAN !';
    } else if (mode === 'survival') {
      this.scoreA.textContent = `❤${w.score[my]}`;
      this.scoreB.textContent = `❤${w.score[1 - my]}`;
      this.targetEl.textContent = 'Vies restantes';
    } else {
      this.scoreA.textContent = String(w.score[my]);
      this.scoreB.textContent = String(w.score[1 - my]);
      this.targetEl.textContent = `Objectif ${w.target}`;
    }
    const rem = Math.max(0, w.duration - w.time);
    this.timerEl.textContent = `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`;
    this.timerEl.classList.toggle('hot', rem < 20 && w.state === 'playing');
    // countdown
    if (w.state === 'intro') {
      const c = Math.ceil(w.introT);
      if (c !== this.lastCount) {
        this.lastCount = c;
        this.countdown.textContent = String(c);
        this.countdown.style.animation = 'none';
        void this.countdown.offsetWidth;
        this.countdown.style.animation = 'announce 1s forwards';
        audio.sfx('countdown');
      }
    } else if (this.lastCount !== 0) {
      this.lastCount = 0;
      this.countdown.textContent = 'GO !';
      this.countdown.style.animation = 'none';
      void this.countdown.offsetWidth;
      this.countdown.style.animation = 'announce 1s forwards';
      audio.sfx('go');
      setTimeout(() => (this.countdown.textContent = ''), 900);
    }
    // buttons
    const atkFrac = p.ammo / p.def.attack.ammo;
    (this.bAtk.querySelector('.cd') as HTMLElement).style.setProperty('--p', `${(1 - Math.min(1, p.ammo)) * 100}%`);
    this.bAtk.style.opacity = p.ammo >= 1 ? '1' : '0.7';
    void atkFrac;
    const skFrac = p.skillCd / p.skillCdMax;
    (this.bSkl.querySelector('.cd') as HTMLElement).style.setProperty('--p', `${skFrac * 100}%`);
    (this.bSkl.querySelector('.cdt') as HTMLElement).textContent = p.skillCd > 0 ? String(Math.ceil(p.skillCd)) : '';
    (this.bSup.querySelector('.ring') as HTMLElement).style.setProperty('--p', `${p.superCharge * 100}%`);
    this.bSup.classList.toggle('ready', p.superCharge >= 1);
    if (p.gadget) {
      (this.bGad.querySelector('.uses') as HTMLElement).textContent = String(p.gadgetUses);
      this.bGad.style.opacity = p.gadgetUses > 0 && p.gadgetCd <= 0 ? '1' : '0.45';
    }
    const nearNode = w.nodes.some((n) => n.cd <= 0 && Math.hypot(n.x - p.x, n.z - p.z) < 2.2);
    this.bInt.classList.toggle('near', nearNode && p.alive);
    // carry bar
    if (p.carrying) {
      const e = p.carrying;
      const next = e.phase < 4 ? Math.max(0, w.eggPhaseTime() - e.phaseT) : 0;
      this.carryBar.style.display = 'block';
      this.carryBar.innerHTML = `<div class="f-title stroke">${['🥚', '🐣', '🐾', '👹', '👑'][e.phase]} ${EGG_PHASE_NAMES[e.phase]} · ${getBeast(e.speciesId).name} · <span style="color:#ffd23a">${EGG_POINTS[e.phase]} PTS</span></div>${e.phase < 4 ? `<div class="small">Évolution dans ${Math.ceil(next)}s → ${EGG_POINTS[e.phase + 1]} pts</div><div class="cb"><i style="width:${(e.phaseT / w.eggPhaseTime()) * 100}%"></i></div>` : '<div class="small">PUISSANCE MAXIMALE !</div>'}`;
    } else this.carryBar.style.display = 'none';
    // death panel
    if (!p.alive && w.state !== 'ended') {
      this.deadPanel.style.display = 'block';
      this.deadPanel.innerHTML = p.respawnT > 1e6 ? '<div class="f-title stroke" style="font-size:26px">ÉLIMINÉ</div><div class="small">Plus de vies… soutiens ton équipe !</div>' : `<div class="f-title stroke" style="font-size:26px">K.O.</div><div class="small">Réapparition dans ${Math.ceil(Math.max(0, p.respawnT))}s</div>`;
    } else this.deadPanel.style.display = 'none';
    // event bar
    if (w.event) {
      const ev = MATCH_EVENTS[w.event.id];
      this.eventBar.style.display = 'block';
      this.eventBar.style.background = `linear-gradient(${ev.color}, #241a55)`;
      this.eventBar.textContent = `${ev.icon} ${ev.name} · ${Math.ceil(w.event.dur - w.event.t)}s`;
    } else if (w.wind.t > 0) {
      this.eventBar.style.display = 'block';
      this.eventBar.style.background = 'linear-gradient(#c6f5d8, #241a55)';
      this.eventBar.textContent = `🌬️ RAFALE ${w.wind.x > 0 ? '→' : '←'}`;
    } else {
      const toEvent = Math.ceil(w.core.eventT);
      if (w.rules.coreEvents && toEvent <= 5 && w.state === 'playing') {
        this.eventBar.style.display = 'block';
        this.eventBar.style.background = 'linear-gradient(#7ff7ff, #241a55)';
        this.eventBar.textContent = `⚠️ GRAVITY CORE : événement dans ${toEvent}s`;
      } else this.eventBar.style.display = 'none';
    }
    // aim indicator
    this.updateAim();
  }

  private updateAim() {
    const p = this.world.player!;
    let d: DragState | null = null;
    for (const x of this.drags.values()) if (x.dragged) d = x;
    if (!d || !p.alive) {
      this.aimGroup.visible = false;
      return;
    }
    this.aimGroup.visible = true;
    let range = p.def.attack.range,
      radius = 0;
    const def: any = d.kind === 'skill' ? p.def.skill.def : d.kind === 'super' ? p.def.super.def : null;
    if (d.kind === 'attack' && p.def.attack.kind === 'lob') radius = p.def.attack.radius ?? 2;
    if (def) {
      range = def.range ?? def.dist ?? 8;
      radius = def.radius ?? def.area ?? 0;
      if (def.kind === 'gravityZone' && def.range === 0) range = 0;
    }
    const l = Math.hypot(d.dx, d.dz) || 1;
    const nx = d.dx / l,
      nz = d.dz / l;
    const reach = range * (radius > 0 ? Math.min(1, l) : 1);
    this.aimLine.scale.set(radius > 0 ? 0.25 : 1.1, Math.max(0.1, reach), 1);
    this.aimLine.position.set(p.x + (nx * reach) / 2, 0.12, p.z + (nz * reach) / 2);
    this.aimLine.rotation.z = Math.atan2(nx, nz) + Math.PI;
    this.aimLine.rotation.set(-Math.PI / 2, 0, -Math.atan2(nx, nz) + Math.PI);
    this.aimCircle.visible = radius > 0;
    this.aimCircle.scale.setScalar(Math.max(0.5, radius));
    this.aimCircle.position.set(p.x + nx * reach, 0.13, p.z + nz * reach);
    const col = d.kind === 'super' ? '#ffd23a' : d.kind === 'skill' ? '#38c8ff' : '#ffffff';
    (this.aimLine.material as THREE.MeshBasicMaterial).color.set(col);
    (this.aimCircle.material as THREE.MeshBasicMaterial).color.set(col);
  }

  // ------------------------------------------------------------ fx reactions
  onFx(e: FxEvent) {
    const w = this.world;
    const p = w.player!;
    const unit = (id: number) => w.units.find((u) => u.id === id);
    switch (e.t) {
      case 'deliver': {
        const mine = e.team === p.team;
        this.announce(`+${e.points}`, mine ? '#5fb0ff' : '#ff6a7a', `${mine ? 'TON ÉQUIPE' : 'ENNEMI'} · ${EGG_PHASE_NAMES[e.phase]}`);
        break;
      }
      case 'death': {
        const v = unit(e.u),
          k = unit(e.killer);
        if (v) this.feed(k ? `<b style="color:${k.team === p.team ? '#7fd0ff' : '#ff8a9a'}">${k.name}</b> 💥 <b style="color:${v.team === p.team ? '#7fd0ff' : '#ff8a9a'}">${v.name}</b>` : `💀 <b>${v.name}</b>`);
        if (k === p) this.announce('ÉLIMINATION !', '#ffd23a');
        break;
      }
      case 'event': {
        const ev = MATCH_EVENTS[e.id];
        this.announce(`${ev.icon} ${ev.name}`, ev.color, ev.desc);
        break;
      }
      case 'evolve':
        if (e.phase >= 3) this.feed(`${e.phase === 4 ? '👑' : '👹'} Un œuf est devenu <b>${EGG_PHASE_NAMES[e.phase]}</b> !`);
        break;
      case 'node':
        if (e.u === p.id || unit(e.u)) {
          const u = unit(e.u);
          if (u && w.nodes.some((n) => Math.hypot(n.x - e.x, n.z - e.z) < 0.5)) this.feed(`🧲 <b style="color:${u.team === p.team ? '#7fd0ff' : '#ff8a9a'}">${u.name}</b> active ${GRAVITY_INFO[e.gtype as keyof typeof GRAVITY_INFO]?.name ?? e.gtype}`);
        }
        break;
      case 'capture':
        this.feed(e.team === p.team ? '🚩 Zone capturée !' : '⚠️ Zone perdue !');
        break;
      case 'boss':
        this.feed(`👑 Le TITAN prépare : <b>${({ slam: 'ÉCRASEMENT', barrage: 'BARRAGE', summon: 'INVOCATION', vortex: 'VORTEX', meteors: 'MÉTÉORES' } as any)[e.move]}</b>`);
        break;
      case 'super':
        if (e.u === p.id) this.announce(p.def.super.name, '#ffd23a');
        break;
      case 'collapse':
        this.feed('⚠️ L’arène s’effondre !');
        break;
    }
  }
  private announce(text: string, color: string, sub = '') {
    const a = h('div', { class: 'announce' }, h('div', { class: 'a1 stroke-l', style: `color:${color}` }, text), sub ? h('div', { class: 'a2 stroke' }, sub) : null);
    this.el.appendChild(a);
    setTimeout(() => a.remove(), 2000);
  }
  private feed(html: string) {
    const k = h('div', { class: 'kf', html });
    this.killfeed.appendChild(k);
    while (this.killfeed.children.length > 4) this.killfeed.firstChild!.remove();
    setTimeout(() => k.remove(), 4500);
  }
  private toggleEmotes() {
    const ems = this.app.meta.state.profile.emotes;
    const m = modal(
      h('div', { class: 'col center' }, h('h2', { class: 'stroke' }, 'EMOTES'), h('div', { class: 'row wrap center' }, ems.map((em) => btn(em, 'white iconbtn', () => ((this.world.player!.input.emote = em), m.close()))))),
    );
  }

  pause(on: boolean) {
    const m = this.app.match;
    if (!m || this.world.state === 'ended') return;
    this.paused = on;
    m.paused = on;
    if (on) {
      const st = this.app.meta.state.settings;
      const aimBtn = btn(`VISÉE : ${st.aim === 'auto' ? 'AUTO' : 'MANUELLE'}`, 'blue', () => {
        st.aim = st.aim === 'auto' ? 'manual' : 'auto';
        aimBtn.textContent = `VISÉE : ${st.aim === 'auto' ? 'AUTO' : 'MANUELLE'}`;
        this.app.meta.dirty();
      });
      const box = h(
        'div',
        { class: 'col pause-menu' },
        h('h2', { class: 'stroke' }, 'PAUSE'),
        h('p', { class: 'muted small', style: 'text-align:center' }, `${MODE_MAP[this.world.cfg.mode].name} · ${this.world.arena.name}`),
        btn('▶ REPRENDRE', 'green big', () => this.pause(false)),
        aimBtn,
        btn('🏳 ABANDONNER', 'red', () => confirmModal('Abandonner ?', 'Le match comptera comme une défaite.', 'ABANDONNER', () => (this.pause(false), this.app.forfeit()), 'red')),
      );
      this.pauseModal = modal(box, { onClose: () => this.pause(false) });
    } else {
      const pm = this.pauseModal;
      this.pauseModal = null;
      pm?.close();
    }
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.app.renderer.canvas.removeEventListener('pointerdown', this.onCanvasDown);
    this.app.renderer.canvas.removeEventListener('pointermove', this.onCanvasMove);
  }
}

export type { Unit };
