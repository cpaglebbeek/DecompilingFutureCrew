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
  paused = false;

  constructor(entries: TimelineEntry[]) {
    if (entries.length === 0) throw new Error("Timeline needs at least one entry");
    this.entries = entries;
  }

  get currentName(): string {
    return this.entries[this.idx]?.name ?? "";
  }

  skip(): void {
    this.idx = (this.idx + 1) % this.entries.length;
    this.elapsed = 0;
  }

  back(): void {
    this.idx = (this.idx - 1 + this.entries.length) % this.entries.length;
    this.elapsed = 0;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  update(dt: number, renderer: Renderer, audio: AudioEngine): void {
    const entry = this.entries[this.idx];
    if (!entry) return;
    if (!this.paused) this.elapsed += dt * 1000;
    if (this.elapsed >= entry.durationMs) {
      this.idx = (this.idx + 1) % this.entries.length;
      this.elapsed = 0;
      return;
    }
    const tNorm = this.elapsed / entry.durationMs;
    entry.scene({ t: this.elapsed / 1000, tNorm, renderer, audio });
  }
}
