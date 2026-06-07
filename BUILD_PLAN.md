# BUILD_PLAN — DecompilingFutureCrew

Roadmap per fase. Elke fase eindigt met committen + GitHub Pages deploy.

## Fase 0 — Skeleton (v0.0.1-PSi) ✓

- [x] Vite + TS + WebGL2 boot
- [x] Timeline-stub die scenes sequentieel afspeelt
- [x] Placeholder START + ALKU (fades, geen content)
- [x] Mobile-friendly canvas (DPR-aware, touch passthrough)
- [x] GitHub Pages auto-deploy via Actions
- [x] Decomp-doc structuur (`decomp/<scene>/ASM_NOTES.md` + `port.*`)

## Fase 1 — Renderer fundamenten (v0.1.0-Marvel) ✓ huidige

- [x] WebGL2 wrapper (program/shader caching, fullscreen-triangle VAO, Framebuffer helper)
- [x] DPR-aware canvas resize (al in 0.0.1) + pause/resume via Timeline
- [x] FPS-overlay (HUD met scene-naam + paused-indicator, toggle `H`)
- [x] Keyboard + touch input (tap=skip, long-press=pause, double-tap=back, kbd-mappings)
- [x] STARFIELD als eerste echte fragment-shader scene (vervangt placeholder)
- [ ] Fullscreen-API (F11 / `fullscreen` toggle) — uitgesteld naar 0.1.1 indien gewenst

## Fase 2 — Eerste hero-decompile: GLENZ (v0.2.0-Trug) ✓ huidige

- [x] `source/` clone bekeken: GLENZ-mesh + pipeline uit `MAINTRAN.C` geïdentificeerd
- [x] `decomp/glenz/ASM_NOTES.md` — palet-XOR-translucentie-truc uitgelegd, 1993→2026 mapping
- [x] `decomp/glenz/port.ts` — TypeScript port (8 verts, 6 faces RGB+CMY, mat4-helpers)
- [x] `decomp/glenz/port.vert` + `port.frag` — moderne GLSL (additive blending, depth-test off)
- [x] Scene `src/scenes/glenz.ts` geregistreerd in timeline (10s tussen STARFIELD en ALKU)
- [ ] *(Uit scope, voor 0.2.x)*: wireframe-edges, hidden-edge tracking, palet-OR pixel-perfect

## Fase 3 — Tweede hero-decompile: DOTS (v0.3.0-Pixel) ✓ huidige

- [x] Identificeer DOTS-routine in source (**niet tunnel/vortex** zoals gespeculeerd — 512 particles met physics in 4 fases)
- [x] Port naar instanced rendering (1 draw-call, 512 dots — niet 64k zoals gespeculeerd; origineel doet 512)
- [x] Decomp-note `decomp/dots/ASM_NOTES.md` met alle 4 fases beschreven (alleen 1+2 ge-port)
- [x] Scene `src/scenes/dots.ts` in timeline (12s tussen GLENZ en ALKU)
- [ ] *(Parkeren voor v0.3.x)*: fase 3 spiraal, fase 4 random scatter, trails, background-image

## Fase 4 — Audio (v0.4.0-Skaven) ✓ huidige

- [x] WebAudio AudioContext + master gain (via chiptune3-wrapper)
- [x] S3M-tracker player integratie — **chiptune3** (MIT) rond **libopenmpt** (BSD)
- [x] MUSIC0.S3M (originele Skaven/Purple Motion track) live afspelen op user-gesture
- [x] Mute-toggle (`M`-toets)
- [x] Pause-sync (timeline-pause → tracker-pause)
- [ ] *(v0.4.x)* Timeline-sync op tracker-positie
- [ ] *(v0.4.x)* Per-channel events naar shader-uniforms (reactive scenes)
- [ ] *(v0.4.x)* Volume-slider in HUD
- [ ] *(v0.4.x)* MUSIC1.S3M switcher

## Fase 5 — Volume-uitbreiding (v0.5.x-PurpleMotion) ✓ huidige (v0.5.0)

- [x] **TUNNELI** (v0.5.0) — niet een tunnel-fly-through maar een 3D pipe-snake; 80 ringen × 64 punten via vertex-shader Lissajous-path
- [ ] **WATER** (v0.5.1) — origineel = pre-rendered POV-Ray, dus tribute via fragment-shader water (raymarched of fbm-distorted)
- [ ] **LENS** (v0.5.2) — lens-zoom / fisheye distortie als post-effect
- [ ] **TWIST** (v0.5.3) — twist-warp transformatie
- [ ] **GRID** (v0.5.4) — grid-warp

## Fase 6 — End-game scenes (v0.6.x-Yodel / v0.7.x-Yost)

- [ ] 3DS (raytraced spheres — vervangen door PBR-WebGL approximatie)
- [ ] ENDPIC + ENDSCRL + CREDITS
- [ ] Volledige showcase-mode (alle scenes back-to-back, ~7 min)

## Out of scope (voorlopig)

- POV-Ray scenes pixel-for-pixel reproduceren (we benaderen, geen exacte match)
- Originele resolutie 320×200 / 320×400 fidelity (modern resolutie-onafhankelijk)
- Sound Blaster / Gravis Ultrasound HW-emulatie (we gebruiken WebAudio)
- DOS PMODE / DPMI nabouwen
