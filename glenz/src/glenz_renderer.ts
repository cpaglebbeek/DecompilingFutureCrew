// glenz_renderer.ts — software rasteriser for the translucent glenz vector.
//
// Pipeline per object (semantic port of VEC.ASM rotlist/projlist + NEW.ASM
// additive fill):
//   1. rotate verts (Y·X·Z Euler, cmatrix_yxz order) and squash-scale
//   2. translate into view space, place at camera distance
//   3. perspective project with the faithful 320x200 constants
//   4. additively scanline-fill every triangle (no back-face cull — both
//      sides of the glass must show; overlaps brighten → the glenz look)
//
// Per-face brightness comes from the 3D facing of each triangle (|n·view|),
// reinterpreting the original's orientation-based palette shading.

import { VGA } from "./vga.js";
import {
  WIDTH,
  HEIGHT,
  PROJ_XMUL,
  PROJ_YMUL,
  PROJ_XADD,
  PROJ_YADD,
  PROJ_MINZ,
  FLOOR_Y,
  FLOOR_TILE,
  FLOOR_DARK,
  FLOOR_LIGHT,
  type Vec3,
  type Tri,
} from "./glenz_data.js";

// Faithful 320x200 projection (VID.ASM init320x200, VEC.ASM projlist):
//   screenX = X*256/Z + 160 ; screenY = Y*213/Z + 130 ; Z clamped to 128.
// Vertices arrive in true world units and are scaled by scale*64/32768 in
// glenz_core, so no extra focal-length fudge is needed here.
//
// The glenz polygons are filled ADDITIVELY (no stipple): the translucent
// glass look — and the magenta where the blue object shows through the red —
// comes from channel summation, the modern equivalent of the original's
// palette-OR fill. The "schaakbord" the scene shows is the floor, drawn by
// drawFloor() below, NOT a per-object dither.

export interface ObjectState {
  verts: Vec3[];
  tris: Tri[];
  rotX: number; // degree-tenths
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  transX: number; // view-space translation (object units)
  transY: number;
  transZ: number;
  camDist: number; // camera distance added to transZ
  brightness: number; // 0..1 overall fade
  // two alternating glass shades; the renderer picks per triangle via code&2
  tintPrimary: [number, number, number];
  tintSecondary: [number, number, number];
}

// Authentic glenz transparency (NEW.ASM): every triangle is filled with a
// SOLID span and combined with what is already on screen via channel-add (the
// modern equivalent of the original's palette-OR `or ah,fs:[di]`). No per-pixel
// dither — the faceted glass look comes purely from massive translucent faces
// overlapping and summing. Per-face contribution is kept LOW so 2-4 overlapping
// layers brighten toward the tint without saturating to white (which is what
// made the inner blue wash out before).

interface PV {
  sx: number;
  sy: number;
  vz: number; // view-space Z (for facing only)
  x: number;
  y: number;
  z: number; // view-space position (for normals)
}

function rotateScale(v: Vec3, s: ObjectState): Vec3 {
  const ax = (s.rotX * Math.PI) / 1800;
  const ay = (s.rotY * Math.PI) / 1800;
  const az = (s.rotZ * Math.PI) / 1800;
  // Z first, then X, then Y  (R = Ry · Rx · Rz)
  let x = v.x;
  let y = v.y;
  let z = v.z;
  // Rz
  let c = Math.cos(az);
  let sn = Math.sin(az);
  let nx = x * c - y * sn;
  let ny = x * sn + y * c;
  x = nx;
  y = ny;
  // Rx
  c = Math.cos(ax);
  sn = Math.sin(ax);
  ny = y * c - z * sn;
  let nz = y * sn + z * c;
  y = ny;
  z = nz;
  // Ry
  c = Math.cos(ay);
  sn = Math.sin(ay);
  nx = x * c + z * sn;
  nz = -x * sn + z * c;
  x = nx;
  z = nz;
  return { x: x * s.scaleX, y: y * s.scaleY, z: z * s.scaleZ };
}

export class GlenzRenderer {
  constructor(private readonly vga: VGA) {}

  // Perspective checkerboard ground plane (the scene background). For every
  // screen row below the horizon (screenY > PROJ_YADD), cast a ray onto the
  // world plane Y = FLOOR_Y and read which checker square it lands in. Two
  // mauve shades, fading to black toward the horizon for depth.
  drawFloor(): void {
    for (let sy = PROJ_YADD + 1; sy < HEIGHT; sy++) {
      const dy = sy - PROJ_YADD; // > 0 below the horizon
      const z = (FLOOR_Y * PROJ_YMUL) / dy; // depth of the plane at this row
      const fade = z > 0 ? Math.min(1, 9000 / z) : 0;
      const zc = Math.floor(z / FLOOR_TILE);
      for (let sx = 0; sx < WIDTH; sx++) {
        const x = ((sx - PROJ_XADD) * z) / PROJ_XMUL;
        const xc = Math.floor(x / FLOOR_TILE);
        const lit = ((xc + zc) & 1) === 0;
        const c = lit ? FLOOR_LIGHT : FLOOR_DARK;
        this.vga.setPixel(sx, sy, c[0] * fade, c[1] * fade, c[2] * fade);
      }
    }
  }

  drawObject(s: ObjectState): void {
    const proj: PV[] = new Array(s.verts.length);
    for (let i = 0; i < s.verts.length; i++) {
      const r = rotateScale(s.verts[i]!, s);
      const x = r.x + s.transX;
      const y = r.y + s.transY;
      let z = r.z + s.transZ + s.camDist;
      if (z < PROJ_MINZ) z = PROJ_MINZ;
      proj[i] = {
        sx: (x * PROJ_XMUL) / z + PROJ_XADD,
        sy: (y * PROJ_YMUL) / z + PROJ_YADD,
        vz: z,
        x,
        y,
        z,
      };
    }
    for (const t of s.tris) {
      const col = t.code & 2 ? s.tintPrimary : s.tintSecondary;
      this.drawTri(proj[t.a]!, proj[t.b]!, proj[t.c]!, s, col);
    }
  }

  private drawTri(
    p0: PV,
    p1: PV,
    p2: PV,
    s: ObjectState,
    col: [number, number, number],
  ): void {
    const fade = s.brightness;
    // facing: view-space normal · view direction → brightness (both sides lit)
    const e1x = p1.x - p0.x;
    const e1y = p1.y - p0.y;
    const e1z = p1.z - p0.z;
    const e2x = p2.x - p0.x;
    const e2y = p2.y - p0.y;
    const e2z = p2.z - p0.z;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    // view dir ≈ from triangle toward camera (camera at origin looking +Z)
    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    const cz = (p0.z + p1.z + p2.z) / 3;
    const clen = Math.hypot(cx, cy, cz) || 1;
    const facing = Math.abs((nx * cx + ny * cy + nz * cz) / (nlen * clen));
    // demo_glz: faces are near-FLAT solid glass (the reference shows crisp two-
    // tone facets, not gradients). Keep only a slight facing variation; the
    // contribution is tuned so ~2 overlapping faces sum to the sampled tint and
    // the spiky tips (3-4 layers) brighten toward saturation, as in ref_09/11.
    const shade = (0.26 + 0.15 * facing) * fade;
    const r = col[0] * shade;
    const g = col[1] * shade;
    const b = col[2] * shade;
    this.fillTriangle(p0.sx, p0.sy, p1.sx, p1.sy, p2.sx, p2.sy, r, g, b);
  }

  // Additive scanline fill of a screen-space triangle, clipped to 320x200.
  private fillTriangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
    g: number,
    b: number,
  ): void {
    // order by Y
    if (y1 < y0) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }
    if (y2 < y0) {
      [x0, x2] = [x2, x0];
      [y0, y2] = [y2, y0];
    }
    if (y2 < y1) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }
    const total = y2 - y0;
    if (total <= 0) return;
    let yStart = Math.max(0, Math.ceil(y0));
    let yEnd = Math.min(HEIGHT - 1, Math.floor(y2));
    for (let y = yStart; y <= yEnd; y++) {
      const a = (y - y0) / total; // long edge param
      const xa = x0 + (x2 - x0) * a;
      let xb: number;
      if (y < y1) {
        const h = y1 - y0;
        xb = h > 0 ? x0 + (x1 - x0) * ((y - y0) / h) : x0;
      } else {
        const h = y2 - y1;
        xb = h > 0 ? x1 + (x2 - x1) * ((y - y1) / h) : x1;
      }
      let xl = Math.round(Math.min(xa, xb));
      let xr = Math.round(Math.max(xa, xb));
      if (xl < 0) xl = 0;
      if (xr > WIDTH - 1) xr = WIDTH - 1;
      for (let x = xl; x <= xr; x++) {
        this.vga.addPixel(x, y, r, g, b); // solid additive span (palette-OR)
      }
    }
  }
}
