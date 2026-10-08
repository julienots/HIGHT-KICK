import { hashString } from '../core/rng';
import { defaultState, migrate, sanitize, SAVE_VERSION, type PlayerState } from './state';

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  set(k: string, v: string) {
    localStorage.setItem(k, v);
  }
  remove(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStorage implements StorageAdapter {
  map = new Map<string, string>();
  get(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  set(k: string, v: string) {
    this.map.set(k, v);
  }
  remove(k: string) {
    this.map.delete(k);
  }
}

interface Envelope {
  app: 'beast-gravity';
  v: number;
  seq: number;
  ts: number;
  sum: string;
  data: string;
}

const PREFIX = 'bg.save.';
const SLOTS = ['A', 'B'];
const BACKUPS = 3;
const SALT = 'SUPERESSENCE::BEAST-GRAVITY';

export function checksum(data: string) {
  return hashString(SALT + data).toString(36) + '-' + data.length.toString(36);
}

export type LoadSource = 'slot' | 'backup' | 'new';

/**
 * Crash-safe save system:
 *  - double-buffered slots (A/B): a write never overwrites the last good save
 *  - each envelope carries a checksum + monotonic sequence number
 *  - rolling backups (3) for recovery if both slots are corrupted
 *  - version migrations + schema sanitizing on load
 */
export class SaveSystem {
  seq = 0;
  lastSource: LoadSource = 'new';
  corruptedSlots = 0;
  private dirty = false;
  private timer: any = null;
  constructor(private store: StorageAdapter) {}

  private readEnvelope(key: string): { env: Envelope; data: any } | null {
    const raw = this.store.get(key);
    if (!raw) return null;
    try {
      const env = JSON.parse(raw) as Envelope;
      if (env.app !== 'beast-gravity' || typeof env.data !== 'string') throw new Error('bad envelope');
      if (checksum(env.data) !== env.sum) throw new Error('checksum mismatch');
      const data = JSON.parse(env.data);
      return { env, data };
    } catch {
      this.corruptedSlots++;
      return null;
    }
  }

  load(): PlayerState {
    this.corruptedSlots = 0;
    const slots = SLOTS.map((s) => this.readEnvelope(PREFIX + s)).filter(Boolean) as { env: Envelope; data: any }[];
    slots.sort((a, b) => b.env.seq - a.env.seq);
    if (slots.length) {
      this.seq = slots[0].env.seq;
      this.lastSource = 'slot';
      return sanitize(migrate(slots[0].data));
    }
    for (let i = 0; i < BACKUPS; i++) {
      const b = this.readEnvelope(PREFIX + 'backup' + i);
      if (b) {
        this.seq = b.env.seq;
        this.lastSource = 'backup';
        return sanitize(migrate(b.data));
      }
    }
    this.lastSource = 'new';
    return defaultState();
  }

  write(state: PlayerState) {
    state.updatedAt = Date.now();
    state.version = SAVE_VERSION;
    const data = JSON.stringify(state);
    this.seq++;
    const env: Envelope = { app: 'beast-gravity', v: SAVE_VERSION, seq: this.seq, ts: state.updatedAt, sum: checksum(data), data };
    const json = JSON.stringify(env);
    const slot = SLOTS[this.seq % 2];
    try {
      this.store.set(PREFIX + slot, json);
      if (this.seq % 10 === 1) this.store.set(PREFIX + 'backup' + (Math.floor(this.seq / 10) % BACKUPS), json);
    } catch (e) {
      // storage full / unavailable: keep playing, retry on next save
      console.warn('[save] write failed', e);
      return false;
    }
    this.dirty = false;
    return true;
  }

  /** Debounced save: many changes in a burst produce a single write. */
  markDirty(state: PlayerState, delay = 600) {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.dirty) this.write(state);
    }, delay);
  }

  flush(state: PlayerState) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.dirty) this.write(state);
  }

  wipe() {
    for (const s of SLOTS) this.store.remove(PREFIX + s);
    for (let i = 0; i < BACKUPS; i++) this.store.remove(PREFIX + 'backup' + i);
    this.seq = 0;
  }

  exportString(state: PlayerState) {
    const data = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(JSON.stringify({ sum: checksum(data), data }))));
  }
  importString(s: string): PlayerState | null {
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
      if (checksum(o.data) !== o.sum) return null;
      return sanitize(migrate(JSON.parse(o.data)));
    } catch {
      return null;
    }
  }
}
