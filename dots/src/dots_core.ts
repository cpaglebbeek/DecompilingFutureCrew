// dots_core.ts — de DOTS-scene simulatie + frame-driver.
//
// Een getrouwe (niet byte-exacte) reinterpretatie van de DOTS-part uit
// Second Reality (Future Crew, 1993): 512 particles met gravity-physics die
// door 4 emitter-fases bewegen. Bron: SecondReality_source/DOTS/MAIN.C +
// ASM.ASM (zie decomp/dots/ASM_NOTES.md voor de mapping-tabel).
//
// Kernpunten van het origineel die hier semantisch zijn overgenomen:
//   - één globale frame-teller (max ~2450 ≈ 35s @70Hz)
//   - round-robin emit: per tick wordt ÉÉN dot opnieuw geëmit, zodat de wolk
//     geleidelijk van de ene fase-vorm naar de volgende overgaat
//   - per-fase emitter-formules (Lissajous / cirkel+val / spiraal / scatter)
//   - physics: yadd += gravity; y += yadd; bounce op de vloer met demping
//   - rotatie om de y-as (xz-rotatie) die vanaf fase 4 vrij uittolt
//
// Modern reinterpretatie: gerekend in genormaliseerde float-tijd en
// float-coördinaten i.p.v. 16-bit fixed-point. Geen audio gekoppeld in deze
// ronde (zie dots/README.md "Approximations").

export const DOTS_COUNT = 512;

// Globale frame-grenzen van de choreografie (origineel @70Hz). We tikken de
// sim op een vaste 70 Hz-klok zodat deze drempels 1-op-1 kloppen met de bron.
export const TICK_HZ = 70;
export const PHASE1_END = 500; // Lissajous opbouw
export const PHASE2_END = 900; // cirkel + val
export const PHASE3_END = 1700; // spiraal
export const PHASE4_END = 2360; // random scatter + val
export const FRAME_MAX = 2450; // einde choreografie → loopt terug

// De 1993-emitters rekenen in grote integer-units (sin-tabel ×16384, posities
// tot ±16384, y=8000). We schalen alles met WORLD_SCALE naar een handzame
// world-ruimte rond de oorsprong zodat de camera-afstanden klein blijven.
const WORLD_SCALE = 1 / 4000;

// sin1024-equivalent: 1024-entry fixed-point sine-LUT uit SIN1024.INC,
// hier benaderd met Math.sin. Geeft een waarde in [-16384, 16384] (Q14) zoals
// het origineel, zodat de emitter-schalingen (×40, /8, +128 …) hetzelfde
// gedrag houden.
const SIN_AMP = 16384;
function sin1024(i: number): number {
  return Math.sin(((i & 1023) / 1024) * 2 * Math.PI) * SIN_AMP;
}

// Vloer-niveau (gravitybottom) waarop dots stuiteren, in 1993-units.
const GRAVITY_BOTTOM = 6000;
// Demping bij bounce: yadd = -yadd*13/16 (MAIN.C).
const BOUNCE_NUM = 13;
const BOUNCE_DEN = 16;

export type Phase = 1 | 2 | 3 | 4;

export interface Dot {
  x: number;
  y: number;
  z: number;
  yadd: number;
  f: number; // per-dot emitter-fase-teller (round-robin opgehoogd)
}

interface SimState {
  frame: number; // globale frame-teller (float, op 70 Hz)
  gravity: number; // velocity-toename per tick (yadd += gravity)
  rot: number; // xz-rotatiehoek in radialen
  rotSpeed: number; // rotatiesnelheid (graden→rad per tick)
  emitCursor: number; // round-robin index van de volgende te emitten dot
  dots: Dot[];
}

function makeDots(): Dot[] {
  const dots: Dot[] = new Array(DOTS_COUNT);
  for (let i = 0; i < DOTS_COUNT; i++) {
    dots[i] = { x: 0, y: 0, z: 0, yadd: 0, f: i * 7 };
  }
  return dots;
}

function initialState(): SimState {
  return {
    frame: 0,
    gravity: 3, // MAIN.C: gravity init 3
    rot: 0,
    rotSpeed: 0.0025, // langzame basis-rotatie, dichtbij ±rotsin/rotcos-tempo
    emitCursor: 0,
    dots: makeDots(),
  };
}

// Bepaal de actieve fase uit de globale frame-teller.
export function phaseForFrame(frame: number): Phase {
  if (frame < PHASE1_END) return 1;
  if (frame < PHASE2_END) return 2;
  if (frame < PHASE3_END) return 3;
  return 4;
}

// xorshift32 PRNG — vervangt het origineel se rand() in fase 4 deterministisch,
// zodat ?frame=N reproduceerbaar is.
let rngState = 0x1234abcd >>> 0;
function resetRng(): void {
  rngState = 0x1234abcd >>> 0;
}
function rand16384(): number {
  // levert [0, 32768) zoals een 15-bit rand() in 1993.
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  rngState >>>= 0;
  return rngState & 0x7fff;
}

// Emit-formules per fase (MAIN.C:196-282). `f` is de per-dot fase-teller,
// `frame` de globale teller (voor de spiraal-"ademing" en scatter-grav).
// Coördinaten in 1993-units; pas in syncPositionBuffer schalen we naar world.

function emitPhase1(d: Dot, frame: number): void {
  // Lissajous opbouw: x=sin(f*11)*40, y=cos(f*13)*10-dropper, z=sin(f*17)*40.
  // "dropper" laat de wolk geleidelijk inzakken; benaderd met de frame-fractie.
  const f = d.f;
  const dropper = (frame / PHASE1_END) * 1200;
  d.x = (sin1024(f * 11) / SIN_AMP) * 40 * 100;
  d.y = (sin1024(f * 13 + 256) / SIN_AMP) * 10 * 100 - dropper; // cos = sin+256
  d.z = (sin1024(f * 17) / SIN_AMP) * 40 * 100;
  d.yadd = 0;
}

function emitPhase2(d: Dot): void {
  // Cirkel + val: x=cos(f*15)*55, y hoog, z=sin(f*15)*55, yadd=-260 (omhoog,
  // daarna trekt gravity het terug). y- = omhoog in 1993-conventie.
  const f = d.f;
  d.x = (sin1024(f * 15 + 256) / SIN_AMP) * 55 * 100;
  d.y = -GRAVITY_BOTTOM; // dropper: start hoog (boven de vloer)
  d.z = (sin1024(f * 15) / SIN_AMP) * 55 * 100;
  d.yadd = -260; // opwaartse impuls
}

function emitPhase3(d: Dot, frame: number): void {
  // Spiraal: a = sin1024[frame&1023]/8 (ademt mee met de globale sinus → de
  // spiraal pulseert in/uit), x=cos(f*66)*a, y=8000, z=sin(f*66)*a, yadd=-300.
  const f = d.f;
  const a = sin1024(frame) / 8;
  d.x = (sin1024(f * 66 + 256) / SIN_AMP) * a;
  d.y = -8000;
  d.z = (sin1024(f * 66) / SIN_AMP) * a;
  d.yadd = -300;
}

function emitPhase4(d: Dot): void {
  // Random scatter + val: x=rand-16384, y=8000-rand/2, z=rand-16384, yadd=0.
  d.x = rand16384() - 16384;
  d.y = -8000 + rand16384() / 2;
  d.z = rand16384() - 16384;
  d.yadd = 0;
}

function emitDot(d: Dot, phase: Phase, frame: number): void {
  switch (phase) {
    case 1:
      emitPhase1(d, frame);
      break;
    case 2:
      emitPhase2(d);
      break;
    case 3:
      emitPhase3(d, frame);
      break;
    case 4:
      emitPhase4(d);
      break;
  }
  d.f += 1; // round-robin: deze dot schuift door in zijn eigen fase-teller
}

export class DotsCore {
  private s: SimState = initialState();

  // FPS-meter
  fps = 0;
  private fpsAccum = 0;
  private fpsCount = 0;

  // ── viewer-state ────────────────────────────────────────────────────────
  private viewer = false;
  private vRotX = 0; // pointer-gedreven kanteling om x-as (rad)
  private vRotY = 0; // pointer-gedreven draai om y-as (rad)
  private vCamDist = DEFAULT_CAM;
  private vPointSize = DEFAULT_POINT;
  // fase-scrubber: kies+bevries een fase, of speel getimed door de 4 fases.
  private viewerPhase: Phase = 1;
  private viewerPlaying = false;

  get isViewer(): boolean {
    return this.viewer;
  }
  get frame(): number {
    return Math.floor(this.s.frame);
  }
  get phase(): Phase {
    return this.viewer ? this.viewerPhase : phaseForFrame(this.s.frame);
  }
  get playing(): boolean {
    return this.viewerPlaying;
  }
  get camDist(): number {
    return this.vCamDist;
  }
  get pointSize(): number {
    return this.vPointSize;
  }
  get rotX(): number {
    return this.vRotX;
  }
  get rotY(): number {
    // in demo-mode draait de wolk om de y-as op de sim-rotatie
    return this.viewer ? this.vRotY : this.s.rot;
  }

  reset(): void {
    this.s = initialState();
    resetRng();
    this.viewer = false;
  }

  enableViewer(): void {
    this.viewer = true;
    this.resetViewer();
  }

  resetViewer(): void {
    this.vRotX = 0;
    this.vRotY = 0;
    this.vCamDist = DEFAULT_CAM;
    this.vPointSize = DEFAULT_POINT;
  }

  // Fase-scrubber API (viewer-mode).
  setPhase(p: Phase): void {
    this.viewerPhase = p;
    this.viewerPlaying = false;
    this.seedPhase(p);
  }
  togglePlay(): void {
    this.viewerPlaying = !this.viewerPlaying;
  }

  // Pointer-drag → kantel de hele puntenwolk (overschrijft auto-rotatie).
  rotateBy(dxPixels: number, dyPixels: number): void {
    this.vRotY += dxPixels * ROT_PER_PX;
    this.vRotX += dyPixels * ROT_PER_PX;
    const lim = Math.PI / 2 - 0.05;
    if (this.vRotX > lim) this.vRotX = lim;
    if (this.vRotX < -lim) this.vRotX = -lim;
  }

  // Scroll → camera-zoom.
  zoomBy(deltaY: number): void {
    let d = this.vCamDist * Math.exp(deltaY * ZOOM_PER_NOTCH);
    if (d < CAM_MIN) d = CAM_MIN;
    if (d > CAM_MAX) d = CAM_MAX;
    this.vCamDist = d;
  }

  // Shift+scroll → puntgrootte.
  pointSizeBy(deltaY: number): void {
    let p = this.vPointSize * Math.exp(-deltaY * POINT_PER_NOTCH);
    if (p < POINT_MIN) p = POINT_MIN;
    if (p > POINT_MAX) p = POINT_MAX;
    this.vPointSize = p;
  }

  // Vul alle dots in één keer met de emitter van fase `p` (voor de scrubber:
  // een nette, stabiele momentopname van die fase zonder round-robin-overgang).
  private seedPhase(p: Phase): void {
    resetRng();
    // representatief frame midden in de fase voor de frame-afhankelijke termen.
    const repFrame =
      p === 1
        ? PHASE1_END / 2
        : p === 2
          ? (PHASE1_END + PHASE2_END) / 2
          : p === 3
            ? (PHASE2_END + PHASE3_END) / 2
            : (PHASE3_END + PHASE4_END) / 2;
    for (let i = 0; i < DOTS_COUNT; i++) {
      const d = this.s.dots[i]!;
      d.f = i * 7;
      emitDot(d, p, repFrame);
    }
    // laat de physics even inlopen zodat fase 2/4 hun val/bounce tonen.
    if (p === 2 || p === 4) {
      for (let k = 0; k < 60; k++) this.physicsStep();
    }
  }

  // ── simulatie ─────────────────────────────────────────────────────────────

  // Eén sim-tick (de body van de DOTS while-loop in MAIN.C).
  private tick(): void {
    const s = this.s;
    s.frame += 1;
    const phase = phaseForFrame(s.frame);

    // Round-robin emit: precies ÉÉN dot per tick opnieuw uitstoten met de
    // emitter van de huidige fase → geleidelijke wolk-overgang.
    const d = s.dots[s.emitCursor]!;
    emitDot(d, phase, s.frame);
    s.emitCursor = (s.emitCursor + 1) % DOTS_COUNT;

    // Gravity neemt af in fase 4: grav-- elke 32 frames vanaf frame 1900.
    if (s.frame >= 1900 && s.frame % 32 === 0 && s.gravity > 0) {
      s.gravity -= 1;
    }

    // Rotatie om de y-as. Vanaf fase 4 gaat hij vrij tollen met afnemende
    // snelheid (de zwerm spint uit terwijl hij verstrooit).
    if (phase === 4) {
      s.rotSpeed *= 0.9995; // afnemende vrije tol
      s.rot += s.rotSpeed * 4;
    } else {
      // oscillerend om de y-as: meeademen met de globale sinus.
      s.rot += s.rotSpeed * (1 + 0.5 * Math.sin(s.frame * 0.01));
    }

    this.physicsStep();

    // einde choreografie → terug naar fase 1 (loop).
    if (s.frame >= FRAME_MAX) {
      const carryRot = s.rot;
      this.s = initialState();
      this.s.rot = carryRot;
      resetRng();
    }
  }

  // Physics voor alle dots: yadd += gravity; y += yadd; bounce op de vloer.
  private physicsStep(): void {
    const s = this.s;
    for (let i = 0; i < DOTS_COUNT; i++) {
      const d = s.dots[i]!;
      d.yadd += s.gravity;
      d.y += d.yadd;
      // y groeit naar +; de vloer ligt op +GRAVITY_BOTTOM (dropper start neg.).
      if (d.y >= GRAVITY_BOTTOM) {
        d.y = GRAVITY_BOTTOM;
        d.yadd = -((d.yadd * BOUNCE_NUM) / BOUNCE_DEN); // dempende bounce
      }
    }
  }

  // ── render-data ────────────────────────────────────────────────────────────

  // Schrijf de huidige dot-posities (geschaald naar world) in `out` (xyz×N).
  syncPositionBuffer(out: Float32Array): void {
    const dots = this.s.dots;
    for (let i = 0; i < DOTS_COUNT; i++) {
      const d = dots[i]!;
      out[i * 3 + 0] = d.x * WORLD_SCALE;
      out[i * 3 + 1] = d.y * WORLD_SCALE;
      out[i * 3 + 2] = d.z * WORLD_SCALE;
    }
  }

  // Eén rAF-stap. In demo-mode loopt de sim op een gewone (niet audio-locked)
  // 70 Hz-klok, afgeleid van dtSec. In viewer-mode staat de choreografie stil,
  // tenzij de fase-scrubber afspeelt.
  advance(dtSec: number): void {
    if (this.viewer) {
      if (this.viewerPlaying) {
        // getimed door de 4 fases lopen: ~6 s per fase, dan wisselen + herseed.
        this.viewerPlayClock += dtSec;
        if (this.viewerPlayClock >= VIEWER_PHASE_SECONDS) {
          this.viewerPlayClock = 0;
          const next = ((this.viewerPhase % 4) + 1) as Phase;
          this.viewerPhase = next;
          this.seedPhase(next);
        }
      }
    } else {
      // sim-ticks sinds vorige frame op vaste 70 Hz, geklemd tegen lag-bursts.
      this.tickAccum += dtSec * TICK_HZ;
      let ticks = Math.floor(this.tickAccum);
      this.tickAccum -= ticks;
      if (ticks > 8) ticks = 8; // nooit wild fast-forwarden na tab-away
      for (let i = 0; i < ticks; i++) this.tick();
    }

    this.fpsAccum += dtSec;
    this.fpsCount++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsCount = 0;
    }
  }

  private tickAccum = 0;
  private viewerPlayClock = 0;

  // Deterministische preview (?frame=N): reset, loop exact `target` sim-ticks
  // (zonder rAF/interactie), zodat de scene gescreenshot en vergeleken kan
  // worden met de referentie-video.
  seekToFrame(target: number): void {
    this.s = initialState();
    resetRng();
    const t = Math.max(0, target | 0);
    for (let i = 0; i < t; i++) this.tick();
  }
}

// ── viewer-tunables ──────────────────────────────────────────────────────────
const DEFAULT_CAM = 7; // camera-afstand in world-units
const CAM_MIN = 2.5;
const CAM_MAX = 24;
const ZOOM_PER_NOTCH = 0.0012;
const DEFAULT_POINT = 9; // basis-puntgrootte (× canvas-hoogte-factor in renderer)
const POINT_MIN = 2;
const POINT_MAX = 40;
const POINT_PER_NOTCH = 0.0015;
const ROT_PER_PX = 0.008; // rad rotatie per gesleepte pixel
const VIEWER_PHASE_SECONDS = 6; // play-modus: seconden per fase
