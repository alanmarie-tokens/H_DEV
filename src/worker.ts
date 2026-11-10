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
    const lists = req.kind === 'generate' ? generate(req.count, req.seed) : importJson(req.text);
    const scene = buildScene(lists);
    const ms = performance.now() - t0;
    (self as unknown as Worker).postMessage({ id: req.id, scene, ms }, sceneTransferables(scene));
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) });
  }
};
