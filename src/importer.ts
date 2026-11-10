// JSON import. Plan coordinates are [x, y] in metres, elevations along Z.
//
// Structured form — sites, buildings, storeys, then the objects of each storey:
// {
//   "sites": [{
//     "name": "Campus",
//     "buildings": [{
//       "name": "Bâtiment A",
//       "storeys": [{
//         "name": "RDC", "elevation": 0, "height": 3,
//         "walls":  [{ "start": [x,y], "end": [x,y], "elevation": 0.25, "height": 2.75, "thickness": 0.2, "color": "#rrggbb" }],
//         "slabs":  [{ "min": [x,y], "max": [x,y], "elevation": 0, "thickness": 0.25, "rotation": 0 }],
//         "spaces": [{ "name": "Accueil", "min": [x,y], "max": [x,y], "elevation": 0.25, "height": 2.6 }]
//       }]
//     }]
//   }]
// }
// Inside a storey, object elevations are relative to the storey elevation.
// "rotation" is in degrees around the centre of the rectangle.
//
// Shorter forms are accepted: "buildings" or "storeys" at the root, or
// "walls" / "slabs" / "spaces" at the root (one site, one building, one storey).

import { BoxList, HierarchyBuilder, rgba } from './scene';

type Json = Record<string, unknown>;

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function text(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
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

function array(v: unknown, name: string): Json[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`"${name}" doit être un tableau`);
  return v as Json[];
}

export interface Imported {
  lists: BoxList[];
  hierarchy: HierarchyBuilder;
  /** Names of the spaces, by insertion index. */
  spaceNames: (string | undefined)[];
}

export function importJson(source: string): Imported {
  const root = JSON.parse(source) as Json;
  const walls = new BoxList(), slabs = new BoxList(), spaces = new BoxList();
  const hierarchy = new HierarchyBuilder();
  const spaceNames: (string | undefined)[] = [];

  const storey = (data: Json, building: number, index: number, where: string) => {
    const base = num(data.elevation, 0);
    const id = hierarchy.storey(building, text(data.name, index === 0 ? 'RDC' : `R+${index}`), base, num(data.height, 3));

    array(data.walls, 'walls').forEach((w, i) => {
      const [ax, ay] = point(w.start, `${where}walls[${i}].start`);
      const [bx, by] = point(w.end, `${where}walls[${i}].end`);
      const h = num(w.height, 3);
      walls.push((ax + bx) / 2, (ay + by) / 2, base + num(w.elevation, 0) + h / 2,
        Math.hypot(bx - ax, by - ay) / 2, num(w.thickness, 0.2) / 2, h / 2,
        Math.atan2(by - ay, bx - ax), color(w.color, rgba(214, 208, 198), 255), 0, id);
    });

    const rect = (list: BoxList, name: string, heightKey: string, defHeight: number, defColor: number, alpha: number) => {
      array(data[name], name).forEach((s, i) => {
        const [x0, y0] = point(s.min, `${where}${name}[${i}].min`);
        const [x1, y1] = point(s.max, `${where}${name}[${i}].max`);
        const h = num(s[heightKey], defHeight);
        if (list === spaces && typeof s.name === 'string') spaceNames[spaces.count] = s.name;
        list.push((x0 + x1) / 2, (y0 + y1) / 2, base + num(s.elevation, 0) + h / 2,
          Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, h / 2,
          (num(s.rotation, 0) * Math.PI) / 180, color(s.color, defColor, alpha), 0, id);
      });
    };
    rect(slabs, 'slabs', 'thickness', 0.25, rgba(112, 118, 130), 255);
    rect(spaces, 'spaces', 'height', 2.7, rgba(79, 157, 255, 80), 80);
  };

  const building = (data: Json, site: number, index: number, where: string) => {
    const id = hierarchy.building(site, text(data.name, `Bâtiment ${index + 1}`));
    array(data.storeys, 'storeys').forEach((s, i) => storey(s, id, i, `${where}storeys[${i}].`));
  };

  if (root.sites !== undefined) {
    array(root.sites, 'sites').forEach((s, i) => {
      const id = hierarchy.site(text(s.name, `Site ${i + 1}`));
      array(s.buildings, 'buildings').forEach((b, j) => building(b, id, j, `sites[${i}].buildings[${j}].`));
    });
  } else if (root.buildings !== undefined) {
    const id = hierarchy.site(text(root.name, 'Site'));
    array(root.buildings, 'buildings').forEach((b, j) => building(b, id, j, `buildings[${j}].`));
  } else if (root.storeys !== undefined) {
    building(root, hierarchy.site('Site'), 0, '');
  } else {
    storey(root, hierarchy.building(hierarchy.site('Site'), 'Bâtiment'), 0, '');
  }

  if (walls.count + slabs.count + spaces.count === 0) {
    throw new Error('Aucun objet trouvé (clés attendues : sites, buildings, storeys, walls, slabs, spaces)');
  }
  return { lists: [walls, slabs, spaces], hierarchy, spaceNames };
}
