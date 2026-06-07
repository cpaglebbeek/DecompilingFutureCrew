// TUNNELI port — TypeScript reinterpretatie van de 3D pipe-snake scene.
// Zie ASM_NOTES.md voor source-vondst en mapping-tabel.
//
// Origineel: 103 ringen × 64 punten in Pascal+asm met perspective-LUT.
// Hier: 80 ringen × 64 punten als single VBO met (ringIdx, pointIdx) als
// vertex-attributes; alle path-berekening in vertex-shader.

export const TUNNELI_RINGS = 80;
export const TUNNELI_POINTS_PER_RING = 64;
export const TUNNELI_VERTEX_COUNT = TUNNELI_RINGS * TUNNELI_POINTS_PER_RING;

export function buildTunneliVertices(): Float32Array {
  // 2 floats per vertex: (ringIdx, pointIdx). Path en radius worden in shader berekend.
  const verts = new Float32Array(TUNNELI_VERTEX_COUNT * 2);
  let off = 0;
  for (let r = 0; r < TUNNELI_RINGS; r++) {
    for (let p = 0; p < TUNNELI_POINTS_PER_RING; p++) {
      verts[off++] = r;
      verts[off++] = p;
    }
  }
  return verts;
}
