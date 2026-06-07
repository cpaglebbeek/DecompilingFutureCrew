# DOTS — decomp-notes

**Versie van deze decomp:** v0.3.0-Pixel
**Source-clone commit:** `071a82e` van `mtuomi/SecondReality`
**Source-pad:** `SecondReality_source/DOTS/`

## Wat is de DOTS-scene

512 individuele "dots" (particles) die door 4 verschillende fases bewegen, getekend in mode-13h chunky 8bpp met **depth-shading via 4 lookup-tables**. Het effect duurt ~2450 frames @ 70Hz ≈ 35 seconden. Er is **geen tunnel of vortex** zoals ik in `BUILD_PLAN.md` speculeerde — het is een **dot-choreographie** met physics-driven gravity.

## Mesh-data / state (uit `MAIN.C` + `FACE.C`)

Géén mesh — een **dot-array**:
```c
// MAIN.C:42-52
struct {
    int x, y, z;            // 16-bit fixed-point positie
    int old1, old2, old3, old4;  // 4 vorige posities (voor trail-effect)
    int yadd;               // huidige y-velocity (16-bit)
} dot[];

dotnum = 512;
```

Globale physics-state:
```c
// MAIN.C:11-19,54-56
extern int rotsin, rotcos;       // pre-computed rotation (xz-plane)
extern int gravity;              // velocity-toename per frame (yadd += gravity)
extern int gravitybottom;        // y-niveau waar dots stoppen / bouncen
extern int gravityd;             // gravity-delta
extern long depthtable1[];       // 128 entries — depth → shading-LUT
extern long depthtable2[];       // varianten voor kleur-tinten
extern long depthtable3[];
extern long depthtable4[];
```

## De 4 fases (uit `MAIN.C:196-282`)

| Frame | Fase | Emitter-formule (per dot `i`, frame-teller `f`) |
|--|--|--|
| 0-500 | **Lissajous opbouw** | `x = sin(f×11)×40`, `y = cos(f×13)×10 - dropper`, `z = sin(f×17)×40`, `yadd = 0` |
| 500-900 | **Cirkel + val** | `x = cos(f×15)×55`, `y = dropper`, `z = sin(f×15)×55`, `yadd = -260` (opwaartse impuls + gravity) |
| 900-1700 | **Spiraal** | `a = sin1024[frame & 1023] / 8`, `x = cos(f×66)×a`, `y = 8000`, `z = sin(f×66)×a`, `yadd = -300` |
| 1700-2360 | **Random scatter + val** | `x = rand()-16384`, `y = 8000 - rand()/2`, `z = rand()-16384`, `yadd = 0`; `grav--` elke 32 frames |
| 2360-2440 | **Palet fade-out** | Geen dot-emit, alleen palet-up/down |

**Per-frame update voor alle dots:** position += velocity, velocity.y += gravity, clamp aan `gravitybottom`. Geïmplementeerd in `ASM.ASM` als unrolled inner loop voor performance.

**Sin-tabel:** `sin1024[]` (uit `SIN1024.INC`) is een 1024-entry fixed-point sine-LUT — equivalent aan `Math.sin(deg / 1024 * 2π) × 16384` of vergelijkbaar.

## Render-pipeline (uit `drawdots()` in `ASM.ASM`)

Voor elke dot:
1. **Rotate** in xz-plane met `rotsin`/`rotcos` (pre-computed per frame, niet per dot)
2. **Project** 3D → 2D met simpele perspective: `sx = x / z + screen_center_x`, `sy = y / z + screen_center_y`
3. **Depth bucket**: z-waarde maps naar een van 4 `depthtable`-rijen × 128 depth-niveaus
4. **Write 4 pixels**: schrijf op `(sx, sy)` met kleuren uit `depthtable_X[depth_index]` — vermoedelijk 2×2 pixel block of trail van 4 vorige posities
5. **Background composite**: dots tekenen bovenop `bgpic` (pre-rendered background)

## Palet-init (uit `MAIN.C:127-147`)

```c
// 16 niveaus × 4 kleuren = 64 entries (palet 100-163)
for (a = 0; a < 16; a++) for (b = 0; b < 4; b++) {
    c = 100 + a * 9;  // shading-multiplier per a
    outp(0x3c9, cols[b*3+0]);                  // R: vast per kleur-bucket
    outp(0x3c9, cols[b*3+1] * c / 256);        // G: geshade
    outp(0x3c9, cols[b*3+2] * c / 256);        // B: geshade
}
// cols[] = {0,0,0, 4,25,30, 8,40,45, 16,55,60}
// → kleuren ≈ zwart, teal-licht, teal-medium, teal-bright
```

**Resultaat:** een **teal/cyan-blauw palette** met 16 helderheidsniveaus per van 4 tinten. Niet "16 miljoen kleuren" — heel bewust monochroom-blauw, "ruimte-achtig".

## Mapping naar modern WebGL2 (port-strategie v0.3.0)

| 1993 | 2026 |
|--|--|
| 512 dots, per-frame CPU-update | 512 dots in `Float32Array` (CPU-update in TypeScript, eenvoudig genoeg) |
| Inner loop in `ASM.ASM` voor draw | **Instanced rendering**: 1 `drawArraysInstanced` call, vertex-shader leest `vec3 a_dotPos` per instance |
| Point-write naar VRAM 320×200 | `gl.POINTS` met `gl_PointSize` perspective-correct: `gl_PointSize = base / -viewSpaceZ` |
| Fixed-point math | float32 |
| Sin1024-LUT | `Math.sin()` direct (genoeg snel voor 512 entries × 60fps) |
| Depth-shading 4 LUT-tables × 128 levels | Fragment-shader: kleur = palet-kleur × `smoothstep(zMin, zMax, depth)` |
| Mode-13h palet | Teal-cyan palet hardcoded in shader (4 kleur-buckets × geleidelijke shading) |
| `depthtable1-4` varianten | 4 randomized kleur-buckets per dot (instance-attribute `a_colorBucket`) |
| Trail via `old1-4` vorige posities | Skip voor v0.3.0 (kan in v0.3.x via 4 extra instance-attribs + 4 extra POINTS draws) |
| Gravity + bounce | Simpele TypeScript-loop: `y += yadd; yadd += gravity; if (y < bottom) y = bottom` |

## Wat we **wel** doen in v0.3.0

- **Fase 1 (Lissajous opbouw)** — 5 seconden timeline-slot
- **Fase 2 (cirkel + val met gravity)** — 7 seconden timeline-slot
- **Teal-cyan palet** in shader (klassieker DOTS look)
- **Depth-shading** in fragment-shader (verre dots dimmer)
- **Perspective point-size** (verre dots kleiner)
- **Instanced rendering** — 1 draw-call

## Wat we **niet** doen in v0.3.0 (parkeren voor v0.3.x)

- Fase 3 (spiraal) en fase 4 (random scatter)
- Trails (per dot 4 vorige posities renderen)
- Palet-fade-out tussenscenes (timeline-overgang via fade-color is genoeg)
- 4 verschillende depth-LUT varianten (we doen 1 LUT in shader)
- Background-image compositing

## Volgende decomp-stappen (v0.3.x)

- v0.3.1: Trails — extra 4 instance-attribs per dot, 4 extra draws met alpha-fade
- v0.3.2: Fase 3 (spiraal)
- v0.3.3: Fase 4 (random scatter)
- v0.3.4: Background-image compositing
