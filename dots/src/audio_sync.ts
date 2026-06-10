// audio_sync.ts — geluid + de master-klok waar de DOTS-visuals op vastzitten.
//
// Zelfde principe als GLENZ (glenz/src/audio_sync.ts): een *vooraf-gerenderde*
// loop uit de echte Second Reality-module MUSIC1.S3M ("UnreaL ][" / Purple
// Motion, Future Crew), geserveerd als statisch Opus-in-Ogg-bestand
// (public/audio/dots_loop.ogg) en gapless afgespeeld via een
// AudioBufferSourceNode(loop=true).
//
// Waarom gebakken, niet live: MUSIC1.S3M is ÉÉN doorlopende song. De originele
// STMIK-player houdt 'm spelend terwijl de demo-parts (DIS) er enkel op syncen
// via 15 +++ skip-markers; libopenmpt leest die als 55 "subsongs". DOTS rijdt
// mee op het segment dat klinkt wanneer DOTS in de demo-volgorde aan de beurt
// is. Welk subsong dat is, is per oor geverifieerd; de loop wordt gebakken met
// tools/bake_dots_loop.mjs (matched-splice + equal-power crossfade).
//
// Klok: een eigen AudioContext waarvan currentTime de hardware-audioklok is. De
// buffer-source start op dezelfde user-gesture en loopt op hetzelfde kristal,
// dus het uit deze klok afgeleide sim-tempo blijft vast aan de playback.
//
// Fallback: zolang dots_loop.ogg nog niet bestaat (of decode faalt), markeert
// `isFailed` dat er geen audioklok is, zodat main.ts terugvalt op een vrij-
// lopende wandklok en de demo gewoon blijft draaien (zonder geluid).

function basePath(): string {
  return import.meta.env.BASE_URL;
}

const DEFAULT_VOL = 0.5;

// Vooraf-gerenderde DOTS-loop. Her-bak met tools/bake_dots_loop.mjs.
const DOTS_AUDIO = "audio/dots_loop.ogg";

export class AudioSync {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private started = false;
  private muted = false;
  private volume = DEFAULT_VOL;
  private failed = false;

  // klok-boekhouding (zodat pause de muziek-tijd bevriest)
  private epoch = 0; // ctx.currentTime waarop muziek-tijd 0 ligt
  private frozenAt: number | null = null; // muziek-tijd vastgelegd bij pause
  // De visuele klok mag niet lopen vóór de muziek echt klinkt — getrouw aan
  // MAIN.C's "wacht tot de muziek begint". Tot decode klaar is, is currentTime
  // 0 en houdt de animatie op frame 0.
  private clockStarted = false;

  private analyser: AnalyserNode | null = null;

  get isStarted(): boolean {
    return this.started;
  }
  get isMuted(): boolean {
    return this.muted;
  }
  // Geen bruikbare audioklok (asset ontbreekt / decode faalde) → main.ts valt
  // terug op een vrij-lopende wandklok zodat de demo blijft draaien.
  get isFailed(): boolean {
    return this.failed;
  }
  // True zodra de loop daadwerkelijk klinkt en de klok loopt.
  get isClockRunning(): boolean {
    return this.clockStarted;
  }
  get contextState(): string {
    return this.ctx?.state ?? "none";
  }

  // Debug: piek |sample| die nu door de output stroomt. >0 = er klinkt echt
  // audio (niet enkel de klok die tikt).
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

  // Moet vanuit een user-gesture aangeroepen worden (autoplay-policy).
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

      const res = await fetch(`${basePath()}${DOTS_AUDIO}`);
      if (!res.ok) throw new Error(`dots_loop.ogg: HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(bytes);
      this.playFromStart();
    } catch (e) {
      // Geen audio beschikbaar — meld het en laat main.ts vrij-lopen.
      this.failed = true;
      console.warn("AudioSync(DOTS): geen audioklok, val terug op wandklok", e);
    }
  }

  // (Her)maak de loopende source en anker de klok op muziek-tijd 0.
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

  // Seconden muziek, bevroren tijdens pause. Leest 0 tot de loop gedecodeerd is,
  // zodat de visuals op frame 0 wachten tot de muziek echt start.
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
      void this.ctx.resume().then(() => {
        if (this.ctx && this.frozenAt !== null) {
          this.epoch = this.ctx.currentTime - this.frozenAt;
        }
        this.frozenAt = null;
      });
    }
  }

  // Herstart muziek + klok vanaf nul.
  restart(): void {
    if (!this.ctx) return;
    this.playFromStart();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }
}
