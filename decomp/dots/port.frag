#version 300 es
// DOTS fragment shader — soft circular dot + depth-shading.
// Vervangt depthtable1-4[] LUT uit 1993 origineel met fragment-shader berekening.
// Palet = teal-cyan (cols[] uit MAIN.C:72-76: {0,0,0, 4,25,30, 8,40,45, 16,55,60}).
precision highp float;
in float v_depth;
in float v_bucket;
out vec4 frag;

void main() {
  // Cirkel-mask binnen point-sprite (gl_PointCoord is [0,1]).
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);

  // Depth-shading: dichterbij = helderder. v_depth = ~camera-afstand.
  float depthShade = clamp(1.0 - (v_depth - 3.0) / 8.0, 0.15, 1.0);

  // 4 kleur-buckets letterlijk uit MAIN.C:72-76 cols[] / 63 (1993 6-bit VGA → 0..1):
  //   bucket 0: zwart (rendert nauwelijks)
  //   bucket 1: 4/63, 25/63, 30/63   ≈ donker-teal
  //   bucket 2: 8/63, 40/63, 45/63   ≈ medium-teal
  //   bucket 3: 16/63, 55/63, 60/63  ≈ helder-teal
  vec3 col;
  int b = int(v_bucket + 0.5);
  if      (b == 0) col = vec3(0.05, 0.05, 0.05);
  else if (b == 1) col = vec3(4.0, 25.0, 30.0) / 63.0;
  else if (b == 2) col = vec3(8.0, 40.0, 45.0) / 63.0;
  else             col = vec3(16.0, 55.0, 60.0) / 63.0;

  frag = vec4(col * depthShade * core, core);
}
