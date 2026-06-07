import type { SceneFn } from "./_scene.js";
import {
  buildGlenzGeometry,
  mat4Multiply,
  mat4Perspective,
  mat4RotateX,
  mat4RotateY,
  mat4RotateZ,
  mat4Translate,
} from "../../decomp/glenz/port.js";

const VERT = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_mvp;
void main() { gl_Position = u_mvp * vec4(a_pos, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec3 u_color;
uniform float u_alpha;
out vec4 frag;
void main() { frag = vec4(u_color * u_alpha, 1.0); }`;

interface GlenzGpu {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  faceOffsets: { start: number; count: number; color: [number, number, number] }[];
}

let gpu: GlenzGpu | null = null;
let lastGlContext: WebGL2RenderingContext | null = null;

function init(gl: WebGL2RenderingContext): GlenzGpu {
  const geom = buildGlenzGeometry();
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("createVertexArray failed (glenz)");
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geom.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  return { vao, indexCount: geom.indices.length, faceOffsets: geom.faceOffsets };
}

export const glenzScene: SceneFn = ({ t, renderer }) => {
  const gl = renderer.gl;
  if (gpu === null || lastGlContext !== gl) {
    gpu = init(gl);
    lastGlContext = gl;
  }

  // Rotatie zoals MAINTRAN.C:74 — ry+=7, rz+=11 per frame in tenths-of-degree
  // bij ~70Hz. Hier in radialen per seconde voor frame-rate-onafhankelijkheid.
  // ry: 0.7°/frame × 70Hz = 49°/s ≈ 0.855 rad/s
  // rz: 1.1°/frame × 70Hz = 77°/s ≈ 1.344 rad/s
  const ry = t * 0.855;
  const rz = t * 1.344;

  const proj = mat4Perspective(Math.PI / 3, renderer.aspect, 0.5, 100);
  const view = mat4Translate(0, 0, -4);
  const model = mat4Multiply(mat4RotateZ(rz), mat4Multiply(mat4RotateX(0), mat4RotateY(ry)));
  const mvp = mat4Multiply(proj, mat4Multiply(view, model));

  const prog = renderer.program("glenz", VERT, FRAG);
  const uMvp = gl.getUniformLocation(prog, "u_mvp");
  const uColor = gl.getUniformLocation(prog, "u_color");
  const uAlpha = gl.getUniformLocation(prog, "u_alpha");

  gl.useProgram(prog);
  gl.uniformMatrix4fv(uMvp, false, mvp);
  if (uAlpha) gl.uniform1f(uAlpha, 0.55);

  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  gl.bindVertexArray(gpu.vao);
  for (const f of gpu.faceOffsets) {
    gl.uniform3f(uColor, f.color[0], f.color[1], f.color[2]);
    gl.drawElements(gl.TRIANGLES, f.count, gl.UNSIGNED_SHORT, f.start * 2);
  }
  gl.bindVertexArray(null);

  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
};
