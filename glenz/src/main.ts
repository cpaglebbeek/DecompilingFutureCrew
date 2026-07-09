// main.ts — GLENZ standalone entry point.
//
// Wires the four subsystems together and drives them from a single
// requestAnimationFrame loop:
//   AudioSync   → owns the master clock (AudioContext.currentTime) + music
//   DisShim     → derives the music-frame counter from that clock
//   GlenzCore   → advances the sim per music-tick and renders into the VGA
//   VGA         → 320x200 indexed framebuffer, presented pixelated to canvas
//
// Audio (and thus the clock) can only start from a user gesture, so the first
// pointer/key press resolves the start overlay before the sim begins ticking.

import { VGA } from "./vga.js";
import { DisShim } from "./dis_shim.js";
import { AudioSync } from "./audio_sync.js";
import { GlenzCore } from "./glenz_core.js";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("GLENZ: 2D canvas context unavailable");

const overlay = document.getElementById("overlay") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const audio = new AudioSync();
const dis = new DisShim(audio);
const vga = new VGA();
const core = new GlenzCore(vga, dis);

let paused = false;
let hudVisible = true;
let lastT = performance.now();
let mode: "demo" | "viewer" = "demo";

// keep the backing canvas sized to its CSS box (DPR-capped, pixelated blit)
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener("resize", resize);

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  resize();
  dis.runCopper();
  core.render(dt, canvas.width, canvas.height, ctx!);
  if (hudVisible) {
    hud.textContent = core.isViewer
      ? `GLENZ · VIEWER · sleep=draaien · shift=binnenbal draaien · ctrl=binnenbal verplaatsen · scroll=binnenbal grootte · ctrl+scroll=zoom · ${core.fps} fps` +
        (audio.isMuted ? " · MUTED" : "")
      : `GLENZ · mframe ${core.musicFrame} · ${core.fps} fps` +
        (paused ? " · PAUSED" : "") +
        (audio.isMuted ? " · MUTED" : "");
  }
  requestAnimationFrame(frame);
}

async function startDemo(selectedMode: "demo" | "viewer"): Promise<void> {
  if (audio.isStarted) return;
  mode = selectedMode;
  overlay.style.display = "none";
  await audio.start();
  dis.partStart();
  if (mode === "viewer") core.enableViewer();
  else core.reset();
  lastT = performance.now();
  requestAnimationFrame(frame);
}

function togglePause(): void {
  if (!audio.isStarted) return;
  paused = !paused;
  audio.setPaused(paused);
}

function restart(): void {
  if (!audio.isStarted) return;
  if (core.isViewer) {
    core.resetViewer(); // R = recenter the object in viewer mode
    return;
  }
  audio.restart();
  dis.partStart();
  core.reset();
  paused = false;
  audio.setPaused(false);
}

// Deterministic preview (?frame=N): render one sim frame without audio so the
// scene can be screenshotted and compared to the reference video frames.
const frameParam = new URLSearchParams(location.search).get("frame");
if (frameParam !== null) {
  overlay.style.display = "none";
  resize();
  core.renderAtFrame(Number(frameParam) | 0, canvas.width, canvas.height, ctx);
}

document
  .getElementById("btn-demo")!
  .addEventListener("click", () => void startDemo("demo"));
document
  .getElementById("btn-viewer")!
  .addEventListener("click", () => void startDemo("viewer"));

// Viewer-mode pointer interaction: drag to rotate, wheel to zoom. Works for mouse
// + touch + pen via Pointer Events (Z Fold 6 friendly).
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (!core.isViewer || !audio.isStarted) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const mode = e.ctrlKey ? "inner-move" : e.shiftKey ? "inner-rot" : "all";
  core.rotateBy(e.clientX - lastX, e.clientY - lastY, mode);
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = (e: PointerEvent): void => {
  if (!dragging) return;
  dragging = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener(
  "wheel",
  (e) => {
    if (!core.isViewer || !audio.isStarted) return;
    e.preventDefault();
    if (e.ctrlKey) core.zoomBy(e.deltaY); // Ctrl+wheel = camera zoom
    else core.scaleInnerBy(e.deltaY); // wheel = inner-ball scale
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (!audio.isStarted) {
    void startDemo("demo"); // any key = quick-start the timed demo
    return;
  }
  switch (e.key.toLowerCase()) {
    case " ":
    case "p":
      e.preventDefault();
      togglePause();
      break;
    case "r":
      restart();
      break;
    case "m":
      audio.toggleMute();
      break;
    case "h":
      hudVisible = !hudVisible;
      hud.style.display = hudVisible ? "block" : "none";
      break;
  }
});

// Debug handles for headless audio/visual probing (harmless in production).
(window as unknown as { __audio: AudioSync; __core: GlenzCore }).__audio = audio;
(window as unknown as { __audio: AudioSync; __core: GlenzCore }).__core = core;

resize();
