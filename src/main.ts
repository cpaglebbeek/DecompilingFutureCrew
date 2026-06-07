import { Renderer } from "./engine/renderer.js";
import { Timeline } from "./engine/timeline.js";
import { AudioEngine } from "./engine/audio.js";
import { Input } from "./engine/input.js";
import { startScene } from "./scenes/start.js";
import { alkuScene } from "./scenes/alku.js";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const input = new Input(canvas);

const timeline = new Timeline([
  { name: "start", durationMs: 3000, scene: startScene },
  { name: "alku",  durationMs: 4000, scene: alkuScene },
]);

input.onActivate = () => audio.resume();
input.onSkip = () => timeline.skip();

let prev = performance.now();
function frame(now: number) {
  const dt = (now - prev) / 1000;
  prev = now;
  renderer.beginFrame();
  timeline.update(dt, renderer, audio);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
