// Structure tree: sites > buildings > storeys > rooms.
// Nodes are created lazily when their parent is opened, so the tree stays
// cheap whatever the number of storeys and rooms.

import { GROUNDS, SPACE, STRIDE_WORDS, scopePath, type SceneData, type Scope } from './scene';

const MAX_ROOMS_LISTED = 400;
const fmt = (n: number) => n.toLocaleString('fr-FR');

interface Node {
  line: HTMLElement;
  children: HTMLElement;
  caret: HTMLElement | null;
  load: (() => HTMLElement[]) | null;
}

export class Navigator {
  private scene: SceneData | null = null;
  private nodes = new Map<string, Node>();
  private active: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private onScope: (scope: Scope) => void,
    private onRoom: (spaceIndex: number) => void,
    private roomLabel: (spaceIndex: number) => string,
  ) {}

  setScene(scene: SceneData): void {
    this.scene = scene;
    this.nodes.clear();
    this.active = null;
    const h = scene.hierarchy;
    this.root.replaceChildren(...h.siteNames.map((_, i) => this.site(i)));
    // A single site is opened straight away.
    if (h.siteNames.length === 1) this.toggle('site:0', true);
  }

  /** Highlights a scope, opening its ancestors so that it is visible. */
  setActive(scope: Scope): void {
    this.active?.classList.remove('active');
    this.active = null;
    if (!this.scene || scope.level === 'all') return;
    const path = scopePath(this.scene.hierarchy, scope);
    for (const ancestor of path.slice(0, -1)) this.toggle(key(ancestor), true);
    const node = this.nodes.get(key(scope));
    if (!node) return;
    node.line.classList.add('active');
    this.active = node.line;
    node.line.scrollIntoView({ block: 'nearest' });
  }

  private toggle(id: string, open?: boolean): void {
    const node = this.nodes.get(id);
    if (!node || !node.caret) return;
    const show = open ?? node.children.hidden;
    if (show && node.load) {
      node.children.replaceChildren(...node.load());
      node.load = null;
    }
    node.children.hidden = !show;
    node.caret.textContent = show ? '▾' : '▸';
  }

  private node(id: string | null, label: string, meta: string, onClick: () => void, load: (() => HTMLElement[]) | null): HTMLElement {
    const el = document.createElement('div');
    el.className = 'node';
    const line = document.createElement('div');
    line.className = 'line';
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = load ? '▸' : '';
    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'n';
    count.textContent = meta;
    line.append(caret, name, count);
    const children = document.createElement('div');
    children.className = 'children';
    children.hidden = true;
    el.append(line, children);
    if (id) {
      this.nodes.set(id, { line, children, caret: load ? caret : null, load });
      caret.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(id); });
    }
    line.addEventListener('click', onClick);
    return el;
  }

  private site(i: number): HTMLElement {
    const h = this.scene!.hierarchy;
    const first = h.siteFirstBuilding[i], end = h.siteFirstBuilding[i + 1];
    let buildings = 0;
    for (let b = first; b < end; b++) if (h.buildingKind[b] !== GROUNDS) buildings++;
    return this.node(`site:${i}`, h.siteNames[i], `${fmt(buildings)} bât.`,
      () => this.onScope({ level: 'site', index: i }),
      () => Array.from({ length: end - first }, (_, k) => this.building(first + k)));
  }

  private building(b: number): HTMLElement {
    const h = this.scene!.hierarchy;
    const select = () => this.onScope({ level: 'building', index: b });
    if (h.buildingKind[b] === GROUNDS) return this.node(`building:${b}`, h.buildingNames[b], '', select, null);
    const first = h.buildingFirstStorey[b], end = h.buildingFirstStorey[b + 1];
    // Storeys are listed like a section: roof first, ground floor last.
    return this.node(`building:${b}`, h.buildingNames[b], `${fmt(end - first)} niv.`, select,
      () => Array.from({ length: end - first }, (_, k) => this.storey(end - 1 - k)));
  }

  private storey(s: number): HTMLElement {
    const scene = this.scene!;
    const spaces = scene.layers[SPACE];
    const first = spaces.storeyStart[s], end = spaces.storeyStart[s + 1];
    const select = () => this.onScope({ level: 'storey', index: s });
    const name = scene.hierarchy.storeyNames[s];
    if (end === first) return this.node(`storey:${s}`, name, '', select, null);
    return this.node(`storey:${s}`, name, `${fmt(end - first)} p.`, select, () => {
      const f = new Float32Array(spaces.data);
      const rows: HTMLElement[] = [];
      for (let i = first; i < end && i < first + MAX_ROOMS_LISTED; i++) {
        const o = i * STRIDE_WORDS;
        rows.push(this.node(null, this.roomLabel(i), (f[o + 3] * f[o + 4] * 4).toFixed(1) + ' m²', () => this.onRoom(i), null));
      }
      if (end - first > MAX_ROOMS_LISTED) {
        rows.push(this.node(null, `… ${fmt(end - first - MAX_ROOMS_LISTED)} autres pièces`, '', select, null));
      }
      return rows;
    });
  }
}

function key(scope: Scope): string {
  return scope.level === 'all' ? 'all' : `${scope.level}:${scope.index}`;
}
