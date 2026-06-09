// glenz_data.ts — hardcoded GLENZ object data + tables.
//
// Behavioural reference: SecondReality_source/GLENZ/MAIN.C (production driver)
// and VEC.ASM (C-callable transform/projection). NOT a byte-for-byte port —
// the original fixed-point matrix math is replaced by float transforms; the
// object geometry, face topology and projection *constants* are faithful.
//
//   - points[]  (MAIN.C:60-74)  = 14 vertices: an 8-corner cube + 6 axis tips
//                                 (a cube with a pyramid pushed out of each
//                                  face = the classic glenz "spiked" vector).
//   - epolys[]  (MAIN.C:176-207) = 24 triangles, in 6 groups of 4 (one fan
//                                  per cube face → its axis tip).
//   - projection (VEC.ASM projlist + VID.ASM init320x200):
//        screenX = X*projxmul/Z + projxadd   projxmul=256 projxadd=160
//        screenY = Y*projymul/Z + projyadd   projymul=213 projyadd=130
//     The 213/256 ratio is the VGA 320x200-on-4:3 non-square-pixel aspect.

export const WIDTH = 320;
export const HEIGHT = 200;

// Original VGA refresh / DIS tick the part paces on (~70 Hz).
export const TICK_HZ = 70;

// Faithful projection constants (VID.ASM init320x200, reported via decomp).
export const PROJ_XMUL = 256;
export const PROJ_YMUL = 213;
export const PROJ_XADD = 160; // screen centre X
export const PROJ_YADD = 130; // screen centre Y (note: below geometric centre)
export const PROJ_MINZ = 128; // Z clamp (in original integer units)

// --- sin1024: 1024 entries, amplitude 256 (256 == sin 1.0), 0..1023 = 0..2π.
// (SIN1024.INC). Regenerated deterministically; matches the original within ±1.
export const SIN_SHIFT = 8; // amplitude = 1<<8 = 256
export const SIN_AMP = 1 << SIN_SHIFT;
export const sin1024: Int16Array = (() => {
  const t = new Int16Array(1024);
  for (let i = 0; i < 1024; i++) {
    t[i] = Math.round(SIN_AMP * Math.sin((i / 1024) * 2 * Math.PI));
  }
  return t;
})();

// sin/cos by angle in "degree-tenths" (3600 == 360°), as cmatrix_yxz uses.
export function sinDeg10(units: number): number {
  return Math.sin((units * Math.PI) / 1800);
}
export function cosDeg10(units: number): number {
  return Math.cos((units * Math.PI) / 1800);
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Tri {
  a: number;
  b: number;
  c: number;
  group: number; // 0..5 — which cube face this triangle fans from
  code: number; // original epolys[] colour-code; bit1 (code&2) selects the tint
}

// Build the cube+tips vertex set in *faithful world units*. `cube` = half-
// extent of the cube corners, `tip` = axis-tip distance.
//   Object A (points[],  MAIN.C:60-74): ZZZ=50 → cube ±5000, tips ±8500.
//   Object B (pointsb[], MAIN.C):        QQQ=99 → cube ±5940, tips ±10395.
// These world coords are later multiplied by scale*64/32768 and projected with
// the real 256/213/160/130 constants — so the two objects keep their true
// relative size (B is the larger, enclosing glenz; A nests inside it).
function buildVerts(cube: number, tip: number): Vec3[] {
  return [
    { x: -cube, y: -cube, z: -cube }, // 0
    { x: cube, y: -cube, z: -cube }, // 1
    { x: cube, y: cube, z: -cube }, // 2
    { x: -cube, y: cube, z: -cube }, // 3
    { x: -cube, y: -cube, z: cube }, // 4
    { x: cube, y: -cube, z: cube }, // 5
    { x: cube, y: cube, z: cube }, // 6
    { x: -cube, y: cube, z: cube }, // 7
    { x: 0, y: 0, z: -tip }, // 8  front tip (-Z)
    { x: 0, y: 0, z: tip }, // 9  back tip  (+Z)
    { x: tip, y: 0, z: 0 }, // 10 right tip (+X)
    { x: -tip, y: 0, z: 0 }, // 11 left tip  (-X)
    { x: 0, y: tip, z: 0 }, // 12 top tip   (+Y)
    { x: 0, y: -tip, z: 0 }, // 13 bottom tip(-Y)
  ];
}

// 24 triangles, exactly the connectivity of epolys[] (MAIN.C:176-207),
// grouped per cube-face/tip. The colour-codes 0x4002.. in the original drive a
// self-modifying palette-shading routine (VEC.ASM demo_glz): `test bp,2` splits
// each triangle into a blue-violet glass face vs a white/grey one, alternating
// per triangle. We keep the real codes per triangle and read bit1 in the
// renderer. `codeFor(i)` produces the code for triangle index i:
//   Object A (epolys):  0x4002 + 2*i      → bit1 toggles each triangle
//   Object B (epolysb): 0x4004 / 0x4002   → same toggle, opposite phase
function buildTris(codeFor: (i: number) => number): Tri[] {
  const g: [number, number, number][][] = [
    // group 0 — front face (verts 0,1,2,3) fanning to tip 8
    [[0, 1, 8], [1, 2, 8], [2, 3, 8], [3, 0, 8]],
    // group 1 — right face fanning to tip 10
    [[2, 1, 10], [1, 5, 10], [5, 6, 10], [6, 2, 10]],
    // group 2 — top face fanning to tip 12
    [[2, 6, 12], [6, 7, 12], [7, 3, 12], [3, 2, 12]],
    // group 3 — left face fanning to tip 11
    [[0, 3, 11], [3, 7, 11], [7, 4, 11], [4, 0, 11]],
    // group 4 — bottom face fanning to tip 13
    [[5, 1, 13], [1, 0, 13], [0, 4, 13], [4, 5, 13]],
    // group 5 — back face fanning to tip 9
    [[5, 4, 9], [4, 7, 9], [7, 6, 9], [6, 5, 9]],
  ];
  const out: Tri[] = [];
  let i = 0;
  g.forEach((grp, gi) => {
    for (const [a, b, c] of grp) {
      out.push({ a, b, c, group: gi, code: codeFor(i) });
      i++;
    }
  });
  return out;
}

// Per-TRIANGLE two-tone tints, sampled from the reference video (GLENZ window
// 1:56–2:32, /tmp/glenz_ref/ref_09..15.png histogram). The original's `test
// bp,2` self-modifying shader splits every glenz into two alternating glass
// shades (demomode selects WHICH palette ramp per object); the renderer reads
// `Tri.code & 2` to pick primary vs secondary. Faces are blended ADDITIVELY
// (palette-OR equivalent) so ~2 overlapping faces sum to the sampled finals and
// wherever the blue inner shows through the red shell the channels sum to a
// magenta/pink — exactly the reference. So colour is per-triangle, not flat.
//
//   Object A (inner): steel BLUE ↔ light WHITE-grey  (ref_09)
//   Object B (outer): bright RED ↔ dark RED          (ref_11)
export const TINT_A_BLUE: [number, number, number] = [30, 40, 120];
export const TINT_A_WHITE: [number, number, number] = [120, 100, 134];
export const TINT_B_RED: [number, number, number] = [176, 12, 0];
export const TINT_B_RED_DARK: [number, number, number] = [92, 6, 0];

// Checkerboard floor (the scene's solid background — ref_05.png histogram):
// a perspective ground plane in two mauve shades, fading to black toward the
// horizon. Reinterpretation values (not byte-exact).
export const FLOOR_Y = 2600; // world Y of the ground plane (below the objects)
export const FLOOR_TILE = 1500; // world size of one checker square
export const FLOOR_DARK: [number, number, number] = [54, 48, 68];
export const FLOOR_LIGHT: [number, number, number] = [84, 66, 84];

// Object A — the main glenz vector (points[]/epolys[]): cube ±5000, tips ±8500.
export const OBJECT_A = {
  verts: buildVerts(5000, 8500),
  tris: buildTris((i) => 0x4002 + 2 * i),
};

// Object B — the second, larger/pointier glenz (pointsb[]/epolysb[]):
// cube ±5940, tips ±10395; alternating code in opposite phase to A.
export const OBJECT_B = {
  verts: buildVerts(5940, 10395),
  tris: buildTris((i) => (i & 1 ? 0x4002 : 0x4004)),
};
