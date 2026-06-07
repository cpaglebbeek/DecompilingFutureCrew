import type { SceneFn } from "./_scene.js";

export const alkuScene: SceneFn = ({ tNorm, renderer }) => {
  const v = Math.sin(tNorm * Math.PI);
  renderer.clearTo(v * 0.5, v * 0.05, v * 0.05);
};
