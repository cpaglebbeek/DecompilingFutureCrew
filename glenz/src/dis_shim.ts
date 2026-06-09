// dis_shim.ts — browser stand-in for Second Reality's DIS (Demo Interrupt
// Server, int 0FCh). The real DIS provides VGA-frame counting, an Amiga-style
// copper (raster-synced palette callbacks), retrace wait, and inter-part
// message buffers. Here the "music frame" is derived from the audio clock so
// visuals stay locked to the music and never desync (per the spec).
//
// Original calls used by GLENZ/MAIN.C:
//   dis_partstart, dis_exit, dis_musplus, dis_setmframe, dis_getmframe,
//   dis_waitb, dis_setcopper, dis_indemo.

import { TICK_HZ } from "./glenz_data.js";

export interface AudioClock {
  // seconds of music played, monotonic, frozen while paused
  currentTime(): number;
}

type CopperCb = () => void;

export class DisShim {
  private clock: AudioClock;
  private mframeOffset = 0; // dis_setmframe baseline
  private partStartFrame = 0; // local timer origin
  private lastWaitFrame = 0;
  private exited = false;
  private copper: CopperCb | null = null;

  constructor(clock: AudioClock) {
    this.clock = clock;
  }

  private rawFrame(): number {
    return Math.floor(this.clock.currentTime() * TICK_HZ);
  }

  // dis_partstart — reset the part-local timer, mark GLENZ active.
  partStart(): void {
    this.partStartFrame = this.rawFrame();
    this.lastWaitFrame = this.partStartFrame;
    this.exited = false;
  }

  // dis_setmframe / dis_getmframe — music-frame counter (audio-derived).
  setMframe(n: number): void {
    this.mframeOffset = this.rawFrame() - n;
  }
  getMframe(): number {
    return this.rawFrame() - this.mframeOffset;
  }

  // dis_waitb — in the original, blocks until the next VGA retrace and returns
  // how many frames elapsed. Here it is non-blocking: returns the number of
  // ticks since the previous call (the driver advances the sim that many ticks
  // — "drop visual frames, never desync audio").
  waitb(): number {
    const now = this.rawFrame();
    const elapsed = Math.max(0, now - this.lastWaitFrame);
    this.lastWaitFrame = now;
    return elapsed;
  }

  // dis_musplus — music sync cue delta. MAIN.C waits `while(dis_musplus()<-19)`
  // for the music to reach its start. We expose (musicFrame - cue) so the wait
  // resolves as soon as playback begins.
  musplus(): number {
    return this.getMframe();
  }

  // dis_setcopper — register a per-frame palette/raster callback (slot ignored;
  // a single callback is enough for GLENZ's copper() palette upload).
  setCopper(cb: CopperCb | null): void {
    this.copper = cb;
  }
  runCopper(): void {
    this.copper?.();
  }

  // dis_indemo — true under the loader, false standalone. We are standalone.
  indemo(): boolean {
    return false;
  }

  // dis_exit — has the part been asked to stop.
  exit(): boolean {
    return this.exited;
  }
  requestExit(): void {
    this.exited = true;
  }
}
