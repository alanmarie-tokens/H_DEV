// Procedural city used as a stress test.
//
// Each building has a floor plan made of rectangular cells that tile its
// footprint: rooms, corridors, stairs, lift shafts. Everything else is derived
// from the cells and their shared edges:
//   - one wall per shared edge (none between two corridor cells),
//   - exterior walls with windows on the edges no other cell touches,
//   - doors chosen so every cell is reachable from a corridor,
//   - one floor slab per cell, left open in stairwells and lift shafts.
// Cores (stairs, lifts) stay in place on every floor; the room partitioning
// changes every few floors.

import { BoxList, rgba } from './scene';

const SLAB = 0.25;
const PITCH = 90;
const EPS = 1e-3;

// Kinds: indices into KIND_NAMES (scene.ts).
const W_EXTERIOR = 1, W_PARTITION = 2, W_CORE = 3, W_LINTEL = 4, W_SILL = 5;
const F_SLAB = 1, F_ROOF = 2, F_STEP = 3, F_LANDING = 4;
const S_OFFICE = 1, S_MEETING = 2, S_OPEN = 3, S_WC = 4, S_TECH = 5, S_CORRIDOR = 6, S_STAIR = 7, S_LIFT = 8;

const SPACE_COLORS = [
  0,
  rgba(79, 157, 255, 80),
  rgba(120, 220, 150, 80),
  rgba(180, 140, 255, 80),
  rgba(90, 220, 220, 80),
  rgba(170, 150, 120, 80),
  rgba(240, 225, 150, 70),
  rgba(255, 120, 80, 90),
  rgba(240, 90, 170, 90),
];
const PARTITION_COLOR = rgba(236, 232, 224);
const CORE_COLOR = rgba(150, 152, 158);
const SLAB_COLOR = rgba(112, 118, 130);
const ROOF_COLOR = rgba(70, 76, 88);
const STAIR_COLOR = rgba(176, 180, 188);

// When an item is emitted, depending on the floor.
const ALWAYS = 0, GROUND_ONLY = 1, NOT_TOP = 2, NOT_GROUND = 3;

const STAIR_W = 2.8, LIFT_W = 2.1, LIFT_D = 2.4, WC_W = 3;

interface Cell { x0: number; y0: number; x1: number; y1: number; kind: number }

/** Boxes of one floor in building-local coordinates, 10 numbers per box. */
interface Template { walls: number[]; slabs: number[]; spaces: number[] }

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Floor plans --------------------------------------------------------------

/** Splits a strip into rooms of varied widths along X or Y. */
function rooms(cells: Cell[], x0: number, y0: number, x1: number, y1: number, alongX: boolean, rnd: () => number): void {
  const end = alongX ? x1 : y1;
  let p = alongX ? x0 : y0;
  if (end - p < 0.5) return;
  while (end - p > EPS) {
    const r = rnd();
    let w = r < 0.6 ? 2.8 + rnd() * 0.9 : r < 0.85 ? 4.4 + rnd() * 1.6 : 7 + rnd() * 3;
    if (end - p - w < 2.6) w = end - p;
    const q = w === end - p ? end : p + w;
    const kind = w < 2 ? S_TECH : w < 4 ? S_OFFICE : w < 6.6 ? S_MEETING : S_OPEN;
    cells.push(alongX ? { x0: p, y0, x1: q, y1, kind } : { x0, y0: p, x1, y1: q, kind });
    p = q;
  }
}

function coreWidth(lifts: number, twoStairs: boolean): number {
  return STAIR_W + lifts * LIFT_W + WC_W + (twoStairs ? STAIR_W : 0);
}

/** Stair, lifts (opening on the y0 side, with a service shaft behind), toilets. */
function core(cells: Cell[], x0: number, y0: number, depth: number, lifts: number, twoStairs: boolean): void {
  const y1 = y0 + depth;
  let x = x0;
  cells.push({ x0: x, y0, x1: x + STAIR_W, y1, kind: S_STAIR });
  x += STAIR_W;
  const liftDepth = depth - LIFT_D >= 1.4 ? LIFT_D : depth;
  const liftsStart = x;
  for (let i = 0; i < lifts; i++, x += LIFT_W) {
    cells.push({ x0: x, y0, x1: x + LIFT_W, y1: y0 + liftDepth, kind: S_LIFT });
  }
  if (liftDepth < depth) cells.push({ x0: liftsStart, y0: y0 + liftDepth, x1: x, y1, kind: S_TECH });
  cells.push({ x0: x, y0, x1: x + WC_W, y1, kind: S_WC });
  x += WC_W;
  if (twoStairs) cells.push({ x0: x, y0, x1: x + STAIR_W, y1, kind: S_STAIR });
}

interface Params {
  type: 'bar' | 'L' | 'tower';
  lifts: number;
  twoStairs: boolean;
  /** Bar and L: wing length, room depths on both sides, corridor width. */
  length: number; south: number; north: number; corridor: number;
  /** Position of the core along the wing. */
  coreX: number;
  /** L only: length of the second wing. */
  wing: number;
  /** Tower only: depth of the perimeter rooms and of the core. */
  ring: number; coreDepth: number;
}

function snapCore(from: number, to: number, width: number, t: number): number {
  const free = to - from - width;
  let x = from + free * t;
  if (x - from < 3) x = from;
  if (to - (x + width) < 3) x = to - width;
  return x;
}

function plan(p: Params, rnd: () => number): Cell[] {
  const cells: Cell[] = [];
  const cw = p.corridor;
  const width = coreWidth(p.lifts, p.twoStairs);

  if (p.type === 'tower') {
    const pd = p.ring;
    const W = width + 2 * cw + 2 * pd, D = p.coreDepth + 2 * cw + 2 * pd;
    core(cells, pd + cw, pd + cw, p.coreDepth, p.lifts, p.twoStairs);
    // Ring corridor around the core.
    cells.push({ x0: pd, y0: pd, x1: W - pd, y1: pd + cw, kind: S_CORRIDOR });
    cells.push({ x0: pd, y0: D - pd - cw, x1: W - pd, y1: D - pd, kind: S_CORRIDOR });
    cells.push({ x0: pd, y0: pd + cw, x1: pd + cw, y1: D - pd - cw, kind: S_CORRIDOR });
    cells.push({ x0: W - pd - cw, y0: pd + cw, x1: W - pd, y1: D - pd - cw, kind: S_CORRIDOR });
    // Rooms along the four facades.
    rooms(cells, 0, 0, W, pd, true, rnd);
    rooms(cells, 0, D - pd, W, D, true, rnd);
    rooms(cells, 0, pd, pd, D - pd, false, rnd);
    rooms(cells, W - pd, pd, W, D - pd, false, rnd);
    return cells;
  }

  // Double-loaded corridor: rooms on both sides of a central corridor.
  const L = p.length;
  const yc0 = p.south, yc1 = p.south + cw, D = yc1 + p.north;
  cells.push({ x0: 0, y0: yc0, x1: L, y1: yc1, kind: S_CORRIDOR });

  if (p.type === 'bar') {
    if (p.twoStairs) {
      // Long wings get a second escape stair at the far end.
      rooms(cells, 0, 0, L - STAIR_W, yc0, true, rnd);
      cells.push({ x0: L - STAIR_W, y0: 0, x1: L, y1: yc0, kind: S_STAIR });
    } else {
      rooms(cells, 0, 0, L, yc0, true, rnd);
    }
    const w = coreWidth(p.lifts, false);
    rooms(cells, 0, yc1, p.coreX, D, true, rnd);
    core(cells, p.coreX, yc1, p.north, p.lifts, false);
    rooms(cells, p.coreX + w, yc1, L, D, true, rnd);
    return cells;
  }

  // L shape: a second wing leaves from the west end, its corridor meeting the first.
  const xb0 = p.south, xb1 = p.south + cw, top = D + p.wing;
  const w = coreWidth(p.lifts, false);
  rooms(cells, 0, 0, L, yc0, true, rnd);
  rooms(cells, 0, yc1, xb0, D, true, rnd);
  cells.push({ x0: xb0, y0: yc1, x1: xb1, y1: top, kind: S_CORRIDOR });
  rooms(cells, xb1, yc1, p.coreX, D, true, rnd);
  core(cells, p.coreX, yc1, p.north, p.lifts, false);
  rooms(cells, p.coreX + w, yc1, L, D, true, rnd);
  rooms(cells, 0, D, xb0, top, false, rnd);
  rooms(cells, xb1, D, D, top - STAIR_W, false, rnd);
  cells.push({ x0: xb1, y0: top - STAIR_W, x1: D, y1: top, kind: S_STAIR });
  return cells;
}

/** Rectangles covering the footprint, for the roof. */
function footprint(p: Params): number[][] {
  if (p.type === 'tower') {
    const w = coreWidth(p.lifts, p.twoStairs);
    return [[0, 0, w + 2 * p.corridor + 2 * p.ring, p.coreDepth + 2 * p.corridor + 2 * p.ring]];
  }
  const D = p.south + p.corridor + p.north;
  const rects = [[0, 0, p.length, D]];
  if (p.type === 'L') rects.push([0, D, D, D + p.wing]);
  return rects;
}

// --- From cells to boxes --------------------------------------------------------

interface Shared { i: number; j: number; vertical: boolean; c: number; a: number; b: number }

function buildTemplate(cells: Cell[], floorHeight: number, exteriorColor: number): Template {
  const t: Template = { walls: [], slabs: [], spaces: [] };
  const H = floorHeight - SLAB;
  const n = cells.length;

  // Shared edges, and for each cell side (W, E, S, N) the intervals they cover.
  const shared: Shared[] = [];
  const covered: number[][] = [];
  for (let k = 0; k < n * 4; k++) covered.push([]);
  for (let i = 0; i < n; i++) {
    const A = cells[i];
    for (let j = i + 1; j < n; j++) {
      const B = cells[j];
      const east = Math.abs(A.x1 - B.x0) < EPS, west = Math.abs(B.x1 - A.x0) < EPS;
      if (east || west) {
        const a = Math.max(A.y0, B.y0), b = Math.min(A.y1, B.y1);
        if (b - a > 0.05) {
          shared.push({ i, j, vertical: true, c: east ? A.x1 : A.x0, a, b });
          covered[i * 4 + (east ? 1 : 0)].push(a, b);
          covered[j * 4 + (east ? 0 : 1)].push(a, b);
        }
      }
      const north = Math.abs(A.y1 - B.y0) < EPS, south = Math.abs(B.y1 - A.y0) < EPS;
      if (north || south) {
        const a = Math.max(A.x0, B.x0), b = Math.min(A.x1, B.x1);
        if (b - a > 0.05) {
          shared.push({ i, j, vertical: false, c: north ? A.y1 : A.y0, a, b });
          covered[i * 4 + (north ? 3 : 2)].push(a, b);
          covered[j * 4 + (north ? 2 : 3)].push(a, b);
        }
      }
    }
  }

  // Doors: every cell must be reachable from a corridor. Cells touching a
  // corridor open onto it; the others open onto an already reachable neighbour.
  const reachable = cells.map((c) => c.kind === S_CORRIDOR);
  const door = new Uint8Array(shared.length);
  const connect = (corridorOnly: boolean): boolean => {
    let changed = false;
    for (let k = 0; k < n; k++) {
      if (reachable[k]) continue;
      let best = -1;
      for (let s = 0; s < shared.length; s++) {
        const e = shared[s];
        const other = e.i === k ? e.j : e.j === k ? e.i : -1;
        if (other < 0 || !reachable[other] || e.b - e.a < 1.15) continue;
        const kind = cells[other].kind;
        if (corridorOnly ? kind !== S_CORRIDOR : kind === S_STAIR || kind === S_LIFT) continue;
        if (best < 0 || e.b - e.a > shared[best].b - shared[best].a) best = s;
      }
      if (best >= 0) { door[best] = 1; reachable[k] = true; changed = true; }
    }
    return changed;
  };
  connect(true);
  while (connect(false)) { /* until nothing new is reachable */ }

  // A wall along one edge, optionally with an opening (door or window).
  const wall = (
    vertical: boolean, c: number, a: number, b: number, thickness: number, kind: number, color: number,
    o0 = 0, o1 = 0, sill = 0, head = 0, sillWhen = ALWAYS,
  ) => {
    const piece = (p: number, q: number, z0: number, z1: number, k: number, when: number) => {
      if (q - p < 0.02 || z1 - z0 < 0.02) return;
      const mid = (p + q) / 2;
      t.walls.push(vertical ? c : mid, vertical ? mid : c, SLAB + (z0 + z1) / 2,
        (q - p) / 2, thickness / 2, (z1 - z0) / 2, vertical ? Math.PI / 2 : 0, color, k, when);
    };
    if (o1 <= o0) { piece(a, b, 0, H, kind, ALWAYS); return; }
    piece(a, o0, 0, H, kind, ALWAYS);
    piece(o1, b, 0, H, kind, ALWAYS);
    piece(o0, o1, head, H, W_LINTEL, ALWAYS);
    piece(o0, o1, 0, sill, W_SILL, sillWhen);
  };

  // Interior walls.
  for (let s = 0; s < shared.length; s++) {
    const e = shared[s];
    const ka = cells[e.i].kind, kb = cells[e.j].kind;
    if (ka === S_CORRIDOR && kb === S_CORRIDOR) continue;
    const isCore = ka === S_STAIR || kb === S_STAIR || ka === S_LIFT || kb === S_LIFT;
    const thickness = isCore ? 0.2 : 0.1, kind = isCore ? W_CORE : W_PARTITION, color = isCore ? CORE_COLOR : PARTITION_COLOR;
    if (!door[s]) { wall(e.vertical, e.c, e.a, e.b, thickness, kind, color); continue; }
    const lift = ka === S_LIFT || kb === S_LIFT;
    const dw = lift ? 1.1 : 0.9, len = e.b - e.a;
    const o0 = lift || len < dw + 0.7 ? e.a + (len - dw) / 2 : e.a + 0.35;
    wall(e.vertical, e.c, e.a, e.b, thickness, kind, color, o0, o0 + dw, 0, 2.1);
  }

  // Exterior walls: what remains of each cell side once shared edges are removed.
  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    for (let side = 0; side < 4; side++) {
      const vertical = side < 2;
      const c = side === 0 ? cell.x0 : side === 1 ? cell.x1 : side === 2 ? cell.y0 : cell.y1;
      const end = vertical ? cell.y1 : cell.x1;
      const spans: [number, number][] = [];
      const cov = covered[i * 4 + side];
      for (let k = 0; k < cov.length; k += 2) spans.push([cov[k], cov[k + 1]]);
      spans.sort((u, v) => u[0] - v[0]);
      spans.push([end, end]);
      let p = vertical ? cell.y0 : cell.x0;
      for (const [u, v] of spans) {
        if (u - p > 0.05) {
          // Piers run 0.15 m past the ends so facade corners close.
          const a = p - 0.15, b = u + 0.15, len = u - p;
          const corridor = cell.kind === S_CORRIDOR;
          const margin = corridor ? 0.3 : 0.5;
          const glazed = cell.kind !== S_LIFT && cell.kind !== S_TECH && len >= 2 * margin + 0.8;
          // Corridor ends are windows upstairs and entrances at ground level.
          if (glazed) wall(vertical, c, a, b, 0.3, W_EXTERIOR, exteriorColor, p + margin, u - margin, 0.9, 2.3, corridor ? NOT_GROUND : ALWAYS);
          else wall(vertical, c, a, b, 0.3, W_EXTERIOR, exteriorColor);
        }
        if (v > p) p = v;
      }
    }
  }

  // Slabs, spaces and stairs.
  for (const cell of cells) {
    const cx = (cell.x0 + cell.x1) / 2, cy = (cell.y0 + cell.y1) / 2;
    const hx = (cell.x1 - cell.x0) / 2, hy = (cell.y1 - cell.y0) / 2;
    const shaft = cell.kind === S_STAIR || cell.kind === S_LIFT;
    t.slabs.push(cx, cy, SLAB / 2, hx + 0.15, hy + 0.15, SLAB / 2, 0, SLAB_COLOR, F_SLAB, shaft ? GROUND_ONLY : ALWAYS);
    const sh = H - 0.1;
    t.spaces.push(cx, cy, SLAB + sh / 2, Math.max(0.1, hx - 0.16), Math.max(0.1, hy - 0.16), sh / 2, 0,
      SPACE_COLORS[cell.kind], cell.kind, ALWAYS);
    if (cell.kind === S_STAIR) stair(t.slabs, cell, floorHeight);
  }
  return t;
}

/** Dog-leg stair: two flights side by side, a landing at each end. */
function stair(out: number[], cell: Cell, floorHeight: number): void {
  const x0 = cell.x0 + 0.2, x1 = cell.x1 - 0.2, y0 = cell.y0 + 0.2, y1 = cell.y1 - 0.2;
  const alongX = x1 - x0 >= y1 - y0;
  const near = alongX ? x0 : y0, far = alongX ? x1 : y1;
  const mid = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2;
  const width = alongX ? y1 - y0 : x1 - x0;
  const landing = Math.min(1.3, (far - near) * 0.24);
  const risers = Math.max(4, Math.round(floorHeight / 2 / 0.18));
  const rise = floorHeight / (2 * risers);
  const tread = (far - near - 2 * landing) / (risers - 1);
  const box = (along: number, across: number, halfAlong: number, halfAcross: number, top: number, thick: number, kind: number, when: number) => {
    out.push(alongX ? along : across, alongX ? across : along, top - thick / 2,
      alongX ? halfAlong : halfAcross, alongX ? halfAcross : halfAlong, thick / 2, 0, STAIR_COLOR, kind, when);
  };
  box(near + landing / 2, mid, landing / 2, width / 2, SLAB, SLAB, F_LANDING, NOT_GROUND);
  box(far - landing / 2, mid, landing / 2, width / 2, SLAB + risers * rise, 0.2, F_LANDING, NOT_TOP);
  const flight = width / 2 - 0.05;
  for (let i = 0; i < risers - 1; i++) {
    box(near + landing + (i + 0.5) * tread, mid - width / 4, tread / 2, flight / 2, SLAB + (i + 1) * rise, rise, F_STEP, NOT_TOP);
    box(far - landing - (i + 0.5) * tread, mid + width / 4, tread / 2, flight / 2, SLAB + (risers + i + 1) * rise, rise, F_STEP, NOT_TOP);
  }
}

// --- City ---------------------------------------------------------------------

function randomParams(floors: number, rnd: () => number): Params {
  const pick = rnd();
  const type = floors > 14 ? (pick < 0.8 ? 'tower' : 'bar') : pick < 0.45 ? 'bar' : pick < 0.75 ? 'L' : 'tower';
  const lifts = floors < 5 ? 1 : floors < 12 ? 2 : floors < 25 ? 3 : 4;
  const p: Params = {
    type, lifts, twoStairs: false,
    length: 0, south: 4.8 + rnd() * 2.2, north: 4.8 + rnd() * 2.2, corridor: 1.6 + rnd() * 0.6,
    coreX: 0, wing: 0, ring: 5 + rnd() * 2.5, coreDepth: 5.2 + rnd(),
  };
  if (type === 'tower') {
    p.twoStairs = floors > 12;
  } else if (type === 'bar') {
    p.length = 24 + rnd() * 40;
    p.twoStairs = p.length > 38;
    p.coreX = snapCore(0, p.length, coreWidth(lifts, false), rnd() * (p.twoStairs ? 0.5 : 1));
  } else {
    p.length = 28 + rnd() * 22;
    p.wing = 14 + rnd() * 16;
    p.coreX = snapCore(p.south + p.corridor, p.length, coreWidth(lifts, false), rnd());
  }
  return p;
}

/** Returns [walls, slabs, spaces] holding at least `target` objects in total. */
export function generate(target: number, seed = 1): BoxList[] {
  const lists = [new BoxList(), new BoxList(), new BoxList()];
  const rnd = mulberry32(seed);
  const total = () => lists[0].count + lists[1].count + lists[2].count;

  // Square spiral over grid cells, so any object count stays centred.
  let gx = 0, gy = 0, dx = 0, dy = -1;
  while (total() < target) {
    const bx = gx * PITCH + (rnd() - 0.5) * 16;
    const by = gy * PITCH + (rnd() - 0.5) * 16;
    if (gx === gy || (gx < 0 && gx === -gy) || (gx > 0 && gx === 1 - gy)) {
      const t = dx; dx = -dy; dy = t;
    }
    gx += dx; gy += dy;

    const r = rnd();
    const floors = 2 + Math.floor(r * r * 38);
    const floorHeight = 2.9 + rnd() * 0.6;
    const params = randomParams(floors, rnd);
    const yaw = rnd() < 0.7 ? Math.floor(rnd() * 2) * Math.PI * 0.5 : rnd() * Math.PI;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const tone = 196 + Math.floor(rnd() * 44);
    const exterior = rgba(tone, tone - 6, tone - 16);

    // The plan is centred on the building origin.
    const rects = footprint(params);
    let maxX = 0, maxY = 0;
    for (const f of rects) { maxX = Math.max(maxX, f[2]); maxY = Math.max(maxY, f[3]); }
    const ox = maxX / 2, oy = maxY / 2;

    // A few partition layouts, alternating every `group` floors around the same cores.
    const variantSeed = Math.floor(rnd() * 0x7fffffff);
    const variants: Template[] = [];
    const variantCount = 1 + Math.floor(rnd() * 3);
    for (let v = 0; v < variantCount; v++) {
      variants.push(buildTemplate(plan(params, mulberry32(variantSeed + v)), floorHeight, exterior));
    }
    const group = 1 + Math.floor(rnd() * 4);

    const emit = (list: BoxList, items: number[], z: number, f: number, last: boolean) => {
      for (let o = 0; o < items.length; o += 10) {
        const when = items[o + 9];
        if ((when === GROUND_ONLY && f > 0) || (when === NOT_GROUND && f === 0) || (when === NOT_TOP && last)) continue;
        const lx = items[o] - ox, ly = items[o + 1] - oy;
        list.push(bx + c * lx - s * ly, by + s * lx + c * ly, z + items[o + 2],
          items[o + 3], items[o + 4], items[o + 5], yaw + items[o + 6], items[o + 7], items[o + 8]);
      }
    };

    let f = 0;
    for (; f < floors; f++) {
      const t = variants[Math.floor(f / group) % variantCount];
      // The floor is the last one if the object budget runs out here.
      const last = f === floors - 1 || total() + (t.walls.length + t.slabs.length + t.spaces.length) / 10 >= target;
      const z = f * floorHeight;
      emit(lists[0], t.walls, z, f, last);
      emit(lists[1], t.slabs, z, f, last);
      emit(lists[2], t.spaces, z, f, last);
      if (last) { f++; break; }
    }
    for (const rect of rects) {
      const lx = (rect[0] + rect[2]) / 2 - ox, ly = (rect[1] + rect[3]) / 2 - oy;
      lists[1].push(bx + c * lx - s * ly, by + s * lx + c * ly, f * floorHeight + SLAB / 2,
        (rect[2] - rect[0]) / 2 + 0.3, (rect[3] - rect[1]) / 2 + 0.3, SLAB / 2, yaw, ROOF_COLOR, F_ROOF);
    }
  }
  return lists;
}
