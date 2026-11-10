// Mouse and touch navigation: orbit, pan, zoom, click to select.

import type { Camera } from './camera';

export function attachControls(
  canvas: HTMLCanvasElement,
  camera: Camera,
  maxDistance: () => number,
  onChange: () => void,
  onClick: (x: number, y: number) => void,
): void {
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
      else camera.orbit(dx * 0.005, dy * 0.005);
    } else if (pointers.size === 2) {
      let other = p;
      for (const [id, q] of pointers) if (id !== e.pointerId) other = q;
      const before = Math.hypot(p.x - other.x, p.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0 && after > 0) camera.zoom(before / after, maxDistance());
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
    camera.zoom(Math.exp(delta * 0.0012), maxDistance());
    onChange();
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
