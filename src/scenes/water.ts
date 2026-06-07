import type { SceneFn } from "./_scene.js";

const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_t;
uniform vec2 u_res;
out vec4 frag;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_res.x / u_res.y;

  vec2 q = uv * 4.0;
  q.x += u_t * 0.25;
  q.y += sin(uv.x * 6.0 + u_t * 0.9) * 0.15;

  float n1 = fbm(q + vec2(u_t * 0.18, 0.0));
  float n2 = fbm(q * 1.7 + vec2(0.0, u_t * 0.22));
  float caustic = pow(0.5 + 0.5 * sin((n1 + n2) * 6.28318 + u_t * 1.2), 4.0);

  vec3 deep = vec3(0.02, 0.08, 0.22);
  vec3 surf = vec3(0.10, 0.40, 0.65);
  float depthMix = smoothstep(0.0, 1.0, n1 * 0.6 + 0.2);
  vec3 col = mix(deep, surf, depthMix);

  col += vec3(0.4, 0.7, 0.95) * caustic * 0.45;

  float glint = pow(sin(uv.x * 22.0 + n1 * 8.0 + u_t * 2.5) * 0.5 + 0.5, 8.0);
  col += vec3(0.7, 0.85, 1.0) * glint * 0.18;

  vec2 c = v_uv - 0.5;
  float vign = 1.0 - dot(c, c) * 0.7;
  col *= vign;

  frag = vec4(col, 1.0);
}`;

export const waterScene: SceneFn = ({ t, renderer }) => {
  const gl = renderer.gl;
  const prog = renderer.program("water", VERT, FRAG);
  renderer.drawFullscreen(prog, () => {
    const uT = gl.getUniformLocation(prog, "u_t");
    const uRes = gl.getUniformLocation(prog, "u_res");
    if (uT) gl.uniform1f(uT, t);
    if (uRes) gl.uniform2f(uRes, renderer.width, renderer.height);
  });
};
