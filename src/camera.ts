// Orbit camera (Z up) with allocation-free matrix updates.

export class Camera {
  target = new Float32Array(3);
  distance = 100;
  azimuth = -1.0;
  elevation = 0.6;
  fov = (50 * Math.PI) / 180;

  eye = new Float32Array(3);
  far = 1000;
  viewProj = new Float32Array(16);

  private view = new Float32Array(16);
  private proj = new Float32Array(16);

  fit(bounds: Float32Array): void {
    this.target[0] = (bounds[0] + bounds[3]) / 2;
    this.target[1] = (bounds[1] + bounds[4]) / 2;
    this.target[2] = (bounds[2] + bounds[5]) / 2;
    const radius = Math.hypot(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]) / 2;
    this.distance = Math.max(radius * 1.6, 5);
    this.azimuth = -1.0;
    this.elevation = 0.6;
  }

  orbit(dx: number, dy: number): void {
    this.azimuth -= dx;
    this.elevation = Math.min(1.55, Math.max(-1.55, this.elevation + dy));
  }

  /** Pan by a screen-space delta expressed in pixels. */
  pan(dxPx: number, dyPx: number, viewportHeight: number): void {
    const k = (2 * this.distance * Math.tan(this.fov / 2)) / viewportHeight;
    const sa = Math.sin(this.azimuth), ca = Math.cos(this.azimuth);
    const se = Math.sin(this.elevation), ce = Math.cos(this.elevation);
    // right = (-sa, ca, 0); up = (-se*ca, -se*sa, ce)
    const rx = -dxPx * k, uy = dyPx * k;
    this.target[0] += -sa * rx + -se * ca * uy;
    this.target[1] += ca * rx + -se * sa * uy;
    this.target[2] += ce * uy;
  }

  /** Rotates the view around the eye (the eye stays fixed, the target moves). */
  look(dx: number, dy: number): void {
    const d = this.distance, t = this.target;
    let ce = Math.cos(this.elevation);
    const ex = t[0] + ce * Math.cos(this.azimuth) * d;
    const ey = t[1] + ce * Math.sin(this.azimuth) * d;
    const ez = t[2] + Math.sin(this.elevation) * d;
    this.orbit(dx, dy);
    ce = Math.cos(this.elevation);
    t[0] = ex - ce * Math.cos(this.azimuth) * d;
    t[1] = ey - ce * Math.sin(this.azimuth) * d;
    t[2] = ez - Math.sin(this.elevation) * d;
  }

  /** Translates the camera, in metres: along the view, to the right, and along world Z. */
  move(forward: number, right: number, up: number): void {
    const sa = Math.sin(this.azimuth), ca = Math.cos(this.azimuth);
    const se = Math.sin(this.elevation), ce = Math.cos(this.elevation);
    this.target[0] += -ce * ca * forward - sa * right;
    this.target[1] += -ce * sa * forward + ca * right;
    this.target[2] += -se * forward + up;
  }

  zoom(factor: number, maxDistance: number): void {
    this.distance = Math.min(maxDistance, Math.max(1, this.distance * factor));
  }

  update(aspect: number, bounds: Float32Array): void {
    const ce = Math.cos(this.elevation);
    const dirX = ce * Math.cos(this.azimuth);
    const dirY = ce * Math.sin(this.azimuth);
    const dirZ = Math.sin(this.elevation);
    const eye = this.eye, t = this.target;
    eye[0] = t[0] + dirX * this.distance;
    eye[1] = t[1] + dirY * this.distance;
    eye[2] = t[2] + dirZ * this.distance;

    // Depth range fitted to the scene to keep depth precision.
    const cx = (bounds[0] + bounds[3]) / 2, cy = (bounds[1] + bounds[4]) / 2, cz = (bounds[2] + bounds[5]) / 2;
    const radius = Math.hypot(bounds[3] - bounds[0], bounds[4] - bounds[1], bounds[5] - bounds[2]) / 2;
    const d = Math.hypot(eye[0] - cx, eye[1] - cy, eye[2] - cz);
    const far = d + radius;
    const near = Math.max(0.25, far / 20000, (d - radius) * 0.9);
    this.far = far;

    // View matrix: z = dir (eye - target), x = up × z, y = z × x, with up = +Z.
    const v = this.view;
    let xx = -dirY, xy = dirX;
    const xl = Math.hypot(xx, xy) || 1;
    xx /= xl; xy /= xl;
    const yx = -dirZ * xy, yy = dirZ * xx, yz = dirX * xy - dirY * xx;
    v[0] = xx; v[1] = yx; v[2] = dirX; v[3] = 0;
    v[4] = xy; v[5] = yy; v[6] = dirY; v[7] = 0;
    v[8] = 0; v[9] = yz; v[10] = dirZ; v[11] = 0;
    v[12] = -(xx * eye[0] + xy * eye[1]);
    v[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    v[14] = -(dirX * eye[0] + dirY * eye[1] + dirZ * eye[2]);
    v[15] = 1;

    const p = this.proj;
    const f = 1 / Math.tan(this.fov / 2);
    p.fill(0);
    p[0] = f / aspect;
    p[5] = f;
    p[10] = (far + near) / (near - far);
    p[11] = -1;
    p[14] = (2 * far * near) / (near - far);

    multiply(this.viewProj, p, v);
  }
}

/** out = a * b (column-major). */
export function multiply(out: Float32Array, a: Float32Array, b: Float32Array): void {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
}
