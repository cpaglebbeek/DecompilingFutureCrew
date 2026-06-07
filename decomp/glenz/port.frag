#version 300 es
// GLENZ fragment shader — emissieve constante kleur. Additive blending wordt
// in JS gezet: gl.blendFunc(gl.ONE, gl.ONE). Geen depth-test (additief is
// orderonafhankelijk), waardoor overlappende faces "translucent" lijken.
precision highp float;
uniform vec3 u_color;
uniform float u_alpha;
out vec4 frag;
void main() {
  frag = vec4(u_color * u_alpha, 1.0);
}
