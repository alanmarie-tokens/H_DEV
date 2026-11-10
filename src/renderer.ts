// WebGL2 renderer: one instanced unit cube, one draw call per visible chunk.
//
// Per frame the CPU only touches chunks (a few thousand at most), never
// individual objects: frustum culling, front-to-back ordering, draw.

import { Camera } from './camera';
import { LAYER_COUNT, SPACE, STRIDE_BYTES, type SceneData } from './scene';

const VS_COMMON = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 iCenter;
layout(location=3) in vec3 iHalf;
layout(location=4) in float iYaw;
layout(location=5) in vec4 iColor;
uniform mat4 uViewProj;
uniform int uBaseId;
vec3 worldPos(float c, float s) {
  vec3 l = aPos * iHalf;
  return vec3(c * l.x - s * l.y, s * l.x + c * l.y, l.z) + iCenter;
}
`;

const VS_MAIN = VS_COMMON + `
uniform int uSelected;
uniform float uFar;
flat out vec4 vColor;
out float vFog;
void main() {
  float c = cos(iYaw), s = sin(iYaw);
  vec3 n = vec3(c * aNormal.x - s * aNormal.y, s * aNormal.x + c * aNormal.y, aNormal.z);
  float light = 0.5 + 0.5 * max(dot(n, vec3(0.37, 0.24, 0.9)), 0.0) + 0.08 * n.x;
  vec4 col = iColor;
  if (uBaseId + gl_InstanceID == uSelected) col = vec4(1.0, 0.55, 0.1, max(col.a, 0.9));
  vColor = vec4(col.rgb * light, col.a);
  gl_Position = uViewProj * vec4(worldPos(c, s), 1.0);
  vFog = smoothstep(0.35, 1.0, gl_Position.w / uFar) * 0.75;
}`;

const FS_MAIN = `#version 300 es
precision mediump float;
flat in vec4 vColor;
in float vFog;
uniform vec3 uFogColor;
out vec4 outColor;
void main() {
  outColor = vec4(mix(vColor.rgb, uFogColor, vFog), vColor.a);
}`;

const VS_PICK = VS_COMMON + `
flat out int vId;
void main() {
  vId = uBaseId + gl_InstanceID + 1;
  gl_Position = uViewProj * vec4(worldPos(cos(iYaw), sin(iYaw)), 1.0);
}`;

const FS_PICK = `#version 300 es
precision highp float;
flat in int vId;
out vec4 outColor;
void main() {
  outColor = vec4(float(vId & 255), float((vId >> 8) & 255), float((vId >> 16) & 255), float((vId >> 24) & 255)) / 255.0;
}`;

const BACKGROUND = [0.055, 0.066, 0.086];

export interface FrameStats {
  drawCalls: number;
  instances: number;
  chunksVisible: number;
  chunksTotal: number;
  cpuMs: number;
}

export class Renderer {
  readonly camera = new Camera();
  readonly stats: FrameStats = { drawCalls: 0, instances: 0, chunksVisible: 0, chunksTotal: 0, cpuMs: 0 };
  readonly layerVisible = [true, true, true];
  /** Global object id (layer offset + index in layer), or -1. */
  selected = -1;
  bounds: Float32Array = new Float32Array([-1, -1, -1, 1, 1, 1]);
  /** First global id of each layer. */
  layerBase = new Uint32Array(LAYER_COUNT + 1);

  private gl: WebGL2RenderingContext;
  private cubeVbo: WebGLBuffer;
  private cubeIbo: WebGLBuffer;
  private mainProgram: WebGLProgram;
  private pickProgram: WebGLProgram;
  private uMain: Record<string, WebGLUniformLocation | null> = {};
  private uPick: Record<string, WebGLUniformLocation | null> = {};
  private pickFbo: WebGLFramebuffer;

  // Flat chunk table across all layers.
  private instanceBuffers: WebGLBuffer[] = [];
  private chunkVao: WebGLVertexArrayObject[] = [];
  private chunkLayer = new Uint8Array(0);
  private chunkCount = new Uint32Array(0);
  private chunkBaseId = new Uint32Array(0);
  private chunkBox = new Float32Array(0);

  // Scratch buffers reused every frame.
  private visible = new Uint32Array(0);
  private depth = new Float32Array(0);
  private planes = new Float32Array(24);
  private pickMatrix = new Float32Array(16);
  private pixel = new Uint8Array(4);
  private byNear = (a: number, b: number) => this.depth[a] - this.depth[b];
  private byFar = (a: number, b: number) => this.depth[b] - this.depth[a];

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 indisponible sur ce navigateur');
    this.gl = gl;

    // Unit cube with per-face normals: 24 vertices, 36 indices.
    const verts: number[] = [];
    const indices: number[] = [];
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [1, -1]) {
        const u = (axis + 1) % 3, v = (axis + 2) % 3;
        const base = verts.length / 6;
        for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const p = [0, 0, 0], n = [0, 0, 0];
          p[axis] = sign; p[u] = du; p[v] = dv; n[axis] = sign;
          verts.push(...p, ...n);
        }
        const order = sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const i of order) indices.push(base + i);
      }
    }
    this.cubeVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    this.cubeIbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);

    this.mainProgram = this.link(VS_MAIN, FS_MAIN);
    this.pickProgram = this.link(VS_PICK, FS_PICK);
    for (const name of ['uViewProj', 'uBaseId', 'uSelected', 'uFar', 'uFogColor']) {
      this.uMain[name] = gl.getUniformLocation(this.mainProgram, name);
    }
    for (const name of ['uViewProj', 'uBaseId']) {
      this.uPick[name] = gl.getUniformLocation(this.pickProgram, name);
    }

    // 1x1 framebuffer used for picking.
    this.pickFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
    const color = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, color);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, 1, 1);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 1, 1);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private link(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vsSource], [gl.FRAGMENT_SHADER, fsSource]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('Shader : ' + gl.getShaderInfoLog(shader));
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Programme : ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  setScene(scene: SceneData): void {
    const gl = this.gl;
    for (const vao of this.chunkVao) gl.deleteVertexArray(vao);
    for (const buffer of this.instanceBuffers) gl.deleteBuffer(buffer);
    this.chunkVao = [];
    this.instanceBuffers = [];
    this.selected = -1;
    this.bounds = scene.bounds;

    let chunkTotal = 0;
    for (const layer of scene.layers) chunkTotal += layer.chunkStart.length;
    this.chunkLayer = new Uint8Array(chunkTotal);
    this.chunkCount = new Uint32Array(chunkTotal);
    this.chunkBaseId = new Uint32Array(chunkTotal);
    this.chunkBox = new Float32Array(chunkTotal * 6);
    this.visible = new Uint32Array(chunkTotal);
    this.depth = new Float32Array(chunkTotal);
    this.stats.chunksTotal = chunkTotal;

    let k = 0, idBase = 0;
    scene.layers.forEach((layer, li) => {
      this.layerBase[li] = idBase;
      const buffer = gl.createBuffer()!;
      this.instanceBuffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(layer.data), gl.STATIC_DRAW);

      for (let c = 0; c < layer.chunkStart.length; c++, k++) {
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIbo);

        // WebGL2 has no base instance: each chunk gets a VAO offset into the shared buffer.
        const offset = layer.chunkStart[c] * STRIDE_BYTES;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE_BYTES, offset);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, STRIDE_BYTES, offset + 12);
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE_BYTES, offset + 24);
        gl.enableVertexAttribArray(5);
        gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, STRIDE_BYTES, offset + 28);
        for (let a = 2; a <= 5; a++) gl.vertexAttribDivisor(a, 1);

        this.chunkVao.push(vao);
        this.chunkLayer[k] = li;
        this.chunkCount[k] = layer.chunkCount[c];
        this.chunkBaseId[k] = idBase + layer.chunkStart[c];
        this.chunkBox.set(layer.chunkBox.subarray(c * 6, c * 6 + 6), k * 6);
      }
      idBase += layer.count;
    });
    this.layerBase[LAYER_COUNT] = idBase;
    gl.bindVertexArray(null);
    this.camera.fit(scene.bounds);
  }

  /** Matches the drawing buffer to the CSS size. Returns true when it changed. */
  resize(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  /** Collects chunks intersecting the frustum of `m` into `visible`/`depth`. */
  private cull(m: Float32Array, transparent: boolean | null): number {
    const p = this.planes;
    for (let i = 0; i < 4; i++) {
      const r0 = m[i * 4], r1 = m[i * 4 + 1], r2 = m[i * 4 + 2], r3 = m[i * 4 + 3];
      p[i] = r3 + r0; p[4 + i] = r3 - r0;
      p[8 + i] = r3 + r1; p[12 + i] = r3 - r1;
      p[16 + i] = r3 + r2; p[20 + i] = r3 - r2;
    }
    const box = this.chunkBox, eye = this.camera.eye;
    let n = 0;
    chunks: for (let k = 0, total = this.chunkCount.length; k < total; k++) {
      const layer = this.chunkLayer[k];
      if (!this.layerVisible[layer]) continue;
      if (transparent !== null && (layer === SPACE) !== transparent) continue;
      const b = k * 6;
      for (let q = 0; q < 24; q += 4) {
        const a = p[q], bb = p[q + 1], c = p[q + 2];
        const x = a >= 0 ? box[b + 3] : box[b];
        const y = bb >= 0 ? box[b + 4] : box[b + 1];
        const z = c >= 0 ? box[b + 5] : box[b + 2];
        if (a * x + bb * y + c * z + p[q + 3] < 0) continue chunks;
      }
      const dx = (box[b] + box[b + 3]) / 2 - eye[0];
      const dy = (box[b + 1] + box[b + 4]) / 2 - eye[1];
      const dz = (box[b + 2] + box[b + 5]) / 2 - eye[2];
      this.depth[k] = dx * dx + dy * dy + dz * dz;
      this.visible[n++] = k;
    }
    return n;
  }

  private draw(n: number, baseIdLocation: WebGLUniformLocation | null): void {
    const gl = this.gl;
    for (let i = 0; i < n; i++) {
      const k = this.visible[i];
      gl.bindVertexArray(this.chunkVao[k]);
      gl.uniform1i(baseIdLocation, this.chunkBaseId[k]);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_BYTE, 0, this.chunkCount[k]);
      this.stats.instances += this.chunkCount[k];
    }
    this.stats.drawCalls += n;
    this.stats.chunksVisible += n;
  }

  render(): void {
    const t0 = performance.now();
    const gl = this.gl;
    this.resize();
    const cam = this.camera;
    cam.update(this.canvas.width / this.canvas.height, this.bounds);

    const stats = this.stats;
    stats.drawCalls = stats.instances = stats.chunksVisible = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.mainProgram);
    gl.uniformMatrix4fv(this.uMain.uViewProj, false, cam.viewProj);
    gl.uniform1i(this.uMain.uSelected, this.selected);
    gl.uniform1f(this.uMain.uFar, cam.far);
    gl.uniform3f(this.uMain.uFogColor, BACKGROUND[0], BACKGROUND[1], BACKGROUND[2]);

    // Opaque pass, front to back so the depth test rejects hidden fragments early.
    let n = this.cull(cam.viewProj, false);
    this.visible.subarray(0, n).sort(this.byNear);
    this.draw(n, this.uMain.uBaseId);

    // Transparent pass (spaces), back to front, without depth writes.
    n = this.cull(cam.viewProj, true);
    if (n > 0) {
      this.visible.subarray(0, n).sort(this.byFar);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      this.draw(n, this.uMain.uBaseId);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
    stats.cpuMs = performance.now() - t0;
  }

  /**
   * Returns the global id of the object under a CSS pixel, or -1.
   * Renders ids into a 1x1 target with a projection narrowed to that pixel,
   * so frustum culling discards almost the whole scene.
   */
  pick(cssX: number, cssY: number): number {
    const gl = this.gl;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const nx = (2 * (cssX + 0.5)) / w - 1;
    const ny = 1 - (2 * (cssY + 0.5)) / h;
    const m = this.pickMatrix;
    m.set(this.camera.viewProj);
    for (let c = 0; c < 16; c += 4) {
      m[c] = w * (m[c] - nx * m[c + 3]);
      m[c + 1] = h * (m[c + 1] - ny * m[c + 3]);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
    gl.viewport(0, 0, 1, 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.pickProgram);
    gl.uniformMatrix4fv(this.uPick.uViewProj, false, m);

    const saved = { ...this.stats };
    this.draw(this.cull(m, null), this.uPick.uBaseId);
    Object.assign(this.stats, saved);

    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const px = this.pixel;
    return ((px[0] | (px[1] << 8) | (px[2] << 16) | (px[3] << 24)) >>> 0) - 1;
  }
}
