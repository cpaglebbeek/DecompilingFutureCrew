# Decomp — per-scene reverse engineering

Elke onderdeel/scene van Second Reality krijgt een eigen map onder `decomp/<scene>/`:

```
decomp/<scene>/
  ASM_NOTES.md     # wat doet de scene + relevante asm-routines uit source/
  port.ts          # moderne TypeScript port (CPU-deel)
  port.vert        # vertex-shader (indien GPU-effect)
  port.frag        # fragment-shader
```

## Vertaal-conventies

| 1993 (x86 / Watcom / PMODE) | 2026 (Web) |
|--|--|
| VGA mode 13h (320×200 chunky 8bpp + palette) | WebGL2 RGBA8 texture + palette LUT in fragment shader |
| Mode-X (320×240 planar) | idem, met aspect-correctie |
| Sound Blaster DSP / GUS PCM | WebAudio AudioContext + AudioBufferSourceNode |
| Tracker S3M (Scream Tracker 3) | libxmp-lite WASM of chiptune2.js |
| Self-modifying asm inner loops | WebGL2 fragment shader (massief parallel) |
| Fixed-point math (16.16) | float32 / WebGL2 native |
| BSP / scanline-fill 3D | WebGL2 indexed draw + depth-test |
| PMODE/W flat-real-mode | n/a — WASM heap |

## Scene-index (placeholder)

| Scene | Source-map | Status | Decomp |
|--|--|--|--|
| START | START | placeholder | — |
| ALKU | ALKU | placeholder | — |
| GLENZ | GLENZ | **ge-port v0.2.0-Trug** ✓ | `glenz/` ASM_NOTES + port.ts/vert/frag |
| DOTS | DOTS | **standalone fase 1-4 v0.8.6-Wildfire** ✓ (scene was fase 1+2) | `decomp/dots/` ASM_NOTES + port.ts/vert/frag · standalone `dots/` |
| 3DS | 3DS | parked (POV-Ray) | — |
| LENS | LENS | tbd | — |
| GRID | GRID | tbd | — |
| TWIST | TWIST | tbd | — |
| WATER | WATER | **tribute v0.5.1-PurpleMotion** (origineel = POV-Ray) ✓ | `water/` ASM_NOTES + port.vert/frag |
| TUNNELI | TUNNELI | **ge-port v0.5.0-PurpleMotion** (pipe-snake, niet fly-through) ✓ | `tunneli/` ASM_NOTES + port.ts/vert/frag |
| TECHNO | TECHNO | tbd | — |
| DDSTARS | DDSTARS | tbd | — |
| ENDPIC | ENDPIC | tbd | — |
| CREDITS | CREDITS | tbd | — |
