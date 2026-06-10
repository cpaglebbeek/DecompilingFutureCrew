// audio_sync.ts — sound + the master clock the visuals lock to.
//
// Sound: a *pre-rendered* loop of the GLENZ techno track, baked once offline
// from the real Second Reality module MUSIC1.S3M ("UnreaL ][ / PM", Purple
// Motion / Future Crew), orders 50–60 (the +++-delimited GLENZ section). It is
// served as a static Opus-in-Ogg file (public/audio/glenz_loop.ogg) and played
// gapless via an AudioBufferSourceNode(loop=true).
//
// Why baked, not live: MUSIC1.S3M is ONE continuous song. The original STMIK
// player keeps it playing while the demo's DIS (Demo Interrupt Server) parts
// merely *sync* to it via 15 +++ skip-markers in the orderlist. libopenmpt reads
// those markers as 55 "subsongs" — so every live selectSubsong()/repeat path
// either fragmented the song into 1–6 s stingers or chained part-music WITH the
// interleaved SFX ("a few right notes, then fax"). Picking one order range
// offline and rendering it linearly is the only reliable way to get the clean
// GLENZ loop, so we bake it and ship audio, not a player.
//
// Clock: a dedicated AudioContext whose currentTime is the hardware audio clock.
// The buffer source starts on the same user gesture and runs off the same
// crystal, so the music-frame derived from this clock stays locked to playback.
// currentTime() implements the AudioClock the DisShim uses.

import type { AudioClock } from "./dis_shim.js";

function basePath(): string {
  return import.meta.env.BASE_URL;
}

const DEFAULT_VOL = 0.5;

// Pre-rendered GLENZ loop: MUSIC1.S3M orders 50–60, the techno section, baked
// offline via the chiptune3 worklet's linear-stitch render (decodeLinear over
// the +++-delimited order range), then encoded to Opus-in-Ogg. 22.5 s, spectral
// flatness 0.0178 ≈ the captured reference's 0.0168 — i.e. measured as music,
// not noise. Re-render: see prompts/ + the audition A/B page.
const GLENZ_AUDIO = "audio/glenz_loop.ogg";

export class AudioSync implements AudioClock {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private started = false;
  private muted = false;
  private volume = DEFAULT_VOL;

  // clock bookkeeping (so pause freezes music-time)
  private epoch = 0; // ctx.currentTime at which music-time 0 sits
  private frozenAt: number | null = null; // music-time captured at pause
  // The visual clock must not run before the music is actually sounding —
  // faithful to MAIN.C's `while(dis_musplus()<-19); dis_setmframe(0)` cue. The
  // fetch + decodeAudioData take time; until then currentTime() == 0 so the
  // animation waits at frame 0 instead of racing ahead of the music.
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

  // Debug: peak |sample| currently flowing through the output. >0 means audio is
  // actually being rendered (not just the clock ticking).
  debugPeak(): number {
    if (!this.ctx || !this.gain) return -1;
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.gain.connect(this.analyser);
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

      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.gain.connect(this.ctx.destination);

      // Fetch + decode the baked loop. Only once it is decoded and the source is
      // started do we release the clock, so the visuals hold at frame 0 until the
      // music actually sounds.
      const res = await fetch(`${basePath()}${GLENZ_AUDIO}`);
      const bytes = await res.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(bytes);
      this.playFromStart();
    } catch (e) {
      console.warn("AudioSync: failed to start", e);
    }
  }

  // (Re)create the looping source and anchor the clock at music-time 0.
  private playFromStart(): void {
    if (!this.ctx || !this.gain || !this.buffer) return;
    this.source?.stop();
    this.source?.disconnect();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain);
    src.start();
    this.source = src;
    this.epoch = this.ctx.currentTime;
    this.frozenAt = null;
    this.clockStarted = true;
  }

  // AudioClock: seconds of music, frozen while paused. Reads 0 until the loop has
  // decoded, so the visuals hold at frame 0 until the music actually starts.
  currentTime(): number {
    if (this.frozenAt !== null) return this.frozenAt;
    if (!this.ctx || !this.clockStarted) return 0;
    return this.ctx.currentTime - this.epoch;
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) {
      if (this.frozenAt === null) this.frozenAt = this.currentTime();
      void this.ctx.suspend();
    } else {
      // re-anchor epoch so currentTime resumes from the frozen value
      void this.ctx.resume().then(() => {
        if (this.ctx && this.frozenAt !== null) {
          this.epoch = this.ctx.currentTime - this.frozenAt;
        }
        this.frozenAt = null;
      });
    }
  }

  // Restart music + clock from zero.
  restart(): void {
    if (!this.ctx) return;
    this.playFromStart();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }
}
