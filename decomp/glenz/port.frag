#version 300 es
// GLENZ fragment shader — stub (fase 2).
// Additive blending wordt buiten de shader gezet (gl.blendFunc(gl.ONE, gl.ONE)).
precision highp float;
in vec3 v_col;
out vec4 frag;
void main() {
  frag = vec4(v_col * 0.5, 1.0);
}
