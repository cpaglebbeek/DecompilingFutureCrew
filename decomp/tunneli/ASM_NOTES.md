# TUNNELI — decomp-notes

**Versie van deze decomp:** v0.5.0-PurpleMotion
**Source-clone commit:** `071a82e` van `mtuomi/SecondReality`
**Source-pad:** `SecondReality_source/TUNNELI/`

## Wat is TUNNELI

Belangrijke correctie op de aanvankelijke aanname in `BUILD_PLAN.md`: TUNNELI is
**niet** een first-person tunnel-fly-through. Het is een **3D pipe-snake** —
een gesegmenteerde "putki" (Fins voor *pipe*) die door 3D-ruimte beweegt en
roteert. Elk segment is een ring met 64 punten, perspectief-geprojecteerd.

## Source-stack

Niet C/asm zoals GLENZ/DOTS, maar **Turbo Pascal + inline x86 asm**:
- `TUN10.PAS` (Pascal) — hoofdloop + datastructuren + palette
- `TUNNELI.OBJ` — pre-computed perspective-circle table (`pcalc`)
- `SINIT.OBJ` — sine/cosine LUTs (4096 + 2048 entries)
- `ROUTINES.ASM` — render-routines
- `BALLGEN.PAS`, `SINGEN.PAS` — generators die `.OBJ`-tables maakten

Build via Turbo Pascal 4.x + TASM (zie `MAKEOB.BAT`).

## Datastructuren (uit `TUN10.PAS:6-29`)

```pascal
type
  bc     = record x, y : integer; end;
  rengas = record x, y : integer; c : byte; end;  { "rengas" = ring }
var
  putki  : array[0..102] of rengas;        { de pipe — 103 ringen }
  pcalc  : array[0..137, 0..63] of bc;     { perspective circles: 138 radii × 64 hoeken }
  sinit  : array[0..4096] of word;         { sine-LUT, frequentie-gemoduleerd }
  cosit  : array[0..2048] of word;         { cosine-LUT }
  sade   : array[0..102] of word;          { perspective radius per ring-z }
```

**Sleutelinzichten:**
- **103 ringen** in een snake (`putki`)
- Elk ring = **64 punten** (`pcalc[*, 0..63]`)
- **138 voorgerekende radii** in `pcalc` — per ring-z is er een aparte radius
- **`sade[z] = 16384 div ((Z*7)+95)`** (`TUN10.PAS:148`) — perspective-radius schaalfactor

## Path-formule (uit hoofdloop `TUN10.PAS:150-200`)

De pipe golft door de ruimte volgens sinussen — de exacte path-formule zit deels in de routines (`putki[x].x/y` worden frame-by-frame ge-update). Het centrum van elk ring loopt langs een Lissajous-achtig pad in xy.

## Palette (uit `TUN10.PAS:121-128`)

```pascal
for x := 0 to 64 do setrgb(64+x ,  64-x, 64-x, 64-x);  { wit→zwart grayscale }
for x := 0 to 64 do setrgb(128+x, (64-x)*3 div 4, ..., ...); { dimmer grayscale }
setrgb(255, 0, 63, 0);  { neon-groen highlight }
```

**Resultaat:** voornamelijk **grayscale** (zoals de Second Reality TUNNELI scene
in de demo zelf) met één neon-groen accent voor de leading edge.

## Render-pipeline (uit inline asm `TUN10.PAS:153-198`)

Voor elke ring `x` van 80 naar 4 (achter naar voor):
1. **`_bx, by`** = offset t.o.v. ring 5 (kop van de snake)
2. **`br = sade[x]`** = perspective radius voor deze ring
3. **`bbc = putki[x].c + round(x/1.3)`** = kleur-index, depth-gemoduleerd
4. **`pcp = ofs(pcalc[br][0])`** — pointer naar de 64-punts cirkel voor deze radius
5. **`oldpos[]`** truc: schrijf `0` (zwart) naar vorige posities → wist trail, schrijf `15` (wit) naar nieuwe pixel

Klassieke 1993 dirty-rectangle render zonder framebuffer-clear: alleen pixels die veranderen worden geupdate (savings van CPU-cycles).

## Mapping naar modern WebGL2 (port-strategie v0.5.0)

| 1993 | 2026 |
|--|--|
| 103 ringen × 64 punten = 6592 pixels per frame | Single VBO met 80 × 64 = 5120 vertices |
| `pcalc[radius][angle]` LUT | Berekend in vertex shader vanuit `(ringIdx, pointIdx, t)` |
| `sade[z]` perspective radius LUT | `1.0 / depth` natuurlijke perspective in shader |
| Mode-13h chunky 8bpp | WebGL2 RGBA8 + point-sprites |
| `oldpos[]` dirty-rect trick | Full clear per frame (modern is goedkoop) |
| Inline asm fast-path | Vertex-shader (GPU = 100×+ sneller) |
| Grayscale palette + groene tip | Wit fade-met-depth + groene head-segment |

## Wat we wel doen in v0.5.0

- **80 ringen × 64 punten = 5120 points** (single VBO, single draw-call)
- **Procedural path** — pipe golft langs Lissajous-achtige curve (sin × cos)
- **Variable radius per ring** — sin-modulated
- **Depth-shading** in fragment shader (verre ringen dimmer)
- **Groene leading-edge** (eerste 5 ringen krijgen subtiele groene tint)
- **Camera-fly-through** — de pipe lijkt te bewegen omdat we langs de z-as kijken

## Wat we niet doen (parkeren voor v0.5.x)

- Exacte `putki[x].c` kleur-aanstuur-routine
- `oldpos[]` dirty-rect (modern hoeft niet)
- Pre-rendered POV-Ray achtergronden (worden voor WATER relevanter)
- Per-ring trail-segments
- Originele Lissajous-frequentie-mapping uit `sinit/cosit` LUT's

## Bronnen (file:line)

- Ring-datastructuur: `TUN10.PAS:6-17`
- `pcalc` perspective table: `TUN10.PAS:18`, `TUN10.PAS:104`
- Sin/cos init: `TUN10.PAS:107-109`
- Palette init: `TUN10.PAS:121-128`
- `sade` perspective radius: `TUN10.PAS:148`
- Hoofdloop render: `TUN10.PAS:150-200`
- Inline asm draw: `TUN10.PAS:162-197`
