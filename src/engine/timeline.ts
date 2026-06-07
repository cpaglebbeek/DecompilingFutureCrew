import type { Renderer } from "./renderer.js";
import type { AudioEngine } from "./audio.js";

export interface SceneCtx {
  t: number;
  tNorm: number;
  renderer: Renderer;
  audio: AudioEngine;
}

export type SceneFn = (ctx: SceneCtx) => void;

export interface TimelineEntry {
  name: string;
  durationMs: number;
  scene: SceneFn;
}

export class Timeline {
  private entries: TimelineEntry[];
  private idx = 0;
  private elapsed = 0;

  constructor(entries: TimelineEntry[]) {
    this.entries = entries;
  }

  skip(): void {
    this.idx = (this.idx + 1) % this.entries.length;
    this.elapsed = 0;
  }

  update(dt: number, renderer: Renderer, audio: AudioEngine): void {
    this.elapsed += dt * 1000;
    const entry = this.entries[this.idx];
    if (!entry) return;
    if (this.elapsed >= entry.durationMs) {
      this.idx = (this.idx + 1) % this.entries.length;
      this.elapsed = 0;
      return;
    }
    const tNorm = this.elapsed / entry.durationMs;
    entry.scene({ t: this.elapsed / 1000, tNorm, renderer, audio });
  }
}
