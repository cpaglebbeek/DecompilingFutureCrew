// audio_sync.ts — sound + the master clock the visuals lock to.
//
// Sound: reuses the repo's chiptune3 / libopenmpt AudioWorklet to replay the
// real Second Reality module MUSIC1.S3M ("UnreaL ][ / PM", Purple Motion /
// Future Crew) — the iconic, recognisable Second Reality song. Files live in
// public/chiptune3 + public/audio and are served at BASE_URL by Vite (dev: "/",
// build: "/DecompilingFutureCrew/").
//
// Clock: a dedicated AudioContext whose currentTime is the hardware audio
// clock. Both it and the chiptune3 context start on the same user gesture and
// run off the same crystal, so the music-frame derived from this clock stays
// locked to playback. currentTime() implements the AudioClock the DisShim uses.

import type { AudioClock } from "./dis_shim.js";

interface ChiptunePlayer {
  gain: GainNode;
  setVol(v: number): void;
  load(url: string): void;
  pause(): void;
  unpause(): void;
  setRepeatCount(n: number): void;
  selectSubsong(n: number): void;
  onInitialized(cb: () => void): void;
  onMetadata(cb: () => void): void;
  onError(cb: (e: { type: string }) => void): void;
}

function basePath(): string {
  return import.meta.env.BASE_URL;
}

const DEFAULT_VOL = 0.5;

// MUSIC1.S3M ("UnreaL ][ / PM", Purple Motion) is not one song: its orderlist is
// chopped by end/skip markers into **55 subsongs** — one per demo part plus many
// 1-6 s stingers/SFX. The original STMIK player jumps to a specific order when a
// part starts; libopenmpt exposes those segments as subsongs. selectSubsong(-1)
// concatenated ALL 55 (part music + SFX) → "a few right notes, then fax".
//
// Picking the right one: spectral *flatness* (Wiener entropy) is the honest
// music-vs-noise discriminator — tonal music is low, fax/noise is high. The
// captured GLENZ reference measures 0.0168. Of the long subsongs only **#8**
// matches it (0.0147); 48/49/50 are ~4x flatter-spectrum (0.06-0.07, noisy) and
// 54 is ~noise (0.37). The earlier LTAS/chroma cosine ranking that picked #50
// was wrong — cosine similarity does not separate music from noise. So GLENZ
// plays subsong 8, looped.
const GLENZ_SUBSONG = 8;

// Playback model: MUSIC1.S3M, repeatCount(-1), then selectSubsong(-1) (= play
// ALL subsongs in sequence, then loop the whole thing).
//
// Root cause of the long-standing "hakkerige pierige bleeps, geen muziek" bug:
// the throttle-immune decodeAll ground truth proved the served module was the
// wrong one. MUSIC0.S3M ("UnreaL ][ - The 2ND Reality") decodes to sparse
// transients no matter how it is played — 19 % duty, crest factor ~34, a 141 s
// silent gap across all 17 subsongs (its libopenmpt default subsong is a 2.2 s
// stub that plain repeat=-1 just loops forever — exactly the reported symptom).
// MUSIC1.S3M ("UnreaL ][ / PM", Purple Motion) decodes to dense, continuous
// music: 79 % duty, crest ~12, a coherent 211 s song under selectSubsong(-1).
// So: switch the module to MUSIC1 and play all subsongs. A bare module load
// only plays subsong 0 (a short fragment); selectSubsong(-1) after load is what
// gives the full recognisable song.

export class AudioSync implements AudioClock {
  private ctx: AudioContext | null = null;
  private player: ChiptunePlayer | null = null;
  private started = false;
  private muted = false;
  private volume = DEFAULT_VOL;
  private clockReleased = false;

  // clock bookkeeping (so pause freezes music-time)
  private epoch = 0; // ctx.currentTime at which music-time 0 sits
  private frozenAt: number | null = null; // music-time captured at pause
  // The visual clock must not run before the music is actually sounding —
  // faithful to MAIN.C's `while(dis_musplus()<-19); dis_setmframe(0)` cue. The
  // worklet + WASM init + S3M fetch take time; until then currentTime() == 0 so
  // the animation waits at frame 0 instead of racing ahead of the music.
  private clockStarted = false;

  private analyser: AnalyserNode | null = null;

  get isStarted(): boolean {
    return this.started;
  }
  get isMuted(): boolean {
    return this.muted;
  }
  get contextState(): string {
    return this.ctx?.state ?? "none";
  }

  // Debug: peak |sample| currently flowing through the player output. >0 means
  // audio is actually being decoded and rendered (not just the clock ticking).
  debugPeak(): number {
    if (!this.ctx || !this.player) return -1;
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.player.gain.connect(this.analyser);
    }
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    return peak;
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
      // Share OUR already-resumed context with the player. Otherwise chiptune3
      // creates its own AudioContext which stays suspended (autoplay policy) and
      // is never resumed → silence. When a context is supplied chiptune3 leaves
      // its gain unconnected (destination=false), so we wire it to the output
      // ourselves. This also makes the visual clock share the audio crystal.
      const player = new Player({ context: this.ctx });
      this.player = player;
      player.gain.connect(this.ctx.destination);
      player.onInitialized(() => {
        player.setRepeatCount(-1);
        player.setVol(this.muted ? 0 : this.volume);
        player.load(`${basePath()}audio/MUSIC1.S3M`);
      });
      // Fires once the worklet has parsed the module (after load→play). Select
      // the single GLENZ subsong (the techno track) and let setRepeatCount(-1)
      // loop it — NOT subsong -1, which would chain all 55 segments (music + SFX
      // = the "fax" noise). Then release the visual clock so the animation starts
      // in sync with the first audio.
      player.onMetadata(() => {
        if (this.clockReleased) return;
        this.clockReleased = true;
        // ?subsong=N overrides the default for live auditioning (find the exact
        // GLENZ track without a redeploy); ?subsong=-1 hears the old fax amalgam.
        const q = Number(
          new URLSearchParams(location.search).get("subsong") ?? "",
        );
        const sub = Number.isFinite(q) && location.search.includes("subsong")
          ? q
          : GLENZ_SUBSONG;
        console.info(`AudioSync: GLENZ subsong = ${sub}`);
        player.selectSubsong(sub);
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
    this.clockReleased = false; // onMetadata re-releases the clock on reload
    this.player?.load(`${basePath()}audio/MUSIC1.S3M`);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.player?.setVol(this.muted ? 0 : this.volume);
  }
}
