import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/world';
import { ARENAS } from '../../src/data/arenas';
import { MODES, type ModeId } from '../../src/data/modes';
import { JACKERS } from '../../src/data/jackers';
import { botProfile } from '../../src/sim/ai';

function run(mode: ModeId, arena: string, jacker = 'vex', difficulty: any = 'normal', seed = 1, maxT = 400) {
  const w = new World({
    mode, arena, difficulty, seed, allBots: true,
    player: { jackerId: jacker, level: 5, skin: jacker + '_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: true, useStarPower: true, useSpecial: true },
  });
  const dt = 1 / 30;
  let t = 0;
  const fxKinds = new Set<string>();
  while (w.state !== 'ended' && t < maxT) {
    w.update(dt);
    for (const f of w.fx) fxKinds.add(f.t);
    t += dt;
  }
  return { w, t, fxKinds };
}

describe('match simulation (headless bots)', () => {
  it('plays a full BEAST RUSH match to an end with deliveries', () => {
    const { w, fxKinds } = run('beast_rush', 'sky_jungle');
    expect(w.state).toBe('ended');
    expect(w.score[0] + w.score[1]).toBeGreaterThan(0);
    expect(fxKinds.has('pickup')).toBe(true);
    expect(fxKinds.has('deliver')).toBe(true);
    expect(fxKinds.has('shoot')).toBe(true);
    const totalKills = w.units.reduce((a, u) => a + u.stats.kills, 0);
    expect(totalKills).toBeGreaterThan(0);
    console.log('rush', w.score, w.endReason, w.time.toFixed(0), 'kills', totalKills);
  });

  for (const m of MODES) {
    it(`mode ${m.id} terminates on every arena`, () => {
      for (const a of ARENAS) {
        const { w } = run(m.id, a.id, JACKERS[(a.num * 3) % JACKERS.length].id, 'hard', a.num);
        expect(w.state, `${m.id}@${a.id}`).toBe('ended');
        expect([0, 1, 2]).toContain(w.winner);
      }
    });
  }

  it('eggs evolve over time', () => {
    const w = new World({ mode: 'beast_rush', arena: 'sky_jungle', difficulty: 'easy', seed: 3, allBots: true, player: { jackerId: 'boulder', level: 1, skin: 'boulder_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: false, useStarPower: false, useSpecial: false } });
    // freeze units: remove brains so nobody picks up eggs
    for (const u of w.units) {
      u.brain = null;
      u.x = 0;
      u.z = 40;
    }
    for (let i = 0; i < 30 * 50; i++) w.update(1 / 30);
    expect(Math.max(...w.eggs.map((e) => e.phase))).toBeGreaterThanOrEqual(2);
  });

  it('gravity node activation creates a zone that affects enemies', () => {
    const w = new World({ mode: 'beast_rush', arena: 'sky_jungle', difficulty: 'easy', seed: 5, allBots: true, player: { jackerId: 'oona', level: 1, skin: 'oona_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: false, useStarPower: false, useSpecial: false } });
    w.state = 'playing';
    const node = w.nodes.find((n) => n.gtype === 'vortex')!;
    expect(node).toBeTruthy();
    const me = w.player!;
    me.brain = null;
    me.x = node.x;
    me.z = node.z;
    node.cd = 0;
    const foe = w.units.find((u) => u.team === 1)!;
    foe.brain = null;
    foe.x = node.x + 4;
    foe.z = node.z;
    for (const u of w.units) if (u !== me && u !== foe) (u.brain = null), (u.z = 50);
    expect(w.tryActivateNode(me)).toBe(true);
    const d0 = Math.hypot(foe.x - node.x, foe.z - node.z);
    for (let i = 0; i < 30; i++) w.update(1 / 30);
    const d1 = Math.hypot(foe.x - node.x, foe.z - node.z);
    expect(d1).toBeLessThan(d0 - 1);
    expect(me.stats.nodes).toBe(1);
  });

  it('difficulty changes bot effectiveness (master beats easy more often)', () => {
    let masterWins = 0;
    for (let s = 1; s <= 6; s++) {
      const w = new World({ mode: 'beast_rush', arena: 'beast_valley', difficulty: 'master', seed: s * 17, allBots: true, player: { jackerId: 'volt', level: 5, skin: 'volt_classic', name: 'T', gadget: 0, starPower: 0, special: 0, useGadget: true, useStarPower: true, useSpecial: true } });
      // team 0 = easy, team 1 = master
      for (const u of w.units) if (u.team === 0) u.brain.p = botProfile('easy');
      let t = 0;
      while (w.state !== 'ended' && t < 400) {
        w.update(1 / 30);
        t += 1 / 30;
      }
      if (w.winner === 1) masterWins++;
    }
    expect(masterWins).toBeGreaterThanOrEqual(4);
  });
});
