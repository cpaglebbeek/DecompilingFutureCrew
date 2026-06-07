import type { SceneFn } from "./_scene.js";
import {
  TUNNELI_VERTEX_COUNT,
  buildTunneliVertices,
} from "../../decomp/tunneli/port.js";
import {
  mat4Multiply,
  mat4Perspective,
  mat4Translate,
} from "../../decomp/glenz/port.js";

const VERT = `#version 300 es
layout(location=0) in vec2 a_idx;
uniform float u_t;
uniform mat4 u_mvp;
uniform float u_basePointSize;
out float v_ring;
out float v_depth;
const float POINTS = 64.0;
const float TAU = 6.28318530718;
void main() {
  float r = a_idx.x;
  float p = a_idx.y;
  float ringPhase = r + u_t * 8.0;
  float z = -(r * 0.45);
  vec2 center = vec2(
    sin(ringPhase * 0.16 + u_t * 0.7) * 1.6,
    cos(ringPhase * 0.13 + u_t * 0.5) * 1.0
  );
  float radius = 0.45 + 0.18 * sin(ringPhase * 0.5 + u_t * 1.4);
  float angle = (p / POINTS) * TAU;
  vec2 ringOffset = vec2(cos(angle), sin(angle)) * radius;
  vec4 pos = vec4(center + ringOffset, z, 1.0);
  vec4 clip = u_mvp * pos;
  gl_Position = clip;
  gl_PointSize = max(1.5, u_basePointSize / clip.w);
  v_ring = r;
  v_depth = clip.w;
}`;

const FRAG = `#version 300 es
precision highp float;
in float v_ring;
in float v_depth;
out vec4 frag;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  float depthShade = clamp(1.0 - (v_depth - 3.0) / 18.0, 0.12, 1.0);
  vec3 col = vec3(0.92, 0.95, 0.98);
  float leadMix = smoothstep(6.0, 0.0, v_ring);
  col = mix(col, vec3(0.1, 0.95, 0.2), leadMix * 0.5);
  frag = vec4(col * depthShade * core, core);
}`;

interface TunneliGpu {
  vao: WebGLVertexArrayObject;
}

let gpu: TunneliGpu | null = null;
let lastGl: WebGL2RenderingContext | null = null;

function init(gl: WebGL2RenderingContext): TunneliGpu {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, buildTunneliVertices(), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao };
}

export const tunneliScene: SceneFn = ({ t, renderer }) => {
  const gl = renderer.gl;
  if (gpu === null || lastGl !== gl) {
    gpu = init(gl);
    lastGl = gl;
  }

  const proj = mat4Perspective(Math.PI / 3, renderer.aspect, 0.5, 100);
  const view = mat4Translate(0, 0, -3);
  const mvp = mat4Multiply(proj, view);

  const prog = renderer.program("tunneli", VERT, FRAG);
  gl.useProgram(prog);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "u_mvp"), false, mvp);
  gl.uniform1f(gl.getUniformLocation(prog, "u_t"), t);
  gl.uniform1f(gl.getUniformLocation(prog, "u_basePointSize"), renderer.height * 0.018);

  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  gl.bindVertexArray(gpu.vao);
  gl.drawArrays(gl.POINTS, 0, TUNNELI_VERTEX_COUNT);
  gl.bindVertexArray(null);

  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
};
