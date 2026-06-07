# CLAUDE.md — DecompilingFutureCrew

Modern browser-reinterpretatie van Second Reality (Future Crew, 1993) vanuit de originele x86 asm / C / POV-Ray source. **Ecosysteem:** `Retro_Computing` (sub-master `Meta_Retro_Computing`).

## Sessie-startprotocol

1. Pull Meta_Master (`git -C /Users/christian/Documents/Gemini_Projects/Meta_Master pull`)
2. Pull deze repo (`git pull`)
3. Multi-Session Conflict Check (P-AGT-04)
4. Lees `BUILD_PLAN.md` voor huidige fase, `decomp/README.md` voor scene-status, `prompts/` voor laatste sessie

## Stack

- **TypeScript** strict + Vite + WebGL2 + WebAudio (geen framework — past bij low-level demoscene-stijl)
- **Build:** `npm run dev` / `npm run build` / `npm run preview`
- **Hosting:** GitHub Pages (primary, auto-deploy via Actions) + HC55 mirror onder `horsecloud55.ddns.net/SecondReality/`
- **Licentie:** AGPL-3.0 voor code in deze repo; source (Unlicense) staat los naast de repo onder `/Users/christian/Documents/Gemini_Projects/SecondReality_source`

## Repo-conventies

- **Engine** in `src/engine/` (timeline, renderer, audio, input)
- **Scenes** in `src/scenes/` (één file per scene, exporteren `SceneFn`)
- **Shaders** in `src/shaders/` (`.vert` / `.frag`, GLSL 300 es)
- **Decomp-doc per scene** in `decomp/<scene>/`:
  - `ASM_NOTES.md` — reverse-engineering uitleg op basis van source
  - `port.ts` — moderne TypeScript port (CPU-deel)
  - `port.vert` / `port.frag` — moderne GLSL
- **Source** wordt niet in deze repo opgenomen — clone los naast deze repo
- **Sessies** in `prompts/<NNN>_<onderwerp>.md` met verplichte frontmatter (`date/repo/status/resume`)

## Codenaam-thema

Future Crew leden. Per fase een hoofd-codenaam (zie `BUILD_PLAN.md`):

| Versie | Codenaam | Rol bij Future Crew |
|--|--|--|
| v0.0.x | **PSi** | Sami Tammilehto — lead coder |
| v0.1.x | **Marvel** | Petteri Kuittinen — coder |
| v0.2.x | **Trug** | Mikko Tukiainen |
| v0.3.x | **Pixel** | Tero Toropainen — graphics |
| v0.4.x | **Skaven** | Vesa Norilo — music |
| v0.5.x | **Purple Motion** | Jonne Valtonen — music |
| v0.6.x | **Yodel** | te verifiëren |
| v0.7.x | **Yost** | te verifiëren |

## Feature & Bugfix Protocol (Color-Coded)

**Nieuwe Feature:**
- **Groen:** Minor (code only, geen design/arch impact) → +0.0.1
- **Oranje:** Design impact (functioneel/technisch), logische arch stabiel → +0.1.0
- **Rood:** Major impact (redesign, meta-implicaties) → +1.0.0

**Bugfix:**
- **Groen:** Snel herstel (fysiek niveau)
- **Geel:** Out-of-physical-box (logische architectuur)
- **Rood:** Out-of-the-box (conceptueel redesign + Security Audit)
- **Loop:** Debug-loop — probeer een complete nieuwe invalshoek

**Root Cause Analysis (verplicht bij elke bugfix):** Functioneel + Technisch + Architectonisch.

## WhatIf Protocol

Voor elke niet-triviale wijziging: Stap 1 begrip terugkoppelen → Stap 2 plan voorleggen → Stap 3 impactanalyse → Stap 4 akkoord vragen. Pas NA akkoord bouwen.

## Versioning Mandate

Elke functionele/technische wijziging → versie verhogen in `package.json` + `CHANGELOG.md` vóór build/commit. Versie + codenaam horen bij elkaar.

## Build & Testing Mandate

- Geen automatische build. Gebruiker initieert `npm run dev` of `npm run build`
- Bij UI-wijziging: na `npm run dev` zelf in browser openen en de scene daadwerkelijk afspelen (golden path + edge case)
- GitHub Pages deploy gebeurt automatisch op push naar `main` via `.github/workflows/pages.yml`

## Decompile-discipline

- Per ge-porte scene: één commit met (a) source-citaat in `ASM_NOTES.md`, (b) `port.ts/vert/frag`, (c) scene-registratie in `timeline`
- "Modern reinterpretatie" — niet pixel-perfect. Mag resolutie-onafhankelijk, mag 60fps, mag mobile-friendly afwijken van 1993-output
- Originele asm-citaten in `ASM_NOTES.md` als code-block, met file:line verwijzing naar de source-clone

## Mobile / Z Fold 6

- `index.html` gebruikt `100dvh` + `viewport-fit=cover` + `touch-action: none`
- Renderer is DPR-aware, capped op `min(devicePixelRatio, 2)`
- Tap = skip naar volgende scene; long-press in fase 1 = pause

## Over en uit (alias OEU)

1. Commit + push deze repo
2. Update `CHANGELOG.md` als nieuwe versie
3. Meta_Master: STATUS.md + claude_memory sync + RESUME-regenereren
4. Sessie-MD in `prompts/` op `status: done` (of `pending` met `resume:` ingevuld voor hervatting)
