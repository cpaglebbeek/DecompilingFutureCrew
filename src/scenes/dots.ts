import type { SceneFn } from "./_scene.js";
import {
  DOTS_COUNT,
  emitCircleWithGravity,
  emitLissajous,
  initDots,
  stepDots,
  syncPositionBuffer,
} from "../../decomp/dots/port.js";
import {
  mat4Multiply,
  mat4Perspective,
  mat4RotateY,
  mat4Translate,
} from "../../decomp/glenz/port.js";

const VERT = `#version 300 es
layout(location=0) in vec3 a_dotPos;
layout(location=1) in float a_colorBucket;
uniform mat4 u_mvp;
uniform float u_basePointSize;
out float v_depth;
out float v_bucket;
void main() {
  vec4 clip = u_mvp * vec4(a_dotPos, 1.0);
  gl_Position = clip;
  gl_PointSize = max(2.0, u_basePointSize / clip.w);
  v_depth = clip.w;
  v_bucket = a_colorBucket;
}`;

const FRAG = `#version 300 es
precision highp float;
in float v_depth;
in float v_bucket;
out vec4 frag;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);
  float depthShade = clamp(1.0 - (v_depth - 3.0) / 8.0, 0.15, 1.0);
  vec3 col;
  int b = int(v_bucket + 0.5);
  if      (b == 0) col = vec3(0.05, 0.05, 0.05);
  else if (b == 1) col = vec3(4.0, 25.0, 30.0) / 63.0;
  else if (b == 2) col = vec3(8.0, 40.0, 45.0) / 63.0;
  else             col = vec3(16.0, 55.0, 60.0) / 63.0;
  frag = vec4(col * depthShade * core, core);
}`;

interface DotsGpu {
  vao: WebGLVertexArrayObject;
  positionsBuffer: WebGLBuffer;
  buckets: WebGLBuffer;
  buffers: ReturnType<typeof initDots>;
  unitQuad: WebGLBuffer;
  prevT: number;
}

let gpu: DotsGpu | null = null;
let lastGl: WebGL2RenderingContext | null = null;
let sceneStartT: number | null = null;

const PHASE1_DUR = 5.0; // s — Lissajous opbouw
const PHASE2_DUR = 7.0; // s — Cirkel + val
const TOTAL = PHASE1_DUR + PHASE2_DUR;

function init(gl: WebGL2RenderingContext): DotsGpu {
  const buffers = initDots();

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  // Dummy per-vertex quad (gewoon één punt, gl.POINTS heeft maar 1 vertex per dot nodig).
  const unitQuad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, unitQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.STATIC_DRAW);

  // Instance-buffer voor posities (DYNAMIC: per frame geüpdatet).
  const positionsBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 1);

  // Instance-buffer voor kleur-buckets (STATIC).
  const buckets = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buckets);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.colorBuckets, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  gl.bindVertexArray(null);

  return { vao, positionsBuffer, buckets, buffers, unitQuad, prevT: 0 };
}

export const dotsScene: SceneFn = ({ t, renderer }) => {
  const gl = renderer.gl;
  if (gpu === null || lastGl !== gl) {
    gpu = init(gl);
    lastGl = gl;
    sceneStartT = t;
    gpu.prevT = t;
  }
  const localT = t - (sceneStartT ?? t);
  const dt = Math.max(0, Math.min(0.1, t - gpu.prevT));
  gpu.prevT = t;

  // Per-fase: emit-formules + physics.
  if (localT < PHASE1_DUR) {
    // Lissajous (geen gravity in deze fase).
    for (let i = 0; i < DOTS_COUNT; i++) {
      emitLissajous(localT, gpu.buffers.state[i]!, i);
    }
  } else if (localT < TOTAL) {
    const tIn = localT - PHASE1_DUR;
    // Bij begin van fase 2: stoot alle dots opnieuw aan (cirkel + impuls).
    if (tIn < dt + 0.001) {
      for (let i = 0; i < DOTS_COUNT; i++) {
        emitCircleWithGravity(0, gpu.buffers.state[i]!, i);
      }
    }
    stepDots(gpu.buffers.state, dt, 9.8, -2.5);
  } else {
    // loop terug naar fase 1 zodra de scene-slot in timeline herhaalt
    sceneStartT = t;
    for (let i = 0; i < DOTS_COUNT; i++) {
      emitLissajous(0, gpu.buffers.state[i]!, i);
    }
  }
  syncPositionBuffer(gpu.buffers.state, gpu.buffers.positions);

  // Upload updated positions.
  gl.bindBuffer(gl.ARRAY_BUFFER, gpu.positionsBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpu.buffers.positions);

  // Camera + rotatie (langzame y-rotation voor parallax-gevoel).
  const proj = mat4Perspective(Math.PI / 3, renderer.aspect, 0.5, 100);
  const view = mat4Translate(0, 0, -7);
  const model = mat4RotateY(localT * 0.25);
  const mvp = mat4Multiply(proj, mat4Multiply(view, model));

  const prog = renderer.program("dots", VERT, FRAG);
  gl.useProgram(prog);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "u_mvp"), false, mvp);
  gl.uniform1f(gl.getUniformLocation(prog, "u_basePointSize"), renderer.height * 0.02);

  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  gl.bindVertexArray(gpu.vao);
  gl.drawArraysInstanced(gl.POINTS, 0, 1, DOTS_COUNT);
  gl.bindVertexArray(null);

  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
};
