#version 300 es
// DOTS vertex shader — instanced point-sprites.
// Vervangt drawdots() uit DOTS/ASM.ASM. Per instance één dot.
layout(location=0) in vec3 a_dotPos;
layout(location=1) in float a_colorBucket;
uniform mat4 u_mvp;
uniform float u_basePointSize;
out float v_depth;
out float v_bucket;
void main() {
  vec4 clip = u_mvp * vec4(a_dotPos, 1.0);
  gl_Position = clip;
  // Perspective-correcte point-size: groter dichtbij, kleiner ver weg.
  // clip.w = -viewspaceZ na perspective-projection (positief = vóór camera).
  gl_PointSize = max(2.0, u_basePointSize / clip.w);
  v_depth = clip.w; // afstand-tot-camera (positief)
  v_bucket = a_colorBucket;
}
