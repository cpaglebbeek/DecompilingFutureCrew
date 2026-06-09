// audio_sync.ts — sound + the master clock the visuals lock to.
//
// Sound: reuses the repo's chiptune3 / libopenmpt AudioWorklet to replay the
// real Second Reality module MUSIC0.S3M ("UnreaL ][ - The 2ND Reality",
// Skaven / Future Crew). Files live in public/chiptune3 + public/audio and are
// served at BASE_URL by Vite (dev: "/", build: "/DecompilingFutureCrew/").
//
// Clock: a dedicated AudioContext whose currentTime is the hardware audio
// clock. Both it and the chiptune3 context start on the same user gesture and
// run off the same crystal, so the music-frame derived from this clock stays
// locked to playback. currentTime() implements the AudioClock the DisShim uses.

import type { AudioClock } from "./dis_shim.js";

interface ChiptunePlayer {
  setVol(v: number): void;
  load(url: string): void;
  pause(): void;
  unpause(): void;
  setRepeatCount(n: number): void;
  onInitialized(cb: () => void): void;
  onError(cb: (e: { type: string }) => void): void;
}

function basePath(): string {
  return import.meta.env.BASE_URL;
}

const DEFAULT_VOL = 0.5;

export class AudioSync implements AudioClock {
  private ctx: AudioContext | null = null;
  private player: ChiptunePlayer | null = null;
  private started = false;
  private muted = false;
  private volume = DEFAULT_VOL;

  // clock bookkeeping (so pause freezes music-time)
  private epoch = 0; // ctx.currentTime at which music-time 0 sits
  private frozenAt: number | null = null; // music-time captured at pause
  // The visual clock must not run before the music is actually sounding —
  // faithful to MAIN.C's `while(dis_musplus()<-19); dis_setmframe(0)` cue. The
  // worklet + WASM init + S3M fetch take time; until then currentTime() == 0 so
  // the animation waits at frame 0 instead of racing ahead of the music.
  private clockStarted = false;

  get isStarted(): boolean {
    return this.started;
  }
  get isMuted(): boolean {
    return this.muted;
  }

  // Must be called from a user gesture (autoplay policy).
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      await this.ctx.resume();
      // NB: do not start the clock here — only once the module is loaded below.

      const mod = await import(
        /* @vite-ignore */ `${basePath()}chiptune3/chiptune3.js`
      );
      const Player = (
        mod as { ChiptuneJsPlayer: new (cfg: object) => ChiptunePlayer }
      ).ChiptuneJsPlayer;
      const player = new Player({});
      this.player = player;
      player.onInitialized(() => {
        player.setRepeatCount(-1);
        player.setVol(this.muted ? 0 : this.volume);
        player.load(`${basePath()}audio/MUSIC0.S3M`);
        // The S3M is now streaming into the worklet — release the visual clock.
        if (this.ctx) {
          this.epoch = this.ctx.currentTime;
          this.clockStarted = true;
        }
      });
      player.onError((e) => console.warn("AudioSync: chiptune3 error", e.type));
    } catch (e) {
      console.warn("AudioSync: failed to start", e);
    }
  }

  // AudioClock: seconds of music, frozen while paused. Reads 0 until the module
  // has loaded, so the visuals hold at frame 0 until the music actually starts.
  currentTime(): number {
    if (this.frozenAt !== null) return this.frozenAt;
    if (!this.ctx || !this.clockStarted) return 0;
    return this.ctx.currentTime - this.epoch;
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) {
      if (this.frozenAt === null) this.frozenAt = this.currentTime();
      this.player?.pause();
      void this.ctx.suspend();
    } else {
      // re-anchor epoch so currentTime resumes from the frozen value
      void this.ctx.resume().then(() => {
        if (this.ctx && this.frozenAt !== null) {
          this.epoch = this.ctx.currentTime - this.frozenAt;
        }
        this.frozenAt = null;
      });
      this.player?.unpause();
    }
  }

  // Restart music + clock from zero.
  restart(): void {
    if (!this.ctx) return;
    this.epoch = this.ctx.currentTime;
    this.frozenAt = null;
    this.player?.load(`${basePath()}audio/MUSIC0.S3M`);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.player?.setVol(this.muted ? 0 : this.volume);
  }
}
