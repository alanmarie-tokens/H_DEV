// Scene preparation runs off the main thread; buffers are transferred, not copied.

import { generate } from './generator';
import { importJson } from './importer';
import { buildScene, sceneTransferables } from './scene';

export type WorkerRequest =
  | { id: number; kind: 'generate'; count: number; seed: number }
  | { id: number; kind: 'import'; text: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    const t0 = performance.now();
    let scene;
    if (req.kind === 'generate') {
      const { lists, hierarchy } = generate(req.count, req.seed);
      scene = buildScene(lists, hierarchy);
    } else {
      const { lists, hierarchy, spaceNames } = importJson(req.text);
      scene = buildScene(lists, hierarchy, spaceNames);
    }
    const ms = performance.now() - t0;
    (self as unknown as Worker).postMessage({ id: req.id, scene, ms }, sceneTransferables(scene));
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) });
  }
};
