import './style.css';
import { attachControls } from './controls';
import { Renderer } from './renderer';
import { LAYER_COUNT, LAYER_NAMES, STRIDE_WORDS, WALL, type SceneData } from './scene';

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
  const t0 = performance.now();
  renderer.setScene(scene);
  const upload = performance.now() - t0;

  const total = scene.layers.reduce((sum, l) => sum + l.count, 0);
  $('s-total').textContent = fmt(total);
  for (let i = 0; i < LAYER_COUNT; i++) $('n-' + i).textContent = fmt(scene.layers[i].count);
  statusEl.textContent = `Préparation ${fmt(e.data.ms ?? 0)} ms · envoi GPU ${fmt(upload)} ms`;
  showSelection(-1);
  invalidate();
};

function load(message: { kind: 'generate'; count: number; seed: number } | { kind: 'import'; text: string }): void {
  statusEl.textContent = 'Préparation de la scène…';
  $<HTMLButtonElement>('generate').disabled = true;
  worker.postMessage({ id: ++requestId, ...message });
}

// --- Selection ---------------------------------------------------------------
function showSelection(id: number): void {
  renderer.selected = id;
  const el = $('selection');
  if (id < 0 || !scene) {
    el.textContent = 'Cliquez sur un objet pour l’inspecter.';
    return;
  }
  let layer = 0;
  while (layer < LAYER_COUNT - 1 && id >= renderer.layerBase[layer + 1]) layer++;
  const index = id - renderer.layerBase[layer];
  const f = layerFloats[layer];
  const o = index * STRIDE_WORDS;
  const m = (v: number) => v.toFixed(2) + ' m';
  const rows: [string, string][] = [['Type', LAYER_NAMES[layer]], ['N°', fmt(index)]];
  if (layer === WALL) {
    rows.push(['Longueur', m(f[o + 3] * 2)], ['Épaisseur', m(f[o + 4] * 2)], ['Hauteur', m(f[o + 5] * 2)]);
  } else {
    rows.push(['Dimensions', `${(f[o + 3] * 2).toFixed(2)} × ${(f[o + 4] * 2).toFixed(2)} m`],
      [layer === 1 ? 'Épaisseur' : 'Hauteur', m(f[o + 5] * 2)],
      ['Surface', (f[o + 3] * f[o + 4] * 4).toFixed(1) + ' m²']);
  }
  rows.push(['Niveau bas', m(f[o + 2] - f[o + 5])],
    ['Position', `${f[o].toFixed(1)} ; ${f[o + 1].toFixed(1)}`],
    ['Orientation', ((f[o + 6] * 180) / Math.PI).toFixed(0) + '°']);
  el.replaceChildren(...rows.map(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'row';
    const key = document.createElement('span');
    key.textContent = k;
    const value = document.createElement('b');
    value.textContent = v;
    row.append(key, value);
    return row;
  }));
}

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
  renderer.camera.fit(renderer.bounds);
  invalidate();
});

$<HTMLInputElement>('file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) load({ kind: 'import', text: await file.text() });
});

load({ kind: 'generate', count: requested > 0 ? requested : sliderCount(), seed: 1 });
