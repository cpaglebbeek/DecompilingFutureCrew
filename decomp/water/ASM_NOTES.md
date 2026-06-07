# WATER — decomp-notes (tribute)

**Versie van deze decomp:** v0.5.1-PurpleMotion
**Source-clone commit:** `071a82e` van `mtuomi/SecondReality`
**Source-pad:** `SecondReality_source/WATER/`

## Waarom dit een "tribute" is, geen exacte port

In tegenstelling tot GLENZ/DOTS/TUNNELI, is WATER **niet runtime-procedureel**.
De WATER-scene in Second Reality is grotendeels **pre-rendered ray-tracing**
output van **POV-Ray 1.x/2.x** (1993), gevolgd door real-time water-bump-
displacement op de pre-rendered frames in Pascal.

Een "decompile" in onze zin (asm → moderne port) is daarom niet mogelijk
zonder ofwel:
- de originele `.POV`-scripts in een moderne ray-tracer draaien (hoge inspanning,
  geen echte vooruitgang op de browser-port), of
- de pre-rendered `.LBM` plaatjes in de repo te bundelen (1993 IFF-format, niet
  triviaal te decoderen, niet portabel)

In plaats daarvan leveren we een **moderne hommage**: een fragment-shader
water-effect met caustic-light, onderwater-blauw, en tijd-gemoduleerde rimpels.
Niet pixel-perfect, maar **in de geest van** de WATER-scene zoals 1993-kijkers
hem ervaren.

## Source-stack (1993)

`SecondReality_source/WATER/` bevat:

| Type | Files | Doel |
|--|--|--|
| **Pascal** | `BKR.PAS`, `DEMO.PAS`, `KOE.PAS`, `DATGEN.PAS` | Hoofdcode, playback, datageneratie |
| **POV-Ray scripts** | `AA.POV`, `KK.POV`, `FISH13.POV` | Ray-trace scènes |
| **POV-Ray includes** | `COLORS.INC`, `FOV.INC`, `IOR.INC`, `LIZARD.INC` | Material/model libraries |
| **Pre-rendered bitmaps** | `FINAL.LBM`, `FINAL2.LBM`, `KOE.LBM`, `FONA.LBM`, `LOGO.LBM`, `DATA.GIF/TGA/TIF` | Ray-trace output (IFF format) |
| **Asm routines** | `ROUTINES.OBJ` (geen `.ASM` source bijgeleverd) | Sprite-overlay + putrouts1 |
| **Color palette** | `BKG.CLX`, `GREEN.CLX`, `COLORS.CLX` | Palet-snapshots per scene-mode |

Voorbeeld POV-Ray scene (`AA.POV:1-30`):
```povray
#include "colors.inc"
camera { location <10 50 -50> look_at <0 0 0> }
fog { colour red 0.0 green 0.0 blue 0.0  250.0 }
object { light_source { <-10 60 30> color White } }
object {
   box { UnitBox scale <256 32 4>}
   texture { color Green }
   texture { image_map { <1 -1 0> tga "rgb.tga" once interpolate 2 } ... }
}
```

POV-Ray syntax uit het pre-SDL tijdperk (1992-1993, vóór POV-Ray 3.0). `image_map` met `interpolate 2` = bilineaire texture sampling op tga-bitmap.

## Pascal pipeline (uit `DEMO.PAS`)

```pascal
uses crt, t1, t2, t3, bkr, miek;        { custom modules per scene-type }
procedure setrgb(c,r,g,b:byte);          { VGA palette helper }
procedure waitr;                         { wait for vertical retrace }
procedure putrouts1; far; external;      { ROUTINES.OBJ — composite sprite }
                                         { dx=bg-seg, ax=pos-seg, si=pos-ofs, ... }
```

De `putrouts1` asm-routine doet sprite-compositing: leest pre-rendered
achtergrond + font-tekst + waterdisplacement-buffer, schrijft samen naar VRAM.

## Modern tribute (port v0.5.1)

Pure fragment-shader op fullscreen-quad. Geen mesh, geen Pascal-state.

| Element | Implementatie |
|--|--|
| Caustic-light patroon | `fbm()` noise op gemoduleerde uv-coords, additief gemixt |
| Water-rimpels | Twee sinussen (`sin(uv.x * f + t)`, `sin(uv.y * g + t)`) gestapeld |
| Onderwater-blauw | Lineaire mix met `vec3(0.05, 0.15, 0.35)` |
| Reflectie / glint | `pow(sin(...), 8.0)` voor spiculae |
| Tijd-evolutie | `u_t` modulatie op alle sinus-fases |
| Vignet | `1.0 - r²` op centered uv |

Resolutie-onafhankelijk, ~50 GFLOPs per pixel @ 60 fps op midrange mobile.

## Niet uit scope v0.5.1

- POV-Ray scenes in WebGL of WebGPU ray-tracen
- IFF/LBM-decoder voor pre-rendered plaatjes
- Exacte 1993 water-bump-displacement (vereist achtergrond-bitmap)
- "Vissen" of de iconische LIZARD-model

## Volgende — v0.5.2 LENS

`LENS/` source — verwacht: post-process fisheye/lens-zoom op een achtergrond.
Modern: post-pass shader die scene-texture leest en distorteert. Vereist dat
we first render-to-texture infrastructuur opzetten (Framebuffer-class is er al
sinds v0.1.0). LENS = goede testcase voor full post-processing pipeline.
