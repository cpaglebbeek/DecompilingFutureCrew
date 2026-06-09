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
    hud.textContent =
      `GLENZ · mframe ${core.musicFrame} · ${core.fps} fps` +
      (paused ? " · PAUSED" : "") +
      (audio.isMuted ? " · MUTED" : "");
  }
  requestAnimationFrame(frame);
}

async function startDemo(): Promise<void> {
  if (audio.isStarted) return;
  overlay.style.display = "none";
  await audio.start();
  dis.partStart();
  core.reset();
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
  audio.restart();
  dis.partStart();
  core.reset();
  paused = false;
  audio.setPaused(false);
}

overlay.addEventListener("click", () => void startDemo());

window.addEventListener("keydown", (e) => {
  if (!audio.isStarted) {
    void startDemo();
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

resize();
