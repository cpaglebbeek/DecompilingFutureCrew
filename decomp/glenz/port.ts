// GLENZ port — TypeScript reinterpretatie van de 1993 spinning-cube glenz scene.
// Zie ASM_NOTES.md voor de bronvondst en mapping-tabel.

export const GLENZ_VERTICES: Float32Array = new Float32Array([
  -1, -1, -1,
   1, -1, -1,
   1,  1, -1,
  -1,  1, -1,
  -1, -1,  1,
   1, -1,  1,
   1,  1,  1,
  -1,  1,  1,
]);

export interface GlenzFace {
  indices: [number, number, number, number, number, number];
  color: [number, number, number];
}

// Kleuren letterlijk uit MAINTRAN.C:36-42 palet-bit-codes:
//   0x04=R, 0x08=G, 0x10=B, 0x20=RG=geel, 0x40=GB=cyaan, 0x80=BR=magenta
export const GLENZ_FACES: GlenzFace[] = [
  // bodem (y=-1)            verts 0,1,5,4
  { indices: [0, 1, 5, 0, 5, 4], color: [1, 0, 0] }, // rood
  // top (y=+1)              verts 3,2,6,7
  { indices: [3, 2, 6, 3, 6, 7], color: [1, 0, 1] }, // magenta
  // voor (z=+1)             verts 4,5,6,7
  { indices: [4, 5, 6, 4, 6, 7], color: [0, 1, 0] }, // groen
  // achter (z=-1)           verts 1,0,3,2
  { indices: [1, 0, 3, 1, 3, 2], color: [1, 1, 0] }, // geel
  // links (x=-1)            verts 0,4,7,3
  { indices: [0, 4, 7, 0, 7, 3], color: [0, 1, 1] }, // cyaan
  // rechts (x=+1)           verts 5,1,2,6
  { indices: [5, 1, 2, 5, 2, 6], color: [0, 0, 1] }, // blauw
];

export function buildGlenzGeometry(): { positions: Float32Array; indices: Uint16Array; faceOffsets: { start: number; count: number; color: [number, number, number] }[] } {
  const indices = new Uint16Array(GLENZ_FACES.length * 6);
  const faceOffsets: { start: number; count: number; color: [number, number, number] }[] = [];
  let off = 0;
  for (const f of GLENZ_FACES) {
    indices.set(f.indices, off);
    faceOffsets.push({ start: off, count: 6, color: f.color });
    off += 6;
  }
  return { positions: GLENZ_VERTICES, indices, faceOffsets };
}

// --- mat4 helpers (column-major, geen extern dep) ---

export function mat4Identity(): Float32Array {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Perspective(fovYRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

export function mat4Translate(tx: number, ty: number, tz: number): Float32Array {
  const m = mat4Identity();
  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  return m;
}

export function mat4RotateX(rad: number): Float32Array {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;  m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}

export function mat4RotateY(rad: number): Float32Array {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;  m[2] = -s;
  m[8] = s;  m[10] = c;
  return m;
}

export function mat4RotateZ(rad: number): Float32Array {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;  m[1] = s;
  m[4] = -s; m[5] = c;
  return m;
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const r = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i + k * 4]! * b[k + j * 4]!;
      r[i + j * 4] = s;
    }
  }
  return r;
}
