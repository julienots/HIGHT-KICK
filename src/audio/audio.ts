/**
 * Procedural audio (no audio files needed → 100% offline, tiny APK).
 * Original sound identity: punchy synth SFX + adaptive chiptune-pop music sequencer.
 */
type Scale = 'major' | 'minor' | 'dorian' | 'lydian' | 'phrygian';
const SCALES: Record<Scale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface MusicSpec {
  tempo: number;
  root: number;
  scale: Scale;
  intensity: number;
  style: 'menu' | 'battle' | 'boss' | 'calm';
}

export class AudioSystem {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  comp!: DynamicsCompressorNode;
  noise!: AudioBuffer;
  musicVol = 0.6;
  sfxVol = 0.8;
  private seqTimer: any = null;
  private spec: MusicSpec | null = null;
  private nextNote = 0;
  private step = 0;
  private bar = 0;
  private lastSfx = new Map<string, number>();
  intensity = 0.5;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    this.ctx = new AC();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol * 0.45;
    this.sfxGain.gain.value = this.sfxVol;
    this.musicGain.connect(this.comp);
    this.sfxGain.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.spec) this.startSeq();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.musicGain.gain.setTargetAtTime(music * 0.45, this.ctx.currentTime, 0.1);
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
  }
  suspend() {
    this.ctx?.suspend();
  }
  resume() {
    this.ctx?.resume();
  }

  // ------------------------------------------------------------ primitives
  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, opts: { slide?: number; attack?: number; dest?: AudioNode; detune?: number; filter?: number } = {}) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private noiseHit(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', dest?: AudioNode, q = 1) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfxGain);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ SFX
  sfx(name: string, pitch = 1, vol = 1) {
    if (!this.ctx || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    // rate limit identical sounds (crowded fights stay readable)
    const last = this.lastSfx.get(name) ?? 0;
    if (now - last < 0.035) return;
    this.lastSfx.set(name, now);
    const t = now + 0.005;
    const p = pitch;
    const v = vol;
    switch (name) {
      case 'shoot':
        this.tone(880 * p, t, 0.09, 'square', 0.08 * v, { slide: 0.5, filter: 3000 });
        this.noiseHit(t, 0.05, 0.08 * v, 3000);
        break;
      case 'spread':
        this.tone(660 * p, t, 0.1, 'sawtooth', 0.06 * v, { slide: 0.6, filter: 2500 });
        this.noiseHit(t, 0.08, 0.1 * v, 2000);
        break;
      case 'lob':
        this.tone(300 * p, t, 0.18, 'sine', 0.15 * v, { slide: 1.8 });
        break;
      case 'melee':
        this.noiseHit(t, 0.12, 0.25 * v, 1800, 'bandpass', undefined, 0.8);
        this.tone(220 * p, t, 0.1, 'triangle', 0.12 * v, { slide: 0.5 });
        break;
      case 'hit':
        this.tone(200 * p, t, 0.08, 'square', 0.1 * v, { slide: 0.5, filter: 1800 });
        this.noiseHit(t, 0.06, 0.12 * v, 1200);
        break;
      case 'hurt':
        this.tone(140, t, 0.16, 'sawtooth', 0.14 * v, { slide: 0.6, filter: 1200 });
        break;
      case 'crit':
        this.tone(1200, t, 0.12, 'square', 0.08 * v, { slide: 1.5 });
        this.tone(1800, t + 0.04, 0.12, 'square', 0.06 * v);
        break;
      case 'explode':
        this.noiseHit(t, 0.5, 0.5 * v, 400, 'lowpass');
        this.tone(90, t, 0.4, 'sine', 0.4 * v, { slide: 0.4 });
        break;
      case 'dash':
        this.noiseHit(t, 0.22, 0.2 * v, 2500, 'highpass');
        this.tone(400 * p, t, 0.18, 'sine', 0.08 * v, { slide: 2 });
        break;
      case 'blink':
        this.tone(1400 * p, t, 0.2, 'sine', 0.1 * v, { slide: 0.3 });
        this.tone(700 * p, t + 0.05, 0.2, 'triangle', 0.08 * v, { slide: 2.2 });
        break;
      case 'shield':
        this.tone(500, t, 0.35, 'triangle', 0.12 * v, { slide: 1.6 });
        this.tone(750, t + 0.05, 0.35, 'sine', 0.08 * v, { slide: 1.4 });
        break;
      case 'heal':
        [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), t + i * 0.05, 0.25, 'sine', 0.08 * v));
        break;
      case 'skill':
        this.tone(330 * p, t, 0.25, 'sawtooth', 0.09 * v, { slide: 2, filter: 2500 });
        this.noiseHit(t, 0.2, 0.12 * v, 1500);
        break;
      case 'super':
        this.tone(110 * p, t, 0.6, 'sawtooth', 0.18 * v, { slide: 4, filter: 2200 });
        this.tone(220 * p, t + 0.05, 0.6, 'square', 0.08 * v, { slide: 3, filter: 3000 });
        this.noiseHit(t, 0.6, 0.25 * v, 800, 'lowpass');
        break;
      case 'superReady':
        [0, 7, 12].forEach((s, i) => this.tone(mtof(79 + s), t + i * 0.06, 0.18, 'square', 0.05 * v, { filter: 4000 }));
        break;
      case 'node':
        this.tone(160, t, 0.8, 'sine', 0.25 * v, { slide: 0.4 });
        this.tone(320, t, 0.8, 'triangle', 0.1 * v, { slide: 2.5 });
        this.noiseHit(t, 0.7, 0.15 * v, 600, 'lowpass');
        break;
      case 'pickup':
        this.tone(660, t, 0.08, 'square', 0.08 * v);
        this.tone(990, t + 0.07, 0.12, 'square', 0.08 * v);
        break;
      case 'drop':
        this.tone(500, t, 0.15, 'triangle', 0.1 * v, { slide: 0.4 });
        break;
      case 'deliver':
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(mtof(67 + s), t + i * 0.07, 0.3, 'square', 0.07 * v, { filter: 4000 }));
        this.noiseHit(t + 0.3, 0.4, 0.1 * v, 6000, 'highpass');
        break;
      case 'enemyDeliver':
        [12, 7, 3, 0].forEach((s, i) => this.tone(mtof(62 + s), t + i * 0.08, 0.25, 'sawtooth', 0.06 * v, { filter: 1500 }));
        break;
      case 'evolve':
        [0, 5, 9, 12].forEach((s, i) => this.tone(mtof(64 + s), t + i * 0.06, 0.22, 'triangle', 0.1 * v));
        break;
      case 'death':
        this.tone(400 * p, t, 0.5, 'sawtooth', 0.12 * v, { slide: 0.2, filter: 1500 });
        this.noiseHit(t, 0.4, 0.2 * v, 500, 'lowpass');
        break;
      case 'kill':
        this.tone(880, t, 0.1, 'square', 0.08 * v);
        this.tone(1320, t + 0.08, 0.18, 'square', 0.08 * v);
        break;
      case 'respawn':
        this.tone(300, t, 0.3, 'sine', 0.12 * v, { slide: 3 });
        break;
      case 'jump':
        this.tone(250, t, 0.25, 'sine', 0.15 * v, { slide: 3 });
        break;
      case 'land':
        this.noiseHit(t, 0.15, 0.2 * v, 300, 'lowpass');
        break;
      case 'portal':
        this.tone(200, t, 0.4, 'sine', 0.12 * v, { slide: 5 });
        this.tone(1200, t + 0.1, 0.3, 'sine', 0.06 * v, { slide: 0.3 });
        break;
      case 'crate':
        this.noiseHit(t, 0.25, 0.3 * v, 900);
        this.tone(160, t, 0.15, 'square', 0.1 * v, { slide: 0.5, filter: 800 });
        break;
      case 'lightning':
        this.noiseHit(t, 0.35, 0.35 * v, 3500, 'highpass');
        this.tone(60, t, 0.3, 'sawtooth', 0.15 * v, { slide: 0.5, filter: 600 });
        break;
      case 'warn':
        this.tone(880, t, 0.1, 'square', 0.05 * v);
        this.tone(880, t + 0.15, 0.1, 'square', 0.05 * v);
        break;
      case 'event':
        [0, 3, 7, 10, 12].forEach((s, i) => this.tone(mtof(60 + s), t + i * 0.05, 0.3, 'sawtooth', 0.07 * v, { filter: 2500 }));
        this.noiseHit(t, 0.6, 0.12 * v, 400, 'lowpass');
        break;
      case 'countdown':
        this.tone(660, t, 0.15, 'square', 0.1 * v, { filter: 3000 });
        break;
      case 'go':
        this.tone(990, t, 0.35, 'square', 0.12 * v, { filter: 4000 });
        this.tone(1320, t, 0.35, 'square', 0.06 * v, { filter: 4000 });
        break;
      case 'click':
        this.tone(1100, t, 0.05, 'triangle', 0.12 * v);
        this.noiseHit(t, 0.03, 0.06 * v, 5000, 'highpass');
        break;
      case 'back':
        this.tone(700, t, 0.06, 'triangle', 0.1 * v, { slide: 0.7 });
        break;
      case 'coin':
        this.tone(1320, t, 0.06, 'square', 0.06 * v, { filter: 5000 });
        this.tone(1760, t + 0.05, 0.15, 'square', 0.06 * v, { filter: 5000 });
        break;
      case 'buy':
        [0, 7, 12].forEach((s, i) => this.tone(mtof(76 + s), t + i * 0.05, 0.15, 'square', 0.06 * v, { filter: 4000 }));
        break;
      case 'error':
        this.tone(200, t, 0.18, 'square', 0.08 * v, { filter: 900 });
        break;
      case 'chestShake':
        this.noiseHit(t, 0.12, 0.2 * v, 700);
        this.tone(120, t, 0.12, 'triangle', 0.15 * v);
        break;
      case 'chestRise':
        for (let i = 0; i < 10; i++) this.tone(mtof(55 + i * 2), t + i * 0.07, 0.12, 'square', 0.04 * v, { filter: 3000 });
        break;
      case 'chestOpen':
        this.noiseHit(t, 0.6, 0.3 * v, 5000, 'highpass');
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(60 + s), t + i * 0.04, 0.4, 'triangle', 0.08 * v));
        break;
      case 'reveal':
        this.tone(mtof(72) * p, t, 0.2, 'triangle', 0.12 * v);
        this.tone(mtof(79) * p, t + 0.06, 0.25, 'sine', 0.08 * v);
        break;
      case 'rare':
        [0, 4, 7, 11, 14, 19, 23, 26].forEach((s, i) => this.tone(mtof(64 + s), t + i * 0.06, 0.5, 'sine', 0.09 * v));
        this.noiseHit(t, 1.2, 0.08 * v, 8000, 'highpass');
        break;
      case 'levelUp':
        [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(67 + s), t + i * 0.09, 0.35, 'square', 0.07 * v, { filter: 4000 }));
        [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(55 + s), t + i * 0.09, 0.35, 'triangle', 0.08 * v));
        break;
      case 'victory':
        [
          [0, 0],
          [4, 0.12],
          [7, 0.24],
          [12, 0.36],
          [11, 0.6],
          [12, 0.72],
          [16, 0.84],
        ].forEach(([s, d]) => {
          this.tone(mtof(67 + s), t + d, 0.35, 'square', 0.08 * v, { filter: 4500 });
          this.tone(mtof(55 + s), t + d, 0.35, 'triangle', 0.08 * v);
        });
        break;
      case 'defeat':
        [
          [7, 0],
          [6, 0.25],
          [5, 0.5],
          [0, 0.8],
        ].forEach(([s, d]) => this.tone(mtof(60 + s), t + d, 0.5, 'triangle', 0.1 * v, { slide: 0.97 }));
        break;
      case 'voice': {
        // cute gibberish chirps (per-character pitch)
        for (let i = 0; i < 3; i++) this.tone(mtof(70 + Math.floor(Math.random() * 7)) * p, t + i * 0.07, 0.08, 'triangle', 0.07 * v, { slide: Math.random() < 0.5 ? 1.3 : 0.8 });
        break;
      }
      case 'boss':
        this.tone(55, t, 1.2, 'sawtooth', 0.25 * v, { slide: 0.7, filter: 500 });
        this.noiseHit(t, 1, 0.2 * v, 200, 'lowpass');
        break;
    }
  }

  // ------------------------------------------------------------ MUSIC
  playMusic(spec: MusicSpec | null) {
    if (spec && this.spec && spec.style === this.spec.style && spec.root === this.spec.root && spec.tempo === this.spec.tempo) return;
    this.spec = spec;
    this.stopSeq();
    if (spec && this.ctx) this.startSeq();
  }
  private startSeq() {
    if (!this.ctx || !this.spec) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.seqTimer = setInterval(() => this.schedule(), 30);
  }
  private stopSeq() {
    if (this.seqTimer) clearInterval(this.seqTimer);
    this.seqTimer = null;
  }
  private schedule() {
    const c = this.ctx,
      s = this.spec;
    if (!c || !s) return;
    const sixteenth = 60 / s.tempo / 4;
    while (this.nextNote < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextNote, s, sixteenth);
      this.nextNote += sixteenth;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % 8;
    }
  }
  private playStep(st: number, t: number, s: MusicSpec, d: number) {
    const dest = this.musicGain;
    const sc = SCALES[s.scale];
    const note = (deg: number, oct = 0) => s.root + sc[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
    // chord progression I - VI - IV - V (degrees)
    const prog = s.style === 'boss' ? [0, 5, 6, 4] : s.style === 'calm' ? [0, 3, 5, 4] : [0, 5, 3, 4];
    const chord = prog[Math.floor(this.bar / 2) % 4];
    const inten = s.style === 'menu' ? 0.6 : s.style === 'calm' ? 0.3 : 0.6 + this.intensity * 0.4;
    // drums
    if (s.style !== 'calm') {
      if (st % 4 === 0) {
        this.tone(140, t, 0.18, 'sine', 0.55, { slide: 0.3, dest });
        this.noiseHit(t, 0.03, 0.12, 120, 'lowpass', dest);
      }
      if (st === 4 || st === 12) this.noiseHit(t, 0.16, 0.22 * inten + 0.08, 1800, 'bandpass', dest, 0.7);
      if (st % 2 === 0 || (inten > 0.8 && st % 1 === 0)) this.noiseHit(t, 0.03, 0.05 + (st % 4 === 2 ? 0.04 : 0), 9000, 'highpass', dest);
    } else if (st % 8 === 0) this.noiseHit(t, 0.4, 0.04, 3000, 'highpass', dest);
    // bass
    const bassPattern = s.style === 'battle' || s.style === 'boss' ? [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0] : [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (bassPattern[st]) this.tone(mtof(note(chord, -2)), t, d * 1.8, 'square', 0.13, { filter: 600, dest });
    // pad (chord) at bar start
    if (st === 0 && this.bar % 2 === 0)
      [0, 2, 4].forEach((k) => this.tone(mtof(note(chord + k, 0)), t, d * 30, 'triangle', 0.035, { attack: 0.3, dest, detune: (k - 1) * 6 }));
    // lead arpeggio / melody
    const arp = [0, 2, 4, 7, 4, 2, 0, 4];
    const melodyOn = s.style === 'calm' ? st % 4 === 0 : s.style === 'menu' ? st % 2 === 0 : st % 2 === 0 && (this.bar % 4 !== 3 || st < 8);
    if (melodyOn) {
      const deg = chord + arp[(st / 2 + this.bar * 3) % arp.length];
      this.tone(mtof(note(deg, 1)), t, d * 1.6, s.style === 'boss' ? 'sawtooth' : 'square', 0.035 * (0.6 + inten * 0.6), { filter: 3500, dest });
    }
    // counter melody sparkle
    if (s.style !== 'boss' && st === 14 && this.bar % 2 === 1) this.tone(mtof(note(chord + 4, 2)), t, d * 2, 'sine', 0.04, { dest });
  }
}

export const audio = new AudioSystem();
