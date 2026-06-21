// dots_renderer.ts — zelfstandige WebGL2 instanced-POINTS renderer voor DOTS.
//
// Gelift uit src/scenes/dots.ts + src/engine/renderer.ts: één
// drawArraysInstanced(gl.POINTS, …)-call tekent alle 512 dots, met
// perspective-correcte point-size en additive blending. De GLSL komt
// rechtstreeks uit decomp/dots/port.vert + decomp/dots/port.frag
// (Vite `?raw`-import), zodat de shader-bron gedeeld blijft met de decomp-doc.
//
// 1993-tegenhanger: drawdots() in DOTS/ASM.ASM (per-dot rotate → project →
// depth-bucket → pixel-write). Hier vervangen door de GPU.

import VERT from "../../decomp/dots/port.vert?raw";
import FRAG from "../../decomp/dots/port.frag?raw";
import {
  mat4Multiply,
  mat4Perspective,
  mat4RotateX,
  mat4RotateY,
  mat4Translate,
} from "../../decomp/glenz/port.js";
import { DOTS_COUNT } from "./dots_core.js";

export interface DotsCamera {
  rotX: number; // kanteling om x-as (rad)
  rotY: number; // draai om y-as (rad)
  camDist: number; // camera-afstand (world-units)
  basePointSize: number; // basis-puntgrootte (× hoogte-factor)
}

export class DotsRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private positionsBuffer: WebGLBuffer;
  private positions = new Float32Array(DOTS_COUNT * 3);
  private uMvp: WebGLUniformLocation | null;
  private uPointSize: WebGLUniformLocation | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("DOTS: WebGL2 niet ondersteund");
    this.gl = gl;

    this.prog = this.link(VERT, FRAG);
    this.uMvp = gl.getUniformLocation(this.prog, "u_mvp");
    this.uPointSize = gl.getUniformLocation(this.prog, "u_basePointSize");

    // VAO met twee instance-attributen: posities (dynamisch) + kleur-buckets
    // (statisch, pseudo-random verdeeld over de 4 teal-tinten uit cols[]).
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.positionsBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 1);

    const buckets = new Float32Array(DOTS_COUNT);
    for (let i = 0; i < DOTS_COUNT; i++) buckets[i] = (i * 7919) & 3;
    const bucketBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bucketBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, buckets, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindVertexArray(null);

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  // Houd de backing-store gelijk aan de CSS-box, DPR-capped op 2.
  resize(): void {
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * this.dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  get aspect(): number {
    return this.canvas.width / Math.max(1, this.canvas.height);
  }

  // Tekenen: posities komen via syncPositionBuffer in `this.positions`.
  draw(positions: Float32Array, cam: DotsCamera): void {
    const gl = this.gl;
    this.resize();

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // upload de verse posities
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionsBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    // camera + model-rotatie (kantel om x, draai om y)
    const proj = mat4Perspective(Math.PI / 3, this.aspect, 0.1, 200);
    const view = mat4Translate(0, 0, -cam.camDist);
    const model = mat4Multiply(mat4RotateX(cam.rotX), mat4RotateY(cam.rotY));
    const mvp = mat4Multiply(proj, mat4Multiply(view, model));

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.uMvp, false, mvp);
    gl.uniform1f(this.uPointSize, this.canvas.height * 0.001 * cam.basePointSize);

    // additive, geen depth-write (translucente puntenwolk)
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.POINTS, 0, 1, DOTS_COUNT);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  private link(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, vertSrc);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error("DOTS: createProgram faalde");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`DOTS link-error: ${gl.getProgramInfoLog(prog) ?? ""}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private compile(type: GLenum, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type);
    if (!sh) throw new Error("DOTS: createShader faalde");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? "";
      gl.deleteShader(sh);
      throw new Error(`DOTS shader compile-error: ${log}\n--- bron ---\n${src}`);
    }
    return sh;
  }
}
