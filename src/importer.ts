// JSON import. Plan coordinates are [x, y] in metres, elevations along Z.
//
// {
//   "walls":  [{ "start": [x,y], "end": [x,y], "elevation": 0, "height": 3, "thickness": 0.2, "color": "#rrggbb" }],
//   "slabs":  [{ "min": [x,y], "max": [x,y], "elevation": 0, "thickness": 0.25, "rotation": 0, "color": "#rrggbb" }],
//   "spaces": [{ "min": [x,y], "max": [x,y], "elevation": 0, "height": 2.7,  "rotation": 0, "color": "#rrggbb" }]
// }
// "rotation" is in degrees around the centre of the rectangle.

import { BoxList, rgba } from './scene';

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function point(v: unknown, what: string): [number, number] {
  if (!Array.isArray(v) || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
    throw new Error(`${what} : point [x, y] attendu`);
  }
  return [v[0], v[1]];
}

function color(v: unknown, fallback: number, alpha: number): number {
  if (typeof v !== 'string') return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgba(n >> 16, (n >> 8) & 255, n & 255, alpha);
}

function array(v: unknown, name: string): Record<string, unknown>[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`"${name}" doit être un tableau`);
  return v as Record<string, unknown>[];
}

export function importJson(text: string): BoxList[] {
  const root = JSON.parse(text) as Record<string, unknown>;
  const walls = new BoxList();
  const slabs = new BoxList();
  const spaces = new BoxList();

  array(root.walls, 'walls').forEach((w, i) => {
    const [ax, ay] = point(w.start, `walls[${i}].start`);
    const [bx, by] = point(w.end, `walls[${i}].end`);
    const h = num(w.height, 3);
    const z = num(w.elevation, 0);
    const len = Math.hypot(bx - ax, by - ay);
    walls.push((ax + bx) / 2, (ay + by) / 2, z + h / 2,
      len / 2, num(w.thickness, 0.2) / 2, h / 2,
      Math.atan2(by - ay, bx - ax), color(w.color, rgba(214, 208, 198), 255));
  });

  const rect = (list: BoxList, items: Record<string, unknown>[], name: string,
    heightKey: string, defHeight: number, defColor: number, alpha: number) => {
    items.forEach((s, i) => {
      const [x0, y0] = point(s.min, `${name}[${i}].min`);
      const [x1, y1] = point(s.max, `${name}[${i}].max`);
      const h = num(s[heightKey], defHeight);
      const z = num(s.elevation, 0);
      list.push((x0 + x1) / 2, (y0 + y1) / 2, z + h / 2,
        Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, h / 2,
        (num(s.rotation, 0) * Math.PI) / 180, color(s.color, defColor, alpha));
    });
  };
  rect(slabs, array(root.slabs, 'slabs'), 'slabs', 'thickness', 0.25, rgba(112, 118, 130), 255);
  rect(spaces, array(root.spaces, 'spaces'), 'spaces', 'height', 2.7, rgba(79, 157, 255, 80), 80);

  if (walls.count + slabs.count + spaces.count === 0) {
    throw new Error('Aucun objet trouvé (clés attendues : walls, slabs, spaces)');
  }
  return [walls, slabs, spaces];
}
