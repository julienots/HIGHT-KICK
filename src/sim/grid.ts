import { CELL, fullGrid, GRID_H, GRID_W, type ArenaDef } from '../data/arenas';

export enum C {
  Floor = 0,
  Wall = 1,
  Crate = 2,
  Pit = 3,
  Bridge = 4,
  Pad = 5,
  Portal = 6,
  Node = 7,
  Hazard = 8,
  Slow = 9,
  Bush = 10,
  Base0 = 11,
  Base1 = 12,
  Core = 13,
  Track = 14,
  Spawn = 15,
}

const CHAR: Record<string, C> = {
  '.': C.Floor, '#': C.Wall, x: C.Crate, _: C.Pit, '=': C.Bridge, '^': C.Pad, o: C.Portal, G: C.Node,
  h: C.Hazard, '~': C.Slow, '*': C.Bush, C: C.Core, m: C.Track, E: C.Spawn,
};

export interface CellPos {
  c: number;
  r: number;
}

/** Arena grid: rows top (red base, team 1) → bottom (blue base, team 0). */
export class Grid {
  w = GRID_W;
  h = GRID_H;
  cell = CELL;
  cells: Uint8Array;
  /** original crate layout (for regrowing crystals) */
  origCrate: Uint8Array;
  crateHp: Float32Array;
  halfW: number;
  halfH: number;
  constructor(public arena: ArenaDef) {
    this.cells = new Uint8Array(this.w * this.h);
    this.origCrate = new Uint8Array(this.w * this.h);
    this.crateHp = new Float32Array(this.w * this.h);
    this.halfW = (this.w * CELL) / 2;
    this.halfH = (this.h * CELL) / 2;
    const rows = fullGrid(arena);
    for (let r = 0; r < this.h; r++) {
      const row = rows[r];
      for (let c = 0; c < this.w; c++) {
        const ch = row[c] ?? '.';
        let t = CHAR[ch] ?? C.Floor;
        if (ch === 'B') t = r < this.h / 2 ? C.Base1 : C.Base0;
        this.cells[r * this.w + c] = t;
        if (t === C.Crate) {
          this.origCrate[r * this.w + c] = 1;
          this.crateHp[r * this.w + c] = 1600;
        }
      }
    }
  }
  idx(c: number, r: number) {
    return r * this.w + c;
  }
  inBounds(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.w && r < this.h;
  }
  get(c: number, r: number): C {
    if (!this.inBounds(c, r)) return C.Wall;
    return this.cells[r * this.w + c];
  }
  set(c: number, r: number, t: C) {
    if (this.inBounds(c, r)) this.cells[r * this.w + c] = t;
  }
  toCell(x: number, z: number): CellPos {
    return { c: Math.floor((x + this.halfW) / CELL), r: Math.floor((z + this.halfH) / CELL) };
  }
  at(x: number, z: number): C {
    const p = this.toCell(x, z);
    return this.get(p.c, p.r);
  }
  center(c: number, r: number) {
    return { x: (c + 0.5) * CELL - this.halfW, z: (r + 0.5) * CELL - this.halfH };
  }
  isSolid(t: C) {
    return t === C.Wall || t === C.Crate;
  }
  solidAt(x: number, z: number) {
    return this.isSolid(this.at(x, z));
  }
  isPit(t: C) {
    return t === C.Pit || t === C.Track;
  }
  walkable(t: C) {
    return !this.isSolid(t) && !this.isPit(t);
  }
  find(t: C): CellPos[] {
    const out: CellPos[] = [];
    for (let r = 0; r < this.h; r++) for (let c = 0; c < this.w; c++) if (this.cells[r * this.w + c] === t) out.push({ c, r });
    return out;
  }

  /** Line of sight check (walls & crates block). */
  los(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax,
      dz = bz - az;
    const d = Math.hypot(dx, dz);
    const steps = Math.ceil(d / 0.5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  /** A* pathfinding on walkable cells (8-neighbour). Returns world waypoints. */
  path(sx: number, sz: number, tx: number, tz: number, avoidHazard = true): { x: number; z: number }[] {
    const s = this.toCell(sx, sz),
      t = this.toCell(tx, tz);
    if (!this.inBounds(t.c, t.r)) return [];
    const W = this.w,
      N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const f = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open: number[] = [];
    const si = this.idx(Math.max(0, Math.min(W - 1, s.c)), Math.max(0, Math.min(this.h - 1, s.r)));
    let ti = this.idx(t.c, t.r);
    if (!this.walkable(this.cells[ti])) {
      // target not walkable: pick nearest walkable neighbour
      let best = -1,
        bd = 1e9;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const c = t.c + dc,
            r = t.r + dr;
          if (this.inBounds(c, r) && this.walkable(this.get(c, r))) {
            const dd = dc * dc + dr * dr;
            if (dd < bd) {
              bd = dd;
              best = this.idx(c, r);
            }
          }
        }
      if (best < 0) return [];
      ti = best;
    }
    const tc = ti % W,
      tr = Math.floor(ti / W);
    const hfn = (i: number) => Math.hypot((i % W) - tc, Math.floor(i / W) - tr);
    g[si] = 0;
    f[si] = hfn(si);
    open.push(si);
    let iter = 0;
    while (open.length && iter++ < 2000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === ti) break;
      closed[cur] = 1;
      const cc = cur % W,
        cr = Math.floor(cur / W);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc,
            nr = cr + dr;
          if (!this.inBounds(nc, nr)) continue;
          const ni = this.idx(nc, nr);
          if (closed[ni]) continue;
          const ct = this.cells[ni];
          if (!this.walkable(ct)) continue;
          if (dr && dc && (!this.walkable(this.get(cc + dc, cr)) || !this.walkable(this.get(cc, cr + dr)))) continue; // no corner cutting
          let cost = dr && dc ? 1.414 : 1;
          if (avoidHazard && ct === C.Hazard) cost += 6;
          if (ct === C.Slow) cost += 0.6;
          const ng = g[cur] + cost;
          if (ng < g[ni]) {
            g[ni] = ng;
            f[ni] = ng + hfn(ni);
            from[ni] = cur;
            if (!open.includes(ni)) open.push(ni);
          }
        }
    }
    if (from[ti] < 0 && ti !== si) return [];
    const out: { x: number; z: number }[] = [];
    let k = ti;
    while (k !== si && k >= 0) {
      out.push(this.center(k % W, Math.floor(k / W)));
      k = from[k];
    }
    out.reverse();
    return out;
  }
}
