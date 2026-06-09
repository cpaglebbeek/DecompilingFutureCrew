# Changelog

Codenamen = Future Crew leden.

## [0.6.1-Yodel] — 2026-06-09

**Deep-debug GLENZ** — vier defecten t.o.v. het origineel (YouTube-referentie 1:46–2:33) verholpen. **Gele bugfix** (out-of-physical-box): de display-mapping-laag met fudge-constanten (`POS_DIV`/`CAM_BASE`/`OBJ_SCALE`/`SCALE_REF`/`Y_OFFSET`/`FX`/`FY`/`Z_MIN`) is vervangen door **faithful world-units + de echte projectie-constanten** — een logische-architectuur-correctie, geen fysiek lapje.

### Root Cause Analysis
- **Functioneel:** kleuren waren een RGB/CMY-regenboog; het schaakbord (glenz-transparantie) ontbrak; geluid liep vóór op de muziek; het 2e object dreef weg i.p.v. concentrisch genest te blijven.
- **Technisch:** (1) `GROUP_COLOR` regenboog i.p.v. de violette `backpal` + `test bp,2`-tintsplitsing uit `VEC.ASM demo_glz`; (2) additieve smooth-fill zonder de canonieke 50%-stipple; (3) visuele klok-epoch gezet bij `AudioContext`-creatie (vóór WASM-init + S3M-load) → visuals racen vooruit; (4) beide objecten genormaliseerd op kubus=1.0 + losse fudge-schalingen → echte grootteverhouding verbroken → drift.
- **Architectonisch:** de reconstructie projecteerde in een verzonnen view-ruimte i.p.v. de bron-coördinatenruimte; daardoor moest elke plaatsing met de hand bijgesteld worden en klopte de objectrelatie nooit structureel.

### Gewijzigd
- **`glenz_data.ts`**: `OBJECT_A = buildVerts(5000, 8500)`, `OBJECT_B = buildVerts(5940, 10395)` (echte world-units uit `MAIN.C` ZZZ=50/QQQ=99); per-`Tri` `code` (epolys `0x4002+2*i`, epolysb `0x4004/0x4002` tegenfase); `GROUP_COLOR`-regenboog vervangen door `GLENZ_TINT_BLUE`/`GLENZ_TINT_WHITE` + `tintForCode(code&2)` (violet glas vs witte highlight, conform `backpal`/`demo_glz`)
- **`glenz_renderer.ts`**: faithful projectie `sx = X*256/Z + 160`, `sy = Y*213/Z + 130`, Z-clamp 128 (constanten i.p.v. `FX`/`FY`/`Z_MIN`); tint per `code&2`; **50% screen-aligned schaakbord-stipple** `((x+parity)&1)` met helderheids-boost ×1.8
- **`glenz_core.ts`**: faithful transforms — `scale*64/32768` (`VEC.ASM rotlist`), translatie naar world `(oxp, ypos+1500+oyp, ozp)` met `camDist = 7500`; alle fudge-constanten verwijderd
- **`audio_sync.ts`**: visuele klok-epoch + `clockStarted` pas gezet in `onInitialized` (bij `load()`), niet bij `ctx`-creatie; `currentTime()` geeft 0 tot de module geladen is → visuals wachten op frame 0 tot de muziek echt klinkt (faithful aan `while(dis_musplus()<-19); dis_setmframe(0)`)

### Verifieerd
- `tsc -b` schoon; geen overgebleven verwijzingen naar verwijderde fudge-constanten
- **Headless Playwright (echte browser)**: 0 page-errors; geen 404 op assets (S3M + chiptune3 + libopenmpt 200); `mframe` loopt pas op ná worklet-init (audio-gate bewezen)
- **Visueel bevestigd** via screenshots: violet/wit glas met zichtbaar schaakbord (mframe 352/636); beide objecten concentrisch genest zonder drift, B omsluit A (mframe 1019)
- **Te bevestigen tegen video:** de schaakbord-interpretatie (canonieke glenz-transparantie-stipple) — headless niet met zekerheid te toetsen

## [0.6.0-Yodel] — 2026-06-09

Nieuw **standalone GLENZ-subsysteem** (`glenz/`): een browser-native *semantische* reconstructie van GLENZ.EXE — de translucente roterende glenz-vector die van bovenaf invalt en bij inslag squasht, op de echte `MUSIC0.S3M` (Skaven). Oranje bump (+0.1.0 — nieuw subsysteem met design-impact; bestaande WebGL-demo blijft ongemoeid).

### Waarom een apart subsysteem, geen scene in de WebGL-timeline
De gevraagde aanpak (YAML-spec: Canvas-2D software-rasteriser + indexed 320×200 framebuffer + DIS-shim + audio-locked clock) is een **semantische port van `MAIN.C`/`VEC.ASM`**, een andere stack dan de WebGL2-scenes. Daarom als losse Vite multi-page app onder `glenz/`, met eigen entry, naast de bestaande demo.

### Toegevoegd
- **`glenz/src/glenz_data.ts`**: object-verts/tris (kubus + 6 as-tip-piramides = spiked glenz, 24 tris in 6 kleurgroepen), `sin1024`-tabel (amplitude 256), projectie-constanten (213/256 VGA-aspect), R/G/B/Y/C/M groepskleuren, OBJECT_A/B
- **`glenz/src/vga.ts`**: mode-13h-model — indexed `Uint8Array(320×200)` + 6-bit palette + additieve RGBA-presentatie, nearest-neighbour pixelated blit
- **`glenz/src/glenz_renderer.ts`**: software-rasteriser — rotate/scale (R=Ry·Rx·Rz) + perspectief-projectie + additieve scanline triangle-fill, geen back-face cull (beide glaszijden tonen), facing-shading `|n·view|`
- **`glenz/src/dis_shim.ts`**: DIS-stand-in — music-frame uit de audio-clock, non-blocking `waitb`, copper-callback-slot
- **`glenz/src/audio_sync.ts`**: chiptune3 + libopenmpt playback; `AudioContext.currentTime` als master-clock (visuals audio-locked, nooit desync)
- **`glenz/src/glenz_core.ts`**: sim-port van `MAIN.C:273-648` — rotatie (rx+=32/ry+=7), drop/bounce/jello-fysica (ypos −9000 → bounce → settle −2800), scale-puls, tweede pointier glenz fade-in vanaf frame 800, secundaire beweging via `sin1024`, naadloze sequence-loop
- **`glenz/src/main.ts`**: wiring + rAF-loop + input (start/pause/restart/mute/HUD) + DPR-aware pixelated canvas
- **`glenz/index.html`** + **`glenz/README.md`** (run-instructies + lijst van geapproximeerde routines)

### Gewijzigd
- `vite.config.ts`: rollup multi-page input (`main` + `glenz`)
- `tsconfig.json`: include `glenz/src`

### Verifieerd
- `tsc -b` schoon; `npm run build` groen (28 modules, `glenz` chunk 9.61 KB / 4.13 KB gzip)
- **Headless Playwright smoke-test (echte browser)**: 0 console/page-errors; HUD telt `mframe` op exact 70 Hz uit de audio-clock (audio-locked bewezen); ~31% niet-zwarte pixels met `maxLum 765` (verzadigde additieve overlap = glenz-translucentie werkt); 60 fps
- **Visueel bevestigd** via screenshots: drop-in van bovenaf (mframe 125) + gecentreerde gesettelde spiked glenz (mframe 768) met doorkijk door beide glasschillen, alle 6 as-piramides zichtbaar
- `Y_OFFSET` live-getuned (1500→2300) zodat gesettelde object centreert

### Buiten scope (fase 2)
FC-logo intro (`zoomer`/`zoomer2`), DOS palette-fades, music-cue-sync — achtergrond blijft zwart.

## [0.5.1-PurpleMotion] — 2026-06-07

Vijfde scene: **WATER** (tribute via fragment-shader). Patch-level bump (Groen — alleen toevoegen, geen design-impact).

### Waarom dit een tribute is, geen exacte decompile
Origineel WATER (`SecondReality_source/WATER/`) is **pre-rendered POV-Ray** (1.x/2.x) + Pascal playback. De `.POV` scripts (AA, KK, FISH13) renderden vooraf alle scene-frames als bitmaps; Pascal deed dan water-bump op die plaatjes. Een runtime-procedureel original bestaat niet — daarom een fragment-shader hommage in de geest van het effect.

### Toegevoegd
- **`decomp/water/ASM_NOTES.md`**: source-stack-overzicht (Pascal + POV-Ray + LBM + asm routines), POV-Ray-snippet uit `AA.POV`, expliciete "tribute"-rationale, mapping naar moderne fragment-shader
- **`decomp/water/port.vert/frag`** + **`port.ts`** stub
- **`src/scenes/water.ts`**: fullscreen-quad fragment-shader met fbm-noise, caustic-light (`pow(sin(...), 4.0)`), onderwater-blauw mix, sin-glint specula, vignet
- `src/main.ts`: timeline = ... TUNNELI → **WATER (10s)** → ALKU

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 19 modules, **20.59 KB JS / 7.26 KB gzip**
- **Visuele verificatie pending**: bewegende onderwater-blauwe scene met heldere caustic-lichtbundels en spiculae

## [0.5.0-PurpleMotion] — 2026-06-07

Vierde scene: **TUNNELI** (pipe-snake). Begin van fase 5 scene-uitbreiding.

### Correctie op BUILD_PLAN.md
TUNNELI is **niet** een first-person tunnel-fly-through. Source-vondst in `TUNNELI/TUN10.PAS` toont een **3D pipe-snake** ("putki" = Fins voor pipe): 103 ringen langs een Lissajous-pad, elk met 64 punten, in Turbo Pascal + inline x86 asm (heel ander stack dan de C/asm van GLENZ/DOTS). Onze port reproduceert het pipe-snake-idee, niet de first-person-tunnel.

### Toegevoegd
- **`decomp/tunneli/ASM_NOTES.md`**: source-vondst, datastructuren (`putki`, `pcalc`, `sade`), palette-init (grayscale + neon-groene leading edge), render-pipeline van inline asm, mapping-tabel
- **`decomp/tunneli/port.ts`**: `buildTunneliVertices()` — 80 ringen × 64 punten = 5120 vertices (single VBO), elke vertex bevat alleen `(ringIdx, pointIdx)`
- **`decomp/tunneli/port.vert/frag`**: vertex-shader berekent path-positie (Lissajous-center + sin-modulated radius), fragment-shader doet grayscale + groene leading-edge fade
- **`src/scenes/tunneli.ts`**: single draw-call `gl.POINTS` van 5120 vertices, additive blending, depth-test off

### Gewijzigd
- `src/main.ts`: timeline = STARFIELD → GLENZ → DOTS → **TUNNELI (12s)** → ALKU
- `index.html`: HUD-versie-string v0.5.0-PurpleMotion

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 18 modules, **18.76 KB JS / 6.78 KB gzip** (cold-start budget 150 KB)
- `npm run dev`: `src/scenes/tunneli.ts` + `decomp/tunneli/port.ts` 200
- **Visuele verificatie pending**: golvende grayscale pipe met groene "kop" die door 3D-ruimte beweegt

### Volgende — fase 5 vervolg
- v0.5.1: WATER (tribute, want origineel = pre-rendered POV-Ray)
- v0.5.2: LENS (lens-zoom / fisheye)
- v0.5.3: TWIST (twist-warp)
- v0.5.4: GRID (grid-warp)

## [0.4.0-Skaven] — 2026-06-07

Fase 4 — **audio is live**. De originele Second Reality soundtrack speelt nu in de browser.

### Toegevoegd
- **`public/audio/MUSIC0.S3M`** (382 KB) — originele tracker-module "UnreaL ][ - The 2ND Reality" door **Skaven** (Vesa Norilo) en **Purple Motion** (Jonne Valtonen), uit `SecondReality_source/MAIN/`. Licentie: Unlicense (public domain via SecondReality repo).
- **`public/chiptune3/`** (chiptune3.js + chiptune3.worklet.js + libopenmpt.worklet.js + LICENSE) — chiptune3 v0.8.7 wrapper rond libopenmpt voor S3M-playback via AudioWorklet. chiptune3 = MIT, libopenmpt = BSD. Bestanden los in `public/` zodat de browser de worklet's relative `import './libopenmpt.worklet.js'` zelf kan resolven (Vite bundelt geen AudioWorklet-modules recursief).
- **`src/engine/audio.ts`** volledig herschreven: `resume()` doet lazy dynamic `import()` van chiptune3 (BASE_URL-aware), op `onInitialized` zet repeat-count -1 + volume 0.45 + start playback van MUSIC0.S3M
- **`src/engine/input.ts`**: `M` toggle mute (kbd only voor v0.4.0; touch-toggle volgt later)
- **`src/engine/hud.ts`**: `♪` indicator + `♪ muted` als mute aan
- **`src/main.ts`**: audio pause/unpause synct met timeline pause
- **`src/vite-env.d.ts`**: types voor `import.meta.env.BASE_URL`

### Niet (parkeren voor v0.4.x)
- Per-channel events naar shader-uniforms (drum-hit triggert scene-flash)
- Timeline-sync op tracker-positie i.p.v. wall clock
- Volume-slider in HUD (alleen mute-toggle voor nu)
- MUSIC1.S3M alternatief / track-switcher

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 16 modules, **16.40 KB JS / 6.26 KB gzip** (worklet + S3M lazy-loaded, niet in cold-start budget)
- `npm run dev`: alle endpoints 200 (chiptune3/*, audio/MUSIC0.S3M)
- **Visuele/auditieve verificatie pending — gebruiker:** browser openen, tap canvas → S3M speelt af in loop; HUD toont `♪` na metadata-load; `M`-toets toggleert mute → `♪ muted`; pause via long-press of Esc pauzeert ook tracker.

### Credits
- **Skaven** (Vesa Norilo) & **Purple Motion** (Jonne Valtonen) — muziek (1993)
- **Future Crew** — origineel, Unlicense
- **chiptune3** door DrSnuggles + **libopenmpt** door OpenMPT-team — playback (MIT/BSD)

## [0.3.0-Pixel] — 2026-06-07

Tweede hero-decompile: **DOTS** (fase 1+2 — Lissajous + cirkel-met-gravity).

### Toegevoegd
- **`decomp/dots/ASM_NOTES.md`**: source-vondst in `MAIN.C`, alle 4 fases beschreven met formules, teal-cyan palet-init uitgelegd, `depthtable1-4[]` LUT mapping naar fragment-shader
- **`decomp/dots/port.ts`**: `DotState` (x,y,z,yadd), `initDots()` (512 dots), `emitLissajous()` + `emitCircleWithGravity()` emitters, `stepDots()` physics, `syncPositionBuffer()` voor instance-buffer
- **`decomp/dots/port.vert`** + **`port.frag`**: instanced point-sprite shader met perspective-correcte `gl_PointSize` en depth-shading
- **`src/scenes/dots.ts`**: VAO met instance-attribuut `a_dotPos` (DYNAMIC) + `a_colorBucket` (STATIC), 1 `drawArraysInstanced(POINTS, 0, 1, 512)` call per frame, langzame y-rotatie voor parallax
- Teal-cyan kleur-palet uit `cols[]` in `MAIN.C:72-76` letterlijk overgenomen (4 buckets: zwart/donker-teal/medium-teal/helder-teal)

### Gewijzigd
- `src/main.ts`: timeline = STARFIELD (8s) → GLENZ (10s) → **DOTS (12s)** → ALKU (3s)
- `index.html`: HUD-versie-string v0.3.0-Pixel

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 15 modules, **14.55 KB JS / 5.46 KB gzip** (cold-start budget 150 KB ruim onder)
- `npm run dev`: `src/scenes/dots.ts`, `decomp/dots/port.ts`, `src/main.ts` allen 200
- **Visuele verificatie pending**: 512 teal-cyan dots in Lissajous 3D-figuur (5s) → cirkel-formatie met opwaartse impuls en gravity-val (7s)

### Niet (parkeren voor v0.3.x)
- Fase 3 (spiraal, frame 900-1700)
- Fase 4 (random scatter, frame 1700-2360)
- Trails (per dot 4 vorige posities, vereist 4 extra instance-attribs + 4 extra draws)
- Palet-fade tussenscenes (overgang via timeline-fade is genoeg)
- Background-image compositing

## [0.2.0-Trug] — 2026-06-07

Eerste echte decompile-port: **GLENZ**.

### Toegevoegd
- **`decomp/glenz/ASM_NOTES.md`** (volledig): source-vondst in `SecondReality_source/GLENZ/MAINTRAN.C`, mesh-data (8v/12e/6f), palet-XOR-translucentie-truc uitgelegd, 1993→2026 mapping-tabel
- **`decomp/glenz/port.ts`**: vertex-data + GLENZ_FACES (6 faces met RGB+CMY kleuren letterlijk uit `0x04/08/10/20/40/80` palet-bit-codes) + mat4-helpers (perspective/translate/rotateX/Y/Z/multiply, geen extern dep)
- **`decomp/glenz/port.vert`** + **`port.frag`**: MVP + emissive `u_color × u_alpha`
- **`src/scenes/glenz.ts`**: VAO + indexed draw, 6 draw-calls (één per face-kleur), additive blending `gl.blendFunc(ONE, ONE)`, depth-test uit
- Rotatie: `ry≈0.855 rad/s, rz≈1.344 rad/s` — herrekening van 1993 `ry+=7, rz+=11` per frame @ 70Hz in tenths-of-degree

### Gewijzigd
- `src/main.ts`: GLENZ-scene tussen STARFIELD en ALKU; ALKU verkort van 4s naar 3s
- `index.html`: HUD-tekst versie-string `v0.2.0-Trug`

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build`: 13 modules, **11.13 KB JS / 4.47 KB gzip** (cold-start budget 150 KB)
- `npm run dev`: `src/scenes/glenz.ts`, `decomp/glenz/port.ts`, `src/main.ts` allen 200
- **Visuele verificatie pending**: kleurige roterende kubus met additieve face-mixing (gebruiker checkt)

### Niet (uit scope v0.2.0)
- Pixel-perfect VGA palet-OR reproduceren (modern reinterpretatie via echte WebGL2 blending)
- Mode-X 320×240 non-square pixels
- Hidden-edge tracking (volgt eventueel in 0.2.x als wireframe-overlay)

## [0.1.0-Marvel] — 2026-06-07

Renderer-fundamenten + eerste echte scene. Bumpt naar 0.1.0 (Oranje — design-impact: scene-API stabiliseert rondom program-cache + fullscreen-quad helper).

### Toegevoegd
- **Renderer-wrapper:** program/shader-cache (key-based), `drawFullscreen()` met cached fullscreen-triangle VAO, `Framebuffer` helper voor toekomstige post-processing
- **HUD** (`src/engine/hud.ts`): DOM-overlay met FPS-teller + actieve scene-naam + paused-indicator, toggle met `H`
- **Input upgrade:** long-press (≥500ms) = pause, double-tap (≤280ms) = vorige scene, `Esc`/`Space` = pause, `→`/`Enter` = skip, `←` = back, `H` = HUD toggle
- **Timeline:** `paused` state + `back()` + `togglePause()`, scene-naam exposed via `currentName`
- **STARFIELD scene** (`src/scenes/starfield.ts`): procedural fragment-shader, drie parallax-lagen sterren met twinkle + vignet — vervangt placeholder `start.ts`
- **package-lock.json** + 11 deps geïnstalleerd (vite 5.4.21, typescript 5.6, esbuild, rollup, ...)

### Gewijzigd
- `main.ts`: registreert HUD, koppelt nieuwe input-callbacks aan timeline
- `src/scenes/start.ts` verwijderd (vervangen door STARFIELD)

### Verifieerd
- `npx tsc --noEmit` schoon
- `npm run build` slaagt — 11 modules, **8.34 KB JS / 3.49 KB gzip** (ruim onder 150 KB cold-start-budget)
- `npm run dev` op http://localhost:5173/DecompilingFutureCrew/ serveert HTML + alle module-endpoints met 200
- **Visuele verificatie pending**: GLSL-shader-correctheid niet getest in echte browser — actie voor gebruiker

## [0.0.1-PSi] — 2026-06-07

Skeleton.

### Toegevoegd
- Vite + TypeScript + WebGL2 project-skeleton
- Timeline-stub (`src/engine/timeline.ts`) die scenes sequentieel afspeelt
- Renderer-stub (`src/engine/renderer.ts`) — WebGL2 context, clear-color, DPR-aware resize
- Audio-stub (`src/engine/audio.ts`) — AudioContext placeholder (geen tracker yet)
- Input-stub (`src/engine/input.ts`) — keyboard + touch
- Placeholder scenes: `start`, `alku` (gekleurde fades)
- Decomp-doc structuur: `decomp/<scene>/ASM_NOTES.md` + `port.ts` + `port.vert/frag`
- Eerste decomp-target stub: `decomp/glenz/` (leeg, fase 2)
- GitHub Pages workflow (`.github/workflows/pages.yml`)
- AGPL-3.0 LICENSE (volledige GNU-tekst, te toe te voegen bij volgende commit)
- Source-clone instructies in `source/NOTE.md`
- Sessie-transcriptie `prompts/000_whatif.md` (deze WhatIf-rondes)

### Bekend / open
- LICENSE bevat nu placeholder — volledige AGPL-3.0 tekst nog niet ingeplakt (todo eerste fase 1 commit)
- Codenamen Yodel / Yost te verifiëren tegen Future Crew bronnen
