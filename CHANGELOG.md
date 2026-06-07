# Changelog

Codenamen = Future Crew leden.

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
