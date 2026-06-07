---
date: 2026-06-07
repo: DecompilingFutureCrew
status: open
resume: "verder met DecompilingFutureCrew — fase 1 v0.1.x-Marvel renderer-fundamenten (program/shader caching, framebuffer ping-pong, FPS-overlay, touch-controls); daarna fase 2 GLENZ decompile"
---

# 000 — WhatIf v0.0.1-PSi

**Datum:** 2026-06-07
**Trigger:** `newp "decompling the futurecew"` + source-link github.com/mtuomi/SecondReality
**Doel gebruiker:** browser-variant maken van de Second Reality x86-demo, met animatie en geluid.

## Vraag van gebruiker

> newp "decompling the futurecew". ik lever link naar source code jij gaat browser variant maken van x86 demos met animatie en geluid. https://github.com/mtuomi/SecondReality

## WhatIf-presentatie (samengevat)

**Context-research:**
- SecondReality repo = 65% x86 asm, 20% C, 9% POV-Ray SDL — DOS/Watcom/PMODE, Unlicense
- ~20+ scene-mappen (START, ALKU, 3DS, GLENZ, LENS, GRID, TWIST, WATER, TUNNELI, DOTS, DDSTARS, TECHNO, ENDPIC, CREDITS …)
- Past in bestaand ecosysteem **Retro_Computing** (sub-master `Meta_Retro_Computing`, "taal-runtimes + decompilatie")

**Route-keuze:** A (js-dos wrapper) / **B (hybride)** / **C (volledige rewrite)** / D (video+overlay)
**Stijl-keuze:** pixel-perfect vs **modern reinterpretatie**

## Beslissingen gebruiker

| Vraag | Antwoord |
|--|--|
| 1. Route | **C** — volledige rewrite in TypeScript+WebGL2+WebAudio |
| 2. Hosting | **3** — GitHub Pages primary + HC55 mirror |
| 3. Repo-naam | `DecompilingFutureCrew` (akkoord) |
| 4. Source-strategie | clone naast repo (`/Users/christian/Documents/Gemini_Projects/SecondReality_source`, read-only) |
| 5. Codenamen | Future Crew leden (akkoord) — v0.0.1-**PSi** |
| Stijl | **Modern reinterpretatie** (resolutie-onafhankelijk, 60fps, mobile-friendly) |

## Acties v0.0.1-PSi

1. Skeleton aangemaakt: Vite + TS + WebGL2 + WebAudio
2. Timeline + Renderer + Audio + Input stubs
3. Placeholder scenes START + ALKU (fade-color)
4. Decomp-doc structuur (`decomp/README.md` + `decomp/glenz/` als eerste hero target)
5. AGPL-3.0 LICENSE (volledige tekst)
6. GitHub Pages workflow (`.github/workflows/pages.yml`)
7. SecondReality source clone (naast repo)
8. Git init + commit + push naar `cpaglebbeek/DecompilingFutureCrew` PUBLIC
9. Meta_Master: PROJECTS.json entry onder Retro_Computing, STATUS.md, memory-file

## Volgende sessie

- Fase 1 (v0.1.x-Marvel): renderer-fundamenten — program/shader caching, framebuffer ping-pong, FPS-overlay, touch-controls
- Fase 2 (v0.2.x-Trug): eerste echte decompile — GLENZ
