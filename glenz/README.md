# GLENZ — Second Reality (browser reconstruction)

A browser-native, **semantic** reconstruction of the GLENZ.EXE part of
*Second Reality* (Future Crew, 1993): the translucent ("glenz") rotating
vector object, bouncing in from above and squashing on impact, set to the
original `MUSIC0.S3M` by Skaven.

This is **not** an x86/DOS emulator and **not** an instruction-by-instruction
translation. It re-implements the *behaviour* of the original
`GLENZ/MAIN.C` main loop and `VEC.ASM` transform/projection in TypeScript,
rendering with a Canvas-2D software rasteriser into a 320×200 indexed
framebuffer (the authentic mode-13h model), presented pixelated and scaled.

## Run

From the repository root (the `glenz/` app is wired into the repo's Vite
multi-page build):

```bash
npm install
npm run dev      # → http://localhost:5173/DecompilingFutureCrew/glenz/
```

Click / tap / press any key to start (audio needs a user gesture).

```bash
npm run build    # type-checks + builds both the main demo and glenz/
npm run preview  # serve the production build
```

### Controls

| Key            | Action        |
| -------------- | ------------- |
| click / tap / any key | start |
| space / P      | pause / resume |
| R              | restart       |
| M              | mute          |
| H              | toggle HUD    |

## Architecture

| File                  | Original counterpart | Role |
| --------------------- | -------------------- | ---- |
| `src/glenz_data.ts`   | `MAIN.C` data, `SIN1024.INC` | object verts/tris, sin1024 table, palette colours, projection constants |
| `src/vga.ts`          | VGA mode-13h + DAC   | 320×200 indexed framebuffer + 6-bit palette, additive RGBA presentation |
| `src/glenz_renderer.ts` | `VEC.ASM` rotlist/projlist + `NEW.ASM` fill | rotate/scale/project + additive scanline triangle fill |
| `src/dis_shim.ts`     | DIS (int 0FCh)       | music-frame counter derived from the audio clock |
| `src/audio_sync.ts`   | timer / music driver | chiptune3 + libopenmpt playback; AudioContext is the master clock |
| `src/glenz_core.ts`   | `MAIN.C:273-648` loop | the simulation: rotation, drop/bounce/jello physics, scale pulse, second object fade-in |
| `src/main.ts`         | loader / part entry  | wires it together, rAF loop, input, HUD |

The sim advances in fixed **70 Hz** ticks; the number of ticks per rendered
frame comes from the audio-derived music-frame, so the animation is locked to
the music and simply drops visual frames if rendering lags (never desyncs).

## Approximations (which original routines are *not* byte-exact)

The brief is a *modern reinterpretation*, not a pixel-perfect port. The
following were deliberately approximated:

- **Translucency.** The original fakes glass with a palette-OR trick (it ORs
  colour bits so overlaps brighten, no real alpha). Here the sanctioned
  semantic equivalent is used: **additive RGB blending** with **no back-face
  culling**, so both sides of the glass show and overlaps brighten — the glenz
  look. The 6 cube-face groups are tinted R/G/B/Y/C/M.
- **Per-face shading.** The original picks palette shades from face
  orientation. Here brightness comes from the 3D facing `|n·view|` of each
  triangle, reinterpreting that orientation-based shading.
- **Fixed-point scale.** The original's fixed-point transform matrix and
  position units are *not* reproduced. The pipeline is floating-point with a
  handful of display-mapping tunables (`FX`, `POS_DIV`, `CAM_BASE`,
  `OBJ_SCALE`, `Y_OFFSET`) chosen so the object matches the source's on-screen
  size and placement. The projection *ratio* (213/256, the VGA non-square-pixel
  aspect) and additive constants are kept faithful.
- **Background.** The DOS palette-fade bookkeeping and the FC-logo intro
  (`zoomer` / `zoomer2`) are **out of MVP scope** — the background stays black.
  These belong to phase 2 (intro zoom + palette fades + music-cue sync).
- **DIS.** The real Demo Interrupt Server provides VGA-frame counting, an
  Amiga-style copper (raster-synced palette callbacks), retrace wait, and
  inter-part message buffers. The shim implements only what GLENZ needs: a
  music-frame counter derived from the audio clock, a non-blocking `waitb`,
  and a single copper callback slot.
- **Timing.** The 8254 PIT IRQ0 timer is replaced by the WebAudio hardware
  clock (`AudioContext.currentTime`), from which the 70 Hz music-frame is
  derived.

## Credits

- Music: *UnreaL ][ - The 2ND Reality* (`MUSIC0.S3M`) by **Skaven** (Vesa
  Norilo) / Future Crew, 1993.
- Original code: **Future Crew** (Second Reality source, released under the
  Unlicense).
- Playback: chiptune3 / libopenmpt (AudioWorklet).
