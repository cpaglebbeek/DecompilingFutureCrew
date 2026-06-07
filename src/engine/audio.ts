// AudioEngine — chiptune3 (libopenmpt AudioWorklet) wrapper voor S3M-playback.
// Behoeft user-gesture om AudioContext te starten.
//
// Track: SECONDREALITY MUSIC0.S3M ("UnreaL ][ - The 2ND Reality" door Skaven /
// Future Crew, 1993). Source onder Unlicense (public domain).
//
// chiptune3 zelf (MIT) en libopenmpt-worklet (BSD) staan in public/chiptune3/
// zodat de browser de worklet-files met hun originele relatieve imports kan
// laden — Vite bundelt geen worklets recursief, daarom geen npm-dep.

interface ChiptunePlayer {
  setVol(v: number): void;
  load(url: string): void;
  stop(): void;
  pause(): void;
  unpause(): void;
  togglePause(): void;
  setRepeatCount(n: number): void;
  onInitialized(cb: () => void): void;
  onMetadata(cb: (meta: { title?: string; artist?: string }) => void): void;
  onError(cb: (e: { type: string }) => void): void;
}

const DEFAULT_VOL = 0.45;

function basePath(): string {
  // Vite injecteert BASE_URL = '/DecompilingFutureCrew/' bij build, '/' bij dev.
  return import.meta.env.BASE_URL;
}

export class AudioEngine {
  private player: ChiptunePlayer | null = null;
  private volume = DEFAULT_VOL;
  private muted = false;
  private started = false;
  private trackTitle = "";

  get isMuted(): boolean { return this.muted; }
  get currentTrackTitle(): string { return this.trackTitle; }

  resume(): void {
    if (this.started) return;
    this.started = true;
    void this.startPlayer();
  }

  private async startPlayer(): Promise<void> {
    try {
      const mod = await import(/* @vite-ignore */ `${basePath()}chiptune3/chiptune3.js`);
      const Player = (mod as { ChiptuneJsPlayer: new (cfg: object) => ChiptunePlayer }).ChiptuneJsPlayer;
      const player = new Player({});
      this.player = player;
      player.onInitialized(() => {
        player.setRepeatCount(-1);
        player.setVol(this.muted ? 0 : this.volume);
        player.load(`${basePath()}audio/MUSIC0.S3M`);
      });
      player.onMetadata((meta) => {
        this.trackTitle = meta.title ?? meta.artist ?? "";
      });
      player.onError((e) => {
        console.warn("AudioEngine: chiptune3 error", e.type);
      });
    } catch (e) {
      console.warn("AudioEngine: failed to start", e);
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.player?.setVol(this.muted ? 0 : this.volume);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.muted) this.player?.setVol(this.volume);
  }

  setPaused(paused: boolean): void {
    if (!this.player) return;
    if (paused) this.player.pause();
    else this.player.unpause();
  }
}
