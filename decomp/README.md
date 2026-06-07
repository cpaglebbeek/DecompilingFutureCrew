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
| GLENZ | GLENZ | **eerste hero target** | `glenz/` |
| DOTS | DOTS | hero target #2 | — |
| 3DS | 3DS | parked (POV-Ray) | — |
| LENS | LENS | tbd | — |
| GRID | GRID | tbd | — |
| TWIST | TWIST | tbd | — |
| WATER | WATER | tbd | — |
| TUNNELI | TUNNELI | tbd | — |
| TECHNO | TECHNO | tbd | — |
| DDSTARS | DDSTARS | tbd | — |
| ENDPIC | ENDPIC | tbd | — |
| CREDITS | CREDITS | tbd | — |
