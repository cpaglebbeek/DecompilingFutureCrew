import { Renderer } from "./engine/renderer.js";
import { Timeline } from "./engine/timeline.js";
import { AudioEngine } from "./engine/audio.js";
import { Input } from "./engine/input.js";
import { Hud } from "./engine/hud.js";
import { starfieldScene } from "./scenes/starfield.js";
import { glenzScene } from "./scenes/glenz.js";
import { alkuScene } from "./scenes/alku.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const input = new Input(canvas);
const hud = new Hud();

const timeline = new Timeline([
  { name: "STARFIELD", durationMs: 8000, scene: starfieldScene },
  { name: "GLENZ",     durationMs: 10000, scene: glenzScene },
  { name: "ALKU",      durationMs: 3000, scene: alkuScene },
]);

input.onActivate = () => audio.resume();
input.onSkip = () => timeline.skip();
input.onBack = () => timeline.back();
input.onPause = () => timeline.togglePause();
input.onToggleHud = () => hud.toggle();

let prev = performance.now();
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  renderer.beginFrame();
  timeline.update(dt, renderer, audio);
  hud.tick(dt, timeline.currentName, timeline.paused);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
