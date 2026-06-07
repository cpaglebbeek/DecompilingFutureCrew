# GLENZ — decomp-notes

**Versie van deze decomp:** v0.2.0-Trug
**Source-clone commit:** `071a82e` van `mtuomi/SecondReality`
**Source-pad:** `SecondReality_source/GLENZ/`

## Wat is een "Glenz vector"

Demoscene-jargon (Amiga, ~1989) voor **translucente vector-objecten**. In Second Reality: een ronddraaiende kleurige kubus waarvan tegenoverliggende kanten door elkaar heen lichten. Bedoeld om "additieve glas-look" te suggereren in **VGA mode-X (320×240 planar)** waar geen alpha-blending bestaat.

## Wat het effect technisch is in de 1993 source

Het effect is **géén echte alpha-blending**. Het is een palet-truc:

1. De kubus heeft 6 faces, elk met een `kleur-code` die per face een **enkele bit** zet in de palet-index: `0x04, 0x08, 0x10, 0x20, 0x40, 0x80`.
2. Het palet wordt zo geïnitialiseerd dat **elke bit een primaire kleur-bijdrage** krijgt (`MAINTRAN.C:60-69`):
   ```c
   if(a&4)  r+=30;            // bit 0x04 → rood
   if(a&8)  g+=30;            // bit 0x08 → groen
   if(a&16) b+=30;            // bit 0x10 → blauw
   if(a&32) { r+=30; g+=30; } // bit 0x20 → geel
   if(a&64) { g+=30; b+=30; } // bit 0x40 → cyaan
   if(a&128){ b+=30; r+=30; } // bit 0x80 → magenta
   ```
3. Wanneer twee faces in dezelfde scanline-pixel zouden landen, zou een **OR van hun kleur-bits** een palet-index opleveren waarvan de RGB-waarde de **som** is van de twee primaire bijdragen. → "Translucent" zonder echte blending.

In Second Reality wordt dit uitgewerkt via **mode-X tweaked polygon-fill** (`VIDTWE.ASM`) — niet de standaard mode-13h chunky 8bpp. Mode-X gebruikt 4 bit-planes; de "fill" zet bits per plane los, wat het palet-OR-effect dichterbij brengt zonder per pixel te hoeven OR'en.

> Detail om in v0.2.1+ uit te zoeken: hoe precies wordt de **per-pixel OR** gerealiseerd? Schrijft `VIDTWE.ASM` met `OR` naar VRAM in plaats van `MOV`, of staat het palet zo dat per-plane writes vanzelf optellen? Voor de browser-port is dit detail niet kritisch — additive blending in WebGL2 levert hetzelfde visuele resultaat.

## Mesh-data (uit `MAINTRAN.C:11-43`)

**8 vertices** (`points[]`, schaal ±1000 in elke as, dus kubus van 2000 units):
```c
// MAINTRAN.C:11-19
long points[32]={8,
  -1000,-1000,-1000,    // 0: links-onder-achter
   1000,-1000,-1000,    // 1: rechts-onder-achter
   1000, 1000,-1000,    // 2: rechts-boven-achter
  -1000, 1000,-1000,    // 3: links-boven-achter
  -1000,-1000, 1000,    // 4: links-onder-voor
   1000,-1000, 1000,    // 5: rechts-onder-voor
   1000, 1000, 1000,    // 6: rechts-boven-voor
  -1000, 1000, 1000};   // 7: links-boven-voor
```

**12 edges** (`edges[]`):
- 0-1, 1-2, 2-3, 3-0 (achterkant)
- 4-5, 5-6, 6-7, 7-4 (voorkant)
- 0-4, 1-5, 2-6, 3-7 (verticaal)

**6 faces** (`polys[]`, ieder met kleur-code en 4 hoekpunten):
```c
// MAINTRAN.C:36-42  format: aantal_zijden, kleur, edge-indices...
4,0x4004,0,1,2,3,        // bodem      → 0x04 rood
4,0x4008,0,8,4,9,        // links?     → 0x08 groen
4,0x4010,1,9,5,10,       // ...        → 0x10 blauw
4,0x4020,2,10,6,11,      // ...        → 0x20 geel
4,0x4040,3,11,7,12,      // ...        → 0x40 cyaan
4,0x4080,4,5,6,7,        // top        → 0x80 magenta
```

> De zijden gebruiken **edge-indices** (0-11), niet vertex-indices. `cpolylist()` resolved ze. Voor onze port gebruiken we direct vertex-indices (modern reinterpretatie).

## Render-pipeline (uit `MAINTRAN.C:52-98`)

```c
// MAINTRAN.C:74-83
rz+=5; ry+=7; rz+=6;                 // rotatie-snelheden (rx blijft 0, rz krijgt 11)
rx%=3600; ry%=3600; rz%=3600;        // wrap op 360° in tenths-of-degree
cmatrix_yxz(rx,ry,rz,matrix);        // bouw 3x3 rotation matrix YXZ-order
csetmatrix(matrix,0,0,4000);         // set view: camera op z = -4000 t.o.v. mesh
points2[0]=0; crotlist(points2,points);    // wereld→view: rotate alle verts
points3[0]=0; cprojlist(points3,points2);  // view→2D: perspective projection
cpolylist(polylist,polys,edges,points3);   // bouw poly-list (vermoedelijk depth-sort)
asm();                                // pre-draw asm hooks
cdrawpolylist(polylist);              // teken polygons (VIDTWE.ASM)
```

- **Schaal-keuze:** mesh is ±1000, view-z = 4000 → camera-afstand 4 mesh-eenheden = comfortabele FOV.
- **Rotatie-snelheden:** in ticks van 0.1°. `ry+=7` per frame = 0.7°/frame, `rz+=11` = 1.1°/frame. Bij 70 Hz (DOS-VBL) = ~49°/s rond y, ~77°/s rond z. Bij 60 fps in browser: zelfde graden-per-frame geeft ~42°/s en ~66°/s — close enough.

## Mapping naar modern WebGL2 (port-strategie)

| 1993 (Mode-X + palet-OR) | 2026 (WebGL2) |
|--|--|
| Palet-bit-OR voor translucentie | `gl.enable(BLEND); gl.blendFunc(ONE, ONE)` (echte additive) |
| Geen depth-test (additief = orderonafhankelijk) | `gl.disable(DEPTH_TEST); gl.depthMask(false)` |
| Fixed-point matrix-math (16.16) | Float32 mat4 helpers in `port.ts` |
| `cmatrix_yxz` + `csetmatrix` | `mat4Perspective × mat4Translate × mat4RotateY × mat4RotateX × mat4RotateZ` |
| `crotlist` + `cprojlist` (CPU-side transform + project) | vertex-shader doet alles met `u_mvp` |
| Mode-X polygon-fill `VIDTWE.ASM` | `gl.drawElements(TRIANGLES, ...)` met VAO |
| Palet-index → RGB | uniform `vec3 u_color` per draw-call (6 draws per frame) |
| Kleur-bit-codes (0x04/08/10/20/40/80) | RGB+CMY kleuren letterlijk overgenomen: `(1,0,0), (0,1,0), (0,0,1), (1,1,0), (0,1,1), (1,0,1)` |
| Backface-culling? Onbekend (asm) | Niet nodig — additief blending is orderonafhankelijk |

## Wat we **niet** doen (uit scope v0.2.0)

- Pixel-perfect VGA palet-OR reproduceren (alleen verschil bij overlappende pixels uit andere bron-bits zou afwijken — verwaarloosbaar)
- Mode-X 320×240 aspect met non-square pixels (we doen square pixels, resolutie-onafhankelijk)
- Originele edge-list voor hidden-edge tracking (we tekenen volle faces, edge-render volgt evt. in 0.2.x)
- Originele FOV-keuze (we gebruiken 60° en plaatsen de kubus op vergelijkbare schaal)
