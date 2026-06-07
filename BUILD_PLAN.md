# BUILD_PLAN — DecompilingFutureCrew

Roadmap per fase. Elke fase eindigt met committen + GitHub Pages deploy.

## Fase 0 — Skeleton (v0.0.1-PSi) ✓ huidige

- [x] Vite + TS + WebGL2 boot
- [x] Timeline-stub die scenes sequentieel afspeelt
- [x] Placeholder START + ALKU (fades, geen content)
- [x] Mobile-friendly canvas (DPR-aware, touch passthrough)
- [x] GitHub Pages auto-deploy via Actions
- [x] Decomp-doc structuur (`decomp/<scene>/ASM_NOTES.md` + `port.*`)

## Fase 1 — Renderer fundamenten (v0.1.x-Marvel)

- [ ] WebGL2 wrapper (program/shader caching, vao helpers, framebuffer ping-pong)
- [ ] DPR-aware canvas resize, fullscreen, pause/resume
- [ ] FPS-overlay (toggle)
- [ ] Keyboard + touch input (tap = skip, hold = pause, double-tap = back)

## Fase 2 — Eerste hero-decompile: GLENZ (v0.2.x-Trug)

- [ ] `source/` clone bekeken: GLENZ-asm geïdentificeerd
- [ ] `decomp/glenz/ASM_NOTES.md` — wat doet het effect (translucent vector objects, BSP-sorteren of geen?)
- [ ] `decomp/glenz/port.ts` — TypeScript port (vertex-data, transformatie)
- [ ] `decomp/glenz/port.vert` + `port.frag` — moderne GLSL (additive blending, depth-test off)
- [ ] Scene registreerd in timeline

## Fase 3 — Tweede hero-decompile: DOTS / PLASMA (v0.3.x-Pixel)

- [ ] Identificeer DOTS-routine in source (dots-tunnel / dots-vortex)
- [ ] Port naar instanced rendering (1 draw call, ~64k dots)
- [ ] Decomp-note

## Fase 4 — Audio (v0.4.x-Skaven)

- [ ] WebAudio AudioContext + master gain
- [ ] S3M-tracker player integratie (libxmp-lite WASM of chiptune2.js)
- [ ] Sync timeline op tracker-positie (i.p.v. wall clock)
- [ ] Stuur per-scene events (channel triggers naar shader-uniforms voor reactive effects)

## Fase 5 — Volume-uitbreiding (v0.5.x-Purple Motion)

- [ ] TUNNELI (tunnel effect)
- [ ] LENS (lens-zoom / fisheye)
- [ ] WATER (water-bump)
- [ ] TWIST (twist transformatie)
- [ ] GRID (grid-warp)

## Fase 6 — End-game scenes (v0.6.x-Yodel / v0.7.x-Yost)

- [ ] 3DS (raytraced spheres — vervangen door PBR-WebGL approximatie)
- [ ] ENDPIC + ENDSCRL + CREDITS
- [ ] Volledige showcase-mode (alle scenes back-to-back, ~7 min)

## Out of scope (voorlopig)

- POV-Ray scenes pixel-for-pixel reproduceren (we benaderen, geen exacte match)
- Originele resolutie 320×200 / 320×400 fidelity (modern resolutie-onafhankelijk)
- Sound Blaster / Gravis Ultrasound HW-emulatie (we gebruiken WebAudio)
- DOS PMODE / DPMI nabouwen
