// Procedural city used as a stress test: buildings made of slabs, walls and
// spaces, laid out on a square spiral so any object count stays centred.

import { BoxList, rgba } from './scene';

const FLOOR_HEIGHT = 3;
const SLAB_THICKNESS = 0.25;
const WALL_HEIGHT = FLOOR_HEIGHT - SLAB_THICKNESS;
const PITCH = 90;

const SPACE_COLORS = [
  rgba(79, 157, 255, 80),
  rgba(255, 179, 71, 80),
  rgba(120, 220, 150, 80),
  rgba(240, 110, 130, 80),
  rgba(180, 140, 255, 80),
  rgba(90, 220, 220, 80),
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns [walls, slabs, spaces] holding at least `target` objects in total. */
export function generate(target: number, seed = 1): BoxList[] {
  const walls = new BoxList();
  const slabs = new BoxList();
  const spaces = new BoxList();
  const rnd = mulberry32(seed);
  let total = 0;

  // Square spiral over grid cells.
  let gx = 0, gy = 0, dx = 0, dy = -1;
  while (total < target) {
    const bx = gx * PITCH + (rnd() - 0.5) * 16;
    const by = gy * PITCH + (rnd() - 0.5) * 16;
    if (gx === gy || (gx < 0 && gx === -gy) || (gx > 0 && gx === 1 - gy)) {
      const t = dx; dx = -dy; dy = t;
    }
    gx += dx; gy += dy;

    const nx = 3 + Math.floor(rnd() * 7);
    const ny = 2 + Math.floor(rnd() * 4);
    const rw = 4 + rnd() * 2;
    const rd = 4 + rnd() * 2;
    const W = nx * rw, D = ny * rd;
    const r = rnd();
    const floors = 2 + Math.floor(r * r * 38);
    const yaw = rnd() < 0.7 ? Math.floor(rnd() * 2) * Math.PI * 0.5 : rnd() * Math.PI;
    const c = Math.cos(yaw), s = Math.sin(yaw);

    const tone = 196 + Math.floor(rnd() * 44);
    const exterior = rgba(tone, tone - 6, tone - 16);
    const interior = rgba(236, 232, 224);
    const slabColor = rgba(112, 118, 130);

    for (let f = 0; f < floors && total < target; f++) {
      const z0 = f * FLOOR_HEIGHT;
      slabs.push(bx, by, z0 + SLAB_THICKNESS / 2, W / 2 + 0.15, D / 2 + 0.15, SLAB_THICKNESS / 2, yaw, slabColor);

      const wz = z0 + SLAB_THICKNESS + WALL_HEIGHT / 2;
      // Walls running along local X.
      for (let j = 0; j <= ny; j++) {
        const edge = j === 0 || j === ny;
        const ly = j * rd - D / 2;
        for (let i = 0; i < nx; i++) {
          const lx = (i + 0.5) * rw - W / 2;
          walls.push(bx + c * lx - s * ly, by + s * lx + c * ly, wz,
            rw / 2, edge ? 0.15 : 0.06, WALL_HEIGHT / 2, yaw, edge ? exterior : interior);
        }
      }
      // Walls running along local Y.
      for (let i = 0; i <= nx; i++) {
        const edge = i === 0 || i === nx;
        const lx = i * rw - W / 2;
        for (let j = 0; j < ny; j++) {
          const ly = (j + 0.5) * rd - D / 2;
          walls.push(bx + c * lx - s * ly, by + s * lx + c * ly, wz,
            rd / 2, edge ? 0.15 : 0.06, WALL_HEIGHT / 2, yaw + Math.PI / 2, edge ? exterior : interior);
        }
      }
      // One space per room, slightly inset from the walls.
      const sh = WALL_HEIGHT - 0.1;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const lx = (i + 0.5) * rw - W / 2;
          const ly = (j + 0.5) * rd - D / 2;
          spaces.push(bx + c * lx - s * ly, by + s * lx + c * ly, z0 + SLAB_THICKNESS + sh / 2,
            rw / 2 - 0.2, rd / 2 - 0.2, sh / 2, yaw, SPACE_COLORS[Math.floor(rnd() * SPACE_COLORS.length)]);
        }
      }
      total += 1 + nx * (ny + 1) + ny * (nx + 1) + nx * ny;
    }
  }
  return [walls, slabs, spaces];
}
