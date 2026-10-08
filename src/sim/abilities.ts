import type { AbilityDef, AttackDef } from '../data/jackers';
import { angleOf, dist, fromAngle, norm } from '../core/math';
import type { Unit } from './entities';
import type { Target, World } from './world';
import { liftUnit } from './world';

interface Aim {
  dx: number;
  dz: number;
  tx: number;
  tz: number;
  target: Target | null;
}

/** Resolve aiming: manual stick direction, or auto-aim on the best target. */
export function resolveAim(w: World, u: Unit, range: number, needLos = true, leadSpeed = 0): Aim {
  const manual = Math.hypot(u.input.ax, u.input.az) > 0.2;
  if (manual) {
    const n = norm(u.input.ax, u.input.az);
    const m = Math.min(1, Math.hypot(u.input.ax, u.input.az));
    return { dx: n.x, dz: n.z, tx: u.x + n.x * range * m, tz: u.z + n.z * range * m, target: null };
  }
  const t = w.nearestEnemy(u, range * 1.1, needLos);
  if (t) {
    let tx = t.x,
      tz = t.z;
    if (leadSpeed > 0 && t.kind === 'unit') {
      const d = dist(u, t);
      const tt = d / leadSpeed;
      tx += t.vx * tt * 0.6;
      tz += t.vz * tt * 0.6;
    }
    const n = norm(tx - u.x, tz - u.z);
    return { dx: n.x, dz: n.z, tx, tz, target: t };
  }
  const f = fromAngle(u.facing);
  return { dx: f.x, dz: f.z, tx: u.x + f.x * range * 0.7, tz: u.z + f.z * range * 0.7, target: null };
}

function act(u: Unit, a: string) {
  u.action = a;
  u.actionT = 0;
  u.actionId++;
}

export function tickAbilities(w: World, u: Unit, dt: number) {
  // queued burst shots
  if (u.burst) {
    u.burst.t -= dt;
    if (u.burst.t <= 0) {
      fireBolt(w, u, u.def.attack, u.burst.dx, u.burst.dz, 0, u.burst.crit);
      u.burst.n--;
      u.burst.t = u.def.attack.interval ?? 0.08;
      if (u.burst.n <= 0) u.burst = null;
    }
  }
  const inp = u.input;
  if (inp.attack) {
    inp.attack = false;
    if (u.ammo >= 1 && u.shotCd <= 0 && !u.dash) doAttack(w, u);
  }
  if (inp.skill) {
    inp.skill = false;
    if (u.skillCd <= 0 && !u.dash) {
      doAbility(w, u, u.def.skill.def, false);
      u.skillCd = u.skillCdMax;
      act(u, 'skill');
      w.emit({ t: 'skill', u: u.id, name: u.def.skill.name });
    }
  }
  if (inp.super) {
    inp.super = false;
    if (u.superCharge >= 1 && !u.dash) {
      u.superCharge = 0;
      u.stats.supers++;
      act(u, 'super');
      w.emit({ t: 'super', u: u.id, name: u.def.super.name });
      doAbility(w, u, u.def.super.def, true);
      if (u.special?.kind === 'superHeal') w.heal(u, u.maxHp * u.special.value, u);
      const hs = u.hasPassive('healOnSuper');
      if (hs) for (const a of w.unitsNear(u.x, u.z, 8, (x) => x.team === u.team)) w.heal(a, a.maxHp * hs.value, u);
    }
  }
  if (inp.gadget) {
    inp.gadget = false;
    if (u.gadget && u.gadgetUses > 0 && u.gadgetCd <= 0) {
      doGadget(w, u);
      u.gadgetUses--;
      u.gadgetCd = 6;
      w.emit({ t: 'gadget', u: u.id, name: u.gadget.name });
    }
  }
}

function attackRange(u: Unit) {
  return u.def.attack.range * (u.special?.kind === 'attackRange' ? 1 + u.special.value : 1);
}

function doAttack(w: World, u: Unit) {
  const a = u.def.attack;
  const range = attackRange(u);
  const crit = w.time - u.lastAttackT > 3;
  const aim = resolveAim(w, u, range, a.kind !== 'lob', u.isBot && u.brain?.lead ? a.speed ?? 0 : 0);
  if (u.isBot && u.brain) {
    const err = u.brain.aimError();
    const ang = angleOf(aim.dx, aim.dz) + err;
    const f = fromAngle(ang);
    aim.dx = f.x;
    aim.dz = f.z;
  }
  u.ammo -= 1;
  u.shotCd = u.rapid ? 0.16 : 0.33;
  u.facing = angleOf(aim.dx, aim.dz);
  u.lastAttackT = w.time;
  u.lastActT = w.time;
  u.revealT = 1;
  act(u, 'attack');
  switch (a.kind) {
    case 'bolt':
      fireBolt(w, u, a, aim.dx, aim.dz, 0, crit);
      break;
    case 'spread': {
      const n = a.count ?? 3;
      const base = angleOf(aim.dx, aim.dz);
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : -((a.angle ?? 0.5) / 2) + ((a.angle ?? 0.5) * i) / (n - 1);
        const f = fromAngle(base + off);
        fireBolt(w, u, a, f.x, f.z, 0, crit);
      }
      break;
    }
    case 'burst':
      fireBolt(w, u, a, aim.dx, aim.dz, 0, crit);
      u.burst = { n: (a.count ?? 3) - 1, t: a.interval ?? 0.08, dx: aim.dx, dz: aim.dz, crit };
      break;
    case 'lob': {
      const d = Math.min(range, Math.hypot(aim.tx - u.x, aim.tz - u.z));
      const tx = u.x + aim.dx * Math.max(2, d),
        tz = u.z + aim.dz * Math.max(2, d);
      w.spawnProjectile({ owner: u, team: u.team, x: u.x, z: u.z, vx: 0, vz: 0, dmg: a.dmg, range: 999, element: u.element, color: skinFx(u), slow: a.slow ?? 0, knockback: a.knockback ?? 0, critReady: crit, lob: { sx: u.x, sz: u.z, tx, tz, t: 0, T: 0.45 + d / 28, splash: a.radius ?? 2 } });
      w.emit({ t: 'shoot', u: u.id, x: u.x, z: u.z, dx: aim.dx, dz: aim.dz, color: skinFx(u), kind: 'lob' });
      break;
    }
    case 'melee': {
      const hits = w.enemiesOf(u.team).filter((t) => {
        const d = Math.hypot(t.x - u.x, t.z - u.z);
        if (d > range + ((t as any).radius ?? 0.6)) return false;
        const ang = Math.abs(angleDiffA(u.facing, angleOf(t.x - u.x, t.z - u.z)));
        return ang < (a.angle ?? 1.5) / 2 + 0.25 || d < 1.2;
      });
      for (const t of hits) w.damage(u, t, a.dmg, { element: u.element, knock: a.knockback ?? 1.5, knockX: aim.dx, knockZ: aim.dz, color: skinFx(u), burn: u.hasPassive('burn')?.value, critReady: crit });
      if (hits.length && u.hasPassive('slowOnHit')) for (const t of hits) if (t.kind === 'unit') ((t.slowT = 1.2), (t.slowAmt = Math.max(t.slowAmt, u.hasPassive('slowOnHit')!.value)));
      w.damageCratesAround(u.x + aim.dx * range * 0.6, u.z + aim.dz * range * 0.6, 1, a.dmg);
      w.emit({ t: 'cone', x: u.x, z: u.z, dx: aim.dx, dz: aim.dz, range, angle: a.angle ?? 1.5, color: skinFx(u) });
      // short lunge forward
      w.move(u, aim.dx * 0.5, aim.dz * 0.5);
      break;
    }
  }
}

function skinFx(u: Unit) {
  return (u as any).fxColor ?? u.def.palette.accent;
}

function fireBolt(w: World, u: Unit, a: AttackDef, dx: number, dz: number, _off: number, crit: boolean) {
  const sp = a.speed ?? 18;
  const range = attackRange(u);
  w.spawnProjectile({ owner: u, team: u.team, x: u.x + dx * 0.6, z: u.z + dz * 0.6, vx: dx * sp, vz: dz * sp, dmg: a.dmg, range, radius: a.size ?? 0.35, pierce: !!a.pierce, element: u.element, color: skinFx(u), slow: a.slow ?? 0, knockback: a.knockback ?? 0, critReady: crit });
  w.emit({ t: 'shoot', u: u.id, x: u.x, z: u.z, dx, dz, color: skinFx(u), kind: a.kind });
}

function angleDiffA(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Execute a skill or a super. */
export function doAbility(w: World, u: Unit, def: AbilityDef, isSuper: boolean) {
  const big = isSuper && u.special?.kind === 'superBig' ? 1 + u.special.value : 1;
  const dmgM = !isSuper && u.special?.kind === 'skillDmg' ? 1 + u.special.value : 1;
  const color = skinFx(u);
  const o = { element: u.element, isSuper, isAbility: true, color };
  switch (def.kind) {
    case 'dash': {
      const aim = resolveAim(w, u, def.dist * 1.2);
      u.dash = { dx: aim.dx, dz: aim.dz, left: def.dist, speed: 30, dmg: def.dmg * dmgM, hit: new Set(), chain: (def.count ?? 1) - 1, knock: isSuper ? 4 : 6 };
      u.facing = angleOf(aim.dx, aim.dz);
      w.emit({ t: 'dash', u: u.id, x: u.x, z: u.z, color });
      break;
    }
    case 'shield': {
      const targets = def.radius > 0 ? w.unitsNear(u.x, u.z, def.radius * big, (a) => a.team === u.team) : [u];
      for (const t of targets) {
        t.shield = Math.max(t.shield, def.amount * (t === u ? 1 : 0.8));
        t.shieldT = def.duration * big;
        w.emit({ t: 'shield', u: t.id, color });
      }
      if (u.hasPassive('shieldOnSkill')) u.shield += 500;
      if (def.radius > 0) w.emit({ t: 'ring', x: u.x, z: u.z, r: def.radius * big, color });
      break;
    }
    case 'gravityZone': {
      let x = u.x,
        z = u.z;
      if (def.range > 0) {
        const aim = resolveAim(w, u, def.range, false);
        const d = Math.min(def.range, Math.hypot(aim.tx - u.x, aim.tz - u.z));
        x = u.x + aim.dx * d;
        z = u.z + aim.dz * d;
      }
      w.addZone({ x, z, r: def.radius * big, gtype: def.gtype, team: u.team, owner: u, dur: def.duration * (isSuper ? Math.sqrt(big) : 1), dps: def.dps * dmgM, strength: def.strength });
      w.emit({ t: 'node', x, z, gtype: def.gtype, team: u.team, u: u.id });
      break;
    }
    case 'chain': {
      const pts: { x: number; z: number }[] = [{ x: u.x, z: u.z }];
      let cur: { x: number; z: number; team: number } = u;
      const hit = new Set<number>();
      let dmg = def.dmg * dmgM;
      let range = def.range;
      for (let i = 0; i <= def.jumps; i++) {
        const t = w.nearestEnemy({ x: cur.x, z: cur.z, team: u.team }, range, i === 0, (c) => (hit.has(c.id) ? 999 : 0));
        if (!t || hit.has(t.id)) break;
        hit.add(t.id);
        pts.push({ x: t.x, z: t.z });
        w.damage(u, t, dmg, { ...o, slow: 0.3, slowT: 1 });
        dmg *= 0.85;
        cur = { x: t.x, z: t.z, team: u.team };
        range = 6;
      }
      if (pts.length === 1) {
        const f = fromAngle(u.facing);
        pts.push({ x: u.x + f.x * 4, z: u.z + f.z * 4 });
      }
      w.emit({ t: 'chain', pts, color: '#7fe8ff' });
      break;
    }
    case 'storm': {
      const aim = resolveAim(w, u, def.range, false);
      const d = Math.min(def.range, Math.hypot(aim.tx - u.x, aim.tz - u.z));
      const cx = u.x + aim.dx * d,
        cz = u.z + aim.dz * d;
      const area = def.area * big;
      for (let i = 0; i < def.strikes * (isSuper ? big : 1); i++) {
        const a = w.rng.next() * Math.PI * 2,
          r = Math.sqrt(w.rng.next()) * area;
        w.addStrike({ x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r, r: def.radius, t: 0.35 + i * 0.18, dmg: def.dmg * dmgM, team: u.team, owner: u, kind: 'lightning', knock: 0, stun: 0.25 });
      }
      break;
    }
    case 'heal':
      w.addZone({ x: u.x, z: u.z, r: def.radius * big, gtype: 'heal', team: u.team, owner: u, dur: def.duration, dps: 0, strength: 0, heal: def.amount / def.duration, speed: def.speed });
      w.emit({ t: 'heal', x: u.x, z: u.z, r: def.radius * big });
      break;
    case 'ring': {
      const r = def.radius * big;
      for (const t of w.targetsNear(u.x, u.z, r, u.team)) {
        const n = norm(t.x - u.x || 0.01, t.z - u.z);
        w.damage(u, t, def.dmg * dmgM, { ...o, knock: def.knockback, knockX: n.x, knockZ: n.z, stun: def.stun });
      }
      w.damageCratesAround(u.x, u.z, r, def.dmg);
      w.emit({ t: 'ring', x: u.x, z: u.z, r, color });
      w.emit({ t: 'boom', x: u.x, z: u.z, r, color, big: isSuper });
      break;
    }
    case 'blink': {
      const fx = u.x,
        fz = u.z;
      if (def.strike) {
        const t = w.nearestEnemy(u, def.dist * big, false);
        if (t) {
          const n = norm(u.x - t.x, u.z - t.z);
          const sp = w.safeSpot(t.x + n.x * 1.2, t.z + n.z * 1.2);
          u.x = sp.x;
          u.z = sp.z;
          u.facing = angleOf(t.x - u.x, t.z - u.z);
          w.damage(u, t, def.dmg * dmgM, { ...o, stun: 0.5, knock: 4, knockX: -n.x, knockZ: -n.z });
          w.emit({ t: 'blink', u: u.id, fx, fz, x: u.x, z: u.z, color });
          w.emit({ t: 'boom', x: t.x, z: t.z, r: 1.8, color, big: true });
          break;
        }
      }
      const aim = resolveAim(w, u, def.dist);
      if (u.element === 'void' || u.def.id === 'prism') {
        // teleport: furthest walkable point along the aim
        let bx = u.x,
          bz = u.z;
        for (let s = 0.5; s <= def.dist; s += 0.5) {
          const x = u.x + aim.dx * s,
            z = u.z + aim.dz * s;
          const c = w.grid.at(x, z);
          if (w.grid.walkable(c)) {
            bx = x;
            bz = z;
          }
        }
        u.x = bx;
        u.z = bz;
        w.emit({ t: 'blink', u: u.id, fx, fz, x: u.x, z: u.z, color });
        if (def.dmg > 0) for (const t of w.targetsNear(u.x, u.z, 2, u.team)) w.damage(u, t, def.dmg * dmgM, o);
      } else {
        // leap: real gravity jump over walls and pits (goes further in low gravity!)
        const vy = 11;
        const air = (2 * vy) / w.g;
        const hs = def.dist / Math.max(0.5, air);
        u.vy = vy;
        u.vx = aim.dx * hs;
        u.vz = aim.dz * hs;
        u.leap = true;
        u.facing = angleOf(aim.dx, aim.dz);
        w.emit({ t: 'jump', u: u.id });
        if (def.dmg > 0) (u as any).landDmg = def.dmg * dmgM;
      }
      break;
    }
    case 'cone': {
      const aim = resolveAim(w, u, def.range * big, false);
      const range = def.range * big;
      for (const t of w.targetsNear(u.x, u.z, range, u.team)) {
        const a = Math.abs(angleDiffA(angleOf(aim.dx, aim.dz), angleOf(t.x - u.x, t.z - u.z)));
        if (a > def.angle / 2 + 0.15 && dist(u, t) > 1.3) continue;
        w.damage(u, t, def.dmg * dmgM, { ...o, slow: def.slow, slowT: 2, knock: def.knockback, knockX: aim.dx, knockZ: aim.dz });
      }
      u.facing = angleOf(aim.dx, aim.dz);
      w.emit({ t: 'cone', x: u.x, z: u.z, dx: aim.dx, dz: aim.dz, range, angle: def.angle, color });
      break;
    }
    case 'tornado': {
      const aim = resolveAim(w, u, def.range, false);
      const dur = def.range / def.speed;
      w.addZone({ x: u.x + aim.dx, z: u.z + aim.dz, r: def.radius * big, gtype: 'storm', team: u.team, owner: u, dur, dps: def.dmg * dmgM * 2.2, strength: 5, vx: aim.dx * def.speed, vz: aim.dz * def.speed });
      break;
    }
    case 'buff': {
      const targets = def.radius > 0 ? w.unitsNear(u.x, u.z, def.radius * big, (a) => a.team === u.team) : [u];
      for (const t of targets) {
        t.buffT = def.duration * big;
        t.buffSpeed = def.speed;
        t.buffDmg = def.dmgMult;
        t.rapid = !!def.rapid;
        if (def.rapid) t.ammo = t.def.attack.ammo;
        w.emit({ t: 'shield', u: t.id, color: '#ffd23a' });
      }
      if (def.radius > 0) w.emit({ t: 'ring', x: u.x, z: u.z, r: def.radius * big, color: '#ffd23a' });
      break;
    }
    case 'turret': {
      const f = fromAngle(u.facing);
      const sp = w.safeSpot(u.x + f.x * 1.6, u.z + f.z * 1.6);
      w.turrets.push({ kind: 'turret', id: w.id(), team: u.team, owner: u, x: sp.x, z: sp.z, hp: def.hp, maxHp: def.hp, dmg: def.dmg * dmgM * u.dmgMult, rate: def.rate, range: def.range, t: def.duration, cd: 0.3, alive: true, decoy: false, facing: u.facing, color });
      w.emit({ t: 'ring', x: sp.x, z: sp.z, r: 1.5, color });
      break;
    }
    case 'wall': {
      const aim = resolveAim(w, u, def.range, false);
      const cx = u.x + aim.dx * def.range,
        cz = u.z + aim.dz * def.range;
      const px = -aim.dz,
        pz = aim.dx;
      for (let i = 0; i < def.count; i++) {
        const k = i - (def.count - 1) / 2;
        w.placeCrate(cx + px * k * 2, cz + pz * k * 2, 1800);
      }
      break;
    }
    case 'radial': {
      const n = Math.round(def.count * big);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + w.time;
        w.spawnProjectile({ owner: u, team: u.team, x: u.x, z: u.z, vx: Math.sin(a) * def.speed, vz: Math.cos(a) * def.speed, dmg: def.dmg, range: def.range, radius: 0.4, pierce: true, element: u.element, color, isSuper, isAbility: true });
      }
      w.emit({ t: 'ring', x: u.x, z: u.z, r: 2, color });
      break;
    }
    case 'meteor': {
      const aim = resolveAim(w, u, def.range, false);
      const d = Math.min(def.range, Math.hypot(aim.tx - u.x, aim.tz - u.z));
      const tx = u.x + aim.dx * d,
        tz = u.z + aim.dz * d;
      w.spawnProjectile({ owner: u, team: u.team, x: u.x, z: u.z, vx: 0, vz: 0, dmg: def.dmg * dmgM, range: 999, element: u.element, color, isSuper, isAbility: true, knockback: 8, lob: { sx: u.x, sz: u.z, tx, tz, t: 0, T: 0.9, splash: def.radius * big, burn: def.burn, big: true } });
      w.emit({ t: 'warn', x: tx, z: tz, r: def.radius * big, dur: 0.9, color });
      break;
    }
    case 'line': {
      const aim = resolveAim(w, u, def.range * big, false);
      const range = def.range * big,
        width = def.width * Math.sqrt(big);
      for (const t of w.enemiesOf(u.team)) {
        const rx = t.x - u.x,
          rz = t.z - u.z;
        const along = rx * aim.dx + rz * aim.dz;
        const side = Math.abs(rx * -aim.dz + rz * aim.dx);
        if (along > -0.5 && along < range && side < width / 2 + 0.5) w.damage(u, t, def.dmg * dmgM, { ...o, stun: def.stun, slow: 0.5, slowT: 2.5 });
      }
      for (let s = 1; s < range; s += 2) w.damageCratesAround(u.x + aim.dx * s, u.z + aim.dz * s, 1, def.dmg);
      u.facing = angleOf(aim.dx, aim.dz);
      w.emit({ t: 'line', x: u.x, z: u.z, dx: aim.dx, dz: aim.dz, range, width, color });
      break;
    }
  }
}

function doGadget(w: World, u: Unit) {
  const g = u.gadget!;
  const color = u.def.palette.accent;
  switch (g.kind) {
    case 'heal':
      w.heal(u, g.value, u);
      w.emit({ t: 'heal', x: u.x, z: u.z, r: 1.5 });
      break;
    case 'speed':
      u.buffT = Math.max(u.buffT, 3);
      u.buffSpeed = Math.max(u.buffSpeed, g.value);
      w.emit({ t: 'dash', u: u.id, x: u.x, z: u.z, color });
      break;
    case 'shield':
      u.shield = Math.max(u.shield, g.value);
      u.shieldT = 4;
      w.emit({ t: 'shield', u: u.id, color });
      break;
    case 'push':
      for (const t of w.targetsNear(u.x, u.z, 4, u.team)) {
        const n = norm(t.x - u.x || 0.01, t.z - u.z);
        w.damage(u, t, 250, { element: u.element, isAbility: true, knock: g.value * 2.5, knockX: n.x, knockZ: n.z, color });
      }
      w.emit({ t: 'ring', x: u.x, z: u.z, r: 4, color });
      break;
    case 'blink': {
      const aim = resolveAim(w, u, g.value);
      const fx = u.x,
        fz = u.z;
      const sp = w.safeSpot(u.x + aim.dx * g.value, u.z + aim.dz * g.value);
      u.x = sp.x;
      u.z = sp.z;
      w.emit({ t: 'blink', u: u.id, fx, fz, x: u.x, z: u.z, color });
      break;
    }
    case 'gravityPulse':
      w.addZone({ x: u.x, z: u.z, r: 4.5, gtype: 'repulsion', team: u.team, owner: u, dur: 0.6, dps: 0, strength: g.value * 2 });
      w.emit({ t: 'node', x: u.x, z: u.z, gtype: 'repulsion', team: u.team, u: u.id });
      break;
    case 'reload':
      u.ammo = u.def.attack.ammo;
      w.emit({ t: 'shield', u: u.id, color: '#ffd23a' });
      break;
    case 'decoy':
      w.turrets.push({ kind: 'turret', id: w.id(), team: u.team, owner: u, x: u.x, z: u.z, hp: 1500, maxHp: 1500, dmg: 0, rate: 99, range: 0, t: 4, cd: 99, alive: true, decoy: true, facing: u.facing, color });
      u.buffT = Math.max(u.buffT, 2.5);
      u.buffSpeed = Math.max(u.buffSpeed, g.value);
      u.revealT = 0;
      w.emit({ t: 'blink', u: u.id, fx: u.x, fz: u.z, x: u.x, z: u.z, color });
      break;
  }
}

export { liftUnit };
