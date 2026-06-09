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
import { OBJECT_A, OBJECT_B, sin1024 } from "./glenz_data.js";

// --- display mapping tunables (original fixed-point scale not reproduced) ---
const POS_DIV = 1500; // original position units → view units
const CAM_BASE = 7500 / POS_DIV; // zpos baseline depth (=5.0)
const OBJ_SCALE = 0.62; // unit-object → view size
const SCALE_REF = 120; // original xscale at "1.0"
const Y_OFFSET = 2300; // raises settled ypos (~-2800) to roughly screen-centre

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

  constructor(vga: VGA, dis: DisShim) {
    this.vga = vga;
    this.dis = dis;
    this.renderer = new GlenzRenderer(vga);
  }

  reset(): void {
    this.s = initialState();
    this.lastMusicFrame = this.dis.getMframe();
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
      scaleX: (s.xscale / SCALE_REF) * OBJ_SCALE,
      scaleY: (s.yscale / SCALE_REF) * OBJ_SCALE,
      scaleZ: (s.zscale / SCALE_REF) * OBJ_SCALE,
      transX: s.oxp / POS_DIV,
      transY: (s.ypos + Y_OFFSET + s.oyp) / POS_DIV,
      transZ: s.ozp / POS_DIV,
      camDist: CAM_BASE,
      brightness: bright,
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
      scaleX: (s.bscale / SCALE_REF) * OBJ_SCALE,
      scaleY: (s.bscale / SCALE_REF) * OBJ_SCALE,
      scaleZ: (s.bscale / SCALE_REF) * OBJ_SCALE,
      transX: s.oxb / POS_DIV,
      transY: (s.ypos + Y_OFFSET + s.oyb) / POS_DIV,
      transZ: s.ozb / POS_DIV,
      camDist: CAM_BASE,
      brightness: 1,
    };
  }

  // Called once per requestAnimationFrame.
  render(dtSec: number, dstW: number, dstH: number, ctx: CanvasRenderingContext2D): void {
    // advance the sim by however many music-ticks have elapsed (audio-locked)
    this.musicFrame = this.dis.getMframe();
    let ticks = this.musicFrame - this.lastMusicFrame;
    this.lastMusicFrame = this.musicFrame;
    if (ticks < 0) ticks = 0;
    if (ticks > 8) ticks = 8; // clamp after tab-away; never fast-forward wildly
    for (let i = 0; i < ticks; i++) this.tick();

    // draw
    this.vga.clearIndexed(0);
    this.vga.composeBackground(); // black background (palette index 0)
    if (this.s.xscale > 4) this.renderer.drawObject(this.buildStateA());
    if (this.s.frame > 800 && this.s.bscale > 4) {
      this.renderer.drawObject(this.buildStateB());
    }
    this.vga.present(ctx, dstW, dstH);

    // fps meter
    this.fpsAccum += dtSec;
    this.fpsCount++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsCount / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsCount = 0;
    }
  }
}
