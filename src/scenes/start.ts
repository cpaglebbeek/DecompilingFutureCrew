import type { SceneFn } from "./_scene.js";

export const startScene: SceneFn = ({ tNorm, renderer }) => {
  const v = Math.sin(tNorm * Math.PI) * 0.25;
  renderer.clearTo(v * 0.1, v * 0.2, v * 0.45);
};
