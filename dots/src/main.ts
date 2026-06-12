// main.ts — DOTS standalone entry point.
//
// Stuurt de twee subsystemen vanuit één requestAnimationFrame-loop:
//   DotsCore     → de sim: 512 dots, 4 fase-emitters + round-robin, physics
//   DotsRenderer → zelfstandige WebGL2 instanced-POINTS renderer
//
// Net als GLENZ is DOTS audio-locked: de sim-tijd komt uit de audioklok
// (AudioSync, master clock), niet uit de rAF-delta. Zolang de DOTS-loop nog niet
// gebakken is (of decode faalt), valt de klok terug op een vrij-lopende wandklok
// zodat de demo blijft draaien (zonder geluid). De start-overlay laat Demo of
// Viewer kiezen.

import { DotsCore, type Phase } from "./dots_core.js";
import { DotsRenderer } from "./dots_renderer.js";
import { AudioSync } from "./audio_sync.js";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const renderer = new DotsRenderer(canvas);
const core = new DotsCore();
const audio = new AudioSync();

let started = false;
let paused = false;
let hudVisible = true;
let lastClock = 0; // laatst gelezen sim-tijd (seconden)
let wallEpoch = 0; // performance.now() bij start, voor de fallback-wandklok

// Sim-tijd in seconden. Voorkeur: audioklok (vast aan de muziek). Bij ontbrekende
// audio: vrij-lopende wandklok. Tijdens audio-decode: 0 → sim houdt op frame 0
// tot de muziek klinkt (getrouw aan GLENZ/MAIN.C).
function clockSeconds(): number {
  if (audio.isFailed) return (performance.now() - wallEpoch) / 1000;
  return audio.currentTime();
}

const positions = new Float32Array(512 * 3);

function renderFrame(): void {
  core.syncPositionBuffer(positions);
  renderer.draw(positions, {
    rotX: core.rotX,
    rotY: core.rotY,
    camDist: core.camDist,
    basePointSize: core.pointSize,
  });
}

function frame(): void {
  const t = clockSeconds();
  const dt = Math.min(0.1, Math.max(0, t - lastClock));
  lastClock = t;
  if (!paused) core.advance(dt);
  renderFrame();
  if (hudVisible) updateHud();
  requestAnimationFrame(frame);
}

function audioTag(): string {
  if (audio.isFailed) return " · ♪ geen audio";
  if (!audio.isClockRunning) return " · ♪ laden…";
  return audio.isMuted ? " · ♪ mute" : " · ♪";
}

function updateHud(): void {
  if (core.isViewer) {
    hud.textContent =
      `DOTS · VIEWER · fase ${core.phase} · ${core.playing ? "▶ playing" : "‖ frozen"}` +
      ` · ${core.fps} fps${audioTag()} · 1/2/3/4=fase · P=play · M=mute · sleep=draaien · scroll=zoom · shift+scroll=puntgrootte`;
  } else {
    hud.textContent =
      `DOTS · frame ${core.frame} · fase ${core.phase} · ${core.fps} fps${audioTag()}` +
      (paused ? " · PAUSED" : "") + " · M=mute";
  }
}

function startDemo(mode: "demo" | "viewer"): void {
  if (started) return;
  started = true;
  overlay.style.display = "none";
  if (mode === "viewer") core.enableViewer();
  else core.reset();
  wallEpoch = performance.now();
  lastClock = 0;
  void audio.start(); // muziek + master-klok starten op de user-gesture
  requestAnimationFrame(frame);
}

function togglePause(): void {
  if (!started || core.isViewer) return;
  paused = !paused;
  audio.setPaused(paused);
}

function onR(): void {
  if (!started) return;
  if (core.isViewer) {
    core.resetViewer();
  } else {
    core.reset();
    paused = false;
    audio.restart();
    wallEpoch = performance.now();
    lastClock = 0;
  }
}

// Deterministische preview (?frame=N): render exact één sim-frame zonder de
// rAF-loop / zonder interactie, voor screenshot-vergelijking.
const frameParam = new URLSearchParams(location.search).get("frame");
if (frameParam !== null) {
  overlay.style.display = "none";
  started = true;
  core.seekToFrame(Number(frameParam) | 0);
  renderFrame();
}

document
  .getElementById("btn-demo")!
  .addEventListener("click", () => startDemo("demo"));
document
  .getElementById("btn-viewer")!
  .addEventListener("click", () => startDemo("viewer"));

// Viewer-pointer-interactie: sleep = draaien, scroll = zoom, shift+scroll =
// puntgrootte. Mouse + touch + pen via Pointer Events (Z Fold 6-vriendelijk).
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (!core.isViewer || !started) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  core.rotateBy(e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = (e: PointerEvent): void => {
  if (!dragging) return;
  dragging = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer al losgelaten */
  }
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener(
  "wheel",
  (e) => {
    if (!core.isViewer || !started) return;
    e.preventDefault();
    if (e.shiftKey) core.pointSizeBy(e.deltaY); // shift+scroll = puntgrootte
    else core.zoomBy(e.deltaY); // scroll = camera-zoom
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (!started) {
    startDemo("demo"); // elke toets = snel-start van de demo
    return;
  }
  switch (e.key.toLowerCase()) {
    case " ":
    case "p":
      e.preventDefault();
      if (core.isViewer) core.togglePlay();
      else togglePause();
      break;
    case "1":
    case "2":
    case "3":
    case "4":
      if (core.isViewer) core.setPhase(Number(e.key) as Phase);
      break;
    case "r":
      onR();
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

// Debug-handles voor headless probing (onschadelijk in productie).
(window as unknown as { __core: DotsCore }).__core = core;

renderer.resize();
