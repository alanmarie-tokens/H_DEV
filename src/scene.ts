// Scene data model.
//
// Every object (wall, slab, space) is an oriented box, packed in 32 bytes:
//   f32 cx, cy, cz   centre (metres, Z up)
//   f32 hx, hy, hz   half extents
//   f32 yaw          rotation around Z (radians)
//   u8  r, g, b, a   colour
// The same bytes are uploaded to the GPU untouched and drawn by instancing.

export const STRIDE_WORDS = 8;
export const STRIDE_BYTES = 32;

export const WALL = 0;
export const SLAB = 1;
export const SPACE = 2;
export const LAYER_COUNT = 3;
export const LAYER_NAMES = ['Mur', 'Dalle', 'Espace'];

/** Display name of each object kind, per layer. Kind 0 is the generic default. */
export const KIND_NAMES = [
  ['Mur', 'Mur extérieur', 'Cloison', 'Mur de noyau', 'Linteau', 'Allège'],
  ['Dalle', 'Dalle', 'Toiture', 'Marche', 'Palier'],
  ['Espace', 'Bureau', 'Salle de réunion', 'Espace ouvert', 'Sanitaires', 'Local technique',
    'Couloir', 'Escalier', 'Ascenseur'],
];

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
    yaw: number, color: number, kind = 0,
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
    this.u32[o] = color;
    this.count++;
  }
}

/** One object type, sorted so that each spatial chunk is a contiguous range. */
export interface LayerData {
  data: ArrayBuffer;
  /** Kind of each object, in the same order as `data`. */
  kinds: Uint8Array;
  count: number;
  chunkStart: Uint32Array;
  chunkCount: Uint32Array;
  /** minX, minY, minZ, maxX, maxY, maxZ per chunk */
  chunkBox: Float32Array;
}

export interface SceneData {
  layers: LayerData[];
  /** minX, minY, minZ, maxX, maxY, maxZ */
  bounds: Float32Array;
}

const TARGET_PER_CHUNK = 3000;
const MAX_CHUNKS_PER_LAYER = 2048;

/** Sorts each list into a uniform XY grid of chunks used for frustum culling. */
export function buildScene(lists: BoxList[]): SceneData {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let total = 0;
  for (const list of lists) {
    const f = list.f32;
    total += list.count;
    for (let i = 0, o = 0; i < list.count; i++, o += STRIDE_WORDS) {
      const c = Math.abs(Math.cos(f[o + 6])), s = Math.abs(Math.sin(f[o + 6]));
      const ex = c * f[o + 3] + s * f[o + 4];
      const ey = s * f[o + 3] + c * f[o + 4];
      const ez = f[o + 5];
      if (f[o] - ex < minX) minX = f[o] - ex;
      if (f[o] + ex > maxX) maxX = f[o] + ex;
      if (f[o + 1] - ey < minY) minY = f[o + 1] - ey;
      if (f[o + 1] + ey > maxY) maxY = f[o + 1] + ey;
      if (f[o + 2] - ez < minZ) minZ = f[o + 2] - ez;
      if (f[o + 2] + ez > maxZ) maxZ = f[o + 2] + ez;
    }
  }
  if (total === 0) {
    minX = minY = minZ = -1;
    maxX = maxY = maxZ = 1;
  }

  const wanted = Math.min(MAX_CHUNKS_PER_LAYER, Math.max(1, total / TARGET_PER_CHUNK));
  const side = Math.max(1, Math.ceil(Math.sqrt(wanted)));
  const cell = Math.max(maxX - minX, maxY - minY, 1e-3) / side;

  return {
    layers: lists.map((list) => buildLayer(list, minX, minY, cell, side)),
    bounds: new Float32Array([minX, minY, minZ, maxX, maxY, maxZ]),
  };
}

function buildLayer(list: BoxList, minX: number, minY: number, cell: number, side: number): LayerData {
  const n = list.count;
  const src = list.u32;
  const srcF = list.f32;
  const cells = side * side;
  const cellOf = new Uint32Array(n);
  const counts = new Uint32Array(cells);

  for (let i = 0, o = 0; i < n; i++, o += STRIDE_WORDS) {
    let ix = Math.floor((srcF[o] - minX) / cell);
    let iy = Math.floor((srcF[o + 1] - minY) / cell);
    ix = ix < 0 ? 0 : ix >= side ? side - 1 : ix;
    iy = iy < 0 ? 0 : iy >= side ? side - 1 : iy;
    const c = iy * side + ix;
    cellOf[i] = c;
    counts[c]++;
  }

  // Counting sort by cell.
  const starts = new Uint32Array(cells);
  let chunkTotal = 0;
  for (let c = 0, acc = 0; c < cells; c++) {
    starts[c] = acc;
    acc += counts[c];
    if (counts[c] > 0) chunkTotal++;
  }
  const cursor = starts.slice();
  const out = new ArrayBuffer(n * STRIDE_BYTES);
  const dst = new Uint32Array(out);
  const kinds = new Uint8Array(n);
  const boxes = new Float32Array(cells * 6);
  for (let c = 0; c < cells; c++) {
    boxes[c * 6] = boxes[c * 6 + 1] = boxes[c * 6 + 2] = Infinity;
    boxes[c * 6 + 3] = boxes[c * 6 + 4] = boxes[c * 6 + 5] = -Infinity;
  }

  for (let i = 0, o = 0; i < n; i++, o += STRIDE_WORDS) {
    const c = cellOf[i];
    const slot = cursor[c]++;
    kinds[slot] = list.kinds[i];
    let d = slot * STRIDE_WORDS;
    for (let k = 0; k < STRIDE_WORDS; k++) dst[d++] = src[o + k];

    const cs = Math.abs(Math.cos(srcF[o + 6])), sn = Math.abs(Math.sin(srcF[o + 6]));
    const ex = cs * srcF[o + 3] + sn * srcF[o + 4];
    const ey = sn * srcF[o + 3] + cs * srcF[o + 4];
    const ez = srcF[o + 5];
    const b = c * 6;
    if (srcF[o] - ex < boxes[b]) boxes[b] = srcF[o] - ex;
    if (srcF[o + 1] - ey < boxes[b + 1]) boxes[b + 1] = srcF[o + 1] - ey;
    if (srcF[o + 2] - ez < boxes[b + 2]) boxes[b + 2] = srcF[o + 2] - ez;
    if (srcF[o] + ex > boxes[b + 3]) boxes[b + 3] = srcF[o] + ex;
    if (srcF[o + 1] + ey > boxes[b + 4]) boxes[b + 4] = srcF[o + 1] + ey;
    if (srcF[o + 2] + ez > boxes[b + 5]) boxes[b + 5] = srcF[o + 2] + ez;
  }

  const chunkStart = new Uint32Array(chunkTotal);
  const chunkCount = new Uint32Array(chunkTotal);
  const chunkBox = new Float32Array(chunkTotal * 6);
  for (let c = 0, k = 0; c < cells; c++) {
    if (counts[c] === 0) continue;
    chunkStart[k] = starts[c];
    chunkCount[k] = counts[c];
    chunkBox.set(boxes.subarray(c * 6, c * 6 + 6), k * 6);
    k++;
  }
  return { data: out, kinds, count: n, chunkStart, chunkCount, chunkBox };
}

export function sceneTransferables(scene: SceneData): Transferable[] {
  const list: Transferable[] = [scene.bounds.buffer];
  for (const l of scene.layers) {
    list.push(l.data, l.kinds.buffer, l.chunkStart.buffer, l.chunkCount.buffer, l.chunkBox.buffer);
  }
  return list;
}
