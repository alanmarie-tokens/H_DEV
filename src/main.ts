import './style.css';
import { attachControls } from './controls';
import { Renderer } from './renderer';
import { Navigator } from './navigator';
import {
  GROUNDS, KIND_NAMES, LAYER_COUNT, LAYER_NAMES, SPACE, STOREY_FLOOR, STRIDE_WORDS, WALL,
  scopeBox, scopeName, scopePath, scopeRange, type SceneData, type Scope,
} from './scene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

const COUNT_STEPS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 4_000_000];

const canvas = $<HTMLCanvasElement>('view');
const statusEl = $('status');
let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (err) {
  statusEl.textContent = err instanceof Error ? err.message : String(err);
  throw err;
}

let scene: SceneData | null = null;
let layerFloats: Float32Array[] = [];
let layerWords: Uint32Array[] = [];
let scope: Scope = { level: 'all' };
let autoRotate = false;

// --- Render on demand: a frame is drawn only when something changed. ---------
let scheduled = false;
let lastFrame = 0;
let fps = 0;
let lastStatsUpdate = 0;
let statsTimer = 0;

function invalidate(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

function frame(now: number): void {
  scheduled = false;
  const dt = now - lastFrame;
  lastFrame = now;
  // FPS is only meaningful across consecutive frames.
  if (dt > 0 && dt < 250) fps = fps === 0 ? 1000 / dt : fps * 0.9 + (1000 / dt) * 0.1;
  else fps = 0;

  if (controls.update(dt)) invalidate();
  if (autoRotate) {
    renderer.camera.azimuth += Math.min(dt, 100) * 0.0002;
    invalidate();
  }
  renderer.render();

  // Throttle DOM writes while animating, but always show the final frame.
  clearTimeout(statsTimer);
  if (now - lastStatsUpdate > 200) updateStats(now);
  else statsTimer = window.setTimeout(() => updateStats(performance.now()), 220);
}

function updateStats(now: number): void {
  lastStatsUpdate = now;
  const s = renderer.stats;
  $('s-fps').textContent = fps > 0 ? fps.toFixed(0) : '—';
  $('s-cpu').textContent = s.cpuMs.toFixed(2) + ' ms';
  $('s-drawn').textContent = fmt(s.instances);
  $('s-tris').textContent = fmt(s.instances * 12);
  $('s-calls').textContent = fmt(s.drawCalls);
  $('s-chunks').textContent = `${fmt(s.chunksVisible)} / ${fmt(s.chunksTotal)}`;
}

// --- Scene loading through the worker ---------------------------------------
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let requestId = 0;

worker.onmessage = (e: MessageEvent<{ id: number; scene?: SceneData; ms?: number; error?: string }>) => {
  if (e.data.id !== requestId) return; // superseded by a newer request
  $<HTMLButtonElement>('generate').disabled = false;
  if (e.data.error || !e.data.scene) {
    statusEl.textContent = 'Erreur : ' + (e.data.error ?? 'inconnue');
    return;
  }
  scene = e.data.scene;
  layerFloats = scene.layers.map((l) => new Float32Array(l.data));
  layerWords = scene.layers.map((l) => new Uint32Array(l.data));
  const t0 = performance.now();
  renderer.setScene(scene);
  const upload = performance.now() - t0;

  const total = scene.layers.reduce((sum, l) => sum + l.count, 0);
  $('s-total').textContent = fmt(total);
  for (let i = 0; i < LAYER_COUNT; i++) $('n-' + i).textContent = fmt(scene.layers[i].count);
  statusEl.textContent = `Préparation ${fmt(e.data.ms ?? 0)} ms · envoi GPU ${fmt(upload)} ms`;
  showSelection(-1);
  nav.setScene(scene);
  setScope({ level: 'all' });
};

function load(message: { kind: 'generate'; count: number; seed: number } | { kind: 'import'; text: string }): void {
  statusEl.textContent = 'Préparation de la scène…';
  $<HTMLButtonElement>('generate').disabled = true;
  worker.postMessage({ id: ++requestId, ...message });
}

// --- Spatial structure: site > building > storey > room ----------------------
const STOREY_WORD = STRIDE_WORDS - 1;

function row(label: string, value: string, onClick?: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  const key = document.createElement('span');
  key.textContent = label;
  const val = document.createElement(onClick ? 'a' : 'b');
  val.textContent = value;
  if (onClick) val.addEventListener('click', onClick);
  el.append(key, val);
  return el;
}

/** Name of a room: the imported one, or its use and number (storey.rank). */
function roomLabel(index: number): string {
  if (!scene) return '';
  const given = scene.roomNames?.[index];
  if (given) return given;
  const h = scene.hierarchy, spaces = scene.layers[SPACE];
  const storey = layerWords[SPACE][index * STRIDE_WORDS + STOREY_WORD];
  const level = storey - h.buildingFirstStorey[h.storeyBuilding[storey]];
  const rank = index - spaces.storeyStart[storey] + 1;
  return `${KIND_NAMES[SPACE][spaces.kinds[index]] ?? 'Pièce'} ${level}.${String(rank).padStart(2, '0')}`;
}

/** Displays only a site, a building or a storey, and frames it. */
function setScope(next: Scope, frame = true): void {
  if (!scene) return;
  scope = next;
  const h = scene.hierarchy;
  const [first, end] = scopeRange(h, scope);
  renderer.scope[0] = first;
  renderer.scope[1] = end;
  if (frame) renderer.camera.fit(scopeBox(scene, scope));

  // Breadcrumb.
  const crumbs: Scope[] = [{ level: 'all' }, ...scopePath(h, scope)];
  $('crumbs').replaceChildren(...crumbs.flatMap((c, i) => {
    const link = document.createElement(i === crumbs.length - 1 ? 'b' : 'a');
    link.textContent = scopeName(h, c);
    if (i < crumbs.length - 1) link.addEventListener('click', () => setScope(c));
    return i === 0 ? [link] : [document.createTextNode(' › '), link];
  }));

  // Contents of the scope. Storey ranges give object ranges directly.
  const last = Math.min(end, h.storeyNames.length);
  let buildings = 0, storeys = 0;
  for (let st = first; st < last; st++) if (h.storeyKind[st] === STOREY_FLOOR) storeys++;
  for (let b = 0; b < h.buildingNames.length; b++) {
    if (h.buildingKind[b] !== GROUNDS && h.buildingFirstStorey[b] >= first && h.buildingFirstStorey[b] < last) buildings++;
  }
  const spaces = scene.layers[SPACE], f = layerFloats[SPACE];
  const r0 = spaces.storeyStart[first], r1 = spaces.storeyStart[last];
  let area = 0;
  for (let i = r0, o = r0 * STRIDE_WORDS; i < r1; i++, o += STRIDE_WORDS) area += f[o + 3] * f[o + 4] * 4;
  const objects = scene.layers.reduce((sum, l) => sum + l.storeyStart[last] - l.storeyStart[first], 0);
  const rows: HTMLElement[] = [];
  if (scope.level === 'all') rows.push(row('Sites', fmt(h.siteNames.length)));
  if (scope.level === 'all' || scope.level === 'site') rows.push(row('Bâtiments', fmt(buildings)));
  if (scope.level !== 'storey') rows.push(row('Étages', fmt(storeys)));
  else rows.push(row('Altitude', h.storeyElevation[scope.index].toFixed(2) + ' m'));
  rows.push(row('Pièces', fmt(r1 - r0)), row('Surface des pièces', fmt(area) + ' m²'), row('Objets', fmt(objects)));
  $('scope-stats').replaceChildren(...rows);

  $('storey-nav').hidden = scope.level !== 'storey';
  $<HTMLButtonElement>('show-all').disabled = scope.level === 'all';
  nav.setActive(scope);

  // A selected object that is no longer displayed is deselected.
  if (renderer.selected >= 0) {
    const { layer, index } = locate(renderer.selected);
    const storey = layerWords[layer][index * STRIDE_WORDS + STOREY_WORD];
    if (storey < first || storey >= end) showSelection(-1);
  }
  invalidate();
}

/** Moves to the storey above or below, within the same building. */
function stepStorey(delta: number): void {
  if (!scene || scope.level !== 'storey') return;
  const h = scene.hierarchy, b = h.storeyBuilding[scope.index];
  const next = scope.index + delta;
  if (next >= h.buildingFirstStorey[b] && next < h.buildingFirstStorey[b + 1]) setScope({ level: 'storey', index: next });
}

// --- Selection ---------------------------------------------------------------
function locate(id: number): { layer: number; index: number } {
  let layer = 0;
  while (layer < LAYER_COUNT - 1 && id >= renderer.layerBase[layer + 1]) layer++;
  return { layer, index: id - renderer.layerBase[layer] };
}

function showSelection(id: number): void {
  renderer.selected = id;
  const el = $('selection');
  if (id < 0 || !scene) {
    el.textContent = 'Cliquez sur un objet pour l’inspecter.';
    return;
  }
  const { layer, index } = locate(id);
  const f = layerFloats[layer];
  const o = index * STRIDE_WORDS;
  const m = (v: number) => v.toFixed(2) + ' m';
  const h = scene.hierarchy;
  const storey = layerWords[layer][o + STOREY_WORD];
  const building = h.storeyBuilding[storey];
  const site = h.buildingSite[building];

  const rows: HTMLElement[] = [];
  if (layer === SPACE) rows.push(row('Pièce', roomLabel(index)));
  rows.push(
    row('Type', KIND_NAMES[layer][scene.layers[layer].kinds[index]] ?? LAYER_NAMES[layer]),
    row('Site', h.siteNames[site], () => setScope({ level: 'site', index: site })),
    row('Bâtiment', h.buildingNames[building], () => setScope({ level: 'building', index: building })),
    row('Étage', h.storeyNames[storey], () => setScope({ level: 'storey', index: storey })),
  );
  if (layer === WALL) {
    rows.push(row('Longueur', m(f[o + 3] * 2)), row('Épaisseur', m(f[o + 4] * 2)), row('Hauteur', m(f[o + 5] * 2)));
  } else {
    rows.push(row('Dimensions', `${(f[o + 3] * 2).toFixed(2)} × ${(f[o + 4] * 2).toFixed(2)} m`),
      row(layer === SPACE ? 'Hauteur' : 'Épaisseur', m(f[o + 5] * 2)),
      row('Surface', (f[o + 3] * f[o + 4] * 4).toFixed(1) + ' m²'));
  }
  rows.push(row('Niveau bas', m(f[o + 2] - f[o + 5])));
  el.replaceChildren(...rows);
}

const nav = new Navigator($('tree-body'), (next) => setScope(next), (spaceIndex) => {
  // A room picked in the tree: show its storey and select it.
  const storey = layerWords[SPACE][spaceIndex * STRIDE_WORDS + STOREY_WORD];
  if (scope.level !== 'storey' || scope.index !== storey) setScope({ level: 'storey', index: storey });
  showSelection(renderer.layerBase[SPACE] + spaceIndex);
  invalidate();
}, roomLabel);

// --- UI wiring ---------------------------------------------------------------
const maxDistance = () => {
  const b = renderer.bounds;
  return Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) * 3 + 50;
};

const controls = attachControls(canvas, renderer.camera, maxDistance, invalidate, (x, y) => {
  showSelection(renderer.pick(x, y));
  invalidate();
});

new ResizeObserver(invalidate).observe(canvas);

const SPEED_STEPS = [2, 5, 10, 30, 60, 120, 250, 500];
const flyBox = $<HTMLInputElement>('fly');
const speedSlider = $<HTMLInputElement>('speed');
speedSlider.max = String(SPEED_STEPS.length - 1);
speedSlider.value = String(SPEED_STEPS.indexOf(controls.speed));
const applySpeed = () => {
  controls.speed = SPEED_STEPS[Number(speedSlider.value)];
  $('speed-label').textContent = controls.speed + ' m/s';
};
speedSlider.addEventListener('input', applySpeed);
applySpeed();
flyBox.addEventListener('change', () => { controls.fly = flyBox.checked; });
// Hand the keyboard back to navigation once a panel control has been used.
const releaseFocus = () => (document.activeElement as HTMLElement | null)?.blur();
$('panel').addEventListener('change', releaseFocus);
$('panel').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).tagName === 'BUTTON') releaseFocus();
});
window.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement | null;
  if (e.code !== 'KeyF' || e.ctrlKey || e.metaKey || e.altKey || (el && el.tagName === 'INPUT' && el !== flyBox)) return;
  flyBox.checked = controls.fly = !controls.fly;
});

const slider = $<HTMLInputElement>('count');
slider.max = String(COUNT_STEPS.length - 1);
const requested = Number(new URLSearchParams(location.search).get('n'));
const initial = requested > 0 ? requested : 250_000;
slider.value = String(Math.max(0, COUNT_STEPS.findIndex((s) => s >= initial)));
const sliderCount = () => COUNT_STEPS[Number(slider.value)];
const updateSliderLabel = () => { $('count-label').textContent = fmt(sliderCount()); };
slider.addEventListener('input', updateSliderLabel);
updateSliderLabel();

$('generate').addEventListener('click', () => load({ kind: 'generate', count: sliderCount(), seed: 1 }));

for (let i = 0; i < LAYER_COUNT; i++) {
  $<HTMLInputElement>('layer-' + i).addEventListener('change', (e) => {
    renderer.layerVisible[i] = (e.target as HTMLInputElement).checked;
    invalidate();
  });
}

$<HTMLInputElement>('rotate').addEventListener('change', (e) => {
  autoRotate = (e.target as HTMLInputElement).checked;
  invalidate();
});

$('fit').addEventListener('click', () => {
  if (scene) renderer.camera.fit(scopeBox(scene, scope));
  invalidate();
});

$('show-all').addEventListener('click', () => setScope({ level: 'all' }));
$('storey-up').addEventListener('click', () => stepStorey(1));
$('storey-down').addEventListener('click', () => stepStorey(-1));
window.addEventListener('keydown', (e) => {
  if (e.code === 'PageUp' || e.code === 'PageDown') {
    e.preventDefault();
    stepStorey(e.code === 'PageUp' ? 1 : -1);
  }
});

$<HTMLInputElement>('file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) load({ kind: 'import', text: await file.text() });
});

load({ kind: 'generate', count: requested > 0 ? requested : sliderCount(), seed: 1 });
