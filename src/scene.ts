// Scene data model.
//
// Spatial structure: Site > Building > Storey > Room. Every object belongs to
// one storey; a room is a space object. Storeys are numbered so that the
// storeys of a building, and the buildings of a site, are contiguous: any
// site, building or storey is therefore a range of storey ids, and objects
// are sorted by storey id so it is also a contiguous range of objects.
//
// Every object (wall, slab, space) is an oriented box, packed in 36 bytes:
//   f32 cx, cy, cz   centre (metres, Z up)
//   f32 hx, hy, hz   half extents
//   f32 yaw          rotation around Z (radians)
//   u8  r, g, b, a   colour
//   u32 storey       storey id
// The same bytes are uploaded to the GPU untouched and drawn by instancing.

export const STRIDE_WORDS = 9;
export const STRIDE_BYTES = 36;
const STOREY_WORD = 8;

export const WALL = 0;
export const SLAB = 1;
export const SPACE = 2;
export const LAYER_COUNT = 3;
export const LAYER_NAMES = ['Mur', 'Dalle', 'Espace'];

/** Display name of each object kind, per layer. Kind 0 is the generic default. */
export const KIND_NAMES = [
  ['Mur', 'Mur extérieur', 'Cloison', 'Mur de noyau', 'Linteau', 'Allège'],
  ['Dalle', 'Dalle', 'Toiture', 'Marche', 'Palier', 'Terrain'],
  ['Pièce', 'Bureau', 'Salle de réunion', 'Espace ouvert', 'Sanitaires', 'Local technique',
    'Couloir', 'Escalier', 'Ascenseur'],
];

export const BUILDING = 0, GROUNDS = 1;
export const STOREY_FLOOR = 0, STOREY_ROOF = 1, STOREY_GROUNDS = 2;

export function rgba(r: number, g: number, b: number, a = 255): number {
  return (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
}

/** Growable list of packed boxes. */
export class BoxList {
  count = 0;
  f32: Float32Array;
  u32: Uint32Array;
  /** One kind per box (index into KIND_NAMES of its layer); not sent to the GPU. */
  kinds: Uint8Array;

  constructor(capacity = 4096) {
    const buffer = new ArrayBuffer(capacity * STRIDE_BYTES);
    this.f32 = new Float32Array(buffer);
    this.u32 = new Uint32Array(buffer);
    this.kinds = new Uint8Array(capacity);
  }

  push(
    cx: number, cy: number, cz: number,
    hx: number, hy: number, hz: number,
    yaw: number, color: number, kind = 0, storey = 0,
  ): void {
    let o = this.count * STRIDE_WORDS;
    if (o + STRIDE_WORDS > this.f32.length) {
      const buffer = new ArrayBuffer(this.f32.byteLength * 2);
      const f32 = new Float32Array(buffer);
      f32.set(this.f32);
      this.f32 = f32;
      this.u32 = new Uint32Array(buffer);
      const kinds = new Uint8Array(this.kinds.length * 2);
      kinds.set(this.kinds);
      this.kinds = kinds;
    }
    this.kinds[this.count] = kind;
    const f = this.f32;
    f[o++] = cx; f[o++] = cy; f[o++] = cz;
    f[o++] = hx; f[o++] = hy; f[o++] = hz;
    f[o++] = yaw;
    this.u32[o++] = color;
    this.u32[o] = storey;
    this.count++;
  }
}

// --- Spatial structure ----------------------------------------------------------

/** Sites, buildings and storeys, in final (contiguous) order. */
export interface Hierarchy {
  siteNames: string[];
  /** First building of each site; one extra entry at the end. */
  siteFirstBuilding: Uint32Array;
  buildingNames: string[];
  buildingSite: Uint32Array;
  /** BUILDING or GROUNDS (site-level objects such as the terrain). */
  buildingKind: Uint8Array;
  /** First storey of each building; one extra entry at the end. */
  buildingFirstStorey: Uint32Array;
  /** minX, minY, minZ, maxX, maxY, maxZ per building. */
  buildingBox: Float32Array;
  storeyNames: string[];
  storeyBuilding: Uint32Array;
  /** STOREY_FLOOR, STOREY_ROOF or STOREY_GROUNDS. */
  storeyKind: Uint8Array;
  storeyElevation: Float32Array;
  storeyHeight: Float32Array;
}

/** Collects sites, buildings and storeys in any order while a scene is being built. */
export class HierarchyBuilder {
  private siteNames: string[] = [];
  private buildingNames: string[] = [];
  private buildingSite: number[] = [];
  private buildingKind: number[] = [];
  private storeyNames: string[] = [];
  private storeyBuilding: number[] = [];
  private storeyKind: number[] = [];
  private storeyElevation: number[] = [];
  private storeyHeight: number[] = [];

  get siteCount(): number { return this.siteNames.length; }
  get buildingCount(): number { return this.buildingNames.length; }

  site(name: string): number {
    return this.siteNames.push(name) - 1;
  }

  building(site: number, name: string, kind = BUILDING): number {
    this.buildingSite.push(site);
    this.buildingKind.push(kind);
    return this.buildingNames.push(name) - 1;
  }

  /** Returns the provisional storey id to give to the objects of this storey. */
  storey(building: number, name: string, elevation: number, height: number, kind = STOREY_FLOOR): number {
    this.storeyBuilding.push(building);
    this.storeyKind.push(kind);
    this.storeyElevation.push(elevation);
    this.storeyHeight.push(height);
    return this.storeyNames.push(name) - 1;
  }

  /** Orders buildings by site and storeys by building. `remap` gives final storey ids. */
  finalize(): { hierarchy: Hierarchy; remap: Uint32Array } {
    if (this.storeyNames.length === 0) {
      const site = this.siteNames.length ? 0 : this.site('Site');
      const building = this.buildingNames.length ? 0 : this.building(site, 'Bâtiment');
      this.storey(building, 'Niveau 0', 0, 3);
    }
    const B = this.buildingNames.length, S = this.storeyNames.length;
    const buildingOrder = Array.from({ length: B }, (_, i) => i)
      .sort((a, b) => this.buildingSite[a] - this.buildingSite[b]);
    const buildingRank = new Uint32Array(B);
    buildingOrder.forEach((old, rank) => { buildingRank[old] = rank; });
    const storeyOrder = Array.from({ length: S }, (_, i) => i)
      .sort((a, b) => buildingRank[this.storeyBuilding[a]] - buildingRank[this.storeyBuilding[b]]);
    const remap = new Uint32Array(S);
    storeyOrder.forEach((old, rank) => { remap[old] = rank; });

    const siteFirstBuilding = new Uint32Array(this.siteNames.length + 1);
    for (const old of buildingOrder) siteFirstBuilding[this.buildingSite[old] + 1]++;
    for (let i = 0; i < this.siteNames.length; i++) siteFirstBuilding[i + 1] += siteFirstBuilding[i];
    const buildingFirstStorey = new Uint32Array(B + 1);
    for (const old of storeyOrder) buildingFirstStorey[buildingRank[this.storeyBuilding[old]] + 1]++;
    for (let i = 0; i < B; i++) buildingFirstStorey[i + 1] += buildingFirstStorey[i];

    const buildingBox = new Float32Array(B * 6);
    for (let b = 0; b < B; b++) {
      buildingBox.fill(Infinity, b * 6, b * 6 + 3);
      buildingBox.fill(-Infinity, b * 6 + 3, b * 6 + 6);
    }
    return {
      remap,
      hierarchy: {
        siteNames: this.siteNames,
        siteFirstBuilding,
        buildingNames: buildingOrder.map((i) => this.buildingNames[i]),
        buildingSite: Uint32Array.from(buildingOrder, (i) => this.buildingSite[i]),
        buildingKind: Uint8Array.from(buildingOrder, (i) => this.buildingKind[i]),
        buildingFirstStorey,
        buildingBox,
        storeyNames: storeyOrder.map((i) => this.storeyNames[i]),
        storeyBuilding: Uint32Array.from(storeyOrder, (i) => buildingRank[this.storeyBuilding[i]]),
        storeyKind: Uint8Array.from(storeyOrder, (i) => this.storeyKind[i]),
        storeyElevation: Float32Array.from(storeyOrder, (i) => this.storeyElevation[i]),
        storeyHeight: Float32Array.from(storeyOrder, (i) => this.storeyHeight[i]),
      },
    };
  }
}

/** What is displayed: everything, or one site, building or storey. */
export type Scope = { level: 'all' } | { level: 'site' | 'building' | 'storey'; index: number };

/** Storey ids covered by a scope: [first, end). */
export function scopeRange(h: Hierarchy, scope: Scope): [number, number] {
  switch (scope.level) {
    case 'all': return [0, 0xffffffff];
    case 'site': return [
      h.buildingFirstStorey[h.siteFirstBuilding[scope.index]],
      h.buildingFirstStorey[h.siteFirstBuilding[scope.index + 1]],
    ];
    case 'building': return [h.buildingFirstStorey[scope.index], h.buildingFirstStorey[scope.index + 1]];
    case 'storey': return [scope.index, scope.index + 1];
  }
}

/** The scope and its ancestors, outermost first (without the "all" level). */
export function scopePath(h: Hierarchy, scope: Scope): Scope[] {
  if (scope.level === 'all') return [];
  if (scope.level === 'site') return [scope];
  const building = scope.level === 'building' ? scope.index : h.storeyBuilding[scope.index];
  const path: Scope[] = [{ level: 'site', index: h.buildingSite[building] }, { level: 'building', index: building }];
  if (scope.level === 'storey') path.push(scope);
  return path;
}

export function scopeName(h: Hierarchy, scope: Scope): string {
  switch (scope.level) {
    case 'all': return 'Tous les sites';
    case 'site': return h.siteNames[scope.index];
    case 'building': return h.buildingNames[scope.index];
    case 'storey': return h.storeyNames[scope.index];
  }
}

/** Bounding box of a scope: minX, minY, minZ, maxX, maxY, maxZ. */
export function scopeBox(scene: SceneData, scope: Scope): Float32Array {
  const h = scene.hierarchy;
  const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  const add = (b: number) => {
    for (let k = 0; k < 3; k++) {
      box[k] = Math.min(box[k], h.buildingBox[b * 6 + k]);
      box[k + 3] = Math.max(box[k + 3], h.buildingBox[b * 6 + k + 3]);
    }
  };
  if (scope.level === 'site') {
    for (let b = h.siteFirstBuilding[scope.index]; b < h.siteFirstBuilding[scope.index + 1]; b++) add(b);
  } else if (scope.level === 'building') {
    add(scope.index);
  } else if (scope.level === 'storey') {
    add(h.storeyBuilding[scope.index]);
    if (h.storeyKind[scope.index] !== STOREY_GROUNDS) {
      box[2] = h.storeyElevation[scope.index];
      box[5] = box[2] + h.storeyHeight[scope.index];
    }
  }
  return box[0] <= box[3] ? box : scene.bounds.slice();
}

// --- Scene ------------------------------------------------------------------------

/** One object type, sorted by storey id. Each chunk is a contiguous range. */
export interface LayerData {
  data: ArrayBuffer;
  /** Kind of each object, in the same order as `data`. */
  kinds: Uint8Array;
  count: number;
  /** First object of each storey; one extra entry at the end. */
  storeyStart: Uint32Array;
  chunkStart: Uint32Array;
  chunkCount: Uint32Array;
  /** First and last storey id found in each chunk. */
  chunkLo: Uint32Array;
  chunkHi: Uint32Array;
  /** minX, minY, minZ, maxX, maxY, maxZ per chunk */
  chunkBox: Float32Array;
}

export interface SceneData {
  layers: LayerData[];
  /** minX, minY, minZ, maxX, maxY, maxZ */
  bounds: Float32Array;
  hierarchy: Hierarchy;
  /** Names given to rooms (space objects), by index in the space layer; null when none were given. */
  roomNames: (string | undefined)[] | null;
}

const CHUNK_TARGET = 3000;
/** A chunk only continues into the next building while it is smaller than this. */
const CHUNK_MIN = 1000;
/** Storeys larger than this are sorted spatially and split into several chunks. */
const BIG_STOREY = 6000;

function extentX(f: Float32Array, o: number): number {
  return Math.abs(Math.cos(f[o + 6])) * f[o + 3] + Math.abs(Math.sin(f[o + 6])) * f[o + 4];
}
function extentY(f: Float32Array, o: number): number {
  return Math.abs(Math.sin(f[o + 6])) * f[o + 3] + Math.abs(Math.cos(f[o + 6])) * f[o + 4];
}

/** Sorts each list by storey and cuts it into chunks used for culling. */
export function buildScene(lists: BoxList[], builder: HierarchyBuilder, spaceNames: (string | undefined)[] = []): SceneData {
  const { hierarchy, remap } = builder.finalize();
  const bounds = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  const bbox = hierarchy.buildingBox;
  let total = 0;
  for (const list of lists) {
    const f = list.f32;
    total += list.count;
    for (let i = 0, o = 0; i < list.count; i++, o += STRIDE_WORDS) {
      const ex = extentX(f, o), ey = extentY(f, o), ez = f[o + 5];
      const b = hierarchy.storeyBuilding[remap[list.u32[o + STOREY_WORD]] ?? 0] * 6;
      const lo = [f[o] - ex, f[o + 1] - ey, f[o + 2] - ez], hi = [f[o] + ex, f[o + 1] + ey, f[o + 2] + ez];
      for (let k = 0; k < 3; k++) {
        if (lo[k] < bounds[k]) bounds[k] = lo[k];
        if (hi[k] > bounds[k + 3]) bounds[k + 3] = hi[k];
        if (lo[k] < bbox[b + k]) bbox[b + k] = lo[k];
        if (hi[k] > bbox[b + k + 3]) bbox[b + k + 3] = hi[k];
      }
    }
  }
  if (total === 0) bounds.set([-1, -1, -1, 1, 1, 1]);

  let roomNames: (string | undefined)[] | null = null;
  const layers = lists.map((list, li) => {
    const { layer, order } = buildLayer(list, remap, hierarchy, bounds);
    if (li === SPACE && spaceNames.length > 0) roomNames = Array.from(order, (old) => spaceNames[old]);
    return layer;
  });
  return { layers, bounds, hierarchy, roomNames };
}

function spread(n: number): number {
  n &= 0x3ff;
  n = (n | (n << 8)) & 0x00ff00ff;
  n = (n | (n << 4)) & 0x0f0f0f0f;
  n = (n | (n << 2)) & 0x33333333;
  return (n | (n << 1)) & 0x55555555;
}

function buildLayer(list: BoxList, remap: Uint32Array, h: Hierarchy, bounds: Float32Array): { layer: LayerData; order: Uint32Array } {
  const n = list.count;
  const src = list.u32, srcF = list.f32;
  const S = h.storeyNames.length;

  // Counting sort by final storey id; `order` maps new index -> old index.
  const storeyOf = new Uint32Array(n);
  const storeyStart = new Uint32Array(S + 1);
  for (let i = 0; i < n; i++) {
    const s = remap[src[i * STRIDE_WORDS + STOREY_WORD]] ?? 0;
    storeyOf[i] = s;
    storeyStart[s + 1]++;
  }
  for (let s = 0; s < S; s++) storeyStart[s + 1] += storeyStart[s];
  const cursor = storeyStart.slice(0, S);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[cursor[storeyOf[i]]++] = i;

  // Very large storeys are ordered along a Z curve so their chunks stay compact.
  let keys: Uint32Array | null = null;
  for (let s = 0; s < S; s++) {
    if (storeyStart[s + 1] - storeyStart[s] <= BIG_STOREY) continue;
    if (!keys) {
      keys = new Uint32Array(n);
      const sx = 1023 / Math.max(bounds[3] - bounds[0], 1e-6), sy = 1023 / Math.max(bounds[4] - bounds[1], 1e-6);
      for (let i = 0, o = 0; i < n; i++, o += STRIDE_WORDS) {
        keys[i] = spread((srcF[o] - bounds[0]) * sx) | (spread((srcF[o + 1] - bounds[1]) * sy) << 1);
      }
    }
    const k = keys;
    order.subarray(storeyStart[s], storeyStart[s + 1]).sort((a, b) => k[a] - k[b]);
  }

  const out = new ArrayBuffer(n * STRIDE_BYTES);
  const dst = new Uint32Array(out), dstF = new Float32Array(out);
  const kinds = new Uint8Array(n);
  for (let i = 0, d = 0; i < n; i++) {
    const old = order[i];
    const o = old * STRIDE_WORDS;
    kinds[i] = list.kinds[old];
    for (let k = 0; k < STOREY_WORD; k++) dst[d++] = src[o + k];
    dst[d++] = storeyOf[old];
  }

  // Chunks: runs of consecutive storeys, cut at building boundaries when large enough.
  const starts: number[] = [], counts: number[] = [], los: number[] = [], his: number[] = [];
  let cStart = 0, cCount = 0, cLo = 0, cHi = 0;
  const close = () => {
    if (cCount > 0) { starts.push(cStart); counts.push(cCount); los.push(cLo); his.push(cHi); }
    cCount = 0;
  };
  for (let s = 0; s < S; s++) {
    const count = storeyStart[s + 1] - storeyStart[s];
    if (count === 0) continue;
    if (count > BIG_STOREY) {
      close();
      for (let p = storeyStart[s]; p < storeyStart[s + 1]; p += CHUNK_TARGET) {
        starts.push(p); counts.push(Math.min(CHUNK_TARGET, storeyStart[s + 1] - p)); los.push(s); his.push(s);
      }
      continue;
    }
    if (cCount > 0 && cCount >= CHUNK_MIN && h.storeyBuilding[s] !== h.storeyBuilding[cHi]) close();
    if (cCount === 0) { cStart = storeyStart[s]; cLo = s; }
    cCount += count;
    cHi = s;
    if (cCount >= CHUNK_TARGET) close();
  }
  close();

  const chunkBox = new Float32Array(starts.length * 6);
  for (let c = 0; c < starts.length; c++) {
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = starts[c], o = i * STRIDE_WORDS; i < starts[c] + counts[c]; i++, o += STRIDE_WORDS) {
      const ex = extentX(dstF, o), ey = extentY(dstF, o), ez = dstF[o + 5];
      if (dstF[o] - ex < minX) minX = dstF[o] - ex;
      if (dstF[o] + ex > maxX) maxX = dstF[o] + ex;
      if (dstF[o + 1] - ey < minY) minY = dstF[o + 1] - ey;
      if (dstF[o + 1] + ey > maxY) maxY = dstF[o + 1] + ey;
      if (dstF[o + 2] - ez < minZ) minZ = dstF[o + 2] - ez;
      if (dstF[o + 2] + ez > maxZ) maxZ = dstF[o + 2] + ez;
    }
    chunkBox.set([minX, minY, minZ, maxX, maxY, maxZ], c * 6);
  }

  return {
    order,
    layer: {
      data: out, kinds, count: n, storeyStart,
      chunkStart: Uint32Array.from(starts), chunkCount: Uint32Array.from(counts),
      chunkLo: Uint32Array.from(los), chunkHi: Uint32Array.from(his), chunkBox,
    },
  };
}

export function sceneTransferables(scene: SceneData): Transferable[] {
  const h = scene.hierarchy;
  const list: Transferable[] = [
    scene.bounds.buffer, h.siteFirstBuilding.buffer, h.buildingSite.buffer, h.buildingKind.buffer,
    h.buildingFirstStorey.buffer, h.buildingBox.buffer, h.storeyBuilding.buffer, h.storeyKind.buffer,
    h.storeyElevation.buffer, h.storeyHeight.buffer,
  ];
  for (const l of scene.layers) {
    list.push(l.data, l.kinds.buffer, l.storeyStart.buffer, l.chunkStart.buffer, l.chunkCount.buffer,
      l.chunkLo.buffer, l.chunkHi.buffer, l.chunkBox.buffer);
  }
  return list;
}
