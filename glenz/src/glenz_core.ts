// glenz_core.ts — the GLENZ part's simulation + frame driver.
//
// A faithful (not byte-exact) port of the main loop in GLENZ/MAIN.C:273-648:
//   - continuous rotation  rx += 32, ry += 7  per music-tick (degree-tenths)
//   - the object drops in from above and bounces (ypos / yposa gravity +
//     boingm/boingd damping), squashing on impact (jello → x/z scale)
//   - it settles, a second pointier glenz fades in from frame 800
//   - scale/secondary-motion wobble via sin1024
// The DOS palette-fade bookkeeping and the FC-logo intro (zoomer) are out of
// MVP scope (background stays black) — see README "approximations".
//
// Timing: the sim advances in fixed 70 Hz ticks, and the number of ticks per
// rendered frame comes from the audio-derived DisShim — so the animation is
// locked to the music and simply drops visual frames if rendering lags.

import { VGA } from "./vga.js";
import { GlenzRenderer, type ObjectState } from "./glenz_renderer.js";
import { DisShim } from "./dis_shim.js";
import {
  OBJECT_A,
  OBJECT_B,
  sin1024,
  TINT_A_BLUE,
  TINT_A_WHITE,
  TINT_B_RED,
  TINT_B_RED_DARK,
} from "./glenz_data.js";

// Faithful placement (MAIN.C): both objects sit at world (0, ypos+1500, 7500).
// A model point becomes world = R(point) * (scale*64/32768) + translation, then
// is projected with the real 256/213/160/130 constants. No display fudge.
const Z_POS = 9500; // camera/object baseline depth (zpos). Pushed back beyond the
// faithful 7500 so the object sits COMPACT with a wide black margin — matching
// ref_10/11 (blue lands ~45% width, red shell ~75%). At the prior 7100 the
// object filled the frame, which amplified the impact squash (±27% of a huge
// object) into a screen-wide "explosion"; compact framing makes the same squash
// read as the original's subtle inward "deuk". travel/bounce scale with it.
const Y_BASE = 1500; // MAIN.C adds 1500 to ypos for both objects
const SCALE_FP = 64 / 32768; // VEC.ASM rotlist: scale*64 then >>15

// Viewer-mode pose: object held at the demo's settled framing (ypos drifts to
// -2800 after the bounce, transY = ypos + Y_BASE = -1300) but centred, full
// size, with rotation driven by the pointer instead of the music clock.
const VIEWER_Y = Y_BASE - 2800; // = -1300, matches the settled demo framing
const VIEWER_ROT_PER_PX = 6; // degree-tenths of rotation per dragged pixel
const VIEWER_ZOOM_PER_NOTCH = 6; // camDist units per wheel deltaY
const VIEWER_CAM_MIN = 3800;
const VIEWER_CAM_MAX = 13000;
const ROT_MOD = 3 * 3600;

const trunc = Math.trunc;
const si = (i: number): number => sin1024[i & 1023]!;

interface SimState {
  frame: number;
  rx: number;
  ry: number;
  rz: number;
  ypos: number;
  yposa: number;
  boingm: number;
  boingd: number;
  jello: number;
  jelloa: number;
  xscale: number;
  yscale: number;
  zscale: number;
  bscale: number;
  oxp: number;
  oyp: number;
  ozp: number;
  oxb: number;
  oyb: number;
  ozb: number;
}

function initialState(): SimState {
  return {
    frame: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    ypos: -9000,
    yposa: 0,
    boingm: 6,
    boingd: 7,
    jello: 0,
    jelloa: 0,
    xscale: 120,
    yscale: 120,
    zscale: 120,
    bscale: 0,
    oxp: 0,
    oyp: 0,
    ozp: 0,
    oxb: 0,
    oyb: 0,
    ozb: 0,
  };
}

export class GlenzCore {
  private vga: VGA;
  private renderer: GlenzRenderer;
  private dis: DisShim;
  private s: SimState = initialState();
  private lastMusicFrame = 0;
  musicFrame = 0;
  fps = 0;
  private fpsAccum = 0;
  private fpsCount = 0;

  // viewer mode: pointer-driven orientation + zoom, choreography frozen
  private viewer = false;
  private vRx = 0;
  private vRy = 0;
  private vCamDist = Z_POS;

  get isViewer(): boolean {
    return this.viewer;
  }

  constructor(vga: VGA, dis: DisShim) {
    this.vga = vga;
    this.dis = dis;
    this.renderer = new GlenzRenderer(vga);
  }

  reset(): void {
    this.s = initialState();
    this.lastMusicFrame = this.dis.getMframe();
  }

  // Enter interactive viewer mode: freeze the choreography at the settled pose
  // (full-size A + faded-in B), centred, and let the pointer drive orientation.
  enableViewer(): void {
    this.viewer = true;
    this.resetViewer();
  }

  // Reset the viewer orientation + zoom to the default front-on framing.
  resetViewer(): void {
    this.vRx = 0;
    this.vRy = 0;
    this.vCamDist = Z_POS;
  }

  // Pointer drag → accumulate rotation (degree-tenths), wrapped into range.
  rotateBy(dxPixels: number, dyPixels: number): void {
    this.vRy = (this.vRy + dxPixels * VIEWER_ROT_PER_PX) % ROT_MOD;
    this.vRx = (this.vRx + dyPixels * VIEWER_ROT_PER_PX) % ROT_MOD;
    if (this.vRx < 0) this.vRx += ROT_MOD;
    if (this.vRy < 0) this.vRy += ROT_MOD;
  }

  // Wheel → zoom by moving the object nearer/further (camDist), clamped.
  zoomBy(deltaY: number): void {
    let d = this.vCamDist + deltaY * VIEWER_ZOOM_PER_NOTCH;
    if (d < VIEWER_CAM_MIN) d = VIEWER_CAM_MIN;
    if (d > VIEWER_CAM_MAX) d = VIEWER_CAM_MAX;
    this.vCamDist = d;
  }

  // One simulation tick — the body of MAIN.C's `while(repeat--)` loop.
  private tick(): void {
    const s = this.s;
    s.frame++;
    s.rx += 32;
    s.ry += 7;
    s.rx %= 3 * 3600;
    s.ry %= 3 * 3600;
    s.rz %= 3 * 3600;

    if (s.frame > 900) {
      const a = s.frame - 900;
      const b = a > 50 ? 50 : a;
      s.oxp = trunc((si(a * 3) * b) / 10);
      s.oyp = trunc((si(a * 5) * b) / 10);
      s.ozp = trunc(((trunc(si(a * 4) / 2) + 128) * b) / 16);
      if (s.frame > 1800) {
        let aa = s.frame - 1800 + 64;
        if (aa > 1024) aa = 1024;
        s.oxb = trunc((-si(aa * 6) * aa) / 40);
        s.oyb = trunc((-si(aa * 7) * aa) / 40);
        s.ozb = trunc(((si(aa * 8) + 128) * aa) / 40);
      } else {
        s.oxb = -si(a * 6);
        s.oyb = -si(a * 7);
        s.ozb = si(a * 8) + 128;
      }
      let bb = 1800 - s.frame;
      if (bb < 0) {
        if (bb < -99) bb = -99;
        s.oyp -= trunc((bb * bb) / 2);
      }
    }

    if (s.frame > 800) {
      if (s.frame > 1220 + 789) {
        if (s.xscale > 0) s.xscale -= 1;
        if (s.yscale > 0) s.yscale -= 1;
        if (s.zscale > 0) s.zscale -= 1;
        if (s.bscale > 0) s.bscale -= 1;
      } else if (s.frame > 1400 + 789) {
        if (s.bscale > 0) s.bscale -= 8;
        if (s.bscale < 0) s.bscale = 0;
      } else {
        if (s.bscale < 180) s.bscale += 2;
        else s.bscale = 180;
      }
    } else {
      if (s.frame < 640 + 70) {
        s.yposa += 31;
        s.ypos += trunc(s.yposa / 40);
        if (s.ypos > -300) {
          s.ypos -= trunc(s.yposa / 40);
          s.yposa = trunc((-s.yposa * s.boingm) / s.boingd);
          s.boingm += 2;
          s.boingd++;
        }
        if (s.ypos > -900 && s.yposa > 0) {
          s.jello = trunc(((s.ypos + 900) * 5) / 3);
          s.jelloa = 0;
        }
      } else {
        if (s.ypos > -2800) s.ypos -= 16;
        else if (s.ypos < -2800) s.ypos += 16;
      }
      s.yscale = s.xscale = 120 + trunc(s.jello / 30);
      s.zscale = 120 - trunc(s.jello / 30);
      const a = s.jello;
      s.jello += s.jelloa;
      if ((a < 0 && s.jello > 0) || (a > 0 && s.jello < 0)) {
        s.jelloa = trunc((s.jelloa * 5) / 6);
      }
      s.jelloa -= trunc(s.jello / 20);
    }

    // loop the sequence once the object has fully shrunk away (original exits)
    if (s.frame > 2009 && s.xscale <= 4 && s.bscale <= 4) {
      const carryR = s.rx;
      this.s = initialState();
      this.s.rx = carryR; // keep rotation phase for a seamless restart
    }
  }

  private buildStateA(): ObjectState {
    const s = this.s;
    const bright = Math.min(1, s.frame / 40);
    return {
      verts: OBJECT_A.verts,
      tris: OBJECT_A.tris,
      rotX: s.rx,
      rotY: s.ry,
      rotZ: s.rz,
      scaleX: s.xscale * SCALE_FP,
      scaleY: s.yscale * SCALE_FP,
      scaleZ: s.zscale * SCALE_FP,
      transX: s.oxp,
      transY: s.ypos + Y_BASE + s.oyp,
      transZ: s.ozp,
      camDist: Z_POS,
      brightness: bright,
      tintPrimary: TINT_A_BLUE,
      tintSecondary: TINT_A_WHITE,
    };
  }

  private buildStateB(): ObjectState {
    const s = this.s;
    return {
      verts: OBJECT_B.verts,
      tris: OBJECT_B.tris,
      rotX: 3600 - trunc(s.rx / 3),
      rotY: 3600 - trunc(s.ry / 3),
      rotZ: 3600 - trunc(s.rz / 3),
      scaleX: s.bscale * SCALE_FP,
      scaleY: s.bscale * SCALE_FP,
      scaleZ: s.bscale * SCALE_FP,
      // Object B's OWN translation (MAIN.C:633 — `0+oxb, ypos+1500+oyb,
      // zpos+ozb`): an independent sin1024 drift. This is the "stuitert" the
      // reference shows — the blue inner ball wanders off-centre inside the red
      // shell (ref_11→15: centre → right → left → low), not concentric. A prior
      // build pinned B to A's centre and so killed that bounce.
      transX: s.oxb,
      transY: s.ypos + Y_BASE + s.oyb,
      transZ: s.ozb,
      camDist: Z_POS,
      brightness: 1,
      tintPrimary: TINT_B_RED,
      tintSecondary: TINT_B_RED_DARK,
    };
  }

  // Viewer-mode object A: settled, centred, pointer-driven orientation.
  private buildViewerA(): ObjectState {
    return {
      verts: OBJECT_A.verts,
      tris: OBJECT_A.tris,
      rotX: this.vRx,
      rotY: this.vRy,
      rotZ: 0,
      scaleX: 120 * SCALE_FP,
      scaleY: 120 * SCALE_FP,
      scaleZ: 120 * SCALE_FP,
      transX: 0,
      transY: VIEWER_Y,
      transZ: 0,
      camDist: this.vCamDist,
      brightness: 1,
      tintPrimary: TINT_A_BLUE,
      tintSecondary: TINT_A_WHITE,
    };
  }

  // Viewer-mode object B: the inner shell, concentric. Unlike the demo (where B
  // counter-rotates 3600 - r/3 as choreography), here it shares A's orientation
  // so the whole translucent assembly turns as ONE rigid object when dragged —
  // matching the approved "A+B objects together" interactive-viewer intent.
  private buildViewerB(): ObjectState {
    return {
      verts: OBJECT_B.verts,
      tris: OBJECT_B.tris,
      rotX: this.vRx,
      rotY: this.vRy,
      rotZ: 0,
      scaleX: 180 * SCALE_FP,
      scaleY: 180 * SCALE_FP,
      scaleZ: 180 * SCALE_FP,
      transX: 0,
      transY: VIEWER_Y,
      transZ: 0,
      camDist: this.vCamDist,
      brightness: 1,
      tintPrimary: TINT_B_RED,
      tintSecondary: TINT_B_RED_DARK,
    };
  }

  private drawViewer(dstW: number, dstH: number, ctx: CanvasRenderingContext2D): void {
    this.vga.clearIndexed(0);
    this.vga.composeBackground();
    this.renderer.drawFloor();
    this.renderer.drawObject(this.buildViewerA());
    this.renderer.drawObject(this.buildViewerB());
    this.vga.present(ctx, dstW, dstH);
  }

  // Called once per requestAnimationFrame.
  render(dtSec: number, dstW: number, dstH: number, ctx: CanvasRenderingContext2D): void {
    if (this.viewer) {
      this.drawViewer(dstW, dstH, ctx);
      this.fpsAccum += dtSec;
      this.fpsCount++;
      if (this.fpsAccum >= 0.5) {
        this.fps = Math.round(this.fpsCount / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsCount = 0;
      }
      return;
    }
    // advance the sim by however many music-ticks have elapsed (audio-locked)
    this.musicFrame = this.dis.getMframe();
    let ticks = this.musicFrame - this.lastMusicFrame;
    this.lastMusicFrame = this.musicFrame;
    if (ticks < 0) ticks = 0;
    if (ticks > 8) ticks = 8; // clamp after tab-away; never fast-forward wildly
    for (let i = 0; i < ticks; i++) this.tick();

    this.draw(dstW, dstH, ctx);

    // fps meter
    this.fpsAccum += dtSec;
    this.fpsCount++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsCount = 0;
    }
  }

  // Compose one frame: black clear → checkerboard floor → glenz objects.
  private draw(dstW: number, dstH: number, ctx: CanvasRenderingContext2D): void {
    this.vga.clearIndexed(0);
    this.vga.composeBackground(); // black (palette index 0)
    this.renderer.drawFloor(); // perspective checkerboard ground plane
    if (this.s.xscale > 4) this.renderer.drawObject(this.buildStateA());
    if (this.s.frame > 800 && this.s.bscale > 4) {
      this.renderer.drawObject(this.buildStateB());
    }
    this.vga.present(ctx, dstW, dstH);
  }

  // Deterministic preview: reset, advance exactly `target` sim ticks (no audio
  // clock), render one frame. Used for golden-frame screenshot comparison and
  // not wired into the rAF loop.
  renderAtFrame(target: number, dstW: number, dstH: number, ctx: CanvasRenderingContext2D): void {
    this.s = initialState();
    for (let i = 0; i < target; i++) this.tick();
    this.draw(dstW, dstH, ctx);
  }
}
