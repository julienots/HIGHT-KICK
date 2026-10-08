import { describe, expect, it } from 'vitest';
import { MemoryStorage, SaveSystem, checksum } from '../../src/systems/save';
import { defaultState, sanitize, migrate, SAVE_VERSION } from '../../src/systems/state';

describe('SaveSystem (offline, crash-safe)', () => {
  it('round-trips the full player state', () => {
    const store = new MemoryStorage();
    const s1 = new SaveSystem(store);
    const st = defaultState();
    st.currencies.coins = 1234;
    st.jackers.vex.level = 7;
    st.beasts.push({ uid: 'bx', speciesId: 'voltaris', level: 12, xp: 3, stage: 2, mutation: 'prism', obtainedAt: 1, favorite: true, breedReadyAt: 0 });
    st.settings.aim = 'manual';
    s1.write(st);
    const loaded = new SaveSystem(store).load();
    expect(loaded.currencies.coins).toBe(1234);
    expect(loaded.jackers.vex.level).toBe(7);
    expect(loaded.beasts.find((b) => b.uid === 'bx')?.mutation).toBe('prism');
    expect(loaded.settings.aim).toBe('manual');
  });

  it('alternates slots so a torn write never destroys the last good save', () => {
    const store = new MemoryStorage();
    const sys = new SaveSystem(store);
    const st = defaultState();
    st.currencies.coins = 100;
    sys.write(st);
    st.currencies.coins = 200;
    sys.write(st);
    // simulate a crash in the middle of writing the newest slot (truncated JSON)
    const newest = sys.seq % 2 === 0 ? 'bg.save.A' : 'bg.save.B';
    store.set(newest, store.get(newest)!.slice(0, 50));
    const re = new SaveSystem(store);
    const loaded = re.load();
    expect(loaded.currencies.coins).toBe(100);
    expect(re.corruptedSlots).toBe(1);
  });

  it('detects tampering / bit-rot with the checksum and falls back to backups', () => {
    const store = new MemoryStorage();
    const sys = new SaveSystem(store);
    const st = defaultState();
    st.currencies.gems = 77;
    sys.write(st); // seq 1 -> also backup0
    for (const k of ['bg.save.A', 'bg.save.B']) {
      const raw = store.get(k);
      if (raw) store.set(k, raw.replace('\\"gems\\":77', '\\"gems\\":99999'));
    }
    const re = new SaveSystem(store);
    const loaded = re.load();
    expect(re.lastSource).toBe('backup');
    expect(loaded.currencies.gems).toBe(77);
  });

  it('starts a new game when nothing valid exists', () => {
    const store = new MemoryStorage();
    store.set('bg.save.A', 'garbage{');
    const re = new SaveSystem(store);
    const st = re.load();
    expect(re.lastSource).toBe('new');
    expect(st.version).toBe(SAVE_VERSION);
  });

  it('sanitizes invalid values instead of crashing', () => {
    const bad: any = defaultState();
    bad.currencies.coins = -50;
    bad.currencies.gems = 'lots';
    bad.jackers.vex.level = 999;
    bad.beasts.push({ uid: 'x', speciesId: 'does-not-exist' });
    bad.settings.quality = 'hyper';
    const s = sanitize(bad);
    expect(s.currencies.coins).toBe(0);
    expect(s.currencies.gems).toBe(30);
    expect(s.jackers.vex.level).toBe(20);
    expect(s.beasts.some((b) => b.uid === 'x')).toBe(false);
    expect(s.settings.quality).toBe('high');
  });

  it('migrates v1 saves', () => {
    const v1: any = { version: 1, trophies: 120, profile: { selectedJacker: 'vex' }, jackers: { vex: { unlocked: true, level: 3, trophies: 10 } } };
    const s = sanitize(migrate(v1));
    expect(s.jackers.vex.trophies).toBe(130);
    expect(s.version).toBe(SAVE_VERSION);
  });

  it('export/import codes are checksummed', () => {
    const sys = new SaveSystem(new MemoryStorage());
    const st = defaultState();
    st.profile.name = 'Ünicode✓';
    const code = sys.exportString(st);
    expect(sys.importString(code)?.profile.name).toBe('Ünicode✓');
    expect(sys.importString(code.slice(0, -4) + 'AAAA')).toBeNull();
    expect(checksum('a')).not.toBe(checksum('b'));
  });
});
