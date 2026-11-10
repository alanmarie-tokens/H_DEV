// Mouse, touch and keyboard navigation: orbit, pan, zoom, flight, click to select.
//
// Keys are read by physical position (event.code), so WASD on a QWERTY
// keyboard and ZQSD on an AZERTY one are the same keys.

import type { Camera } from './camera';

export interface Controls {
  /** When true, dragging looks around from the eye instead of orbiting the target. */
  fly: boolean;
  /** Keyboard travel speed in metres per second. */
  speed: number;
  /** Applies held movement keys for one frame. Returns true while moving. */
  update(dtMs: number): boolean;
}

export function attachControls(
  canvas: HTMLCanvasElement,
  camera: Camera,
  maxDistance: () => number,
  onChange: () => void,
  onClick: (x: number, y: number) => void,
): Controls {
  const controls: Controls = {
    fly: false,
    speed: 30,
    update(dtMs) {
      if (keys.size === 0) return false;
      const axis = (plus: string[], minus: string[]) =>
        (plus.some((k) => keys.has(k)) ? 1 : 0) - (minus.some((k) => keys.has(k)) ? 1 : 0);
      const forward = axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
      const right = axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
      const up = axis(['KeyE', 'Space'], ['KeyQ', 'KeyC']);
      if (forward === 0 && right === 0 && up === 0) return false;
      const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1;
      const step = (controls.speed * boost * Math.min(dtMs, 100)) / 1000;
      camera.move(forward * step, right * step, up * step);
      return true;
    },
  };
  const keys = new Set<string>();
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyC', 'Space',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA')) return;
    if (!MOVE_KEYS.has(e.code)) return;
    if (!e.code.startsWith('Shift')) e.preventDefault();
    keys.add(e.code);
    onChange();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const pointers = new Map<number, { x: number; y: number }>();
  let travelled = 0;
  let panning = false;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      travelled = 0;
      panning = e.button !== 0 || e.shiftKey;
    } else {
      travelled = Infinity; // multi-touch is never a click
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (dx === 0 && dy === 0) return;

    if (pointers.size === 1) {
      travelled += Math.abs(dx) + Math.abs(dy);
      if (panning) camera.pan(dx, dy, canvas.clientHeight);
      else if (controls.fly) camera.look(dx * 0.004, dy * 0.004);
      else camera.orbit(dx * 0.005, dy * 0.005);
    } else if (pointers.size === 2) {
      let other = p;
      for (const [id, q] of pointers) if (id !== e.pointerId) other = q;
      const before = Math.hypot(p.x - other.x, p.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (controls.fly) camera.move((after - before) * controls.speed * 0.01, 0, 0);
      else if (before > 0 && after > 0) camera.zoom(before / after, maxDistance());
      camera.pan(dx / 2, dy / 2, canvas.clientHeight);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    onChange();
  });

  const release = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (e.type === 'pointerup' && pointers.size === 0 && travelled < 5 && e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      onClick(e.clientX - rect.left, e.clientY - rect.top);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // In flight the wheel moves along the view instead of changing the orbit radius.
    if (controls.fly) camera.move(-delta * controls.speed * 0.004, 0, 0);
    else camera.zoom(Math.exp(delta * 0.0012), maxDistance());
    onChange();
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return controls;
}
