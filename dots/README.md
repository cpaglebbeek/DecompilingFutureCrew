# DOTS — Second Reality (browser reconstruction)

A browser-native, **semantic** reconstruction of the DOTS part of
*Second Reality* (Future Crew, 1993): **512 particles** driven by
gravity-physics through **four choreography phases** — a Lissajous build-up, a
circle that's flung up and falls, a breathing spiral, and a random scatter.
There is **no tunnel/vortex** here (an earlier `BUILD_PLAN.md` guess); the part
is a physics-driven dot ballet rendered in a teal/cyan monochrome palette.

This is **not** an x86/DOS emulator and **not** an instruction-by-instruction
translation. It re-implements the *behaviour* of `DOTS/MAIN.C` (the emitter
phases + gravity loop) and `DOTS/ASM.ASM` (`drawdots`), rendering with WebGL2
**instanced points** — one `drawArraysInstanced(gl.POINTS, …)` call for all 512
dots, with perspective-correct point size, additive blending and depth-shading
in the fragment shader.

## Run

From the repository root (the `dots/` app is wired into the repo's Vite
multi-page build):

```bash
npm install
npm run dev      # → http://localhost:5173/DecompilingFutureCrew/dots/
```

Click / tap / press any key to start.

```bash
npm run build    # type-checks + builds main + glenz/ + dots/
npm run preview  # serve the production build
```

`?frame=N` renders one deterministic sim-frame without the rAF loop or any
interaction, for screenshot comparison against the reference video, e.g.
`…/dots/?frame=1300` (mid-spiral).

### Controls

| Key / gesture | Demo mode | Viewer mode |
| ------------- | --------- | ----------- |
| click / tap / any key | start | start |
| drag (mouse / touch / pen) | — | rotate the whole cloud (x/y) |
| scroll | — | camera zoom |
| shift + scroll | — | point size |
| 1 / 2 / 3 / 4 | — | pick + freeze emitter phase |
| space / P | pause / resume | play / pause the 4-phase timeline |
| R | restart | recenter rotation/zoom |
| H | toggle HUD | toggle HUD |

The **phase scrubber** (viewer mode) is the primary added value: pick any one of
the four choreography phases with `1`/`2`/`3`/`4` and inspect it from any angle,
or press `P` to step through all four on a timer.

## Architecture

| File | Original counterpart | Role |
| ---- | -------------------- | ---- |
| `src/dots_core.ts` | `DOTS/MAIN.C:196-282` (emitter phases + gravity loop) | the sim: 512 dots, 4 phase-emitters, round-robin emit, physics, rotation, demo timeline + viewer/scrubber state |
| `src/dots_renderer.ts` | `DOTS/ASM.ASM` `drawdots` (rotate → project → depth-bucket → pixel write) | standalone WebGL2 instanced-POINTS renderer; shaders from `decomp/dots/port.vert` + `port.frag` |
| `src/main.ts` | loader / part entry | wires it together, rAF loop, pointer/wheel/keys, `?frame=N`, HUD |
| `../decomp/dots/port.vert` / `port.frag` | `depthtable1-4[]` LUTs + `cols[]` palette (`MAIN.C:72-76`) | per-dot point sprite + depth-shading + 4 teal buckets |
| `../decomp/glenz/port.ts` | `VEC.ASM` matrix math | shared mat4 perspective/translate/rotate/multiply helpers |

### The four phases (round-robin)

Each tick (fixed **70 Hz**) advances a global frame counter and re-emits
**exactly one** dot with the current phase's emitter formula — so the cloud
morphs *gradually* from one shape into the next instead of snapping. Physics
then runs on all dots: `yadd += gravity; y += yadd;` with a damping bounce
(`yadd = -yadd·13/16`) when a dot hits the floor.

| Frame | Phase | Emitter (per dot, counter `f`) | yadd |
| ----- | ----- | ------------------------------ | ---- |
| 0–500 | **1 Lissajous build-up** | `x=sin(f·11)·40`, `y=cos(f·13)·10 − dropper`, `z=sin(f·17)·40` | 0 |
| 500–900 | **2 Circle + fall** | `x=cos(f·15)·55`, `y=high`, `z=sin(f·15)·55` | −260 (up impulse, then gravity) |
| 900–1700 | **3 Spiral** | `a=sin1024[frame&1023]/8` (breathes with the global sine), `x=cos(f·66)·a`, `y=8000`, `z=sin(f·66)·a` | −300 |
| 1700–2360 | **4 Random scatter + fall** | `x=rand−16384`, `y=8000−rand/2`, `z=rand−16384` | 0 |

`gravity` starts at 3 and **decays** in phase 4 (`grav--` every 32 frames from
frame 1900). Rotation about the y-axis oscillates (breathing with the global
sine) in phases 1–3 and then **free-spins with decaying speed** from phase 4 as
the swarm scatters. At frame ~2450 the sequence loops back to phase 1 (rotation
phase carried over for a seamless restart).

## Approximations (which original routines are *not* byte-exact)

The brief is a *modern reinterpretation*, not a pixel-perfect port. The
following were deliberately approximated:

- **Fixed-point → float.** The original works in 16-bit fixed-point with the
  `sin1024` LUT scaled to ±16384. Here positions are floats; `sin1024` is
  `Math.sin` scaled to the same ±16384 amplitude so the emitter scalings
  (`·40`, `/8`, `+128`…) keep the same proportions, and a single `WORLD_SCALE`
  maps the big 1993 units (±16384, y=8000) into a compact world around the
  origin for the WebGL2 camera.
- **Time base.** The original advances one frame per 70 Hz timer IRQ. Here the
  sim ticks at a fixed 70 Hz derived from the rAF `dt` (clamped after tab-away
  so it never wildly fast-forwards), but it is **not audio-locked** (see below).
- **Render.** `drawdots`' per-dot rotate → perspective `x/z`, `y/z` →
  depth-bucket → write-4-pixels inner loop is replaced by GPU instanced
  `gl.POINTS`: perspective-correct `gl_PointSize = base / clip.w`, a soft
  circular sprite mask, and depth-shading computed in the fragment shader
  instead of from the `depthtable1-4[]` lookup tables.
- **Palette.** The 16-level × 4-tint mode-13h palette (`cols[] = {0,0,0,
  4,25,30, 8,40,45, 16,55,60}`, `MAIN.C:72-76`) is reproduced as four teal
  buckets (`/63` from 6-bit VGA) directly in `port.frag`, with continuous
  depth-shading replacing the 16 discrete brightness levels.
- **Trails.** The original keeps `old1..old4` previous positions per dot for a
  4-pixel trail. Not rendered here (single point per dot) — parked.
- **Scatter RNG.** Phase 4's `rand()` is replaced by a deterministic xorshift32
  (re-seeded on reset / `?frame=N`) so the deterministic preview is
  reproducible. The *distribution* matches; the exact 1993 sequence does not.

## Source gaps (unconfirmed / not yet verified against the source)

These are honest unknowns, not design choices — flagged so the next decomp pass
can close them:

- **Audio is not connected.** Which `MUSIC0.S3M` segment DOTS plays — and at
  what tempo it should lock — is an **unconfirmed source gap**. The demo
  therefore runs on a plain rAF clock, *not* audio-locked like GLENZ. Hooking
  the chiptune3/libopenmpt player to a verified S3M offset is future work.
- **Exact phase frame-boundaries.** The 500 / 900 / 1700 / 2360 thresholds and
  the `gravity`/`gravitybottom`/`gravityd` constants come from the
  `ASM_NOTES.md` mapping of `MAIN.C:196-282`; the precise per-frame `dropper`
  ramp and the spiral `a = sin1024[frame&1023]/8` scaling were **not** byte-
  verified against a running 1993 trace.
- **Exact x86 rotation tracker.** `rotsin`/`rotcos` are pre-computed per frame
  in the original; here the y-axis rotation is reinterpreted as an oscillating /
  free-spinning angle rather than reproduced from the source's `rotspd`/`rotadd`
  bookkeeping.
- **Background compositing.** The original draws dots over a pre-rendered
  `bgpic` and runs inter-phase palette fades; the background here is plain black.

## Credits

- Original code: **Future Crew** (Second Reality source, released under the
  Unlicense).
- Music (not yet wired): *UnreaL ][ - The 2ND Reality* (`MUSIC0.S3M`) by
  **Skaven** (Vesa Norilo) / Future Crew, 1993.
