import type { SceneFn } from "./_scene.js";

const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_t;
uniform vec2 u_res;
out vec4 frag;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

vec3 layer(vec2 uv, float depth, float t){
  vec2 g = uv * (4.0 + depth*40.0);
  g.x += t * (0.08 + depth*0.35);
  vec2 gi = floor(g);
  vec2 gf = fract(g) - 0.5;
  float r = hash(gi);
  if (r < 0.985) return vec3(0.0);
  float d = length(gf);
  float core = smoothstep(0.05, 0.0, d);
  float glow = smoothstep(0.30, 0.0, d) * 0.35;
  float tw = 0.6 + 0.4 * sin(t*2.3 + r*42.0);
  vec3 col = mix(vec3(0.8,0.9,1.0), vec3(1.0,0.85,0.7), fract(r*7.3));
  return col * (core + glow) * tw * (0.4 + depth*0.6);
}

void main(){
  vec2 uv = v_uv;
  uv.x *= u_res.x / u_res.y;
  vec3 col = vec3(0.0);
  col += layer(uv, 0.0, u_t);
  col += layer(uv + 17.0, 0.45, u_t);
  col += layer(uv - 9.0, 0.85, u_t);
  vec2 c = v_uv - 0.5;
  float vign = 1.0 - dot(c,c)*0.7;
  col *= vign;
  frag = vec4(col, 1.0);
}`;

export const starfieldScene: SceneFn = ({ t, renderer }) => {
  const gl = renderer.gl;
  const prog = renderer.program("starfield", VERT, FRAG);
  renderer.drawFullscreen(prog, () => {
    const uT = gl.getUniformLocation(prog, "u_t");
    const uRes = gl.getUniformLocation(prog, "u_res");
    if (uT) gl.uniform1f(uT, t);
    if (uRes) gl.uniform2f(uRes, renderer.width, renderer.height);
  });
};
